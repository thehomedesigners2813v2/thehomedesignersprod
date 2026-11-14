export const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube'
export const INTRO_BUCKET = 'designer-intro-videos'
export const MAX_INTRO_BYTES = 30 * 1024 * 1024
export const MAX_INTRO_SECONDS = 60

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

export const youtubeJson = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

export const youtubeOptions = () => new Response(null, { status: 200, headers: corsHeaders })

export const youtubeCredentials = () => {
  const clientId = Deno.env.get('YOUTUBE_CLIENT_ID') || ''
  const clientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET') || ''
  return { clientId, clientSecret }
}

export const youtubeRedirectUri = () => {
  const configured = Deno.env.get('YOUTUBE_REDIRECT_URI')
  if (configured) return configured
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  return `${supabaseUrl}/functions/v1/youtube-oauth-callback`
}

const bytesToBase64Url = (bytes: Uint8Array) => {
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const base64UrlToBytes = (value: string) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

const hmacKey = async (secret: string) => crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(secret),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign', 'verify'],
)

export const signOAuthState = async (secret: string) => {
  const payload = JSON.stringify({ exp: Date.now() + 10 * 60 * 1000 })
  const payloadPart = bytesToBase64Url(new TextEncoder().encode(payload))
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), new TextEncoder().encode(payloadPart)))
  return `${payloadPart}.${bytesToBase64Url(signature)}`
}

export const verifyOAuthState = async (state: string, secret: string) => {
  const [payloadPart, signaturePart] = state.split('.')
  if (!payloadPart || !signaturePart) return false
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    base64UrlToBytes(signaturePart),
    new TextEncoder().encode(payloadPart),
  )
  if (!valid) return false
  const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadPart))) as { exp?: number }
  return typeof payload.exp === 'number' && payload.exp > Date.now()
}

export const googleAccessToken = async (refreshToken: string) => {
  const { clientId, clientSecret } = youtubeCredentials()
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const body = await response.json()
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description || 'The YouTube channel authorization has expired.')
  }
  return body.access_token as string
}

export const uploadPublicVideo = async (accessToken: string, file: Uint8Array, mimeType: string, title: string, description: string) => {
  const start = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Length': String(file.byteLength),
      'X-Upload-Content-Type': mimeType,
    },
    body: JSON.stringify({
      snippet: { title: title.slice(0, 100), description: description.slice(0, 5000), categoryId: '22' },
      status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
    }),
  })
  if (!start.ok) {
    const failure = await start.text()
    throw new Error(failure || 'YouTube did not accept the upload.')
  }
  const uploadUrl = start.headers.get('Location')
  if (!uploadUrl) throw new Error('YouTube did not return an upload location.')

  const uploaded = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': String(file.byteLength),
      'Content-Type': mimeType,
    },
    body: file,
  })
  const video = await uploaded.json()
  if (!uploaded.ok || !video.id) {
    throw new Error(video.error?.message || 'YouTube did not publish the video.')
  }
  return video.id as string
}

export const deleteYoutubeVideo = async (accessToken: string, videoId: string) => {
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(videoId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok && response.status !== 404) {
    const failure = await response.text()
    throw new Error(failure || 'The previous YouTube video could not be removed.')
  }
}

export const youtubeChannelLabel = async (accessToken: string) => {
  const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const body = await response.json()
  return body.items?.[0]?.snippet?.title as string | undefined
}
