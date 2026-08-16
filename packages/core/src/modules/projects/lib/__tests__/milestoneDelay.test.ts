import { isMilestoneDelayed } from '../milestoneDelay'

describe('isMilestoneDelayed', () => {
  const asOf = new Date('2026-08-07T12:00:00.000Z')

  it('returns true when planned date is before asOf and actual is missing', () => {
    expect(
      isMilestoneDelayed({
        plannedDate: '2026-08-01',
        actualDate: null,
        status: 'planned',
        asOf,
      }),
    ).toBe(true)
  })

  it('returns false when actual date is present', () => {
    expect(
      isMilestoneDelayed({
        plannedDate: '2026-08-01',
        actualDate: '2026-08-06',
        status: 'done',
        asOf,
      }),
    ).toBe(false)
  })

  it('returns false when status is cancelled', () => {
    expect(
      isMilestoneDelayed({
        plannedDate: '2026-08-01',
        actualDate: null,
        status: 'cancelled',
        asOf,
      }),
    ).toBe(false)
  })

  it('returns false when planned date is today or in the future', () => {
    expect(
      isMilestoneDelayed({
        plannedDate: '2026-08-07',
        actualDate: null,
        status: 'planned',
        asOf,
      }),
    ).toBe(false)
  })
})
