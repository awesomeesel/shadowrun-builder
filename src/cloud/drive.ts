/** The small part of Google Drive the app uses. Kept as an interface so sync can be tested without Google. */
export interface DriveFile {
  id: string
  name: string
  size?: number
  modifiedTime?: string
  appProperties: Record<string, string>
}

export interface DriveUser {
  name: string
  email: string
  photo?: string
}

export interface Drive {
  about(): Promise<DriveUser>
  /** Id of a folder with this name (inside `parentId`), creating it if needed. */
  folder(name: string, parentId?: string): Promise<string>
  list(folderId: string): Promise<DriveFile[]>
  create(
    folderId: string,
    name: string,
    appProperties: Record<string, string>,
    content: Blob,
    onProgress?: (fraction: number) => void,
  ): Promise<DriveFile>
  update(id: string, name: string, appProperties: Record<string, string>, content: Blob): Promise<DriveFile>
  download(id: string, onProgress?: (fraction: number) => void): Promise<Blob>
  /** Move to the Drive trash, so it can still be recovered there. */
  trash(id: string): Promise<void>
}

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const FILE_FIELDS = 'id,name,size,modifiedTime,appProperties'

export class DriveError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** Drive REST API over fetch. `token` returns a valid access token or throws. */
export class GoogleDrive implements Drive {
  private token: () => Promise<string>
  constructor(token: () => Promise<string>) {
    this.token = token
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${await this.token()}` },
    })
    if (!response.ok) {
      let detail = response.statusText
      try {
        detail = (await response.json()).error?.message ?? detail
      } catch {
        // not JSON
      }
      throw new DriveError(`Google Drive: ${detail}`, response.status)
    }
    return response
  }

  private async json<T>(url: string, init?: RequestInit): Promise<T> {
    return (await this.request(url, init)).json() as Promise<T>
  }

  async about(): Promise<DriveUser> {
    const { user } = await this.json<{ user: { displayName: string; emailAddress: string; photoLink?: string } }>(
      `${API}/about?fields=user`,
    )
    return { name: user.displayName, email: user.emailAddress, photo: user.photoLink }
  }

  async folder(name: string, parentId?: string): Promise<string> {
    const q = [
      `name='${name.replace(/'/g, "\\'")}'`,
      `mimeType='${FOLDER_MIME}'`,
      'trashed=false',
      ...(parentId ? [`'${parentId}' in parents`] : []),
    ].join(' and ')
    const { files } = await this.json<{ files: { id: string }[] }>(
      `${API}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`,
    )
    if (files[0]) return files[0].id
    const created = await this.json<{ id: string }>(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }),
    })
    return created.id
  }

  async list(folderId: string): Promise<DriveFile[]> {
    const files: DriveFile[] = []
    let pageToken = ''
    do {
      const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`)
      const page = await this.json<{ files: RawFile[]; nextPageToken?: string }>(
        `${API}/files?q=${q}&fields=nextPageToken,files(${FILE_FIELDS})&pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`,
      )
      files.push(...page.files.map(toFile))
      pageToken = page.nextPageToken ?? ''
    } while (pageToken)
    return files
  }

  /** Resumable upload: works for large PDFs and reports progress. */
  async create(
    folderId: string,
    name: string,
    appProperties: Record<string, string>,
    content: Blob,
    onProgress?: (fraction: number) => void,
  ): Promise<DriveFile> {
    const session = await this.request(`${UPLOAD}/files?uploadType=resumable&fields=${FILE_FIELDS}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': content.type || 'application/octet-stream',
      },
      body: JSON.stringify({ name, parents: [folderId], appProperties }),
    })
    const location = session.headers.get('Location')
    if (!location) throw new DriveError('Google Drive did not return an upload address', 0)
    return toFile(await this.put(location, content, onProgress))
  }

  async update(id: string, name: string, appProperties: Record<string, string>, content: Blob): Promise<DriveFile> {
    const session = await this.request(`${UPLOAD}/files/${id}?uploadType=resumable&fields=${FILE_FIELDS}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': content.type || 'application/octet-stream',
      },
      body: JSON.stringify({ name, appProperties }),
    })
    const location = session.headers.get('Location')
    if (!location) throw new DriveError('Google Drive did not return an upload address', 0)
    return toFile(await this.put(location, content))
  }

  /** XMLHttpRequest instead of fetch, because only XHR reports upload progress. */
  private async put(url: string, content: Blob, onProgress?: (fraction: number) => void): Promise<RawFile> {
    const token = await this.token()
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', url)
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve(JSON.parse(xhr.responseText) as RawFile)
          : reject(new DriveError(`Google Drive upload failed (${xhr.status})`, xhr.status))
      xhr.onerror = () => reject(new DriveError('Network error while uploading to Google Drive', 0))
      xhr.send(content)
    })
  }

  async download(id: string, onProgress?: (fraction: number) => void): Promise<Blob> {
    const response = await this.request(`${API}/files/${id}?alt=media`)
    const total = Number(response.headers.get('Content-Length')) || 0
    if (!onProgress || !total || !response.body) return response.blob()
    // Stream so large PDFs can show progress.
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let received = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.length
      onProgress(received / total)
    }
    return new Blob(chunks as BlobPart[], { type: response.headers.get('Content-Type') ?? '' })
  }

  async trash(id: string): Promise<void> {
    await this.request(`${API}/files/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    })
  }
}

interface RawFile {
  id: string
  name: string
  size?: string
  modifiedTime?: string
  appProperties?: Record<string, string>
}

function toFile(raw: RawFile): DriveFile {
  return {
    id: raw.id,
    name: raw.name,
    size: raw.size ? Number(raw.size) : undefined,
    modifiedTime: raw.modifiedTime,
    appProperties: raw.appProperties ?? {},
  }
}
