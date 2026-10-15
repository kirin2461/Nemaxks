import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Button } from './Button'

afterEach(cleanup)

describe('Button', () => {
  it('renders children and handles clicks', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Send</Button>)

    const btn = screen.getByRole('button', { name: 'Send' })
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled while loading and ignores clicks', () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Send
      </Button>,
    )

    const btn = screen.getByRole('button')
    expect((btn as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('applies variant and size classes', () => {
    render(
      <Button variant="danger" size="lg">
        Delete
      </Button>,
    )

    const btn = screen.getByRole('button', { name: 'Delete' })
    expect(btn.className).toContain('bg-destructive')
    expect(btn.className).toContain('px-6')
  })
})
