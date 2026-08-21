import wmsAiTools from '../ai-tools'

describe('wms AI tools', () => {
  it('exports inventory reads plus confirm-required receive/adjust/move', () => {
    expect(wmsAiTools.map((tool) => tool.name)).toEqual([
      'wms.list_warehouses',
      'wms.list_balances',
      'wms.list_reservations',
      'wms.receive_inventory',
      'wms.adjust_inventory',
      'wms.move_inventory',
    ])
    expect(wmsAiTools.filter((tool) => tool.isMutation).map((tool) => tool.name)).toEqual([
      'wms.receive_inventory',
      'wms.adjust_inventory',
      'wms.move_inventory',
    ])
  })
})
