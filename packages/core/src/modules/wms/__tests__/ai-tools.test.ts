import wmsAiTools from '../ai-tools'

describe('wms AI tools', () => {
  it('exports read-only warehouse and inventory tools', () => {
    expect(wmsAiTools.map((tool) => tool.name)).toEqual([
      'wms.list_warehouses',
      'wms.list_balances',
      'wms.list_reservations',
    ])
    for (const tool of wmsAiTools) {
      expect(tool.isMutation).not.toBe(true)
    }
  })
})
