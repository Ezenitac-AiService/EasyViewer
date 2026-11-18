// SPDX-License-Identifier: GPL-3.0-only
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Installs the archived Pagelight iOS build on a personal device (spec 003 FR-018).
 * The device UDID is never stored in the repository; pass it through IOS_DEVICE_ID.
 */
export const APP_PATH = 'src-tauri/gen/apple/build/pagelight_iOS.xcarchive/Products/Applications/Pagelight.app'

export function buildInstallCommand(env = process.env) {
  const deviceId = String(env.IOS_DEVICE_ID || '').trim()
  if (!deviceId) return null
  return ['xcrun', ['devicectl', 'device', 'install', 'app', '--device', deviceId, APP_PATH]]
}

function main() {
  const cmd = buildInstallCommand()
  if (!cmd) {
    console.error('[ios:install] IOS_DEVICE_ID 환경 변수가 필요합니다.')
    console.error('  사용법: IOS_DEVICE_ID=<기기 UDID> npm run ios:install')
    console.error('  UDID 확인: xcrun devicectl list devices   (자세한 내용은 docs/ios-build.md)')
    process.exit(1)
  }
  if (!fs.existsSync(path.resolve(APP_PATH))) {
    console.error(`[ios:install] 앱 번들이 없습니다: ${APP_PATH}. 먼저 npm run ios:build를 실행하세요.`)
    process.exit(1)
  }
  const res = spawnSync(cmd[0], cmd[1], { stdio: 'inherit' })
  process.exit(res.status ?? 1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
