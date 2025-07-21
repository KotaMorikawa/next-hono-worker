import { describe, it, expect } from 'vitest'
import app from '../index'

describe('Hono Backend', () => {
  it('should return Hello Hono! for GET /', async () => {
    const res = await app.request('/')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('Hello Hono!')
  })
})