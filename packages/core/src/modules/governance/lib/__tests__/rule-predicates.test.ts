import { normalizeCustomerName } from '../rules/customer_duplicate_candidates'
import { bandForStageName } from '../rules/deal_stage_probability_conflict'

describe('governance rule predicates', () => {
  it('maps negotiation and qualification stage names to probability bands', () => {
    expect(bandForStageName('Negotiation')).toEqual({
      min: 50,
      max: 95,
      label: 'negotiation',
    })
    expect(bandForStageName('Qualification')).toEqual({
      min: 0,
      max: 35,
      label: 'qualification',
    })
    expect(bandForStageName('Unknown Stage XYZ')).toBeNull()
  })

  it('normalizes customer names for duplicate grouping', () => {
    expect(normalizeCustomerName('  Acme   Corp ')).toBe('acme corp')
  })
})
