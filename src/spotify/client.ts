import { withDeadline } from '../../shared/deadline'

const SESSION = 'hamava-spotify-session-v1'
const PENDING = 'hamava-spotify-pkce-v1'
const SCOPES = 'user-read-private user-read-playback-state user-modify-playback-state'
export interface SpotifyProfile {
  display_name?: string
  product?: string
}
export interface SpotifyTrack {
  id: string
  name: string
  duration_ms: number
  type: string
  is_local?: boolean
  artists: { name: string }[]
  album: { name: string; images: { url: string }[] }
  external_urls?: { spotify?: string }
}
export interface Playback {
  item: SpotifyTrack | null
  progress_ms: number | null
  is_playing: boolean
  currently_playing_type: string
  device?: { id?: string; is_restricted?: boolean; is_private_session?: boolean }
  actions?: { disallows?: Record<string, boolean> }
}
interface Tokens {
  access: string
  refresh: string
  expires: number
  clientId: string
}
interface Pending {
  verifier: string
  state: string
  created: number
  redirect: string
  clientId: string
}
export class SpotifyError extends Error {
  constructor(
    message: string,
    public status = 0,
    public retryAt = 0,
    public reason = '',
  ) {
    super(message)
  }
}
export function configuredClientId() {
  return String(import.meta.env.VITE_SPOTIFY_CLIENT_ID || '').trim()
}
export function validClientId(id: string) {
  return /^[a-f\d]{32}$/i.test(id)
}
const random = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('')
const base64url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
export async function authorizationUrl(clientId = configuredClientId()): Promise<string> {
  if (!validClientId(clientId))
    throw new Error('Spotify is not configured yet. Follow the setup steps in the project README.')
  if (location.protocol !== 'https:' && !['127.0.0.1', '[::1]'].includes(location.hostname))
    throw new Error(
      'Open Hamava over HTTPS, or use http://127.0.0.1:5173 locally. Spotify does not accept localhost.',
    )
  const verifier = random(),
    state = random(),
    redirect = `${location.origin}/spotify/callback`
  const challenge = base64url(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
  )
  // Short-lived transaction only; local storage also permits a same-browser callback in another tab.
  localStorage.setItem(
    PENDING,
    JSON.stringify({ verifier, state, created: Date.now(), redirect, clientId }),
  )
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirect,
    state,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    show_dialog: 'true',
  })
  return `https://accounts.spotify.com/authorize?${params}`
}
function storedTokens(): Tokens | null {
  try {
    const t = JSON.parse(sessionStorage.getItem(SESSION) || 'null')
    return t &&
      typeof t.access === 'string' &&
      typeof t.refresh === 'string' &&
      Number.isFinite(t.expires) &&
      validClientId(t.clientId)
      ? t
      : null
  } catch {
    return null
  }
}
let tokens: Tokens | null = null
let generation = 0
let refreshing: Promise<Tokens> | null = null
let callback: Promise<void> | null = null
let cooldown = 0
export function hasSession() {
  tokens ||= storedTokens()
  return !!tokens
}
export function disconnectSpotify() {
  generation++
  tokens = null
  refreshing = null
  callback = null
  cooldown = 0
  sessionStorage.removeItem(SESSION)
  localStorage.removeItem(PENDING)
}
async function tokenRequest(body: URLSearchParams, previous?: Tokens): Promise<Tokens> {
  const epoch = generation
  return withDeadline(
    async (signal) => {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      if (response.status === 429) {
        const raw = response.headers.get('Retry-After') || '60'
        const seconds = /^\d+$/.test(raw)
          ? Number(raw)
          : Math.max(1, (Date.parse(raw) - Date.now()) / 1000) || 60
        cooldown = Date.now() + Math.max(1, seconds) * 1000
        throw new SpotifyError(
          'Spotify is limiting login requests. Please wait before reconnecting.',
          429,
          cooldown,
        )
      }
      const data = await response.json()
      if (!response.ok)
        throw new SpotifyError(
          'Spotify login expired or could not finish. Please connect again.',
          response.status,
        )
      if (
        typeof data.access_token !== 'string' ||
        !(data.refresh_token || previous?.refresh) ||
        !Number.isFinite(data.expires_in) ||
        data.expires_in <= 0
      )
        throw new Error('Spotify returned an incomplete session. Please connect again.')
      if (epoch !== generation) throw new DOMException('Disconnected', 'AbortError')
      const next = {
        access: data.access_token,
        refresh: data.refresh_token || previous!.refresh,
        expires: Date.now() + data.expires_in * 1000,
        clientId: body.get('client_id')!,
      }
      sessionStorage.setItem(SESSION, JSON.stringify(next))
      tokens = next
      return next
    },
    new AbortController().signal,
    12000,
  )
}
export function finishSpotifyLogin(): Promise<void> {
  if (callback) return callback // React StrictMode must not redeem the same code twice.
  callback = (async () => {
    const params = new URLSearchParams(location.search)
    let pending: Pending | null = null
    try {
      pending = JSON.parse(localStorage.getItem(PENDING) || 'null')
    } catch {
      /* invalid transaction */
    }
    // Remove auth parameters before fetching any track, cover or external resource.
    history.replaceState(null, '', '/spotify')
    localStorage.removeItem(PENDING)
    if (
      !pending ||
      params.get('state') !== pending.state ||
      typeof pending.verifier !== 'string' ||
      !/^[a-f\d]{64}$/i.test(pending.verifier) ||
      !Number.isFinite(pending.created) ||
      Date.now() - pending.created > 600000 ||
      pending.created > Date.now() ||
      pending.redirect !== `${location.origin}/spotify/callback` ||
      !validClientId(pending.clientId)
    )
      throw new Error(
        'Login could not be verified. Open Hamava and connect again in this same browser. On iPhone, try signing in from Safari if the home-screen login opened a separate browser.',
      )
    if (params.has('error'))
      throw new Error(
        'Spotify permission was not granted. You can connect again whenever you’re ready.',
      )
    const code = params.get('code')
    if (!code) throw new Error('Spotify did not return a login code. Please connect again.')
    await tokenRequest(
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: pending.redirect,
        client_id: pending.clientId,
        code_verifier: pending.verifier,
      }),
    )
  })()
  return callback
}
async function access(force = false) {
  tokens ||= storedTokens()
  if (!tokens) throw new SpotifyError('Connect Spotify to continue.', 401)
  if (!force && tokens.expires > Date.now() + 30000) return tokens.access
  if (!refreshing) {
    const old = tokens
    refreshing = tokenRequest(
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: old.refresh,
        client_id: old.clientId,
      }),
      old,
    )
      .catch((error) => {
        if (error instanceof SpotifyError && [400, 401].includes(error.status)) disconnectSpotify()
        throw error
      })
      .finally(() => {
        refreshing = null
      })
  }
  return (await refreshing).access
}
export async function spotifyRequest<T>(
  path: string,
  signal: AbortSignal,
  method = 'GET',
  retry = true,
): Promise<T | null> {
  if (Date.now() < cooldown)
    throw new SpotifyError(
      'Spotify is limiting requests. Sync will retry after the wait.',
      429,
      cooldown,
    )
  const token = await access()
  signal.throwIfAborted()
  return withDeadline(
    async (signal) => {
      const response = await fetch(`https://api.spotify.com/v1${path}`, {
        method,
        signal,
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.status === 401 && retry) {
        await access(true)
        return spotifyRequest<T>(path, signal, method, false)
      }
      if (response.status === 204) return null
      let data: any = null
      try {
        data = await response.json()
      } catch {
        /* non-JSON gateway error */
      }
      if (!response.ok) {
        const reason = String(data?.error?.reason || '')
        if (response.status === 429) {
          const raw = response.headers.get('Retry-After') || '60'
          const seconds = /^\d+$/.test(raw)
            ? Number(raw)
            : Math.max(1, (Date.parse(raw) - Date.now()) / 1000) || 60
          cooldown = Date.now() + Math.max(1, seconds) * 1000
        }
        const message =
          reason === 'PREMIUM_REQUIRED'
            ? 'This feature needs Spotify Premium. Please sign in with a Premium account.'
            : response.status === 403
              ? 'Spotify denied access. Check that this account is authorized for Hamava and has Premium. Spotify may also restrict this device or action.'
              : response.status === 404
                ? 'No active Spotify device. Open Spotify and start playing a song.'
                : response.status === 429
                  ? 'Spotify is limiting requests. Sync will retry after the wait.'
                  : response.status === 401
                    ? 'Spotify login expired. Please connect again.'
                    : 'Spotify could not be reached. Check your connection and retry.'
        throw new SpotifyError(message, response.status, cooldown, reason)
      }
      return data as T
    },
    signal,
    10000,
  )
}
export function subscription(profile: SpotifyProfile) {
  return profile.product === 'premium'
    ? 'premium'
    : ['free', 'open'].includes(profile.product || '')
      ? 'free'
      : 'unknown'
}
