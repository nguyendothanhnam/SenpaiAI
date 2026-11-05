export function parseApiUrl(value: string | undefined) {
  if (!value) throw new Error('EXPO_PUBLIC_API_URL is required. See mobile/.env.example.')
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('EXPO_PUBLIC_API_URL must be an http(s) URL without credentials, query, or fragment.')
  }
  if (url.pathname.replace(/\/+$/, '') !== '/api') throw new Error('EXPO_PUBLIC_API_URL must end with /api.')
  return url.toString().replace(/\/+$/, '')
}

// Invalid/missing configuration is shown in the connectivity panel, not an import-time crash.
export const apiConfiguration = (() => {
  try {
    const url = parseApiUrl(process.env.EXPO_PUBLIC_API_URL)
    return { url, origin: new URL(url).origin, valid: true }
  } catch {
    return { url: '', origin: '', valid: false }
  }
})()
