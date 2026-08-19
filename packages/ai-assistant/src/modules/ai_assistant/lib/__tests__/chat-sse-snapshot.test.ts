import {
  extractAssistantSnapshot,
  extractUiPartsFromToolOutput,
} from '../chat-sse-snapshot'

describe('extractUiPartsFromToolOutput', () => {
  it('synthesizes a mutation-preview-card from a pending-confirmation object', () => {
    const parts = extractUiPartsFromToolOutput({
      status: 'pending-confirmation',
      pendingActionId: '11111111-1111-4111-8111-111111111111',
      agentId: 'insights.operating_loop_assistant',
      toolName: 'inbox_ops_accept_action',
      expiresAt: '2026-08-19T12:00:00.000Z',
    })
    expect(parts).toEqual([
      {
        componentId: 'mutation-preview-card',
        pendingActionId: '11111111-1111-4111-8111-111111111111',
        payload: {
          pendingActionId: '11111111-1111-4111-8111-111111111111',
          expiresAt: '2026-08-19T12:00:00.000Z',
          agentId: 'insights.operating_loop_assistant',
          toolName: 'inbox_ops_accept_action',
        },
      },
    ])
  })

  it('parses pretty-printed JSON strings returned by mutation tools', () => {
    const output = JSON.stringify(
      {
        status: 'pending-confirmation',
        pendingActionId: '22222222-2222-4222-8222-222222222222',
        toolName: 'inbox_ops_accept_action',
      },
      null,
      2,
    )
    const parts = extractUiPartsFromToolOutput(output)
    expect(parts[0]?.componentId).toBe('mutation-preview-card')
    expect(parts[0]?.pendingActionId).toBe('22222222-2222-4222-8222-222222222222')
  })
})

describe('extractAssistantSnapshot', () => {
  const pendingOutput = JSON.stringify(
    {
      status: 'pending-confirmation',
      pendingActionId: '33333333-3333-4333-8333-333333333333',
      toolName: 'inbox_ops_accept_action',
    },
    null,
    2,
  )

  it('extracts the confirmation card from tool-output-available without requiring event-stream content type', () => {
    const sse = [
      'data: {"type":"text-delta","delta":"等待确认"}',
      `data: ${JSON.stringify({ type: 'tool-output-available', toolCallId: 'call_1', output: pendingOutput })}`,
      'data: [DONE]',
    ].join('\n\n')

    const snapshot = extractAssistantSnapshot(sse, 'text/plain')
    expect(snapshot.content).toBe('等待确认')
    expect(snapshot.uiParts).toEqual([
      expect.objectContaining({
        componentId: 'mutation-preview-card',
        pendingActionId: '33333333-3333-4333-8333-333333333333',
      }),
    ])
  })

  it('still finds the card when tool output is already an object', () => {
    const sse = `data: ${JSON.stringify({
      type: 'tool-output-available',
      toolCallId: 'call_1',
      output: {
        status: 'pending-confirmation',
        pendingActionId: '44444444-4444-4444-8444-444444444444',
      },
    })}\n\n`

    const snapshot = extractAssistantSnapshot(sse, 'text/event-stream')
    expect(snapshot.uiParts[0]?.pendingActionId).toBe('44444444-4444-4444-8444-444444444444')
  })
})
