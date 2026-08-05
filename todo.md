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

## 2단계 — 게시물 관리 ✅ 완료 (2026-08-04)

구현 노트는 `note.md`의 "게시물 수정 · 삭제 · 끌어올리기", 막혔던 부분은 `troble.md`의 같은 절에 있다.

### 2-1. 게시물 수정 · 삭제 ✅

- **현황**: 수정도 삭제도 없다. `postApi.ts`에 `.from('posts').delete()`가 한 번 나오지만 그건
  `createPost`가 사진 행 삽입에 실패했을 때 방금 만든 글을 되돌리는 롤백이라 재사용할 수 없다.
  RLS(`posts_update`/`posts_delete`)와 Storage 정책은 이미 판매자만 허용한다.
- **설계**: `postForm.tsx`를 등록/수정 겸용으로 바꾸고(`mode: 'create' | 'edit'` + 초기값)
  `/posts/:postId/edit` 라우트 추가. 상세 페이지 판매자 자리에 ⋯ 메뉴(수정/삭제/끌올).
  삭제는 되돌릴 수 없으니 확인 단계를 둔다 — `postStatusControl`의 거래완료 확인 패턴 재사용.
  이미지 교체 시 Storage 고아 파일 정리는 `createPost`의 수동 롤백 방식을 따른다.
- **마이그레이션**: 없음

### 2-2. 끌어올리기(bump) ✅

- **현황**: `posts.bumped_at`을 정렬에 쓰면서 정작 올릴 수단이 없다.
- **설계**: `bump_post(p_post_id)` RPC — 판매자 본인 + `status='selling'` + 마지막 끌올로부터
  24시간 경과일 때만 `bumped_at = now()`. 쿨다운은 서버가 지켜야 하므로 트리거/RPC에 둔다
  (`enforce_post_status_transition`이 상태 규칙을 서버에 둔 것과 같은 이유). 화면은
  판매관리(`/my/sales`)와 상세 ⋯ 메뉴, 남은 시간 표시.
- **마이그레이션**: `0010_post_bump.sql`

## 3단계 — 탐색 ✅ 완료 (2026-08-04)

구현 노트는 `note.md`의 "탐색 — 정렬 · 홈 무한 스크롤", 밟기 전에 확인한 함정은 `troble.md`의 같은 절에 있다.

### 3-1. 정렬 옵션 (최신 · 인기 · 찜순 · 가격순) ✅

- **현황**: `feature.md` §2.2에 적어놓고 미구현. 필터(카테고리·가격대·거래가능)만 있다.
- **설계**: `search_posts` RPC에 `p_sort` 인자를 추가한다. 어려운 부분은 **keyset 커서** —
  정렬 기준이 바뀌면 커서 컬럼도 같이 바뀌어야 한다. `postSearchCursor.ts`를 정렬별
  `(정렬키, id)` 쌍을 다루도록 일반화하고, `posts_region_price_idx`처럼 정렬 기준별 복합
  인덱스를 채운다. 필터가 URL 쿼리로 관리되고 있으니 정렬도 같은 방식으로 넣는다.
- **마이그레이션**: `0011_post_sort.sql`

### 3-2. 홈 피드 무한 스크롤 ✅

- **현황**: 홈은 `NEIGHBORHOOD_POSTS_LIMIT=20`에서 잘려 21번째 글을 볼 방법이 없다.
- **설계**: `fetchNeighborhoodPosts`를 커서 기반으로 바꾸고 `useInfiniteQuery` +
  `useInfiniteScroll`로 교체. 검색 결과(`postSearchResultList.tsx`)가 이미 같은 구조라 그대로 따른다.
  3-1과 커서 유틸을 공유하므로 함께 진행한다.
- **마이그레이션**: 없음 (3-1에 포함)

## 4단계 — 채팅 가격 제안 ✅ 완료 (2026-08-05)

구현 노트는 `note.md`의 "채팅 가격 제안", 막혔던 부분은 `troble.md`의 같은 절에 있다.

- **현황**: `message_type='price_offer'`, `offer_amount`, `offer_status`(pending/accepted/rejected)가
  스키마에 다 있고 `chatMessageBubble`에 분기까지 있는데 **보내는 길도 수락/거절하는 길도 없다.**
  `guard_message_update` 트리거가 이미 `read_at`·`offer_status`만 바뀌도록 막아둔 상태다.
- **설계**: `chatComposer`에 가격 제안 입력(구매자만) → `sendPriceOfferMutation`.
  버블에 수락/거절 버튼(판매자만, `offer_status='pending'`일 때만) → `respondToOfferMutation`이
  `offer_status`를 갱신. 수락 시 게시물 가격을 바꾸지는 않는다 — 당근도 합의 표시일 뿐이다.
  Realtime 구독이 이미 `messages` UPDATE를 받으므로 상대 화면도 따라 바뀐다(`replica identity full`).
  `messages_update` RLS가 "발신자가 아닌 참여자만"이라 판매자의 수락/거절은 통과하지만,
  **구매자가 자기 제안을 취소하는 길은 막혀 있다** — 취소를 넣으려면 정책을 손봐야 한다.
- **마이그레이션**: 없음 (취소는 넣지 않아 정책을 건드리지 않았다)

## 5단계 — 신뢰 (프로필 · 후기) ✅ 완료 (2026-08-05)

구현 노트는 `note.md`의 "신뢰 — 다른 사용자 프로필 · 거래후기", 밟기 전에 확인한 함정은
`troble.md`의 같은 절에 있다.

### 5-1. 다른 사용자 프로필 페이지 ✅

- **현황**: `postSellerCard`가 링크가 아니다. 남의 매너온도·판매물품·받은 후기를 볼 곳이 없는데,
  당근에서 거래 상대를 판단하는 핵심 화면이다.
- **한 것**: `/users/:userId` 신설. 머리말(`fetch_user_profile`)·판매 목록(`fetch_user_posts`)·
  받은 후기(`fetch_user_reviews`)를 나눠 불렀다 — 뒤의 둘은 무한 스크롤이라 한 번에 담을 수 없다.
  목록 껍데기는 `myListLayout`이 아니라 홈·검색의 `PostList`를 썼다(troble.md 같은 절 2번).
  매너온도 눈금과 판매중·거래완료·후기 개수가 붙는다. 6단계 신고·차단 버튼이 올 자리다.
- **마이그레이션**: `0012_user_profile.sql`

### 5-2. 거래후기 · 매너온도 ✅

- **현황**: `reviews` 테이블과 `recalc_manner_temp` 트리거가 완비돼 있는데 후기를 쓸 화면이 없어
  **전원이 36.5°로 고정**돼 있다. `reviews_after_insert`가 알림까지 넣도록 이미 돼 있다.
- **한 것**: `/posts/:postId/review` 신설. 평가(좋아요·보통·별로) + 매너 태그 + 한 줄이고,
  **점수와 후기 대상은 서버가 정한다** — `create_review`가 게시물의 반대편 당사자를 골라 넣는다.
  진입점 셋(거래완료 직후 안내 `ReviewPrompt`, 구매내역·판매관리 버튼)은 모두
  `fetch_pending_reviews()` 한 목록을 보고 스스로 나타났다 사라진다.
- **마이그레이션**: `0013_review.sql` — "없음"으로 적어 뒀지만 0001의 `reviews_insert`가
  **아무나 아무에게나 −99점을 줄 수 있는 상태**라 정책·제약을 손대야 했다(troble.md 같은 절 1번).

## 6단계 — 안전 (차단 · 신고) ✅ 완료 (2026-08-05)

구현 노트는 `note.md`의 "안전 — 차단 · 신고", 막혔던 부분은 `troble.md`의 같은 절에 있다.

### 6-1. 차단 ✅

- **현황**: `blocks` 테이블·RLS 완비. 화면 0.
- **한 것**: 게시물 상세·프로필·채팅방이 나눠 쓰는 ⋯ 메뉴(`SafetyMenu`)에 차단/해제,
  마이페이지에 `/my/blocks`. 예상대로 **작업량의 대부분은 목록에서 걸러내는 쪽**이었는데,
  걸러낼 자리가 둘이 아니라 넷이었다 — `search_posts`·`fetch_chat_rooms`에 더해
  `open_chat_room`(새 대화)과 `messages_insert` 정책(이미 열린 방)까지 막아야 차단당한 쪽이
  계속 말하는 길이 닫힌다(troble.md 같은 절 3번).
  차단은 양방향이라 `blocks_select`(내가 건 것만)로는 판단할 수 없어 비노출 `private` 스키마에
  `security definer` 판정 함수를 뒀다 — 정책을 넓히면 "누가 나를 차단했는지"가 함께 열린다
  (troble.md 같은 절 2번).
- **마이그레이션**: `0014_block_and_report.sql` (6-2와 한 파일)

### 6-2. 신고 ✅

- **현황**: `reports` 테이블 + insert 전용 RLS 완비(조회 정책이 없어 설계상 관리자 전용).
- **한 것**: 게시물·사용자 신고 시트(사유 선택 + 상세). 제출 후 완료 안내만 띄우고 그 자리에서
  차단을 권한다 — 신고는 아무것도 감추지 않기 때문이다. 의존은 한 방향뿐이다(`ReportSheet`가
  슬롯을 열고 block 쪽이 버튼을 꽂는다).
- **마이그레이션**: "없음"으로 적어 뒀지만 `reason`·`target_id`가 자유 text라 제약이 필요했고
  (0013이 `reviews`에 그랬던 것과 같은 이유), `insert ... returning`이 select 정책 없는 테이블에서
  막히는 바람에 `create_report`가 `returns void`가 됐다(troble.md 같은 절 1번).

## 7단계 — 알림 ✅ 완료 (2026-08-05)

구현 노트는 `note.md`의 "알림", 막혔던 부분은 `troble.md`의 같은 절에 있다.

- **현황**: `notifications` 테이블에 **트리거가 이미 행을 쌓고 있는데** 읽는 화면이 없어 채팅·후기
  알림이 그대로 버려지는 중이었다. `on_message_insert`(chat/price_offer)와
  `recalc_manner_temp`(review)가 넣고 있다.
- **한 것**: `/notifications`(탭바 안) + 홈 헤더의 종에 안 읽은 배지. 배지는 한 곳뿐이다 —
  마이페이지 메뉴에도 링크를 뒀지만 숫자는 없다. `payload jsonb`는 **서버가 푼다**
  (`fetch_notifications`가 join 다섯으로 닉네임·게시물 제목·미리보기까지 준다) — 풀지 않으면
  화면이 알림 한 줄마다 따로 조회하게 된다. 그것을 사람의 말과 이동 경로로 바꾸는 자리만
  순수 함수(`notificationText.ts`)로 두고 단위 테스트했다.
- **주의**: `notification_type` enum에 `comment`·`like`가 있지만 **이 값을 넣는 트리거가 없다.**
  `notificationText`는 두 타입을 이미 다루므로 트리거만 더하면 화면은 그대로 굴러간다.
- **마이그레이션**: `0015_notification.sql` — "댓글·찜 알림을 넣을 때만 필요"로 적어 뒀지만
  손댈 곳이 넷이었다. Realtime publication에 `notifications`가 아예 없었고(구독이 조용히
  성공하고 이벤트만 안 온다), `notifications_update`가 payload까지 바꿀 수 있었고,
  목록을 화면이 쓸 모양으로 푸는 RPC가 필요했고, **6단계가 알림에 남긴 구멍**을 메워야 했다
  (차단해도 그 사람의 알림이 그대로 남는다 — troble.md 같은 절 1번).

## 8단계 — 계정

### 8-1. 비밀번호 변경 · 회원탈퇴 ✅ 완료 (2026-08-05)

구현 노트는 `note.md`의 "계정 — 비밀번호 변경 · 회원탈퇴", 밟기 전에 확인한 함정은
`troble.md`의 같은 절에 있다.

- **현황**: `feature.md` §1 요구사항인데 미구현. `profileSettingsForm`은 닉네임·아바타만 다룬다.
- **한 것**: `/settings/account` 신설(마이페이지 메뉴 맨 아래). 비밀번호 변경은
  `updateUser`로 간단하다고 적어 뒀지만 **그것만으로는 현재 비밀번호를 아무도 검사하지 않아서**
  `signInWithPassword`로 본인 확인을 한 번 거친 뒤 바꾼다. 폼을 감출지 말지는
  `app_metadata.provider`(마지막 로그인 방법)가 아니라 `identities`로 판단해야 한다
  (troble.md 같은 절 1·2번). 탈퇴는 예정대로 첫 Edge Function이 됐고, 지울 사람은
  몸통이 아니라 **요청에 실린 토큰이 정한다**. 확인 문구(`탈퇴합니다`)를 적어야 열린다.
- **마이그레이션**: 없음 (Edge Function 신설 — `supabase functions deploy delete-account`)
- **주의**: 스토리지 뒷정리에서 `chat-images`만 경로가 `{room_id}/{user_id}/…`라
  사용자 접두사로 훑을 수 없다. 삭제 전에 방 번호를 읽어 둔다(troble.md 같은 절 5번).

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
