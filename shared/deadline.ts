// Bound the entire operation, including a stalled response body. Abort alone is
// insufficient if an implementation never settles; the race also releases UI.
export async function withDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  parent: AbortSignal,
  milliseconds: number,
): Promise<T> {
  const controller = new AbortController()
  const expires = Date.now() + milliseconds
  let timer: ReturnType<typeof setTimeout> | undefined
  let rejectBoundary: (reason: unknown) => void = () => {}
  const boundary = new Promise<never>((_, reject) => {
    rejectBoundary = reject
  })
  const stop = (reason: unknown) => {
    controller.abort(reason)
    rejectBoundary(reason)
  }
  const cancel = () => stop(parent.reason || new DOMException('Cancelled', 'AbortError'))
  const timeout = () =>
    stop(new DOMException('The request timed out. Please retry.', 'TimeoutError'))
  const resume = () => {
    if (Date.now() >= expires) timeout()
  }
  parent.addEventListener('abort', cancel, { once: true })
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', resume)
  timer = setTimeout(timeout, milliseconds)
  try {
    if (parent.aborted) cancel()
    return await Promise.race([
      boundary,
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted()
        return operation(controller.signal)
      }),
    ])
  } finally {
    clearTimeout(timer)
    parent.removeEventListener('abort', cancel)
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', resume)
    controller.abort()
  }
}
