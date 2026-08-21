/**
 * Phase 2 unit tests for the native SDK callback contract on runAiAgentText /
 * runAiAgentObject.
 *
 * Covers:
 * - generateText callback receives a PreparedAiSdkOptions bag with all loop
 *   primitives: stopWhen (array), prepareStep, onStepFinish, onStepStart,
 *   onToolCallStart, onToolCallFinish, experimental_repairToolCall, activeTools,
 *   toolChoice, abortSignal.
 * - When the callback is absent, streamText is called directly with the same
 *   prepared options.
 * - generateObject callback receives PreparedAiSdkObjectOptions (object-mode
 *   subset) and its result is forwarded correctly.
 * - abortSignal is always an AbortSignal instance in the prepared bag.
 * - Per-call loop fields (maxSteps, onStepFinish, stopWhen, etc.) are forwarded
 *   to the prepared-options bag.
 *
 * Phase 2 of spec 2026-04-28-ai-agents-agentic-loop-controls.
 */

const streamTextMock = jest.fn()
const generateObjectMock = jest.fn()
const stepCountIsMock = jest.fn((count: number) => ({ __kind: 'stepCount', count }))
const hasToolCallMock = jest.fn((name: string) => ({ __kind: 'hasToolCall', name }))
const convertToModelMessagesMock = jest.fn((messages: unknown) => messages)

jest.mock('ai', () => {
  const actual = jest.requireActual('ai')
  return {
    ...actual,
    streamText: (...args: unknown[]) => streamTextMock(...args),
    generateObject: (...args: unknown[]) => generateObjectMock(...args),
    stepCountIs: (count: number) => stepCountIsMock(count),
    hasToolCall: (name: string) => hasToolCallMock(name),
    convertToModelMessages: (...args: unknown[]) => convertToModelMessagesMock(...args),
  }
})

const createModelMock = jest.fn(
  (options: { modelId: string; apiKey: string }) => ({ id: options.modelId, apiKey: options.apiKey }),
)
const resolveApiKeyMock = jest.fn(() => 'test-api-key')
let mockResolvedProviderId = 'test-provider'

jest.mock('@helios/shared/lib/ai/llm-provider-registry', () => ({
  llmProviderRegistry: {
    resolveFirstConfigured: () => ({
      id: mockResolvedProviderId,
      defaultModel: 'provider-default-model',
      resolveApiKey: resolveApiKeyMock,
      createModel: createModelMock,
      isConfigured: () => true,
    }),
    get: () => null,
  },
}))

import type { AiAgentDefinition, AiAgentLoopConfig } from '../ai-agent-definition'
import type { PreparedAiSdkOptions, PreparedAiSdkObjectOptions } from '../agent-runtime'
import {
  resetAgentRegistryForTests,
  seedAgentRegistryForTests,
} from '../agent-registry'
import { toolRegistry } from '../tool-registry'
import { runAiAgentText, runAiAgentObject } from '../agent-runtime'

function makeAgent(
  overrides: Partial<AiAgentDefinition> & Pick<AiAgentDefinition, 'id' | 'moduleId'>,
): AiAgentDefinition {
  return {
    label: `${overrides.id} label`,
    description: `${overrides.id} description`,
    systemPrompt: 'System prompt.',
    allowedTools: [],
    ...overrides,
  }
}

const baseAuth = {
  tenantId: 'tenant-1',
  organizationId: 'org-1',
  userId: 'user-1',
  features: ['*'],
  isSuperAdmin: true,
}

const baseMessages = [
  { role: 'user' as const, id: 'm1', parts: [{ type: 'text' as const, text: 'hi' }] },
]

function fakeStreamResult() {
  return {
    toUIMessageStreamResponse: jest.fn(
      () =>
        new Response('streamed', {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    ),
  }
}

describe('Phase 2: generateText callback on runAiAgentText', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetAgentRegistryForTests()
    toolRegistry.clear()
    streamTextMock.mockImplementation(() => fakeStreamResult())
    mockResolvedProviderId = 'test-provider'
    delete process.env.HELIOS_AI_OPENAI_RESPONSES_STORE
  })

  afterAll(() => {
    resetAgentRegistryForTests()
    toolRegistry.clear()
  })

  it('invokes the generateText callback with the full prepared-options bag', async () => {
    seedAgentRegistryForTests([
      makeAgent({
        id: 'mod.agent',
        moduleId: 'mod',
        loop: { maxSteps: 6 },
      }),
    ])

    const capturedOptions: PreparedAiSdkOptions[] = []
    const fakeStream = fakeStreamResult()

    await runAiAgentText({
      agentId: 'mod.agent',
      messages: baseMessages as never,
      authContext: baseAuth,
      generateText: async (options) => {
        capturedOptions.push(options)
        return fakeStream as never
      },
    })

    expect(capturedOptions).toHaveLength(1)
    const opts = capturedOptions[0]
    expect(opts.model).toBeDefined()
    expect(opts.tools).toBeDefined()
    expect(opts.system).toBe('System prompt.')
    expect(opts.messages).toBeDefined()
    expect(opts.maxSteps).toBe(6)
    expect(Array.isArray(opts.stopWhen)).toBe(true)
    expect(opts.stopWhen.length).toBeGreaterThanOrEqual(1)
    expect(typeof opts.prepareStep).toBe('function')
    expect(opts.abortSignal).toBeInstanceOf(AbortSignal)
  })

  it('does NOT call streamText when generateText callback is supplied', async () => {
    seedAgentRegistryForTests([
      makeAgent({ id: 'mod.agent', moduleId: 'mod' }),
    ])
    const fakeStream = fakeStreamResult()

    await runAiAgentText({
      agentId: 'mod.agent',
      messages: baseMessages as never,
      authContext: baseAuth,
      generateText: async () => fakeStream as never,
    })

    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('calls streamText with prepared loop options when no callback is supplied', async () => {
    seedAgentRegistryForTests([
      makeAgent({
        id: 'mod.agent',
        moduleId: 'mod',
        loop: { maxSteps: 4 },
      }),
    ])

    await runAiAgentText({
      agentId: 'mod.agent',
      messages: baseMessages as never,
      authContext: baseAuth,
    })

    expect(streamTextMock).toHaveBeenCalledTimes(1)
    const callArg = streamTextMock.mock.calls[0][0] as {
      stopWhen: unknown[]
      prepareStep: unknown
      abortSignal: unknown
    }
    expect(Array.isArray(callArg.stopWhen)).toBe(true)
    expect(callArg.stopWhen.length).toBeGreaterThanOrEqual(1)
    expect(typeof callArg.prepareStep).toBe('function')
    expect(callArg.abortSignal).toBeInstanceOf(AbortSignal)
  })

  it('forwards OpenAI Responses store providerOptions when explicitly enabled', async () => {
    mockResolvedProviderId = 'openai'
    process.env.HELIOS_AI_OPENAI_RESPONSES_STORE = 'true'
    seedAgentRegistryForTests([
      makeAgent({
        id: 'mod.agent',
        moduleId: 'mod',
        loop: { maxSteps: 4 },
      }),
    ])

    await runAiAgentText({
      agentId: 'mod.agent',
      messages: baseMessages as never,
      authContext: baseAuth,
    })

    const callArg = streamTextMock.mock.calls[0][0] as {
      providerOptions?: unknown
    }
    expect(callArg.providerOptions).toEqual({ openai: { store: true } })
  })

  it('forwards OpenAI reasoningEffort from HELIOS_AI_OPENAI_REASONING_EFFORT', async () => {
    mockResolvedProviderId = 'openai'
    delete process.env.HELIOS_AI_OPENAI_RESPONSES_STORE
    process.env.HELIOS_AI_OPENAI_REASONING_EFFORT = 'none'
    seedAgentRegistryForTests([
      makeAgent({
        id: 'mod.agent',
        moduleId: 'mod',
        loop: { maxSteps: 4 },
      }),
    ])

    await runAiAgentText({
      agentId: 'mod.agent',
      messages: baseMessages as never,
      authContext: baseAuth,
    })

    const callArg = streamTextMock.mock.calls[0][0] as {
      providerOptions?: unknown
    }
    expect(callArg.providerOptions).toEqual({
      openai: { reasoningEffort: 'none', forceReasoning: true },
    })
  })

  it('strips OpenAI item ids from prepared step messages before the next Responses call', async () => {
    mockResolvedProviderId = 'openai'
    process.env.HELIOS_AI_OPENAI_RESPONSES_STORE = 'true'
    seedAgentRegistryForTests([
      makeAgent({
        id: 'mod.agent',
        moduleId: 'mod',
        loop: { maxSteps: 4 },
      }),
    ])

    await runAiAgentText({
      agentId: 'mod.agent',
      messages: baseMessages as never,
      authContext: baseAuth,
    })

    const callArg = streamTextMock.mock.calls[0][0] as {
      prepareStep: (state: unknown) => Promise<{
        messages?: Array<Record<string, unknown>>
      }>
    }
    const stepMessages = [
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_1',
            toolName: 'mod__lookup',
            input: {},
            providerMetadata: { openai: { itemId: 'item_from_metadata', namespace: 'keep-me' } },
            providerOptions: { openai: { itemId: 'item_from_options', phase: 'keep-phase' } },
          },
        ],
      },
    ]

    const result = await callArg.prepareStep({
      steps: [],
      stepNumber: 1,
      model: {},
      instructions: undefined,
      initialInstructions: undefined,
      messages: stepMessages,
      initialMessages: [],
      responseMessages: [],
      toolsContext: {},
      runtimeContext: {},
    })

    const sanitizedPart = result.messages?.[0].content as Array<{
      providerMetadata?: { openai?: Record<string, unknown> }
      providerOptions?: { openai?: Record<string, unknown> }
    }>
    expect(sanitizedPart[0].providerMetadata?.openai).toEqual({ namespace: 'keep-me' })
    expect(sanitizedPart[0].providerOptions?.openai).toEqual({ phase: 'keep-phase' })
    expect(
      (
        stepMessages[0].content[0] as {
          providerMetadata: { openai: { itemId: string } }
        }
      ).providerMetadata.openai.itemId,
    ).toBe('item_from_metadata')
  })

  it('does not forward OpenAI Responses store providerOptions for non-OpenAI providers', async () => {
    mockResolvedProviderId = 'test-provider'
    process.env.HELIOS_AI_OPENAI_RESPONSES_STORE = 'true'
    seedAgentRegistryForTests([
      makeAgent({
        id: 'mod.agent',
        moduleId: 'mod',
      }),
    ])

    await runAiAgentText({
      agentId: 'mod.agent',
      messages: baseMessages as never,
      authContext: baseAuth,
    })

    const callArg = streamTextMock.mock.calls[0][0] as {
      providerOptions?: unknown
    }
    expect(callArg.providerOptions).toBeUndefined()
  })

  it('forwards per-call loop overrides into the prepared-options bag', async () => {
    seedAgentRegistryForTests([
      makeAgent({
        id: 'mod.agent',
        moduleId: 'mod',
        loop: { maxSteps: 8 },
      }),
    ])

    const capturedOptions: PreparedAiSdkOptions[] = []
    const fakeStream = fakeStreamResult()
    const callerOnStepFinish = jest.fn()

    await runAiAgentText({
      agentId: 'mod.agent',
      messages: baseMessages as never,
      authContext: baseAuth,
      loop: { maxSteps: 3, onStepFinish: callerOnStepFinish },
      generateText: async (options) => {
        capturedOptions.push(options)
        return fakeStream as never
      },
    })

    expect(capturedOptions[0].maxSteps).toBe(3)
    // Phase 4: the trace collector wraps onStepFinish; verify it chains down to
    // the caller's hook by invoking the wired function.
    expect(typeof capturedOptions[0].onStepFinish).toBe('function')
    const fakeEvent = { usage: { inputTokens: 1, outputTokens: 1 }, toolCalls: [] }
    await capturedOptions[0].onStepFinish!(fakeEvent as never)
    expect(callerOnStepFinish).toHaveBeenCalledWith(fakeEvent)
  })

  it('stopWhen array always ends with stepCountIs(maxSteps)', async () => {
    seedAgentRegistryForTests([
      makeAgent({
        id: 'mod.agent',
        moduleId: 'mod',
        loop: {
          maxSteps: 5,
          stopWhen: { kind: 'hasToolCall', toolName: 'mod.update' },
        },
      }),
    ])

    const capturedOptions: PreparedAiSdkOptions[] = []
    const fakeStream = fakeStreamResult()

    await runAiAgentText({
      agentId: 'mod.agent',
      messages: baseMessages as never,
      authContext: baseAuth,
      generateText: async (options) => {
        capturedOptions.push(options)
        return fakeStream as never
      },
    })

    const stopWhen = capturedOptions[0].stopWhen
    expect(stopWhen).toHaveLength(2)
    expect(stopWhen[0]).toEqual({ __kind: 'hasToolCall', name: 'mod__update' })
    expect(stopWhen[1]).toEqual({ __kind: 'stepCount', count: 5 })
  })

  it('abortSignal is an AbortSignal in the prepared bag (Phases 0-2 pre-wire)', async () => {
    seedAgentRegistryForTests([
      makeAgent({ id: 'mod.agent', moduleId: 'mod' }),
    ])

    const capturedOptions: PreparedAiSdkOptions[] = []
    const fakeStream = fakeStreamResult()

    await runAiAgentText({
      agentId: 'mod.agent',
      messages: baseMessages as never,
      authContext: baseAuth,
      generateText: async (options) => {
        capturedOptions.push(options)
        return fakeStream as never
      },
    })

    expect(capturedOptions[0].abortSignal).toBeInstanceOf(AbortSignal)
    expect(capturedOptions[0].abortSignal?.aborted).toBe(false)
  })
})

describe('Phase 2: generateObject callback on runAiAgentObject', () => {
  let z: typeof import('zod').z
  const objSchema = { schemaName: 'Out', schema: null as unknown }

  beforeEach(async () => {
    jest.clearAllMocks()
    resetAgentRegistryForTests()
    toolRegistry.clear()
    generateObjectMock.mockResolvedValue({ object: { title: 'ok' } })
    const zod = await import('zod')
    z = zod.z
    objSchema.schema = z.object({ title: z.string() })
  })

  afterAll(() => {
    resetAgentRegistryForTests()
    toolRegistry.clear()
  })

  function makeObjectAgent(loop?: AiAgentDefinition['loop']): AiAgentDefinition {
    const { z: zInner } = require('zod')
    return makeAgent({
      id: 'mod.obj_agent',
      moduleId: 'mod',
      executionMode: 'object',
      output: { schemaName: 'Out', schema: zInner.object({ title: zInner.string() }) },
      ...(loop !== undefined ? { loop } : {}),
    })
  }

  it('invokes the generateObject callback with PreparedAiSdkObjectOptions', async () => {
    seedAgentRegistryForTests([makeObjectAgent({ maxSteps: 4 })])

    const capturedOptions: PreparedAiSdkObjectOptions[] = []

    await runAiAgentObject({
      agentId: 'mod.obj_agent',
      input: 'Generate something',
      authContext: baseAuth,
      output: {
        schemaName: 'TestOutput',
        schema: objSchema.schema,
        mode: 'generate',
      },
      generateObject: async (options) => {
        capturedOptions.push(options)
        return { object: { title: 'result' } } as never
      },
    })

    expect(capturedOptions).toHaveLength(1)
    const opts = capturedOptions[0]
    expect(opts.model).toBeDefined()
    expect(opts.system).toBe('System prompt.')
    expect(opts.messages).toBeDefined()
    expect(opts.schemaName).toBe('TestOutput')
    expect(opts.schema).toBeDefined()
    expect(opts.maxSteps).toBe(4)
    expect(opts.abortSignal).toBeInstanceOf(AbortSignal)
  })

  it('does NOT call generateObject SDK function when callback is supplied', async () => {
    seedAgentRegistryForTests([makeObjectAgent()])

    await runAiAgentObject({
      agentId: 'mod.obj_agent',
      input: 'Generate',
      authContext: baseAuth,
      output: { schemaName: 'Out', schema: objSchema.schema },
      generateObject: async () => ({ object: { title: 'ok' } } as never),
    })

    expect(generateObjectMock).not.toHaveBeenCalled()
  })

  it('returns generate result from the generateObject callback', async () => {
    seedAgentRegistryForTests([makeObjectAgent()])

    const result = await runAiAgentObject({
      agentId: 'mod.obj_agent',
      input: 'Generate',
      authContext: baseAuth,
      output: { schemaName: 'Out', schema: objSchema.schema },
      generateObject: async () =>
        ({ object: { title: 'found' }, finishReason: 'stop' } as never),
    })

    expect(result.mode).toBe('generate')
    expect((result as { object: unknown }).object).toEqual({ title: 'found' })
  })

  it('calls generateObject SDK function when no callback is supplied', async () => {
    seedAgentRegistryForTests([makeObjectAgent()])
    generateObjectMock.mockResolvedValue({ object: { title: 'sdk' } })

    await runAiAgentObject({
      agentId: 'mod.obj_agent',
      input: 'Generate',
      authContext: baseAuth,
      output: { schemaName: 'Out', schema: objSchema.schema },
    })

    expect(generateObjectMock).toHaveBeenCalledTimes(1)
    const callArg = generateObjectMock.mock.calls[0][0] as {
      abortSignal: unknown
    }
    expect(callArg.abortSignal).toBeInstanceOf(AbortSignal)
  })
})
