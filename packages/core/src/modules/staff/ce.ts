import type { CustomEntitySpec } from '@helios/shared/modules/entities'
import { E } from '#generated/entities.ids.generated'
import { STAFF_TEAM_MEMBER_CUSTHELIOS_FIELDS } from './lib/customFields'

const systemEntities: CustomEntitySpec[] = [
  {
    id: E.staff.staff_team_member,
    label: 'Employee',
    description: 'Employees who can be scheduled on worktime plans.',
    labelField: 'displayName',
    showInSidebar: false,
    fields: STAFF_TEAM_MEMBER_CUSTHELIOS_FIELDS,
  },
]

export const entities = systemEntities
export default systemEntities
