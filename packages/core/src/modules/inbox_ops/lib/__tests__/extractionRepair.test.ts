import { extractionOutputSchema } from '../../data/validators'
import { repairExtractionJsonText } from '../extractionRepair'

describe('repairExtractionJsonText', () => {
  it('stringifies object payloads and fills omitted arrays so Zod can parse', () => {
    const raw = JSON.stringify({
      summary: 'Giulia asked to create a contact',
      category: 'inquiry',
      participants: [{ name: 'Giulia Bianchi', email: 'giulia@example.com', role: 'buyer' }],
      proposedActions: [
        {
          actionType: 'create_contact',
          description: 'Create contact',
          confidence: 0.9,
          payload: { type: 'person', name: 'Giulia Bianchi' },
        },
      ],
      confidence: 0.8,
    })

    const repaired = repairExtractionJsonText(raw)
    const parsed = extractionOutputSchema.safeParse(JSON.parse(repaired))
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.discrepancies).toEqual([])
    expect(parsed.data.draftReplies).toEqual([])
    expect(JSON.parse(parsed.data.proposedActions[0]?.payloadJson ?? '{}')).toEqual({
      type: 'person',
      name: 'Giulia Bianchi',
    })
  })

  it('strips markdown fences and drops unknown action types', () => {
    const repaired = repairExtractionJsonText(`\`\`\`json
{"summary":"ok","proposedActions":[{"actionType":"hack_the_planet","description":"x","confidence":1,"payloadJson":"{}"}],"confidence":0.4}
\`\`\``)
    const parsed = extractionOutputSchema.parse(JSON.parse(repaired))
    expect(parsed.proposedActions).toEqual([])
    expect(parsed.summary).toBe('ok')
  })

  it('returns the original text when it is not JSON', () => {
    expect(repairExtractionJsonText('not-json')).toBe('not-json')
  })
})
