// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { getAllMembersFn, getCurrentUserFn, setupValidator } from './desktop-api'

describe('desktop first launch bootstrap', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('creates only the admin profile and opens the setup flow on first launch', async () => {
    const user = await getCurrentUserFn()

    expect(user).toMatchObject({
      username: 'admin',
      role: 'admin',
      must_setup: true,
      password_changed: false,
    })

    await setupValidator({
      data: {
        username: 'admin',
        password: 'NuovaPass1!',
        recovery_phrase: 'frase recupero molto sicura',
      },
    })

    expect(await getAllMembersFn()).toEqual([])
  })
})
