import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MarkdownEditor } from './MarkdownEditor'

// Mock react-markdown to avoid ESM import issues in jsdom
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="react-markdown">{children}</div>
  ),
}))

vi.mock('remark-gfm', () => ({
  default: () => {},
}))

// eslint-disable-next-line max-lines-per-function
describe('MarkdownEditor', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders textarea in write mode by default', () => {
    render(<MarkdownEditor {...defaultProps} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders Write and Preview tab buttons', () => {
    render(<MarkdownEditor {...defaultProps} />)
    expect(screen.getByText('Write')).toBeInTheDocument()
    expect(screen.getByText('Preview')).toBeInTheDocument()
  })

  it('renders toolbar buttons in write mode', () => {
    render(<MarkdownEditor {...defaultProps} />)
    expect(screen.getByTitle('Bold')).toBeInTheDocument()
    expect(screen.getByTitle('Italic')).toBeInTheDocument()
    expect(screen.getByTitle('Heading')).toBeInTheDocument()
    expect(screen.getByTitle('Link')).toBeInTheDocument()
    expect(screen.getByTitle('Code')).toBeInTheDocument()
    expect(screen.getByTitle('List')).toBeInTheDocument()
  })

  it('calls onChange when typing in the textarea', () => {
    const onChange = vi.fn()
    render(<MarkdownEditor {...defaultProps} onChange={onChange} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Hello world' } })

    expect(onChange).toHaveBeenCalledWith('Hello world')
  })

  it('renders placeholder text', () => {
    render(<MarkdownEditor {...defaultProps} placeholder="Write your blog post..." />)
    expect(screen.getByPlaceholderText('Write your blog post...')).toBeInTheDocument()
  })

  it('displays the current value in the textarea', () => {
    render(<MarkdownEditor {...defaultProps} value="# My Title" />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toBe('# My Title')
  })

  it('switches to preview mode when clicking Preview tab', () => {
    render(<MarkdownEditor {...defaultProps} value="Hello **world**" />)

    fireEvent.click(screen.getByText('Preview'))

    // Textarea should not be in the document
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    // Markdown content should be rendered via the mock
    expect(screen.getByTestId('react-markdown')).toBeInTheDocument()
    expect(screen.getByTestId('react-markdown').textContent).toBe('Hello **world**')
  })

  it('shows "Nothing to preview" when value is empty in preview mode', () => {
    render(<MarkdownEditor {...defaultProps} value="" />)

    fireEvent.click(screen.getByText('Preview'))

    expect(screen.getByText('Nothing to preview')).toBeInTheDocument()
  })

  it('switches back to write mode from preview', () => {
    render(<MarkdownEditor {...defaultProps} value="content" />)

    // Go to preview
    fireEvent.click(screen.getByText('Preview'))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    // Go back to write
    fireEvent.click(screen.getByText('Write'))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('hides toolbar buttons in preview mode', () => {
    render(<MarkdownEditor {...defaultProps} />)

    // Toolbar visible in write mode
    expect(screen.getByTitle('Bold')).toBeInTheDocument()

    // Switch to preview
    fireEvent.click(screen.getByText('Preview'))

    // Toolbar should be hidden
    expect(screen.queryByTitle('Bold')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Italic')).not.toBeInTheDocument()
  })

  it('inserts bold markdown when Bold button is clicked', () => {
    const onChange = vi.fn()
    render(<MarkdownEditor {...defaultProps} onChange={onChange} value="" />)

    fireEvent.click(screen.getByTitle('Bold'))

    expect(onChange).toHaveBeenCalledWith('**bold text**')
  })

  it('inserts italic markdown when Italic button is clicked', () => {
    const onChange = vi.fn()
    render(<MarkdownEditor {...defaultProps} onChange={onChange} value="" />)

    fireEvent.click(screen.getByTitle('Italic'))

    expect(onChange).toHaveBeenCalledWith('*italic text*')
  })

  it('inserts link markdown when Link button is clicked', () => {
    const onChange = vi.fn()
    render(<MarkdownEditor {...defaultProps} onChange={onChange} value="" />)

    fireEvent.click(screen.getByTitle('Link'))

    expect(onChange).toHaveBeenCalledWith('[link text](url)')
  })

  it('inserts code markdown when Code button is clicked', () => {
    const onChange = vi.fn()
    render(<MarkdownEditor {...defaultProps} onChange={onChange} value="" />)

    fireEvent.click(screen.getByTitle('Code'))

    expect(onChange).toHaveBeenCalledWith('`code`')
  })

  it('inserts list markdown when List button is clicked', () => {
    const onChange = vi.fn()
    render(<MarkdownEditor {...defaultProps} onChange={onChange} value="" />)

    fireEvent.click(screen.getByTitle('List'))

    expect(onChange).toHaveBeenCalledWith('- item')
  })
})
