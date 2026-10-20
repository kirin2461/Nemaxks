import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MarkdownText } from './MarkdownText'

afterEach(cleanup)

describe('MarkdownText', () => {
  it('renders bold, italic and inline code', () => {
    const { container } = render(
      <MarkdownText text={'**bold** *italic* `code`'} />,
    )
    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expect(container.querySelector('em')?.textContent).toBe('italic')
    expect(container.querySelector('code')?.textContent).toBe('code')
  })

  it('renders fenced code blocks without parsing markdown inside', () => {
    const { container } = render(
      <MarkdownText text={'```js\nconst **x** = 1\n```'} />,
    )
    const pre = container.querySelector('pre code')
    expect(pre?.textContent).toContain('const **x** = 1')
    expect(container.querySelector('strong')).toBeNull()
  })

  it('renders bullet and numbered lists', () => {
    const { container } = render(
      <MarkdownText text={'- one\n- two\n\n1. first\n2. second'} />,
    )
    expect(container.querySelectorAll('ul li')).toHaveLength(2)
    expect(container.querySelectorAll('ol li')).toHaveLength(2)
  })

  it('does not render raw HTML (XSS-safe by construction)', () => {
    const payload = '<img src=x onerror=alert(1)> <script>alert(2)</script>'
    const { container } = render(<MarkdownText text={payload} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('<script>alert(2)</script>')
  })

  it('keeps plain text untouched', () => {
    render(<MarkdownText text="обычный текст без разметки" />)
    expect(screen.getByText('обычный текст без разметки')).toBeTruthy()
  })
})
