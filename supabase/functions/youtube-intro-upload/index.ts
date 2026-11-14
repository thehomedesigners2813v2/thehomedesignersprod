import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  INTRO_BUCKET,
  MAX_INTRO_BYTES,
  MAX_INTRO_SECONDS,
  deleteYoutubeVideo,
  googleAccessToken,
  signOAuthState,
  uploadPublicVideo,
  youtubeCredentials,
  youtubeJson,
  youtubeOptions,
  youtubeRedirectUri,
  YOUTUBE_SCOPE,
} from '../_shared/youtube.ts'

const allowedTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime'])

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return youtubeOptions()
  if (req.method !== 'POST') return youtubeJson({ error: 'Method not allowed' }, 405)

  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return youtubeJson({ error: 'Authentication required' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceKey) return youtubeJson({ error: 'Service unavailable' }, 503)

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: userData, error: userError } = await userClient.auth.getUser(token)
    if (userError || !userData.user) return youtubeJson({ error: 'Authentication required' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)
    const body = await req.json() as {
      action?: string
      storagePath?: string
      durationSeconds?: number
      mimeType?: string
    }

    if (body.action === 'status') {
      const { data } = await admin.from('youtube_channel_connection').select('channel_label, connected_at').eq('id', true).maybeSingle()
      return youtubeJson({ connected: Boolean(data), channelLabel: data?.channel_label || null })
    }

    if (body.action === 'connect') {
      const { data: adminUser } = await userClient.from('admin_users').select('id').eq('user_id', userData.user.id).eq('is_active', true).maybeSingle()
      if (!adminUser) return youtubeJson({ error: 'Admin access required' }, 403)
      const { clientId, clientSecret } = youtubeCredentials()
      if (!clientId || !clientSecret) return youtubeJson({ error: 'YouTube client credentials are not configured on the server.' }, 503)
      const state = await signOAuthState(clientSecret)
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      url.searchParams.set('client_id', clientId)
      url.searchParams.set('redirect_uri', youtubeRedirectUri())
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('access_type', 'offline')
      url.searchParams.set('prompt', 'consent')
      url.searchParams.set('scope', YOUTUBE_SCOPE)
      url.searchParams.set('login_hint', 'thehomedesigners2813@gmail.com')
      url.searchParams.set('state', state)
      return youtubeJson({ url: url.toString() })
    }

    const { data: designer, error: designerError } = await userClient.from('designers').select('id, name, intro_youtube_id').eq('user_id', userData.user.id).maybeSingle()
    if (designerError || !designer) return youtubeJson({ error: 'Designer access required' }, 403)

    const { data: connection } = await admin.from('youtube_channel_connection').select('refresh_token').eq('id', true).maybeSingle()
    if (!connection?.refresh_token) return youtubeJson({ error: 'The YouTube channel is not connected yet. An admin needs to connect thehomedesigners2813@gmail.com.' }, 503)

    const accessToken = await googleAccessToken(connection.refresh_token)

    if (body.action === 'remove') {
      if (designer.intro_youtube_id) await deleteYoutubeVideo(accessToken, designer.intro_youtube_id)
      const { error: clearError } = await admin.from('designers').update({ intro_youtube_id: null }).eq('id', designer.id)
      if (clearError) return youtubeJson({ error: 'The introduction could not be removed.' }, 500)
      return youtubeJson({ videoId: null })
    }

    const storagePath = body.storagePath || ''
    const duration = Number(body.durationSeconds)
    const mimeType = body.mimeType || ''
    if (!storagePath.startsWith(`${userData.user.id}/`) || storagePath.includes('..')) return youtubeJson({ error: 'Invalid video location' }, 400)
    if (!allowedTypes.has(mimeType)) return youtubeJson({ error: 'Use an MP4, WebM, or MOV video.' }, 400)
    if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_INTRO_SECONDS) return youtubeJson({ error: 'The introduction must be 1 minute or shorter.' }, 400)

    const downloaded = await admin.storage.from(INTRO_BUCKET).download(storagePath)
    if (downloaded.error || !downloaded.data) return youtubeJson({ error: 'The video file could not be read.' }, 400)
    const file = new Uint8Array(await downloaded.data.arrayBuffer())
    if (file.byteLength < 1 || file.byteLength > MAX_INTRO_BYTES) return youtubeJson({ error: 'The video must be smaller than 30 MB.' }, 400)

    const videoId = await uploadPublicVideo(
      accessToken,
      file,
      mimeType,
      `${designer.name} introduction`,
      `Introduction by ${designer.name} on The Home Designers.`,
    )
    const { error: saveError } = await admin.from('designers').update({ intro_youtube_id: videoId }).eq('id', designer.id)
    if (saveError) return youtubeJson({ error: 'The video was uploaded, but the profile could not be updated.' }, 500)

    if (designer.intro_youtube_id && designer.intro_youtube_id !== videoId) {
      try { await deleteYoutubeVideo(accessToken, designer.intro_youtube_id) } catch { /* keep the new video if the old one cannot be deleted */ }
    }
    await admin.storage.from(INTRO_BUCKET).remove([storagePath])
    return youtubeJson({ videoId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The introduction video could not be published.'
    return youtubeJson({ error: message }, 500)
  }
})
