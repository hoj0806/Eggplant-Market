---
name: git-push
description: develop 브랜치에 현재 작업한 내용을 push하고 pr을 생성함
---

## 상세 설명

1. PR 이름은 작업 내용에 따라 `ui` / `chore` / `fix` / `design` / `feature` 등으로 구분해 작업명을 간단하게 요약해 붙인다.
   - 예: `ui : 카드 디자인 변경`, `feature : 로그인 기능 추가`
2. PR 상세 내용에는 작업 내용을 적절하게 요약하여 작성한다.
3. 절대 `main` 브랜치에 push 금지 — 반드시 `develop` 브랜치에 PR을 생성한다.

---

name: git-delete-branch
description: 로컬 저장소와 원격 저장소에 있는 main, develop 브랜치를 제외하고 남아있는 모든 브랜치 삭제

---

## 상세 설명

1.절대 main과 develop 브랜치는 삭제하지 않는다 2.삭제하기전 사용자에게 한번 더 물어봄
