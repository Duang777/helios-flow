/**
 * @jest-environment jsdom
 */
import type React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import EditCurrencyPage from '../[id]/page'
import { apiCall } from '@helios/ui/backend/utils/apiCall'
import { flash } from '@helios/ui/backend/FlashMessages'

const mockTranslate = (key: string, fallback?: string) => fallback ?? key
const mockPush = jest.fn()

jest.mock('@helios/shared/lib/i18n/context', () => ({
  useT: () => mockTranslate,
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: 'cur-1' }),
  usePathname: () => '/backend/currencies/cur-1',
}))

jest.mock('@helios/ui/backend/Page', () => ({
  Page: ({ children }: any) => <div>{children}</div>,
  PageBody: ({ children }: any) => <div>{children}</div>,
}))

jest.mock('@helios/ui/backend/CrudForm', () => ({
  CrudForm: (props: any) => (
    <div data-testid="crud-form-mock">
      <div data-testid="crud-form-title">{props.title}</div>
      <button data-testid="submit-button" onClick={() => props.onSubmit?.(props.initialValues)}>
        {props.submitLabel}
      </button>
    </div>
  ),
}))

jest.mock('@helios/ui/backend/utils/crud', () => ({
  updateCrud: jest.fn(),
  deleteCrud: jest.fn(),
}))

jest.mock('@helios/ui/backend/utils/serverErrors', () => ({
  createCrudFormError: jest.fn(),
}))

jest.mock('@helios/ui/backend/utils/apiCall', () => ({
  apiCall: jest.fn(),
}))

jest.mock('@helios/ui/backend/FlashMessages', () => ({
  flash: jest.fn(),
}))

jest.mock('@helios/ui/backend/messages', () => ({
  SendObjectMessageDialog: () => null,
}))

jest.mock('@helios/ui/primitives/DataLoader', () => ({
  DataLoader: ({ children }: any) => <div>{children}</div>,
}))

jest.mock('@helios/ui/backend/confirm-dialog', () => ({
  useConfirmDialog: () => ({
    confirm: jest.fn(() => new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(true), 0)
    })),
    ConfirmDialogElement: null,
  }),
}))

HTMLDialogElement.prototype.showModal = jest.fn(function (this: HTMLDialogElement) {
  this.open = true
  this.setAttribute('open', '')
})
HTMLDialogElement.prototype.close = jest.fn(function (this: HTMLDialogElement) {
  this.open = false
  this.removeAttribute('open')
})

const mockCurrency = {
  id: 'cur-1',
  code: 'EUR',
  name: 'Euro',
  symbol: '€',
  decimalPlaces: 2,
  thousandsSeparator: ',',
  decimalSeparator: '.',
  isBase: false,
  isActive: true,
  organizationId: 'org-1',
  tenantId: 'ten-1',
}

describe('EditCurrencyPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(apiCall as jest.Mock).mockResolvedValue({
      ok: true,
      result: {
        items: [mockCurrency],
      },
    })
  })

  it('loads currency from the correct API endpoint with id parameter', async () => {
    render(<EditCurrencyPage params={{ id: 'cur-1' }} />)

    await waitFor(() => expect(apiCall).toHaveBeenCalled())
    expect((apiCall as jest.Mock).mock.calls[0][0]).toBe('/api/currencies/currencies?id=cur-1')
  })

  it('renders the form after loading currency data', async () => {
    render(<EditCurrencyPage params={{ id: 'cur-1' }} />)

    await waitFor(() => expect(screen.getByTestId('crud-form-mock')).toBeTruthy())
    expect(screen.getByTestId('crud-form-title')).toHaveTextContent('currencies.edit.title')
  })
})
