/**
 * Keep long-lived AI chat SSE responses alive during idle gaps.
 *
 * Multi-hop agent turns (tool call → LLM → tool call) can sit silent for
 * tens of seconds while a tool or provider call runs. Browsers and some
 * proxies treat that idle stretch as a dead connection and surface
 * `stream_error` / "network error" in the chat UI even though the server
 * is still working.
 *
 * This wrapper pipes the upstream UI-message stream through and, when no
 * bytes have been forwarded for `intervalMs`, emits an SSE comment
 * (`: ping\\n\\n`). Comments are ignored by `useAiChat` and by the AI SDK
 * UI-message parser, but they reset TCP/proxy idle timers.
 */

const SSE_ENCODER = new TextEncoder()
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000
const HEARTBEAT_COMMENT = ': ping\n\n'

export type SseHeartbeatOptions = {
  /** Idle gap before a heartbeat comment is written. Defaults to 15s. */
  intervalMs?: number
}

/**
 * Wrap a streaming `Response` and inject SSE comment heartbeats while the
 * upstream body is quiet. The original chunks are forwarded unchanged.
 */
export function injectSseHeartbeatIntoStream(
  baseResponse: Response,
  options: SseHeartbeatOptions = {},
): Response {
  const intervalMs =
    typeof options.intervalMs === 'number' && options.intervalMs > 0
      ? options.intervalMs
      : DEFAULT_HEARTBEAT_INTERVAL_MS

  if (!baseResponse.body) {
    return baseResponse
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()

  async function pump(): Promise<void> {
    const reader = baseResponse.body!.getReader()
    let closed = false
    let writeChain: Promise<void> = Promise.resolve()
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null

    const enqueueWrite = (bytes: Uint8Array): Promise<void> => {
      writeChain = writeChain
        .then(async () => {
          if (closed) return
          await writer.write(bytes)
        })
        .catch(() => undefined)
      return writeChain
    }

    const stopHeartbeat = () => {
      if (heartbeatTimer !== null) {
        clearInterval(heartbeatTimer)
        heartbeatTimer = null
      }
    }

    const armHeartbeat = () => {
      stopHeartbeat()
      heartbeatTimer = setInterval(() => {
        void enqueueWrite(SSE_ENCODER.encode(HEARTBEAT_COMMENT))
      }, intervalMs)
    }

    armHeartbeat()
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        if (!value) continue
        armHeartbeat()
        await enqueueWrite(value)
      }
      await writeChain
    } catch {
      // Upstream abort / cancel — close quietly so the client sees EOF.
    } finally {
      closed = true
      stopHeartbeat()
      reader.releaseLock()
      await writer.close().catch(() => undefined)
    }
  }

  void pump()
  return new Response(readable, {
    status: baseResponse.status,
    headers: baseResponse.headers,
  })
}
