import type { AppContainer } from '@helios/shared/lib/di/container'
import { bootstrap } from '@helios/core/bootstrap'
import { applicationLifecycleEvents } from '@helios/shared/lib/runtime/events'

const APP_BOOTSTRAP_STARTED_EMITTED_KEY = '__heliosApplicationBootstrapStartedEventEmitted__'
const APP_BOOTSTRAP_COMPLETED_EMITTED_KEY = '__heliosApplicationBootstrapCompletedEventEmitted__'
const APP_BOOTSTRAP_FAILED_EMITTED_KEY = '__heliosApplicationBootstrapFailedEventEmitted__'

async function emitApplicationLifecycleEvent(
  container: AppContainer,
  eventName: string,
  emittedKey: string,
  payload: Record<string, unknown>
) {
  if ((globalThis as Record<string, unknown>)[emittedKey] === true) return

  try {
    const eventBus = container.resolve('eventBus') as {
      emit?: (event: string, payload: unknown) => Promise<void>
      emitEvent?: (event: string, payload: unknown) => Promise<void>
    }

    if (typeof eventBus.emit === 'function') {
      await eventBus.emit(eventName, payload)
    } else if (typeof eventBus.emitEvent === 'function') {
      await eventBus.emitEvent(eventName, payload)
    } else {
      return
    }

    ;(globalThis as Record<string, unknown>)[emittedKey] = true
  } catch (error) {
    console.warn('[application] Failed to emit lifecycle event', {
      event: eventName,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

// App-level DI overrides/registrations.
// This runs after core defaults and module DI registrars.
export async function register(container: AppContainer) {
  const basePayload = {
    source: 'apps/helios',
    emittedAt: new Date().toISOString(),
  }

  await emitApplicationLifecycleEvent(
    container,
    applicationLifecycleEvents.bootstrapStarted,
    APP_BOOTSTRAP_STARTED_EMITTED_KEY,
    basePayload
  )

  try {
    // Call core bootstrap to setup eventBus and auto-register subscribers.
    // Guard against duplicate bootstrap when core bootstrap already ran in createRequestContainer.
    if (!container.registrations?.eventBus) {
      await bootstrap(container)
    }
  } catch (error) {
    await emitApplicationLifecycleEvent(
      container,
      applicationLifecycleEvents.bootstrapFailed,
      APP_BOOTSTRAP_FAILED_EMITTED_KEY,
      {
        ...basePayload,
        errorMessage: error instanceof Error ? error.message : String(error),
      }
    )
    throw error
  }

  await emitApplicationLifecycleEvent(
    container,
    applicationLifecycleEvents.bootstrapCompleted,
    APP_BOOTSTRAP_COMPLETED_EMITTED_KEY,
    basePayload
  )
  // App-level overrides can follow here
}
