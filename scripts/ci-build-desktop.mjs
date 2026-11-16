import fs from 'node:fs'
import { execSync } from 'node:child_process'

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
const ver = String(pkg.version || '')
const name = process.env.MATRIX_NAME || ''
let cmd = process.env.MATRIX_BUILD_CMD || 'npm run mac:build'

if (name === 'windows-x64' && /-[A-Za-z]/.test(ver)) {
  cmd = 'npx tauri build --bundles nsis'
} else if (name === 'linux-x64' && ver.includes('-')) {
  cmd = 'npx tauri build --bundles deb,appimage'
}

console.log(`[ci-build-desktop] name=${name}, version=${ver}, cmd=${cmd}`)
execSync(cmd, { stdio: 'inherit' })
