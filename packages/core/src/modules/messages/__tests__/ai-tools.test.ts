import messagesAiTools from '../ai-tools'

describe('messages AI tools', () => {
  it('exports read-only list and get tools', () => {
    expect(messagesAiTools.map((tool) => tool.name)).toEqual([
      'messages.list_messages',
      'messages.get_message',
    ])
    for (const tool of messagesAiTools) {
      expect(tool.isMutation).not.toBe(true)
    }
  })
})
