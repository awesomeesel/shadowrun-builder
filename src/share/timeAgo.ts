/** "just now", "5 min ago", "3 h ago", or the date. */
export function timeAgo(iso?: string, now = Date.now()): string {
  if (!iso) return 'never'
  const minutes = Math.round((now - Date.parse(iso)) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} h ago`
  return new Date(iso).toLocaleDateString()
}
