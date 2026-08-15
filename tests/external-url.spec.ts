import { describe, expect, it } from 'vitest'
import { isSafeExternalUrl } from '../src/external-url.js'

describe('isSafeExternalUrl', () => {
  it('allows only ordinary web links', () => {
    expect(isSafeExternalUrl('https://example.test/docs')).toBe(true)
    expect(isSafeExternalUrl('http://127.0.0.1:4312')).toBe(true)
  })

  it('rejects local, custom, and malformed targets', () => {
    expect(isSafeExternalUrl('file:///C:/secret.txt')).toBe(false)
    expect(isSafeExternalUrl('dsh-desktop://open')).toBe(false)
    expect(isSafeExternalUrl('not a url')).toBe(false)
  })
})
