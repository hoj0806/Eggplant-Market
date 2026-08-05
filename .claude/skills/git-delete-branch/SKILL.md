---
name: git-delete-branch
description: 로컬 저장소와 원격 저장소에 있는 main, develop 브랜치를 제외하고 남아있는 모든 브랜치를 삭제한다. 병합이 끝난 브랜치를 정리할 때 사용한다.
---

## 상세 설명

1. 절대 `main`과 `develop` 브랜치는 삭제하지 않는다.
2. 삭제하기 전 사용자에게 한 번 더 물어본다.

## 절차

1. `git branch`와 `git branch -r`로 로컬·원격 브랜치를 모은다.
2. `git branch --merged develop`으로 병합 여부를 확인한다.
   병합되지 않은 브랜치가 있으면 어떤 커밋이 남아 있는지(`git log develop..<브랜치> --oneline`)
   함께 보여 준다. 삭제하면 그 커밋은 사라진다.
3. 삭제 대상 목록과 미병합 브랜치를 사용자에게 보여 주고 확인을 받는다.
   원격 삭제는 되돌리기 어렵다는 점을 함께 알린다.
4. 확인 후 로컬(`git branch -d`) → 원격(`git push origin --delete`) 순으로 삭제한다.
   `-D`(강제 삭제)는 사용자가 미병합 브랜치까지 지우기로 명시한 경우에만 쓴다.
5. `git fetch --prune` 후 남은 브랜치를 보여 준다.
