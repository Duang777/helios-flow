/**
 * @jest-environment jsdom
 */

import * as React from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@helios/shared/lib/testing/renderWithProviders'
import { apiCall } from '../../backend/utils/apiCall'
import { AiAssistantLauncher, AI_ASSISTANT_LAUNCHER_OPEN_EVENT } from '../AiAssistantLauncher'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock('../../backend/utils/apiCall', () => ({
  apiCall: jest.fn(),
}))

const apiCallMock = apiCall as unknown as jest.Mock

describe('<AiAssistantLauncher>', () => {
  beforeEach(() => {
    apiCallMock.mockReset()
    apiCallMock.mockImplementation(async (url: string) => {
      if (url === '/api/ai_assistant/health') {
        return { ok: true, result: { healthy: true } }
      }
      if (url === '/api/ai_assistant/ai/agents') {
        return {
          ok: true,
          result: {
            aiConfigured: true,
            agents: [
              {
                id: 'catalog.catalog_assistant',
                label: 'Catalog Assistant',
                labelKey: 'catalog.ai_agents.catalog_assistant.label',
                description: 'Explore catalog data',
                descriptionKey: 'catalog.ai_agents.catalog_assistant.description',
                mutationPolicy: 'read-only',
              },
            ],
          },
        }
      }
      throw new Error(`Unexpected apiCall: ${url}`)
    })
  })

  it('opens the assistants picker when the global launcher event is dispatched', async () => {
    renderWithProviders(<AiAssistantLauncher />)

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Open AI assistant' }).length).toBeGreaterThan(0)
    })

    act(() => {
      window.dispatchEvent(new CustomEvent(AI_ASSISTANT_LAUNCHER_OPEN_EVENT))
    })

    expect(await screen.findByRole('dialog', { name: 'AI assistants' })).toBeInTheDocument()
    expect(screen.getByText('Catalog Assistant')).toBeInTheDocument()
  }, 60_000)

  it('uses localized agent metadata in the picker and search index', async () => {
    renderWithProviders(<AiAssistantLauncher />, {
      locale: 'zh',
      dict: {
        'ai_assistant.launcher.dialogTitle': 'AI 助手',
        'catalog.ai_agents.catalog_assistant.label': '商品目录助手',
        'catalog.ai_agents.catalog_assistant.description': '查看商品、分类和价格。',
      },
    })

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Open AI assistant' }).length).toBeGreaterThan(0)
    })

    act(() => {
      window.dispatchEvent(new CustomEvent(AI_ASSISTANT_LAUNCHER_OPEN_EVENT))
    })

    expect(await screen.findByRole('dialog', { name: 'AI 助手' })).toBeInTheDocument()
    expect(screen.getByText('商品目录助手')).toBeInTheDocument()
    expect(screen.queryByText('Catalog Assistant')).not.toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Search assistants...'), {
      target: { value: '商品' },
    })

    expect(screen.getByText('商品目录助手')).toBeInTheDocument()
  }, 60_000)
})
