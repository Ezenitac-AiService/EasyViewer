// SPDX-License-Identifier: GPL-3.0-only
// Constitution principle I: user-facing text is Korean. Blocks a wrap_up whose recap, question or
// button labels contain no Hangul, so the agent rewrites them before the box reaches the user.
let raw = ''
process.stdin.on('data', (c) => (raw += c))
process.stdin.on('end', () => {
  let input = {}
  try {
    input = JSON.parse(raw).tool_input ?? {}
  } catch {
    return
  }
  const fields = [
    ['recap', input.recap],
    ['ask', input.ask],
    ...(input.actions ?? []).filter((a) => a.label).map((a, i) => [`actions[${i}].label`, a.label])
  ].filter(([, v]) => typeof v === 'string' && v.trim())
  const notKorean = fields.filter(([, v]) => !/[가-힣]/.test(v))
  if (!notKorean.length) return
  const list = notKorean.map(([k, v]) => `${k}: "${v}"`).join('; ')
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `헌법 제1원칙: wrap_up의 recap·ask·버튼은 한국어로 써야 합니다. 한국어로 다시 쓰세요 → ${list}`
      }
    })
  )
})
