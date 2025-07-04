import {
  DistributedTransaction,
  DistributedTransactionEvents,
  DistributedTransactionType,
  TransactionHandlerType,
  TransactionStep,
  WorkflowScheduler,
} from "@medusajs/framework/orchestration"
import {
  ContainerLike,
  Context,
  Logger,
  MedusaContainer,
} from "@medusajs/framework/types"
import { isString, TransactionState } from "@medusajs/framework/utils"
import {
  FlowCancelOptions,
  FlowRunOptions,
  MedusaWorkflow,
  resolveValue,
  ReturnWorkflow,
} from "@medusajs/framework/workflows-sdk"
import Redis from "ioredis"
import { setTimeout } from "timers"
import { ulid } from "ulid"
import type { RedisDistributedTransactionStorage } from "../utils"

export type WorkflowOrchestratorRunOptions<T> = Omit<
  FlowRunOptions<T>,
  "container"
> & {
  transactionId?: string
  runId?: string
  container?: ContainerLike
}

export type WorkflowOrchestratorCancelOptions = Omit<
  FlowCancelOptions,
  "transaction" | "transactionId" | "container"
> & {
  transactionId: string
  runId?: string
  container?: ContainerLike
}

type RegisterStepSuccessOptions<T> = Omit<
  WorkflowOrchestratorRunOptions<T>,
  "transactionId" | "input"
>

type IdempotencyKeyParts = {
  workflowId: string
  transactionId: string
  stepId: string
  action: "invoke" | "compensate"
}

type NotifyOptions = {
  eventType: keyof DistributedTransactionEvents
  workflowId: string
  transactionId?: string
  step?: TransactionStep
  response?: unknown
  result?: unknown
  errors?: unknown[]
}

type WorkflowId = string
type TransactionId = string

type SubscriberHandler = {
  (input: NotifyOptions): void
} & {
  _id?: string
}

type SubscribeOptions = {
  workflowId: string
  transactionId?: string
  subscriber: SubscriberHandler
  subscriberId?: string
}

type UnsubscribeOptions = {
  workflowId: string
  transactionId?: string
  subscriberOrId: string | SubscriberHandler
}

type TransactionSubscribers = Map<TransactionId, SubscriberHandler[]>
type Subscribers = Map<WorkflowId, TransactionSubscribers>

const AnySubscriber = "any"

export class WorkflowOrchestratorService {
  private instanceId = ulid()
  protected redisPublisher: Redis
  protected redisSubscriber: Redis
  protected container_: MedusaContainer
  private subscribers: Subscribers = new Map()
  private activeStepsCount: number = 0

  readonly #logger: Logger

  protected redisDistributedTransactionStorage_: RedisDistributedTransactionStorage

  constructor({
    dataLoaderOnly,
    redisDistributedTransactionStorage,
    redisPublisher,
    redisSubscriber,
    sharedContainer,
  }: {
    dataLoaderOnly: boolean
    redisDistributedTransactionStorage: RedisDistributedTransactionStorage
    workflowOrchestratorService: WorkflowOrchestratorService
    redisPublisher: Redis
    redisSubscriber: Redis
    sharedContainer: MedusaContainer
  }) {
    this.container_ = sharedContainer
    this.redisPublisher = redisPublisher
    this.redisSubscriber = redisSubscriber

    this.#logger =
      this.container_.resolve("logger", { allowUnregistered: true }) ?? console

    redisDistributedTransactionStorage.setWorkflowOrchestratorService(this)

    if (!dataLoaderOnly) {
      DistributedTransaction.setStorage(redisDistributedTransactionStorage)
      WorkflowScheduler.setStorage(redisDistributedTransactionStorage)
    }

    this.redisDistributedTransactionStorage_ =
      redisDistributedTransactionStorage

    this.redisSubscriber.on("message", async (_, message) => {
      const { instanceId, data } = JSON.parse(message)

      await this.notify(data, false, instanceId)
    })
  }

  async onApplicationShutdown() {
    await this.redisDistributedTransactionStorage_.onApplicationShutdown()
  }

  async onApplicationPrepareShutdown() {
    // eslint-disable-next-line max-len
    await this.redisDistributedTransactionStorage_.onApplicationPrepareShutdown()

    while (this.activeStepsCount > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  async onApplicationStart() {
    await this.redisDistributedTransactionStorage_.onApplicationStart()
  }

  private async triggerParentStep(transaction, result) {
    const metadata = transaction.flow.metadata
    const { parentStepIdempotencyKey } = metadata ?? {}

    if (parentStepIdempotencyKey) {
      const hasFailed = [
        TransactionState.REVERTED,
        TransactionState.FAILED,
      ].includes(transaction.flow.state)

      if (hasFailed) {
        await this.setStepFailure({
          idempotencyKey: parentStepIdempotencyKey,
          stepResponse: result,
          options: {
            logOnError: true,
          },
        })
      } else {
        await this.setStepSuccess({
          idempotencyKey: parentStepIdempotencyKey,
          stepResponse: result,
          options: {
            logOnError: true,
          },
        })
      }
    }
  }

  async run<T = unknown>(
    workflowIdOrWorkflow: string | ReturnWorkflow<any, any, any>,
    options?: WorkflowOrchestratorRunOptions<T>
  ) {
    const {
      input,
      transactionId,
      resultFrom,
      logOnError,
      events: eventHandlers,
      container,
    } = options ?? {}

    let { throwOnError, context } = options ?? {}

    throwOnError ??= true
    context ??= {}
    context.transactionId = transactionId ?? ulid()
    const workflowId = isString(workflowIdOrWorkflow)
      ? workflowIdOrWorkflow
      : workflowIdOrWorkflow.getName()

    if (!workflowId) {
      throw new Error("Workflow ID is required")
    }

    const events: FlowRunOptions["events"] = this.buildWorkflowEvents({
      customEventHandlers: eventHandlers,
      workflowId,
      transactionId: context.transactionId,
    })

    const exportedWorkflow = MedusaWorkflow.getWorkflow(workflowId)
    if (!exportedWorkflow) {
      throw new Error(`Workflow with id "${workflowId}" not found.`)
    }

    const originalOnFinishHandler = events.onFinish!
    delete events.onFinish

    const ret = await exportedWorkflow.run({
      input,
      throwOnError: false,
      logOnError,
      resultFrom,
      context,
      events,
      container: container ?? this.container_,
    })

    const hasFinished = ret.transaction.hasFinished()
    const metadata = ret.transaction.getFlow().metadata
    const { parentStepIdempotencyKey } = metadata ?? {}

    const hasFailed = [
      TransactionState.REVERTED,
      TransactionState.FAILED,
    ].includes(ret.transaction.getFlow().state)

    const acknowledgement = {
      transactionId: context.transactionId,
      workflowId: workflowId,
      parentStepIdempotencyKey,
      hasFinished,
      hasFailed,
    }

    if (hasFinished) {
      const { result, errors } = ret

      await originalOnFinishHandler({
        transaction: ret.transaction,
        result,
        errors,
      })

      await this.triggerParentStep(ret.transaction, result)
    }

    if (throwOnError && (ret.thrownError || ret.errors?.length)) {
      if (ret.thrownError) {
        throw ret.thrownError
      }

      throw ret.errors[0].error
    }

    return { acknowledgement, ...ret }
  }

  async cancel(
    workflowIdOrWorkflow: string | ReturnWorkflow<any, any, any>,
    options?: WorkflowOrchestratorCancelOptions
  ) {
    const {
      transactionId,
      logOnError,
      events: eventHandlers,
      container,
    } = options ?? {}

    let { throwOnError, context } = options ?? {}

    throwOnError ??= true
    context ??= {}

    const workflowId = isString(workflowIdOrWorkflow)
      ? workflowIdOrWorkflow
      : workflowIdOrWorkflow.getName()

    if (!workflowId) {
      throw new Error("Workflow ID is required")
    }

    if (!transactionId) {
      throw new Error("Transaction ID is required")
    }

    const events: FlowRunOptions["events"] = this.buildWorkflowEvents({
      customEventHandlers: eventHandlers,
      workflowId,
      transactionId: transactionId,
    })

    const exportedWorkflow = MedusaWorkflow.getWorkflow(workflowId)
    if (!exportedWorkflow) {
      throw new Error(`Workflow with id "${workflowId}" not found.`)
    }

    const originalOnFinishHandler = events.onFinish!
    delete events.onFinish

    const transaction = await this.getRunningTransaction(
      workflowId,
      transactionId,
      { ...options, isCancelling: true }
    )
    if (!transaction) {
      if (!throwOnError) {
        return {
          acknowledgement: {
            transactionId,
            workflowId,
            exists: false,
          },
        }
      }
      throw new Error("Transaction not found")
    }

    const ret = await exportedWorkflow.cancel({
      transaction,
      throwOnError: false,
      logOnError,
      context,
      events,
      container: container ?? this.container_,
    })

    const hasFinished = ret.transaction.hasFinished()
    const metadata = ret.transaction.getFlow().metadata
    const { parentStepIdempotencyKey } = metadata ?? {}

    const hasFailed = [TransactionState.FAILED].includes(
      ret.transaction.getFlow().state
    )

    const acknowledgement = {
      transactionId: context.transactionId,
      workflowId: workflowId,
      parentStepIdempotencyKey,
      hasFinished,
      hasFailed,
      exists: true,
    }

    if (hasFinished) {
      const { result, errors } = ret

      await originalOnFinishHandler({
        transaction: ret.transaction,
        result,
        errors,
      })

      await this.triggerParentStep(ret.transaction, result)
    }

    if (throwOnError && (ret.thrownError || ret.errors?.length)) {
      if (ret.thrownError) {
        throw ret.thrownError
      }

      throw ret.errors[0].error
    }

    return { acknowledgement, ...ret }
  }

  async getRunningTransaction(
    workflowId: string,
    transactionId: string,
    context?: Context
  ): Promise<DistributedTransactionType> {
    if (!workflowId) {
      throw new Error("Workflow ID is required")
    }

    if (!transactionId) {
      throw new Error("TransactionId ID is required")
    }

    context ??= {}

    const exportedWorkflow: any = MedusaWorkflow.getWorkflow(workflowId)
    if (!exportedWorkflow) {
      throw new Error(`Workflow with id "${workflowId}" not found.`)
    }

    const flow = exportedWorkflow()

    const transaction = await flow.getRunningTransaction(transactionId, context)

    return transaction
  }

  async setStepSuccess<T = unknown>({
    idempotencyKey,
    stepResponse,
    options,
  }: {
    idempotencyKey: string | IdempotencyKeyParts
    stepResponse: unknown
    options?: RegisterStepSuccessOptions<T>
  }) {
    const {
      context,
      logOnError,
      resultFrom,
      container,
      events: eventHandlers,
    } = options ?? {}

    let { throwOnError } = options ?? {}
    throwOnError ??= true

    const [idempotencyKey_, { workflowId, transactionId }] =
      this.buildIdempotencyKeyAndParts(idempotencyKey)

    const exportedWorkflow: any = MedusaWorkflow.getWorkflow(workflowId)
    if (!exportedWorkflow) {
      throw new Error(`Workflow with id "${workflowId}" not found.`)
    }

    const events = this.buildWorkflowEvents({
      customEventHandlers: eventHandlers,
      transactionId,
      workflowId,
    })

    const originalOnFinishHandler = events.onFinish!
    delete events.onFinish

    const ret = await exportedWorkflow.registerStepSuccess({
      idempotencyKey: idempotencyKey_,
      context,
      resultFrom,
      throwOnError: false,
      logOnError,
      events,
      response: stepResponse,
      container: container ?? this.container_,
    })

    if (ret.transaction.hasFinished()) {
      const { result, errors } = ret

      await originalOnFinishHandler({
        transaction: ret.transaction,
        result,
        errors,
      })

      await this.triggerParentStep(ret.transaction, result)
    }

    if (throwOnError && (ret.thrownError || ret.errors?.length)) {
      if (ret.thrownError) {
        throw ret.thrownError
      }

      throw ret.errors[0].error
    }

    return ret
  }

  async setStepFailure<T = unknown>({
    idempotencyKey,
    stepResponse,
    options,
  }: {
    idempotencyKey: string | IdempotencyKeyParts
    stepResponse: unknown
    options?: RegisterStepSuccessOptions<T>
  }) {
    const {
      context,
      logOnError,
      resultFrom,
      container,
      events: eventHandlers,
    } = options ?? {}

    let { throwOnError } = options ?? {}
    throwOnError ??= true

    const [idempotencyKey_, { workflowId, transactionId }] =
      this.buildIdempotencyKeyAndParts(idempotencyKey)

    const exportedWorkflow: any = MedusaWorkflow.getWorkflow(workflowId)
    if (!exportedWorkflow) {
      throw new Error(`Workflow with id "${workflowId}" not found.`)
    }

    const events = this.buildWorkflowEvents({
      customEventHandlers: eventHandlers,
      transactionId,
      workflowId,
    })

    const originalOnFinishHandler = events.onFinish!
    delete events.onFinish

    const ret = await exportedWorkflow.registerStepFailure({
      idempotencyKey: idempotencyKey_,
      context,
      resultFrom,
      throwOnError: false,
      logOnError,
      events,
      response: stepResponse,
      container: container ?? this.container_,
    })

    if (ret.transaction.hasFinished()) {
      const { result, errors } = ret

      await originalOnFinishHandler({
        transaction: ret.transaction,
        result,
        errors,
      })

      await this.triggerParentStep(ret.transaction, result)
    }

    if (throwOnError && (ret.thrownError || ret.errors?.length)) {
      if (ret.thrownError) {
        throw ret.thrownError
      }

      throw ret.errors[0].error
    }

    return ret
  }

  subscribe({
    workflowId,
    transactionId,
    subscriber,
    subscriberId,
  }: SubscribeOptions) {
    subscriber._id = subscriberId
    const subscribers = this.subscribers.get(workflowId) ?? new Map()

    // Subscribe instance to redis
    if (!this.subscribers.has(workflowId)) {
      void this.redisSubscriber.subscribe(this.getChannelName(workflowId))
    }

    const handlerIndex = (handlers) => {
      return handlers.indexOf((s) => s === subscriber || s._id === subscriberId)
    }

    if (transactionId) {
      const transactionSubscribers = subscribers.get(transactionId) ?? []
      const subscriberIndex = handlerIndex(transactionSubscribers)
      if (subscriberIndex !== -1) {
        transactionSubscribers.slice(subscriberIndex, 1)
      }

      transactionSubscribers.push(subscriber)
      subscribers.set(transactionId, transactionSubscribers)
      this.subscribers.set(workflowId, subscribers)
      return
    }

    const workflowSubscribers = subscribers.get(AnySubscriber) ?? []
    const subscriberIndex = handlerIndex(workflowSubscribers)
    if (subscriberIndex !== -1) {
      workflowSubscribers.slice(subscriberIndex, 1)
    }

    workflowSubscribers.push(subscriber)
    subscribers.set(AnySubscriber, workflowSubscribers)
    this.subscribers.set(workflowId, subscribers)
  }

  unsubscribe({
    workflowId,
    transactionId,
    subscriberOrId,
  }: UnsubscribeOptions) {
    const subscribers = this.subscribers.get(workflowId) ?? new Map()

    const filterSubscribers = (handlers: SubscriberHandler[]) => {
      return handlers.filter((handler) => {
        return handler._id
          ? handler._id !== (subscriberOrId as string)
          : handler !== (subscriberOrId as SubscriberHandler)
      })
    }

    // Unsubscribe instance
    if (!this.subscribers.has(workflowId)) {
      void this.redisSubscriber.unsubscribe(this.getChannelName(workflowId))
    }

    if (transactionId) {
      const transactionSubscribers = subscribers.get(transactionId) ?? []
      const newTransactionSubscribers = filterSubscribers(
        transactionSubscribers
      )
      subscribers.set(transactionId, newTransactionSubscribers)
      this.subscribers.set(workflowId, subscribers)
      return
    }

    const workflowSubscribers = subscribers.get(AnySubscriber) ?? []
    const newWorkflowSubscribers = filterSubscribers(workflowSubscribers)
    subscribers.set(AnySubscriber, newWorkflowSubscribers)
    this.subscribers.set(workflowId, subscribers)
  }

  private async notify(
    options: NotifyOptions,
    publish = true,
    instanceId = this.instanceId
  ) {
    if (!publish && instanceId === this.instanceId) {
      return
    }

    if (publish) {
      const channel = this.getChannelName(options.workflowId)
      const message = JSON.stringify({
        instanceId: this.instanceId,
        data: options,
      })
      await this.redisPublisher.publish(channel, message)
    }

    const {
      eventType,
      workflowId,
      transactionId,
      errors,
      result,
      step,
      response,
    } = options

    const subscribers: TransactionSubscribers =
      this.subscribers.get(workflowId) ?? new Map()

    const notifySubscribers = (handlers: SubscriberHandler[]) => {
      handlers.forEach((handler) => {
        const args = {
          eventType,
          workflowId,
          transactionId,
          step,
          response,
          result,
          errors,
        }
        const isPromise = "then" in handler
        if (isPromise) {
          ;(handler(args) as unknown as Promise<any>).catch((e) => {
            this.#logger.error(e)
          })
        } else {
          try {
            handler(args)
          } catch (e) {
            this.#logger.error(e)
          }
        }
      })
    }

    if (transactionId) {
      const transactionSubscribers = subscribers.get(transactionId) ?? []
      notifySubscribers(transactionSubscribers)

      // removes transaction id subscribers on finish
      if (eventType === "onFinish") {
        subscribers.delete(transactionId)
      }
    }

    const workflowSubscribers = subscribers.get(AnySubscriber) ?? []
    notifySubscribers(workflowSubscribers)
  }

  private getChannelName(workflowId: string): string {
    return `orchestrator:${workflowId}`
  }

  private buildWorkflowEvents({
    customEventHandlers,
    workflowId,
    transactionId,
  }): DistributedTransactionEvents {
    const notify = async ({
      eventType,
      step,
      result,
      response,
      errors,
    }: {
      eventType: keyof DistributedTransactionEvents
      step?: TransactionStep
      response?: unknown
      result?: unknown
      errors?: unknown[]
    }) => {
      await this.notify({
        workflowId,
        transactionId,
        eventType,
        response,
        step,
        result,
        errors,
      })
    }

    return {
      onTimeout: async ({ transaction }) => {
        customEventHandlers?.onTimeout?.({ transaction })
        await notify({ eventType: "onTimeout" })
      },

      onBegin: async ({ transaction }) => {
        customEventHandlers?.onBegin?.({ transaction })
        await notify({ eventType: "onBegin" })
      },
      onResume: async ({ transaction }) => {
        customEventHandlers?.onResume?.({ transaction })
        await notify({ eventType: "onResume" })
      },
      onCompensateBegin: async ({ transaction }) => {
        customEventHandlers?.onCompensateBegin?.({ transaction })
        await notify({ eventType: "onCompensateBegin" })
      },
      onFinish: async ({ transaction, result, errors }) => {
        customEventHandlers?.onFinish?.({ transaction, result, errors })
        await notify({ eventType: "onFinish" })
      },

      onStepBegin: async ({ step, transaction }) => {
        customEventHandlers?.onStepBegin?.({ step, transaction })
        this.activeStepsCount++

        await notify({ eventType: "onStepBegin", step })
      },
      onStepSuccess: async ({ step, transaction }) => {
        const stepName = step.definition.action!
        const response = await resolveValue(
          transaction.getContext().invoke[stepName],
          transaction
        )
        customEventHandlers?.onStepSuccess?.({ step, transaction, response })
        await notify({ eventType: "onStepSuccess", step, response })

        this.activeStepsCount--
      },
      onStepFailure: async ({ step, transaction }) => {
        const stepName = step.definition.action!
        const errors = transaction
          .getErrors(TransactionHandlerType.INVOKE)
          .filter((err) => err.action === stepName)

        customEventHandlers?.onStepFailure?.({ step, transaction, errors })
        await notify({ eventType: "onStepFailure", step, errors })

        this.activeStepsCount--
      },
      onStepAwaiting: async ({ step, transaction }) => {
        customEventHandlers?.onStepAwaiting?.({ step, transaction })

        await notify({ eventType: "onStepAwaiting", step })

        this.activeStepsCount--
      },

      onCompensateStepSuccess: async ({ step, transaction }) => {
        const stepName = step.definition.action!
        const response = transaction.getContext().compensate[stepName]
        customEventHandlers?.onCompensateStepSuccess?.({
          step,
          transaction,
          response,
        })

        await notify({ eventType: "onCompensateStepSuccess", step, response })
      },
      onCompensateStepFailure: async ({ step, transaction }) => {
        const stepName = step.definition.action!
        const errors = transaction
          .getErrors(TransactionHandlerType.COMPENSATE)
          .filter((err) => err.action === stepName)

        customEventHandlers?.onStepFailure?.({ step, transaction, errors })

        await notify({ eventType: "onCompensateStepFailure", step, errors })
      },
    }
  }

  private buildIdempotencyKeyAndParts(
    idempotencyKey: string | IdempotencyKeyParts
  ): [string, IdempotencyKeyParts] {
    const parts: IdempotencyKeyParts = {
      workflowId: "",
      transactionId: "",
      stepId: "",
      action: "invoke",
    }
    let idempotencyKey_ = idempotencyKey as string

    const setParts = (workflowId, transactionId, stepId, action) => {
      parts.workflowId = workflowId
      parts.transactionId = transactionId
      parts.stepId = stepId
      parts.action = action
    }

    if (!isString(idempotencyKey)) {
      const { workflowId, transactionId, stepId, action } =
        idempotencyKey as IdempotencyKeyParts
      idempotencyKey_ = [workflowId, transactionId, stepId, action].join(":")
      setParts(workflowId, transactionId, stepId, action)
    } else {
      const [workflowId, transactionId, stepId, action] =
        idempotencyKey_.split(":")
      setParts(workflowId, transactionId, stepId, action)
    }

    return [idempotencyKey_, parts]
  }
}
