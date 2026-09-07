import { useEffect, useRef, useState } from 'react'
import {
  nextBatch,
  type BatchResult,
  type BatchState,
  type SongResponse,
} from '../../shared/lyrics'

export async function api<T>(
  path: string,
  key: string,
  body?: unknown,
): Promise<{ data: T; pending: boolean }> {
  let response: Response
  try {
    response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${encodeURIComponent(key)}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(75_000),
    })
  } catch {
    throw new Error(
      'The connection stopped or timed out. Completed sections are still here. Wait up to three minutes before retrying.',
    )
  }
  const data = await response.json().catch(() => ({
    error: 'The API is unavailable. Deploy the live-test Worker first.',
  }))
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status}).`)
  return { data, pending: response.status === 202 }
}

export function useLiveLyrics(initial: SongResponse, key: string, positionMs: number) {
  const [states, setStates] = useState<Record<string, BatchState>>(() =>
    Object.fromEntries(
      initial.song.batches.map((batch) => [
        batch.id,
        initial.completed[batch.id]
          ? { status: 'ready', result: initial.completed[batch.id] }
          : { status: 'pending' },
      ]),
    ),
  )
  const [halted, setHalted] = useState(false)
  const running = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const desired = nextBatch(initial.song, states, positionMs)?.id

  useEffect(() => {
    if (halted || running.current || !desired) return
    const id = desired
    running.current = true
    setStates((previous) => ({ ...previous, [id]: { status: 'loading' } }))
    const task = async () => {
      try {
        let response = await api<BatchResult>('/api/batch', key, {
          batchId: id,
          version: initial.song.version,
        })
        // A different tab owns this job. Poll cache only; polling never starts AI work.
        for (let count = 0; response.pending && count < 20 && mounted.current; count++) {
          await new Promise((resolve) => setTimeout(resolve, 3000))
          if (!mounted.current) return
          response = await api<BatchResult>(
            `/api/batch?id=${id}&version=${initial.song.version}`,
            key,
          )
        }
        if (!mounted.current) return
        if (response.pending)
          throw new Error(
            'This section is still processing elsewhere. Wait up to three minutes, then retry.',
          )
        const expected = initial.song.batches.find((batch) => batch.id === id)!.lineIds
        if (
          !Array.isArray(response.data.lines) ||
          response.data.lines.length !== expected.length ||
          response.data.lines.some(
            (line, i) =>
              line.id !== expected[i] || typeof line.finglish !== 'string' || !line.finglish.trim(),
          )
        )
          throw new Error('The section response was incomplete. Retry this section.')
        setStates((previous) => ({
          ...previous,
          [id]: { status: 'ready', result: response.data },
        }))
      } catch (error) {
        if (!mounted.current) return
        setStates((previous) => ({
          ...previous,
          [id]: {
            status: 'error',
            error: error instanceof Error ? error.message : 'This section could not be loaded.',
          },
        }))
        // Pause the queue after a failure; don't burn through quota with repeated failures.
        setHalted(true)
      } finally {
        running.current = false
      }
    }
    void task()
  }, [desired, halted, initial, key, states])

  const retry = (id: string) => {
    setStates((previous) => ({ ...previous, [id]: { status: 'pending' } }))
    setHalted(false)
  }
  return { states, halted, retry, resume: () => setHalted(false) }
}
