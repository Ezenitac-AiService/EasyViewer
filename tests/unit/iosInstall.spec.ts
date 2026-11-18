// SPDX-License-Identifier: GPL-3.0-only
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { APP_PATH, buildInstallCommand } from '../../scripts/ios-install.mjs'

/** spec 003 FR-017 / T060: the device UDID comes only from IOS_DEVICE_ID, never from the repository. */
describe('ios-install (spec 003 T060)', () => {
  it('returns no command when IOS_DEVICE_ID is missing or blank', () => {
    expect(buildInstallCommand({})).toBeNull()
    expect(buildInstallCommand({ IOS_DEVICE_ID: '   ' })).toBeNull()
  })

  it('installs the Pagelight archive on the device given by IOS_DEVICE_ID', () => {
    const cmd = buildInstallCommand({ IOS_DEVICE_ID: ' DEVICE-123 ' })
    expect(cmd).not.toBeNull()
    const [bin, args] = cmd as [string, string[]]
    expect(bin).toBe('xcrun')
    expect(args).toEqual(['devicectl', 'device', 'install', 'app', '--device', 'DEVICE-123', APP_PATH])
    expect(APP_PATH).toMatch(/pagelight_iOS\.xcarchive\/Products\/Applications\/Pagelight\.app$/)
    expect(APP_PATH).not.toMatch(/easy-viewer|EasyViewer/)
  })

  it('prints usage and exits with code 1 without IOS_DEVICE_ID', () => {
    const env = { ...process.env }
    delete env.IOS_DEVICE_ID
    const res = spawnSync(process.execPath, [path.resolve('scripts/ios-install.mjs')], { env, encoding: 'utf-8' })
    expect(res.status).toBe(1)
    expect(res.stderr).toMatch(/IOS_DEVICE_ID/)
  })
})
