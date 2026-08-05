---
name: git-push
description: 현재 작업한 내용을 브랜치에 push하고 develop 브랜치로 PR을 생성한다. 작업을 마치고 올릴 때 사용한다.
---

## 상세 설명

1. PR 이름은 작업 내용에 따라 `ui` / `chore` / `fix` / `design` / `feature` 등으로 구분해 작업명을 간단하게 요약해 붙인다.
   - 예: `ui : 카드 디자인 변경`, `feature : 로그인 기능 추가`
2. PR 상세 내용에는 작업 내용을 적절하게 요약하여 작성한다.
3. 절대 `main` 브랜치에 push 금지 — 반드시 `develop` 브랜치에 PR을 생성한다.
