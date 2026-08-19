import salesAiTools from '../ai-tools'

describe('sales AI tools', () => {
  it('exports read tools and confirm-required order/quote updates', () => {
    expect(salesAiTools.map((tool) => tool.name)).toEqual([
      'sales.list_orders',
      'sales.get_order',
      'sales.list_quotes',
      'sales.get_quote',
      'sales.manage_order',
      'sales.manage_quote',
    ])
    expect(salesAiTools.filter((tool) => tool.isMutation).map((tool) => tool.name)).toEqual([
      'sales.manage_order',
      'sales.manage_quote',
    ])
  })
})
