# 할 일 — 실제 당근마켓 대비 미구현 기능

현재 상태(`10e062f`): 인증(이메일·구글) → 온보딩(닉네임·동네) → 게시물 등록/상세/찜/조회수 →
검색·필터 → 채팅(실시간·이미지)·거래상태 → 마이페이지까지 완성. "올리고·찾고·대화하고·거래상태
바꾸는" 한 바퀴는 돈다.

아래는 실제 당근마켓에 있는데 아직 없는 것들이다. **DB는 이미 대부분 깔려 있다** —
`0001_init.sql`이 `comments`·`reviews`·`notifications`·`blocks`·`reports`를 전부 만들어뒀고
`src/features/{comment,review,notification,block,report,map}/`가 `.gitkeep`만 있는 빈 폴더다.
그래서 대부분 마이그레이션 없이 api/hooks/components만 얹으면 된다.

단계 하나가 PR 하나다. 순서는 앞 단계가 뒤 단계의 자리를 만들어주도록 잡았다.

---

## 1단계 — 앱 껍데기 ✅ 완료 (2026-08-04)

구현 노트는 `note.md`의 "앱 껍데기 — 하단 탭바 · 다크모드", 막혔던 부분은 `troble.md`의 같은 절에 있다.

### 1-1. 하단 탭바 · 공용 레이아웃 ✅

- **현황**: 레이아웃 셸이 없다. 페이지마다 자기 `<main>`을 그리고 `← 홈` 링크로 오간다.
  당근 형태와 가장 크게 어긋나는 부분.
- **설계**: `src/app/appLayout.tsx`(`<Outlet/>` + 하단 탭바) 신설 → `router.tsx`를 중첩 라우트로
  개편해 홈/검색/글쓰기/채팅/마이를 탭바 아래에 둔다. 상세·채팅방처럼 몰입이 필요한 화면은
  탭바 밖에 남긴다. 채팅 탭에는 안 읽은 수 배지(`fetch_chat_rooms`가 이미 내려줌).
  각 페이지에서 `← 홈`류 링크와 중복 헤더를 걷어낸다.
- **마이그레이션**: 없음

### 1-2. 다크모드 토글 ✅

- **현황**: `index.css`에 `@custom-variant dark`가 있고 65개 파일에 `dark:` 클래스를 다 써놨는데
  **`.dark`를 붙이는 코드가 없어 영원히 라이트모드다.**
- **설계**: `src/shared/store/uiStore.ts`(Zustand + localStorage 영속, `'light'|'dark'|'system'`)
  → `providers.tsx`에서 `document.documentElement.classList`에 반영하고
  `matchMedia('(prefers-color-scheme: dark)')` 변화를 구독. 마이페이지 설정에 토글.
- **마이그레이션**: 없음. 들이는 품 대비 체감 변화가 가장 크다.

## 2단계 — 게시물 관리

### 2-1. 게시물 수정 · 삭제

- **현황**: 수정도 삭제도 없다. `postApi.ts`에 `.from('posts').delete()`가 한 번 나오지만 그건
  `createPost`가 사진 행 삽입에 실패했을 때 방금 만든 글을 되돌리는 롤백이라 재사용할 수 없다.
  RLS(`posts_update`/`posts_delete`)와 Storage 정책은 이미 판매자만 허용한다.
- **설계**: `postForm.tsx`를 등록/수정 겸용으로 바꾸고(`mode: 'create' | 'edit'` + 초기값)
  `/posts/:postId/edit` 라우트 추가. 상세 페이지 판매자 자리에 ⋯ 메뉴(수정/삭제/끌올).
  삭제는 되돌릴 수 없으니 확인 단계를 둔다 — `postStatusControl`의 거래완료 확인 패턴 재사용.
  이미지 교체 시 Storage 고아 파일 정리는 `createPost`의 수동 롤백 방식을 따른다.
- **마이그레이션**: 없음

### 2-2. 끌어올리기(bump)

- **현황**: `posts.bumped_at`을 정렬에 쓰면서 정작 올릴 수단이 없다.
- **설계**: `bump_post(p_post_id)` RPC — 판매자 본인 + `status='selling'` + 마지막 끌올로부터
  24시간 경과일 때만 `bumped_at = now()`. 쿨다운은 서버가 지켜야 하므로 트리거/RPC에 둔다
  (`enforce_post_status_transition`이 상태 규칙을 서버에 둔 것과 같은 이유). 화면은
  판매관리(`/my/sales`)와 상세 ⋯ 메뉴, 남은 시간 표시.
- **마이그레이션**: `0010_post_bump.sql`

## 3단계 — 탐색

### 3-1. 정렬 옵션 (최신 · 인기 · 찜순 · 가격순)

- **현황**: `feature.md` §2.2에 적어놓고 미구현. 필터(카테고리·가격대·거래가능)만 있다.
- **설계**: `search_posts` RPC에 `p_sort` 인자를 추가한다. 어려운 부분은 **keyset 커서** —
  정렬 기준이 바뀌면 커서 컬럼도 같이 바뀌어야 한다. `postSearchCursor.ts`를 정렬별
  `(정렬키, id)` 쌍을 다루도록 일반화하고, `posts_region_price_idx`처럼 정렬 기준별 복합
  인덱스를 채운다. 필터가 URL 쿼리로 관리되고 있으니 정렬도 같은 방식으로 넣는다.
- **마이그레이션**: `0011_post_sort.sql`

### 3-2. 홈 피드 무한 스크롤

- **현황**: 홈은 `NEIGHBORHOOD_POSTS_LIMIT=20`에서 잘려 21번째 글을 볼 방법이 없다.
- **설계**: `fetchNeighborhoodPosts`를 커서 기반으로 바꾸고 `useInfiniteQuery` +
  `useInfiniteScroll`로 교체. 검색 결과(`postSearchResultList.tsx`)가 이미 같은 구조라 그대로 따른다.
  3-1과 커서 유틸을 공유하므로 함께 진행한다.
- **마이그레이션**: 없음 (3-1에 포함)

## 4단계 — 채팅 가격 제안

- **현황**: `message_type='price_offer'`, `offer_amount`, `offer_status`(pending/accepted/rejected)가
  스키마에 다 있고 `chatMessageBubble`에 분기까지 있는데 **보내는 길도 수락/거절하는 길도 없다.**
  `guard_message_update` 트리거가 이미 `read_at`·`offer_status`만 바뀌도록 막아둔 상태다.
- **설계**: `chatComposer`에 가격 제안 입력(구매자만) → `sendPriceOfferMutation`.
  버블에 수락/거절 버튼(판매자만, `offer_status='pending'`일 때만) → `respondToOfferMutation`이
  `offer_status`를 갱신. 수락 시 게시물 가격을 바꾸지는 않는다 — 당근도 합의 표시일 뿐이다.
  Realtime 구독이 이미 `messages` UPDATE를 받으므로 상대 화면도 따라 바뀐다(`replica identity full`).
  `messages_update` RLS가 "발신자가 아닌 참여자만"이라 판매자의 수락/거절은 통과하지만,
  **구매자가 자기 제안을 취소하는 길은 막혀 있다** — 취소를 넣으려면 정책을 손봐야 한다.
- **마이그레이션**: 취소 기능을 넣을 때만 필요

## 5단계 — 신뢰 (프로필 · 후기)

### 5-1. 다른 사용자 프로필 페이지

- **현황**: `postSellerCard`가 링크가 아니다. 남의 매너온도·판매물품·받은 후기를 볼 곳이 없는데,
  당근에서 거래 상대를 판단하는 핵심 화면이다.
- **설계**: `/users/:userId` 신설. `fetch_user_profile(p_user_id)` RPC로 프로필 + 판매중 글 +
  받은 후기를 한 번에. `profiles`는 RLS가 공개 조회라 별도 정책이 필요 없다.
  마이페이지 목록 화면들과 같은 껍데기(`myListLayout.tsx`)를 쓴다. 여기가 6단계 신고·차단
  버튼이 붙을 자리이기도 하다.
- **마이그레이션**: `0012_user_profile.sql`

### 5-2. 거래후기 · 매너온도

- **현황**: `reviews` 테이블과 `recalc_manner_temp` 트리거가 완비돼 있는데 후기를 쓸 화면이 없어
  **전원이 36.5°로 고정**돼 있다. `reviews_after_insert`가 알림까지 넣도록 이미 돼 있다.
- **설계**: 거래완료(`status='sold'`) 후 판매자·구매자 상호 평가. `unique (post_id, reviewer_id)`가
  중복 작성을 막는다. 매너 태그(`manner_tags text[]`) 선택 + 점수 + 한 줄. 진입점은
  거래완료 직후 안내와 `/my/purchases`·`/my/sales` 목록의 "후기 남기기" 버튼.
  받은 후기는 5-1 프로필 페이지에 표시.
- **마이그레이션**: 없음

## 6단계 — 안전 (차단 · 신고)

### 6-1. 차단

- **현황**: `blocks` 테이블·RLS 완비. 화면 0.
- **설계**: 프로필 페이지·채팅방 ⋯ 메뉴에 차단/해제. **차단은 목록에서 걸러내야 의미가 있다** —
  `search_posts`·`fetch_neighborhood_posts`·`fetch_chat_rooms`에 `blocks` 제외 조건을 넣는 것이
  실제 작업량의 대부분이다. 마이페이지에 차단 목록 관리 화면.
- **마이그레이션**: `0013_block_filter.sql` (기존 RPC들 재정의)

### 6-2. 신고

- **현황**: `reports` 테이블 + insert 전용 RLS 완비(조회 정책이 없어 설계상 관리자 전용).
- **설계**: 게시물 상세·프로필·채팅방에서 신고 시트 → 사유 선택 + 상세. 신고자는 자기 신고도
  다시 볼 수 없으므로(정책상 조회 불가) 제출 후 완료 안내만 띄운다. 신고 후 차단을 권하는
  흐름으로 6-1과 이어 붙인다.
- **마이그레이션**: 없음

## 7단계 — 알림

- **현황**: `notifications` 테이블에 **트리거가 이미 행을 쌓고 있는데** 읽는 화면이 없어 채팅·후기
  알림이 그대로 버려지는 중이다. `on_message_insert`(chat/price_offer)와
  `recalc_manner_temp`(review)가 넣고 있다.
- **설계**: `/notifications` + 탭바(또는 헤더)에 안 읽은 배지. Realtime 구독은
  `useChatRealtime.ts` 패턴을 그대로 따른다. `payload jsonb`를 타입별로 해석해 문구와 이동 경로를
  만드는 순수 함수(`notificationText.ts`)를 두고 단위 테스트한다.
- **주의**: `notification_type` enum에 `comment`·`like`가 있지만 **이 값을 넣는 트리거가 없다.**
  댓글·찜 알림까지 원하면 트리거를 새로 만들어야 한다(프론트 작업만으로는 안 된다).
- **마이그레이션**: 댓글·찜 알림을 넣을 때만 필요

## 8단계 — 계정

### 8-1. 비밀번호 변경 · 회원탈퇴

- **현황**: `feature.md` §1 요구사항인데 미구현. `profileSettingsForm`은 닉네임·아바타만 다룬다.
- **설계**: 비밀번호 변경은 `supabase.auth.updateUser`로 간단하다(이메일 회원만 — 구글 로그인
  사용자에게는 감춘다). **탈퇴는 `service_role`이 필요해 이 프로젝트의 첫 Edge Function이 된다**
  (`supabase/functions/delete-account/`). FK가 대부분 `on delete cascade`라 행은 따라 지워지지만
  Storage 파일은 안 지워지므로 함수 안에서 직접 정리한다.
- **마이그레이션**: 없음 (Edge Function 신설)

### 8-2. 카카오 로그인

- **현황**: 명세는 카카오·구글·이메일인데 실제는 구글·이메일뿐이다.
- **설계**: 코드는 `googleSignInButton.tsx` 복제 수준으로 적다. 다만 **카카오 개발자 콘솔 앱 등록,
  REST API 키 발급, Supabase Auth 프로바이더 설정, 리다이렉트 URI 등록은 사람이 직접 해야 한다.**
  착수 전에 그 준비부터 확인한다.
- **마이그레이션**: 없음

---

## 이번에 뺀 것

- **게시물 댓글·대댓글** — `comments` 테이블·RLS·`parent_id`(대댓글)·인덱스까지 다 있어서
  마음먹으면 바로 할 수 있다. 필요해지면 꺼내 쓴다.
- **지도에서 주변 물품 보기** — `nearby_posts` RPC(PostGIS `st_dwithin`)와 `kakaoMapLoader`가
  준비돼 있는데 한 번도 호출되지 않는다. `profiles.search_radius_m`도 함께 잠들어 있다.

---

## 작업 규칙 (`SKILL.md`)

- 기능마다 `develop`으로 PR (`feature : 한글 요약`). `main` push 금지.
- 구현 후 `note.md`에 구현 노트, 막혔던 부분은 `troble.md`에 "증상 → 원인 → 해결".
- 화살표 함수 금지 / `any` 금지 / 파일명 camelCase / 상수 UPPERCASE — `eslint.config.js`가 강제한다.
- 기능마다 Jest 테스트를 붙이고 통과시킨 뒤 적용한다.
