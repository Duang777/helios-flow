/**
 * Tests for AI chat SSE heartbeat keep-alive.
 */

import { injectSseHeartbeatIntoStream } from '../sse-heartbeat-stream'

async function readAllText(response: Response): Promise<string> {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let out = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    if (value) out += decoder.decode(value, { stream: true })
  }
  out += decoder.decode()
  return out
}

describe('injectSseHeartbeatIntoStream', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('forwards upstream chunks unchanged when traffic is continuous', async () => {
    const encoder = new TextEncoder()
    const base = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"start"}\n\n'))
          controller.enqueue(encoder.encode('data: {"type":"finish"}\n\n'))
          controller.close()
        },
      }),
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    )

    const wrapped = injectSseHeartbeatIntoStream(base, { intervalMs: 1_000 })
    const textPromise = readAllText(wrapped)
    await jest.runAllTimersAsync()
    const text = await textPromise

    expect(text).toContain('data: {"type":"start"}')
    expect(text).toContain('data: {"type":"finish"}')
    expect(text).not.toContain(': ping')
  })

  it('emits SSE comment pings during long idle gaps', async () => {
    const encoder = new TextEncoder()
    let releaseGap: (() => void) | null = null
    const gap = new Promise<void>((resolve) => {
      releaseGap = resolve
    })

    const base = new Response(
      new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"start"}\n\n'))
          await gap
          controller.enqueue(encoder.encode('data: {"type":"finish"}\n\n'))
          controller.close()
        },
      }),
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    )

    const wrapped = injectSseHeartbeatIntoStream(base, { intervalMs: 25 })
    const textPromise = readAllText(wrapped)

    // Let the idle timer fire a few times while upstream is blocked.
    await jest.advanceTimersByTimeAsync(80)
    releaseGap?.()
    await jest.runAllTimersAsync()
    const text = await textPromise

    expect(text).toContain('data: {"type":"start"}')
    expect(text).toContain('data: {"type":"finish"}')
    expect(text).toMatch(/: ping\n\n/)
  })

  it('returns the original response when there is no body', () => {
    const base = new Response(null, { status: 204 })
    expect(injectSseHeartbeatIntoStream(base)).toBe(base)
  })
})
