import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  cn,
  formatDate,
  getInitials,
  generateAvatarColor,
  truncate,
  debounce,
  lockBodyScroll,
  unlockBodyScroll,
} from './utils'

describe('cn', () => {
  it('merges class names and resolves tailwind conflicts', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
    const hidden = false
    expect(cn('text-white', hidden && 'hidden', undefined)).toBe('text-white')
  })
})

describe('formatDate', () => {
  it('returns "Just now" for timestamps under a minute old', () => {
    expect(formatDate(new Date())).toBe('Just now')
  })

  it('formats minutes, hours and days', () => {
    const now = Date.now()
    expect(formatDate(new Date(now - 5 * 60_000))).toBe('5m ago')
    expect(formatDate(new Date(now - 3 * 3_600_000))).toBe('3h ago')
    expect(formatDate(new Date(now - 2 * 86_400_000))).toBe('2d ago')
  })

  it('accepts ISO strings', () => {
    expect(formatDate(new Date(Date.now() - 60_000).toISOString())).toBe('1m ago')
  })
})

describe('getInitials', () => {
  it('takes the first letters of words, uppercased, max 2', () => {
    expect(getInitials('john doe')).toBe('JD')
    expect(getInitials('madonna')).toBe('M')
    expect(getInitials('a b c')).toBe('AB')
  })
})

describe('generateAvatarColor', () => {
  it('is deterministic and falls back for empty id', () => {
    expect(generateAvatarColor('user-1')).toBe(generateAvatarColor('user-1'))
    expect(generateAvatarColor('')).toMatch(/^from-/)
    expect(generateAvatarColor(42)).toMatch(/to-/)
  })
})

describe('truncate', () => {
  it('leaves short strings untouched and cuts long ones with ellipsis', () => {
    expect(truncate('hello', 10)).toBe('hello')
    expect(truncate('hello world', 5)).toBe('hello...')
  })
})

describe('debounce', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls the function once after the wait period', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced('a')
    debounced('b')
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('b')
  })
})

describe('lockBodyScroll/unlockBodyScroll', () => {
  afterEach(() => {
    // Сброс возможного остаточного состояния между тестами.
    while (document.body.style.overflow === 'hidden') {
      unlockBodyScroll()
    }
    document.body.style.overflow = ''
  })

  it('locks and restores body overflow with reference counting', () => {
    expect(document.body.style.overflow).toBe('')

    lockBodyScroll()
    lockBodyScroll()
    expect(document.body.style.overflow).toBe('hidden')

    unlockBodyScroll()
    expect(document.body.style.overflow).toBe('hidden')

    unlockBodyScroll()
    expect(document.body.style.overflow).toBe('')
  })

  it('ignores unlock without a matching lock', () => {
    unlockBodyScroll()
    expect(document.body.style.overflow).toBe('')
  })
})
