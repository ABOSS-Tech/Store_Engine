import { EventEmitter } from "events"

type EventBus = {
  eventEmitter_: EventEmitter
}

type WaitSubscribersExecutionOptions = {
  timeout?: number
}

// Map to hold pending promises for each event.
const waits = new Map<string | symbol, Promise<any>>()

/**
 * Creates a promise that rejects after a specified timeout.
 * @param timeout - The timeout in milliseconds.
 * @param eventName - The name of the event being waited on.
 * @returns A tuple containing the timeout promise and a function to clear the timeout.
 */
const createTimeoutPromise = (
  timeout: number,
  eventName: string | symbol
): [Promise<never>, () => void] => {
  let timeoutId: NodeJS.Timeout | null = null
  const promise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          `Timeout of ${timeout}ms exceeded while waiting for event "${String(
            eventName
          )}"`
        )
      )
    }, timeout)
    timeoutId.unref()
  })
  return [promise, () => timeoutId && clearTimeout(timeoutId)]
}

// Core logic to wait for subscribers.
const doWaitSubscribersExecution = (
  eventName: string | symbol,
  eventBus: EventBus,
  { timeout = 15000 }: WaitSubscribersExecutionOptions = {}
): Promise<any> => {
  const eventEmitter = eventBus.eventEmitter_
  const subscriberPromises: Promise<any>[] = []
  const [timeoutPromise, clearTimeout] = createTimeoutPromise(
    timeout,
    eventName
  )

  if (!eventEmitter.listeners(eventName).length) {
    let ok: (value?: any) => void
    const promise = new Promise((resolve) => {
      ok = resolve
    })
    subscriberPromises.push(promise)

    const newListener = async (...args: any[]) => {
      eventEmitter.removeListener(eventName, newListener)
      ok(...args)
    }

    Object.defineProperty(newListener, "__isSubscribersExecutionWrapper", {
      value: true,
      configurable: true,
      enumerable: false,
    })

    eventEmitter.on(eventName, newListener)
  } else {
    eventEmitter.listeners(eventName).forEach((listener: any) => {
      if (listener.__isSubscribersExecutionWrapper) {
        return
      }

      eventEmitter.removeListener(eventName, listener)

      let ok: (value?: any) => void, nok: (reason?: any) => void
      const promise = new Promise((resolve, reject) => {
        ok = resolve
        nok = reject
      })
      subscriberPromises.push(promise)

      const newListener = async (...args2: any[]) => {
        // As soon as the subscriber is executed, we restore the original listener
        eventEmitter.removeListener(eventName, newListener)
        let listenerToAdd = listener
        while (listenerToAdd.originalListener) {
          listenerToAdd = listenerToAdd.originalListener
        }
        eventEmitter.on(eventName, listenerToAdd)

        try {
          const res = await listener.apply(eventBus, args2)
          ok(res)
        } catch (error) {
          nok(error)
        }
      }

      Object.defineProperty(newListener, "__isSubscribersExecutionWrapper", {
        value: true,
        configurable: true,
        enumerable: false,
      })
      Object.defineProperty(newListener, "originalListener", {
        value: listener,
        configurable: true,
        enumerable: false,
      })
      eventEmitter.on(eventName, newListener)
    })
  }

  const subscribersPromise = Promise.all(subscriberPromises).finally(() => {
    // Clear the timeout since events have been fired and handled
    clearTimeout()
  })

  // Race between the subscribers and the timeout
  return Promise.race([subscribersPromise, timeoutPromise])
}

/**
 * Allows you to wait for all subscribers to execute for a given event.
 * It ensures that concurrent waits for the same event are queued and executed sequentially.
 *
 * @param eventName - The name of the event to wait for.
 * @param eventBus - The event bus instance.
 * @param options - Options including timeout.
 */
export const waitSubscribersExecution = (
  eventName: string | symbol,
  eventBus: any,
  options?: WaitSubscribersExecutionOptions
): Promise<any> => {
  const chain = waits.get(eventName)

  if (!chain) {
    const newPromise = doWaitSubscribersExecution(
      eventName,
      eventBus,
      options
    ).finally(() => {
      // Once this chain is done, remove it from the map
      // if it's still the same promise. This prevents race conditions
      // where a new wait is queued before this one is removed.
      if (waits.get(eventName) === newPromise) {
        waits.delete(eventName)
      }
    })
    waits.set(eventName, newPromise)
    return newPromise
  }

  const runner = () => {
    return doWaitSubscribersExecution(eventName, eventBus, options)
  }

  const newPromise = chain.then(runner, runner).finally(() => {
    // Once this chain is done, remove it from the map
    // if it's still the same promise. This prevents race conditions
    // where a new wait is queued before this one is removed.
    if (waits.get(eventName) === newPromise) {
      waits.delete(eventName)
    }
  })

  waits.set(eventName, newPromise)

  return newPromise
}
