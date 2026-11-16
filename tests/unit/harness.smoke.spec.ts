import { describe, expect, it } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { mockIPC } from '@tauri-apps/api/mocks'

describe('Unit test harness bootstrap', () => {
  it('supports mockIPC isolation and cleans up between tests', async () => {
    mockIPC((cmd, args) => {
      if (cmd === 'ping_harness') {
        return { echoed: (args as { msg?: string })?.msg ?? '' }
      }
      return null
    })

    const res = await invoke<{ echoed: string }>('ping_harness', { msg: 'ok' })
    expect(res.echoed).toBe('ok')
  })
})
