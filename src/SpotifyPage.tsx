import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ExternalLink, RefreshCw, LogOut, LoaderCircle } from 'lucide-react'
import { Brand } from './components/Brand'
import { ThemeToggle } from './components/ThemeToggle'
import { UpdateCheck } from './components/AppUpdates'
import { LyricsPlayer } from './components/LyricsPlayer'
import { ModelDownload, useModelDownload } from './components/ModelDownload'
import { PlainReader } from './spotify/PlainReader'
import {
  authorizationUrl,
  configuredClientId,
  validClientId,
  finishSpotifyLogin,
  hasSession,
  disconnectSpotify,
  spotifyRequest,
  subscription,
  type SpotifyProfile,
} from './spotify/client'
import { usePlayback } from './spotify/usePlayback'
import { convertChoice, type ConvertedLyric } from './spotify/lyrics'
import { api } from './search/client'
import { formatTime } from './lib/timeline'
import type { LyricMatches, LyricChoice } from '../shared/spotify'
import './search/search.css'
import './spotify/spotify.css'

const arrivedFromSpotify = location.pathname === '/spotify/callback'
export default function SpotifyPage() {
  const [session, setSession] = useState(hasSession)
  const [profile, setProfile] = useState<SpotifyProfile | null>(null)
  const [authBusy, setAuthBusy] = useState(arrivedFromSpotify || session)
  const [authError, setAuthError] = useState('')
  const [authRetry, setAuthRetry] = useState(0)
  const [matches, setMatches] = useState<{ trackId: string; data: LyricMatches } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [matching, setMatching] = useState(false)
  const [matchError, setMatchError] = useState('')
  const [matchRetry, setMatchRetry] = useState(0)
  const [alternatives, setAlternatives] = useState(false)
  const [reading, setReading] = useState<{ key: string; rows: ConvertedLyric[] } | null>(null)
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState('')
  const [convertRetry, setConvertRetry] = useState(0)
  const [status, setStatus] = useState('')
  const choicesCache = useRef(new Map<string, LyricMatches>())
  const convertedCache = useRef(new Map<string, ConvertedLyric[]>())
  const overrides = useRef(new Map<string, string>())
  const download = useModelDownload()
  const plan = profile ? subscription(profile) : null
  const playback = usePlayback(!!profile && plan !== 'free' && session)
  const track = playback.state?.item
  const trackId = track?.id || ''
  const choices = matches?.trackId === trackId ? matches.data.choices : []
  const choice = choices.find((c) => c.id === selected)
  const key = choice && track ? `${track.id}:${choice.id}` : ''
  const rows = reading?.key === key ? reading.rows : []

  useEffect(() => {
    let alive = true
    const controller = new AbortController()
    void (async () => {
      setAuthError('')
      try {
        if (arrivedFromSpotify) await finishSpotifyLogin()
        if (!hasSession()) {
          if (alive) setAuthBusy(false)
          return
        }
        const p = await spotifyRequest<SpotifyProfile>('/me', controller.signal)
        if (!p) throw new Error('Spotify did not return your account. Please connect again.')
        if (alive) {
          setSession(true)
          setProfile(p)
        }
      } catch (e) {
        if (alive) setAuthError(e instanceof Error ? e.message : 'Spotify login failed.')
      } finally {
        if (alive) setAuthBusy(false)
      }
    })()
    return () => {
      alive = false
      controller.abort()
    }
  }, [authRetry])

  useEffect(() => {
    const controller = new AbortController()
    setMatches(null)
    setSelected(null)
    setAlternatives(false)
    setMatchError('')
    setMatching(false)
    if (!track) return
    const captured = track
    const fetchMatches = async () => {
      setMatching(true)
      try {
        let result = matchRetry ? undefined : choicesCache.current.get(captured.id)
        if (!result) {
          result = await api<LyricMatches>(
            `/api/spotify-lyrics?${new URLSearchParams({
              title: captured.name,
              artist: captured.artists.map((a) => a.name).join(', '),
              album: captured.album.name,
              durationMs: String(captured.duration_ms),
            })}`,
            controller.signal,
          )
          if (controller.signal.aborted) return
          if (result.choices.length && !result.notice) {
            if (choicesCache.current.size >= 20)
              choicesCache.current.delete(choicesCache.current.keys().next().value!)
            choicesCache.current.set(captured.id, result)
          }
        }
        if (controller.signal.aborted) return
        setMatches({ trackId: captured.id, data: result })
        const preferred = overrides.current.get(captured.id)
        const initial =
          result.choices.find((c) => c.id === preferred) || result.choices.find((c) => c.closeMatch)
        setSelected(initial?.id || null)
        if (!initial && result.choices.length) setAlternatives(true)
      } catch (e) {
        if (!controller.signal.aborted) {
          setMatchError(e instanceof Error ? e.message : 'Lyrics could not load.')
          window.dispatchEvent(new Event('hamava:check-lyrics'))
        }
      } finally {
        if (!controller.signal.aborted) setMatching(false)
      }
    }
    void fetchMatches()
    return () => controller.abort()
    // Polling changes progress, not the recording identity.
  }, [trackId, matchRetry])

  useEffect(() => {
    const controller = new AbortController()
    setReading(null)
    setConvertError('')
    setStatus('')
    setConverting(false)
    download.reset()
    if (!choice || !key) return
    const cacheKey = JSON.stringify([choice.id, choice.text, choice.timedLines])
    const cached = convertedCache.current.get(cacheKey)
    if (cached && !convertRetry) {
      setReading({ key, rows: cached })
      return
    }
    setConverting(true)
    setStatus('Preparing Finglish on your device…')
    void convertChoice(
      choice,
      controller.signal,
      (rows) => {
        if (!controller.signal.aborted) setReading({ key, rows })
      },
      (event) => {
        if (controller.signal.aborted) return
        download.update(event)
        if (event.type === 'ready') setStatus('Reading the lyrics…')
      },
    )
      .then((rows) => {
        if (controller.signal.aborted) return
        if (!rows.some((r) => r.error)) {
          if (convertedCache.current.size >= 12)
            convertedCache.current.delete(convertedCache.current.keys().next().value!)
          convertedCache.current.set(cacheKey, rows)
        }
        setStatus(
          rows.some((r) => r.error) ? 'Some lines remain in Persian. You can retry them.' : '',
        )
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setConvertError(e instanceof Error ? e.message : 'Finglish could not load.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setConverting(false)
      })
    return () => controller.abort()
  }, [key, choice, convertRetry])

  async function connect() {
    setAuthBusy(true)
    setAuthError('')
    try {
      location.assign(await authorizationUrl())
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Login could not start.')
      setAuthBusy(false)
    }
  }
  function logout() {
    disconnectSpotify()
    setSession(false)
    setProfile(null)
    setAuthError('')
    setAuthBusy(false)
    setMatches(null)
    setReading(null)
    overrides.current.clear()
    choicesCache.current.clear()
    convertedCache.current.clear()
  }
  const configured = validClientId(configuredClientId())
  return (
    <div className="app spotify-page">
      <a className="skip-link" href="#route-title">
        Skip to content
      </a>
      <header className="site-header">
        <Brand />
        <ThemeToggle />
      </header>
      <main className="main-shell">
        <a className="back-link" href="/">
          <ArrowLeft size={16} /> Home
        </a>
        <header className="spotify-heading">
          <div>
            <span className="eyebrow">LISTEN & FOLLOW</span>
            <h1 id="route-title">Spotify sync</h1>
          </div>
          {profile && (
            <button className="spotify-secondary" onClick={logout}>
              <LogOut size={17} /> Disconnect
            </button>
          )}
        </header>
        {!profile && (
          <section className="spotify-connect">
            <img src="/spotify-icon-black.png" width="48" height="48" alt="Spotify" />
            <h2>Your music. Your place in the lyrics.</h2>
            <p>
              Sign in with Spotify, then play a song in Spotify. Hamava follows its lyrics here.
            </p>
            <p className="spotify-muted">
              Use Google, Apple, email, or any other sign-in option offered on Spotify’s login page.
              Hamava never asks for your password.
            </p>
            {!configured && (
              <p role="status">Spotify connection is awaiting setup by the app owner.</p>
            )}
            <button
              className="spotify-login"
              disabled={!configured || authBusy}
              onClick={() => void connect()}
            >
              {authBusy ? 'Connecting…' : 'Connect Spotify'}
            </button>
            <small>Spotify Premium required. Music keeps playing in Spotify.</small>
          </section>
        )}
        {authError && (
          <div className="search-error" role="alert">
            <p>{authError}</p>
            {session && (
              <button
                onClick={() => {
                  setAuthBusy(true)
                  setAuthRetry((n) => n + 1)
                }}
              >
                Retry connection
              </button>
            )}
            <button
              onClick={() => {
                logout()
                void connect()
              }}
            >
              Sign in again
            </button>
          </div>
        )}
        {profile && (
          <p className="spotify-account">
            Connected as {profile.display_name || 'Spotify listener'}
            {plan === 'premium' ? ' · Premium' : ''}
          </p>
        )}
        {(plan === 'free' || playback.premiumRequired) && (
          <div className="search-error" role="alert">
            <p>
              {plan === 'free'
                ? 'This is a Free account. Please sign in with a Premium account.'
                : 'Spotify requires Premium for this feature. Please sign in with a Premium account.'}
            </p>
            <button
              onClick={() => {
                logout()
                void connect()
              }}
            >
              Switch Spotify account
            </button>
          </div>
        )}
        {profile && plan === 'unknown' && (
          <p className="spotify-muted">
            Spotify isn’t sharing your subscription status. Sync requires a Premium account.
          </p>
        )}
        {profile && plan !== 'free' && (
          <>
            {playback.error && (
              <div className="search-error" role="alert">
                <p>{playback.error}</p>
                <button onClick={playback.retry}>Retry Spotify</button>
                {playback.fatal && (
                  <button
                    onClick={() => {
                      logout()
                      void connect()
                    }}
                  >
                    Sign in again
                  </button>
                )}
              </div>
            )}
            {!track && !playback.error && (
              <section className="spotify-empty">
                <h2>Ready when you are.</h2>
                <p>Open Spotify and play a song, then return here.</p>
                <a href="https://open.spotify.com" target="_blank" rel="noreferrer">
                  Open Spotify <ExternalLink size={16} />
                </a>
                <button onClick={playback.refresh}>
                  <RefreshCw size={16} /> Check again
                </button>
              </section>
            )}
            {track && (
              <>
                <section className="spotify-now" aria-label="Current Spotify song">
                  <img
                    src={track.album.images[0]?.url || '/hamava-mark.png'}
                    alt="Album cover"
                    width="64"
                    height="64"
                  />
                  <div>
                    <strong>{track.name}</strong>
                    <span>
                      {track.artists.map((a) => a.name).join(', ')} ·{' '}
                      {formatTime(track.duration_ms)}
                    </span>
                  </div>
                  <a
                    href={`https://open.spotify.com/track/${encodeURIComponent(track.id)}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open this song in Spotify"
                  >
                    <img src="/spotify-icon-black.png" width="24" height="24" alt="" />
                    <ExternalLink size={16} />
                  </a>
                </section>
                {matching && (
                  <p role="status">
                    <LoaderCircle className="search-spinner" size={17} /> Finding the closest
                    lyrics…
                  </p>
                )}
                {matchError && (
                  <div className="search-error" role="alert">
                    <p>{matchError}</p>
                    <button onClick={() => setMatchRetry((n) => n + 1)}>Retry lyrics</button>
                  </div>
                )}
                {!matching && matches?.trackId === trackId && (
                  <>
                    {!!matches.data.notice && (
                      <p className="spotify-notice">{matches.data.notice}</p>
                    )}
                    {!choices.length && (
                      <p>
                        No Persian lyrics found for this song. Try <a href="/search">Search</a> or{' '}
                        <a href="/paste">paste your lyrics</a>.
                      </p>
                    )}
                    {choices.length > 0 && !choice && (
                      <p>We found similar recordings. Choose the one that matches what you hear.</p>
                    )}
                    <button
                      className="spotify-secondary"
                      aria-expanded={alternatives}
                      onClick={() => setAlternatives(!alternatives)}
                    >
                      Wrong lyrics?
                    </button>
                    {alternatives && (
                      <section className="spotify-alternatives" aria-label="Alternative lyrics">
                        <h2>Try another version</h2>
                        {choices.filter((c) => c.id !== selected).length === 0 ? (
                          <p>Sorry, there are no other options.</p>
                        ) : (
                          choices
                            .filter((c) => c.id !== selected)
                            .map((c) => (
                              <button
                                key={c.id}
                                onClick={() => {
                                  overrides.current.set(trackId, c.id)
                                  setSelected(c.id)
                                  setAlternatives(false)
                                }}
                              >
                                <span>
                                  <strong>{c.title}</strong>
                                  <small>
                                    {c.artist} · {c.album}
                                    {c.duration ? ` · ${formatTime(c.duration * 1000)}` : ''}
                                  </small>
                                </span>
                                <em>{c.timedLines ? 'Synced' : 'Not synced'}</em>
                              </button>
                            ))
                        )}
                      </section>
                    )}
                  </>
                )}
                {choice && (
                  <>
                    {!choice.timedLines && (
                      <p className="spotify-notice">
                        {choices.some((c) => c.timedLines)
                          ? 'This version has no usable timestamps. Showing the full lyrics without sync.'
                          : 'Couldn’t find a timestamped version for this recording. Showing the full lyrics without sync.'}
                      </p>
                    )}
                    <ModelDownload progress={download.progress} />
                    {(converting || status) && (
                      <p role="status" className="reading-status">
                        {converting && <LoaderCircle className="search-spinner" size={17} />}{' '}
                        {status}
                      </p>
                    )}
                    {(convertError || (!converting && rows.some((r) => r.error))) && (
                      <div className="search-error" role="alert">
                        <p>
                          {convertError ||
                            'Some lines could not be converted. The Persian text is kept.'}
                        </p>
                        <button onClick={() => setConvertRetry((n) => n + 1)}>
                          Retry Finglish
                        </button>
                      </div>
                    )}
                    {rows.length > 0 &&
                      (choice.timedLines ? (
                        <LyricsPlayer
                          key={key}
                          track={{
                            title: track.name,
                            artist: track.artists.map((a) => a.name).join(', '),
                            coverSrc: track.album.images[0]?.url || '/hamava-mark.png',
                          }}
                          lines={rows}
                          player={playback.player}
                        />
                      ) : (
                        <PlainReader
                          key={key}
                          track={{
                            title: track.name,
                            artist: track.artists.map((a) => a.name).join(', '),
                          }}
                          lines={rows}
                        />
                      ))}
                    <p className="reader-source">
                      <a href={choice.sourceUrl} target="_blank" rel="noreferrer">
                        Lyrics: {choice.source}
                      </a>{' '}
                      · Automatic Finglish
                    </p>
                  </>
                )}
              </>
            )}
          </>
        )}
      </main>
      <UpdateCheck />
    </div>
  )
}
