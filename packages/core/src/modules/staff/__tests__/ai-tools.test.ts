import staffAiTools from '../ai-tools'

describe('staff AI tools', () => {
  it('exports roster/leave reads plus confirm-required accept/reject', () => {
    expect(staffAiTools.map((tool) => tool.name)).toEqual([
      'staff.list_team_members',
      'staff.list_leave_requests',
      'staff.accept_leave_request',
      'staff.reject_leave_request',
    ])
    expect(staffAiTools.filter((tool) => tool.isMutation).map((tool) => tool.name)).toEqual([
      'staff.accept_leave_request',
      'staff.reject_leave_request',
    ])
  })
})
