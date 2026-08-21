import messagesAiTools from '../ai-tools'

describe('messages AI tools', () => {
  it('exports reads plus confirm-required send/reply', () => {
    expect(messagesAiTools.map((tool) => tool.name)).toEqual([
      'messages.list_messages',
      'messages.get_message',
      'messages.send_message',
      'messages.reply_to_message',
    ])
    expect(messagesAiTools.filter((tool) => tool.isMutation).map((tool) => tool.name)).toEqual([
      'messages.send_message',
      'messages.reply_to_message',
    ])
  })

  it('ships loadBeforeRecord previews for confirm cards without calling LLM', async () => {
    const send = messagesAiTools.find((tool) => tool.name === 'messages.send_message')
    const reply = messagesAiTools.find((tool) => tool.name === 'messages.reply_to_message')
    expect(typeof send?.loadBeforeRecord).toBe('function')
    expect(typeof reply?.loadBeforeRecord).toBe('function')

    const sendPreview = await (send!.loadBeforeRecord as Function)(
      {
        recipientUserIds: ['11111111-1111-4111-8111-111111111111'],
        subject: '经营闭环确认样例',
        body: 'body',
      },
      {},
    )
    expect(sendPreview.after).toMatchObject({
      subject: '经营闭环确认样例',
      sendViaEmail: false,
      recipientCount: 1,
    })

    const replyPreview = await (reply!.loadBeforeRecord as Function)(
      {
        messageId: '22222222-2222-4222-8222-222222222222',
        body: 'reply body',
      },
      {},
    )
    expect(replyPreview.after).toMatchObject({
      messageId: '22222222-2222-4222-8222-222222222222',
      sendViaEmail: false,
    })
  })
})
