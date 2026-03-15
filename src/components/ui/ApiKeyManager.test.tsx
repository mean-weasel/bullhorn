import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ApiKeyManager } from './ApiKeyManager'

// Mock the ConfirmDialog to simplify testing
vi.mock('@/components/ui/ConfirmDialog', () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    onCancel,
    title,
    confirmText,
  }: {
    open: boolean
    onConfirm: () => void
    onCancel: () => void
    title: string
    confirmText: string
  }) => {
    if (!open) return null
    return (
      <div data-testid="confirm-dialog">
        <span>{title}</span>
        <button onClick={onConfirm}>{confirmText}</button>
        <button onClick={onCancel}>Cancel dialog</button>
      </div>
    )
  },
}))

const mockKeys = [
  {
    id: 'key-1',
    name: 'MCP Server',
    keyPrefix: 'bh_abc',
    scopes: ['*'],
    expiresAt: null,
    lastUsedAt: '2026-02-10T12:00:00Z',
    revokedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'key-2',
    name: 'CI Pipeline',
    keyPrefix: 'bh_def',
    scopes: ['*'],
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
    createdAt: '2026-01-15T00:00:00Z',
  },
]

const mockRevokedKey = {
  id: 'key-3',
  name: 'Old Key',
  keyPrefix: 'bh_old',
  scopes: ['*'],
  expiresAt: null,
  lastUsedAt: null,
  revokedAt: '2026-02-01T00:00:00Z',
  createdAt: '2025-12-01T00:00:00Z',
}

describe('ApiKeyManager (1/5)', () => {
  it('renders empty state when no keys exist', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ apiKeys: [] }), { status: 200 })
    )

    render(<ApiKeyManager />)

    await waitFor(() => {
      expect(screen.getByText(/No API keys yet/)).toBeInTheDocument()
    })
  })

  it('renders loading state initially', () => {
    // Return a pending promise to keep loading state
    vi.spyOn(global, 'fetch').mockReturnValueOnce(new Promise(() => {}))

    render(<ApiKeyManager />)

    // The component shows a spinner while loading -- we check that keys are not rendered yet
    expect(screen.queryByText('MCP Server')).not.toBeInTheDocument()
  })

  it('renders existing API keys', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ apiKeys: mockKeys }), { status: 200 })
    )

    render(<ApiKeyManager />)

    await waitFor(() => {
      expect(screen.getByText('MCP Server')).toBeInTheDocument()
      expect(screen.getByText('CI Pipeline')).toBeInTheDocument()
    })

    // Key prefixes shown
    expect(screen.getByText(/bh_abc/)).toBeInTheDocument()
    expect(screen.getByText(/bh_def/)).toBeInTheDocument()
  })
})

describe('ApiKeyManager (2/5)', () => {
  it('shows revoked key count', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ apiKeys: [...mockKeys, mockRevokedKey] }), { status: 200 })
    )

    render(<ApiKeyManager />)

    await waitFor(() => {
      expect(screen.getByText('1 revoked key')).toBeInTheDocument()
    })
  })

  it('opens create key form when clicking Create API key button', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ apiKeys: [] }), { status: 200 })
    )

    render(<ApiKeyManager />)

    await waitFor(() => {
      expect(screen.getByText('Create API key')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Create API key'))

    expect(screen.getByPlaceholderText('e.g. MCP Server')).toBeInTheDocument()
    expect(screen.getByText('Create')).toBeInTheDocument()
  })
})

describe('ApiKeyManager (3/5)', () => {
  it('creates a new key and shows raw key', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    // Initial fetch
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ apiKeys: [] }), { status: 200 }))

    render(<ApiKeyManager />)

    await waitFor(() => {
      expect(screen.getByText('Create API key')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Create API key'))

    const input = screen.getByPlaceholderText('e.g. MCP Server')
    fireEvent.change(input, { target: { value: 'Test Key' } })

    // Mock create response
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ apiKey: { rawKey: 'bh_live_secretkey123' } }), { status: 200 })
    )
    // Mock refetch after creation
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ apiKeys: mockKeys }), { status: 200 })
    )

    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(screen.getByText('bh_live_secretkey123')).toBeInTheDocument()
      expect(screen.getByText(/Copy your API key now/)).toBeInTheDocument()
    })
  })
})

describe('ApiKeyManager (4/5)', () => {
  it('opens revoke confirmation dialog when clicking trash icon', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ apiKeys: mockKeys }), { status: 200 })
    )

    render(<ApiKeyManager />)

    await waitFor(() => {
      expect(screen.getByText('MCP Server')).toBeInTheDocument()
    })

    // Click first revoke button (trash icon)
    const revokeButtons = screen.getAllByTitle('Revoke key')
    fireEvent.click(revokeButtons[0])

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
      expect(screen.getByText('Revoke API Key')).toBeInTheDocument()
    })
  })
})

describe('ApiKeyManager (5/5)', () => {
  it('calls revoke API when confirmed', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    // Initial fetch
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ apiKeys: mockKeys }), { status: 200 })
    )

    render(<ApiKeyManager />)

    await waitFor(() => {
      expect(screen.getByText('MCP Server')).toBeInTheDocument()
    })

    // Click trash icon for first key
    const revokeButtons = screen.getAllByTitle('Revoke key')
    fireEvent.click(revokeButtons[0])

    // Mock revoke response
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
    // Mock refetch
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ apiKeys: [mockKeys[1]] }), { status: 200 })
    )

    // Click confirm in dialog
    fireEvent.click(screen.getByText('Revoke'))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/api-keys/key-1', { method: 'DELETE' })
    })
  })

  it('shows error state when fetch fails', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    render(<ApiKeyManager />)

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })
})
