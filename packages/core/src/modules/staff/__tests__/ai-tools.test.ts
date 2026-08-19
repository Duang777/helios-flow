import staffAiTools from '../ai-tools'

describe('staff AI tools', () => {
  it('exports read-only roster and leave list tools', () => {
    expect(staffAiTools.map((tool) => tool.name)).toEqual([
      'staff.list_team_members',
      'staff.list_leave_requests',
    ])
    for (const tool of staffAiTools) {
      expect(tool.isMutation).not.toBe(true)
    }
  })
})
