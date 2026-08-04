import type { ModuleCli } from '@helios/shared/modules/registry'
import { createQueue } from '@helios/queue'
import type { CleanupExpiredJob } from './workers/create-notification.worker'

const cleanupExpiredCommand: ModuleCli = {
  command: 'cleanup-expired',
  async run() {
    const queue = createQueue('notifications', 'async')

    await queue.enqueue({
      type: 'cleanup-expired',
    } satisfies CleanupExpiredJob)

    console.log('✓ Cleanup job enqueued')
  },
}

export default [cleanupExpiredCommand]
