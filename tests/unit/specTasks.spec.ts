// SPDX-License-Identifier: GPL-3.0-only
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/** Spec 004 US4 (FR-012–FR-014, SC-007, data-model §6): the 003 task list is closed. */

const ROOT_DIR = path.resolve(__dirname, '../..')
const DIR = 'specs/003-independent-fork-separation'
const read = (rel: string) => fs.readFileSync(path.join(ROOT_DIR, rel), 'utf-8')
const line = (text: string, id: string) => text.split('\n').find((l) => new RegExp(`^- \\[[ X]\\] (~~)?${id}\\b`).test(l)) ?? ''

describe('003 tasks are classified', () => {
  const tasks = read(`${DIR}/tasks.md`)

  it('leaves only the maintainer task T062 open', () => {
    const open = tasks.split('\n').filter((l) => l.startsWith('- [ ]'))
    expect(open).toHaveLength(1)
    expect(open[0]).toMatch(/^- \[ \] T062\b/)
    expect(open[0]).toContain('메인테이너 작업, 완료 조건 아님')
  })

  it.each(['T005', 'T048', 'T049', 'T102'])('marks %s as out of scope with its reason and basis', (id) => {
    const l = line(tasks, id)
    expect(l).toMatch(/^- \[X\] ~~/)
    expect(l).toMatch(/범위 제외: [^,)]+, 헌법 v6\.[01]\.0/)
  })

  it('moves T006 to 004 T051', () => {
    expect(line(tasks, 'T006')).toMatch(/004로 이관: 004 T051/)
  })

  it.each(['T076', 'T077'])('splits %s: macOS moves to 004, Linux/Android is out of scope', (id) => {
    const l = line(tasks, id)
    expect(l).toMatch(/^- \[X\]/)
    expect(l).toMatch(/004로 이관: 004 T051/)
    expect(l).toMatch(/범위 제외: [^)]*(Linux|Android)/)
  })

  it('closes T100 through this feature', () => {
    expect(line(tasks, 'T100')).toMatch(/^- \[X\] T100\b.*004 T044/)
  })
})

describe('003 spec status', () => {
  it('is no longer Draft and reflects the result', () => {
    const status = /^\*\*Status\*\*: (.+)$/m.exec(read(`${DIR}/spec.md`))?.[1] ?? ''
    expect(status).not.toMatch(/^Draft/)
    expect(status).toMatch(/Completed/)
    expect(status).toMatch(/004/)
  })
})
