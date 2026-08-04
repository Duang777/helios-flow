import type { ModuleInfo } from '@helios/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'inbox_ops',
  title: 'InboxOps — Email-to-ERP Agent',
  version: '0.1.0',
  description: 'Receives forwarded emails via webhook, extracts structured action proposals using LLM, and presents them for human-in-the-loop approval.',
  author: 'Helios Team',
  license: 'MIT',
  ejectable: true,
}

export { features } from './acl'
