/**
 * Milestone delay rule (PRD §7.9 / M5):
 * plannedDate is set, plannedDate < asOf, actualDate is null, status is not cancelled.
 */
export function isMilestoneDelayed(input: {
  plannedDate?: string | Date | null
  actualDate?: string | Date | null
  status?: string | null
  asOf?: Date
}): boolean {
  if (!input.plannedDate) return false
  if (input.actualDate) return false
  if (input.status === 'cancelled') return false

  const planned =
    typeof input.plannedDate === 'string'
      ? new Date(input.plannedDate.includes('T') ? input.plannedDate : `${input.plannedDate}T00:00:00.000Z`)
      : new Date(input.plannedDate)
  if (Number.isNaN(planned.getTime())) return false

  const asOf = input.asOf ?? new Date()
  const asOfDay = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate())
  const plannedDay = Date.UTC(planned.getUTCFullYear(), planned.getUTCMonth(), planned.getUTCDate())
  return plannedDay < asOfDay
}
