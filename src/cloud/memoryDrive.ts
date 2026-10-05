import type { Drive, DriveFile, DriveUser } from './drive'

/** In-memory Drive for tests: behaves like the real API for the calls the app makes. */
export class MemoryDrive implements Drive {
  files = new Map<string, DriveFile & { parent?: string; content: Blob; trashed: boolean; folder: boolean }>()
  private next = 1

  async about(): Promise<DriveUser> {
    return { name: 'Test Runner', email: 'runner@example.com' }
  }

  async folder(name: string, parentId?: string): Promise<string> {
    for (const f of this.files.values()) {
      if (f.folder && f.name === name && f.parent === parentId && !f.trashed) return f.id
    }
    const id = `folder${this.next++}`
    this.files.set(id, {
      id,
      name,
      parent: parentId,
      appProperties: {},
      content: new Blob(),
      trashed: false,
      folder: true,
    })
    return id
  }

  async list(folderId: string): Promise<DriveFile[]> {
    return [...this.files.values()]
      .filter((f) => f.parent === folderId && !f.trashed && !f.folder)
      .map(({ id, name, size, appProperties }) => ({ id, name, size, appProperties: { ...appProperties } }))
  }

  async create(folderId: string, name: string, appProperties: Record<string, string>, content: Blob) {
    const id = `file${this.next++}`
    const file = {
      id,
      name,
      parent: folderId,
      appProperties: { ...appProperties },
      content,
      size: content.size,
      trashed: false,
      folder: false,
    }
    this.files.set(id, file)
    return { id, name, size: content.size, appProperties: { ...appProperties } }
  }

  async update(id: string, name: string, appProperties: Record<string, string>, content: Blob) {
    const file = this.files.get(id)
    if (!file) throw new Error(`No file ${id}`)
    Object.assign(file, {
      name,
      appProperties: { ...file.appProperties, ...appProperties },
      content,
      size: content.size,
    })
    return { id, name, size: content.size, appProperties: { ...file.appProperties } }
  }

  async download(id: string): Promise<Blob> {
    const file = this.files.get(id)
    if (!file) throw new Error(`No file ${id}`)
    return file.content
  }

  async trash(id: string): Promise<void> {
    const file = this.files.get(id)
    if (file) file.trashed = true
  }
}
