import path from 'node:path'

const DEFAULT_LOCAL_QUEUE_BASE_DIR = '.helios/queue'

/**
 * Resolve the local queue storage directory at runtime.
 *
 * The default queue directory intentionally lives under the process cwd for
 * development compatibility. Next/Turbopack's NFT tracer treats unscoped cwd
 * path resolution as a signal to trace the whole app tree, so the cwd segment is
 * marked as runtime-only while preserving the exact path behavior.
 */
export function resolveLocalQueueBaseDir(explicitBaseDir?: string | null): string {
  const trimmedBaseDir = explicitBaseDir?.trim()
  if (!trimmedBaseDir) {
    return path.join(
      /*turbopackIgnore: true*/
      process.cwd(),
      DEFAULT_LOCAL_QUEUE_BASE_DIR,
    )
  }

  if (path.isAbsolute(trimmedBaseDir)) {
    return trimmedBaseDir
  }

  return path.join(
    /*turbopackIgnore: true*/
    process.cwd(),
    trimmedBaseDir,
  )
}
