# 작업 규칙

스킬 본문은 `.claude/skills/` 아래로 옮겼다. Claude Code가 이 경로에서 자동으로 읽어 가며,
`/git-push`처럼 이름으로 직접 부를 수도 있다.

| 스킬 | 하는 일 |
|---|---|
| [`git-push`](.claude/skills/git-push/SKILL.md) | 작업 내용을 push하고 `develop`으로 PR 생성 (`main` push 금지) |
| [`git-delete-branch`](.claude/skills/git-delete-branch/SKILL.md) | `main`·`develop`을 뺀 로컬·원격 브랜치 정리 (삭제 전 확인) |
| [`write-note`](.claude/skills/write-note/SKILL.md) | 구현 내용을 `note.md`에, 막혔던 부분을 `troble.md`에 기록 |

그 밖의 코드 규칙은 `convention.md`와 `eslint.config.js`에 있다.
