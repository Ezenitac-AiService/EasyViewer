// SPDX-License-Identifier: GPL-3.0-only
// Constitution principle I reminder injected on every user prompt.
process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext:
        '헌법 제1원칙: 사용자에게 보이는 모든 답변·질문·진행 보고와 wrap_up의 recap·ask·버튼, update_plan 단계 이름은 한국어로 쓴다. 백그라운드 작업 알림 뒤의 보고도 같다. 코드 식별자·주석·테스트 코드는 영어.'
    }
  })
)
