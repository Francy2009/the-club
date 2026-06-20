import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkForAvailableUpdate } from './update-check'

vi.stubGlobal('__APP_VERSION__', '1.0.19')

describe('update check', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('detects a newer test release tag as an available update', async () => {
    vi.stubGlobal('__APP_VERSION__', '1.0.19')
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        tag_name: 'v1.0.20-test',
        html_url: 'https://github.com/Francy2009/The-Club/releases/tag/v1.0.20-test',
        draft: false,
        prerelease: false,
      }),
    })))

    await expect(checkForAvailableUpdate()).resolves.toMatchObject({
      version: '1.0.20-test',
      tagName: 'v1.0.20-test',
    })
    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      cache: 'no-store',
    }))
  })

  it('ignores the current version', async () => {
    vi.stubGlobal('__APP_VERSION__', '1.0.19')
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        tag_name: 'v1.0.19',
        html_url: 'https://github.com/Francy2009/The-Club/releases/tag/v1.0.19',
        draft: false,
        prerelease: false,
      }),
    })))

    await expect(checkForAvailableUpdate()).resolves.toBeNull()
  })
})
