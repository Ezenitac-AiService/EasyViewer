import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const HEADER_PATTERN =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\([a-z0-9-]+\))?!?: .{4,}$/
const KOREAN_CHAR_PATTERN = /[가-힣]/
const MIN_BODY_LENGTH = 20

/**
 * Validates commit message rules: Korean Conventional Commits header, blank second line,
 * >=20 chars Korean body, or Merge/Revert exception.
 */
export function validateCommitMessage(rawMessage) {
  const cleanedLines = String(rawMessage || '')
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('#'))

  while (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1].trim() === '') {
    cleanedLines.pop()
  }

  if (cleanedLines.length === 0) {
    return { ok: false, reason: '커밋 메시지가 비어 있습니다.' }
  }

  const header = cleanedLines[0]
  if (/^(Merge |Revert )/.test(header)) {
    return { ok: true }
  }

  if (!HEADER_PATTERN.test(header)) {
    return {
      ok: false,
      reason:
        '첫 줄은 Conventional Commits 형식(예: "feat(security): 한국어 요약")이어야 합니다.'
    }
  }

  if (!KOREAN_CHAR_PATTERN.test(header)) {
    return { ok: false, reason: '커밋 제목(첫 줄)에는 한국어 요약이 포함되어야 합니다.' }
  }

  if (cleanedLines.length < 3 || cleanedLines[1].trim() !== '') {
    return { ok: false, reason: '커밋 제목 다음 줄(둘째 줄)은 반드시 빈 줄이어야 합니다.' }
  }

  const body = cleanedLines.slice(2).join('\n').trim()
  if (body.length < MIN_BODY_LENGTH || !KOREAN_CHAR_PATTERN.test(body)) {
    return {
      ok: false,
      reason: `본문은 최소 ${MIN_BODY_LENGTH}자 이상의 한국어 설명(변경 이유/내용/영향)을 포함해야 합니다.`
    }
  }

  return { ok: true }
}

function main() {
  const args = process.argv.slice(2)
  let raw = ''
  const textIdx = args.indexOf('--text')
  if (textIdx >= 0 && args[textIdx + 1] !== undefined) {
    raw = args[textIdx + 1]
  } else if (args[0]) {
    raw = fs.readFileSync(args[0], 'utf-8')
  } else {
    console.error('[check:commit-msg] 사용법: node scripts/check-commit-msg.mjs <COMMIT_EDITMSG_PATH> | --text "<msg>"')
    process.exit(1)
  }

  const res = validateCommitMessage(raw)
  if (!res.ok) {
    console.error(`[check:commit-msg] 검증 실패: ${res.reason}`)
    process.exit(1)
  }
  console.log('[check:commit-msg] 커밋 메시지 규칙 통과')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
