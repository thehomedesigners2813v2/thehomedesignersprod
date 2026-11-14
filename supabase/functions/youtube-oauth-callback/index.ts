import { createClient } from 'npm:@supabase/supabase-js@2'
import { googleAccessToken, verifyOAuthState, youtubeChannelLabel, youtubeCredentials, youtubeRedirectUri } from '../_shared/youtube.ts'

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char))

const page = (title: string, message: string) => new Response(`<!doctype html><html><body style="font-family:sans-serif;padding:2rem"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></body></html>`, {
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
})

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')
  if (oauthError) return page('YouTube was not connected', 'The Google account did not grant access.')
  if (!code || !state) return page('YouTube was not connected', 'The connection response was incomplete.')

  const { clientId, clientSecret } = youtubeCredentials()
  if (!clientId || !clientSecret) return page('YouTube was not connected', 'YouTube client credentials are not configured.')
  if (!await verifyOAuthState(state, clientSecret)) return page('YouTube was not connected', 'The connection request expired. Start it again from Admin Integrations.')

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: youtubeRedirectUri(),
      grant_type: 'authorization_code',
    }),
  })
  const token = await tokenResponse.json()
  if (!tokenResponse.ok || !token.refresh_token) {
    return page('YouTube was not connected', 'Google did not return a refresh token. Start the connection again and accept the requested access.')
  }

  const accessToken = token.access_token || await googleAccessToken(token.refresh_token)
  const channelLabel = await youtubeChannelLabel(accessToken)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return page('YouTube was not connected', 'The server is missing its database credentials.')

  const admin = createClient(supabaseUrl, serviceKey)
  const { error } = await admin.from('youtube_channel_connection').upsert({
    id: true,
    refresh_token: token.refresh_token,
    channel_label: channelLabel || 'thehomedesigners2813@gmail.com',
    connected_at: new Date().toISOString(),
  })
  if (error) return page('YouTube was not connected', 'The channel authorization could not be saved.')
  return page('YouTube channel connected', `${channelLabel || 'The channel'} can now receive designer introduction videos. You can close this page.`)
})
