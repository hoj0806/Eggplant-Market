# EggPlant Market — 아키텍처 설계 문서

당근마켓 클론 중고거래 플랫폼의 구현 설계 문서. 기능 명세는 [`../feature.md`](../feature.md),
코딩 규칙은 [`../convention.md`](../convention.md), 개발 원칙은 [`../cluade.md`](../cluade.md) 참고.

> 현재 단계는 **설계 + DB 스키마(SQL)** 까지. React 앱 스캐폴딩·기능 구현은 이후 `todo.md` 지시 시 진행한다.

---

## 1. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 빌드 | Vite + React + TypeScript | SPA |
| 스타일 | Tailwind CSS (`darkMode: 'class'`) | 다크모드 대응 |
| 라우팅 | React Router | |
| 클라이언트 상태 | **Zustand** | auth 세션, 테마, UI 상태 |
| 서버 상태 | **TanStack Query** | 캐싱·무한스크롤·낙관적 업데이트 |
| 백엔드 | **Supabase** (Postgres + Auth + Storage + Realtime) | RLS로 권한 제어 |
| 위치/지도 | 카카오맵 JS SDK | 동네 설정, 상품 위치 |
| 테스트 | **Jest** + ts-jest + React Testing Library | `cluade.md` 요구 |

> Vite에선 Vitest가 더 자연스럽지만 `cluade.md`가 Jest를 명시하므로 Jest(ts-jest, jsdom) 사용.

**상태 분리 원칙**
- **Zustand**: `authStore`(user/session), `uiStore`(테마·모달, localStorage 영속).
- **TanStack Query**: 게시물/댓글/찜/채팅/알림/프로필 등 모든 서버 데이터. Realtime 이벤트 수신 시
  `queryClient.setQueryData` / `invalidateQueries`로 캐시 갱신.

---

## 2. 폴더 구조 (기능 기반)

```
src/
├─ app/            # App.tsx, router.tsx, providers.tsx(QueryClientProvider 등)
├─ features/       # 기능별 모듈. 각 내부: components/ hooks/ api/ store/ types.ts
│  ├─ auth/  post/  browse/  like/  comment/  chat/
│  ├─ review/  map/  notification/  report/  block/  profile/
├─ shared/
│  ├─ ui/          # Button, Modal, Spinner 등 공용 컴포넌트
│  ├─ lib/         # supabaseClient, queryClient, kakaoMapLoader
│  ├─ hooks/       # useInfiniteScroll, useDebounce 등
│  ├─ types/       # database.types.ts (supabase gen types 결과)
│  └─ utils/
├─ styles/         # index.css(tailwind), 테마 토큰
└─ main.tsx
supabase/
├─ migrations/0001_init.sql
└─ seed.sql
```

- 테스트는 대상 파일 옆 `*.test.ts(x)` 코로케이션.
- `.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_KAKAO_MAP_KEY`.

---

## 3. 데이터 모델

전체 스키마는 [`../supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql),
관계 다이어그램은 [`erd.md`](./erd.md) 참고. 요약:

- **profiles** — auth.users 1:1. 매너온도(기본 36.5°), 동네 좌표(`geography`), 검색 반경.
- **categories** — 시드 고정 분류.
- **posts / post_images** — 게시물 + 이미지. `bumped_at`(끌올/방금전 정렬), `location`(거리검색).
- **likes / comments** — 찜, 댓글(대댓글).
- **chat_rooms / messages** — 게시물당 (buyer, seller) 1:1 방. `price_offer` 타입 = 가격 제안.
- **reviews** — 거래후기 → 트리거로 매너온도 재계산.
- **notifications** — Realtime 알림.
- **blocks / reports** — 차단, 신고.
- **recently_viewed** — 최근 본 상품(upsert).

**거리 기반 검색**: PostGIS `geography` + `st_dwithin`. RPC `nearby_posts(lat, lng, radius_m, category, cursor, limit)`가
반경 내 게시물을 `bumped_at desc` keyset 커서로 반환 → 무한스크롤에 사용.

**RLS 원칙**: 공개 자원(profiles/posts/comments/likes/reviews)은 조회 공개·소유자만 쓰기,
채팅(chat_rooms/messages)은 참여자만, 개인 자원(notifications/blocks/recently_viewed)은 본인만,
reports는 생성만 허용(조회 불가).

**트리거/함수**: `handle_new_user`(가입 시 profiles 생성), `increment_view_count`(RPC),
`on_message_insert`(채팅방 요약 갱신 + 알림), `recalc_manner_temp`(후기 시 온도 갱신), `set_updated_at`.

**Storage 버킷**: `post-images`, `avatars` (공개 읽기, 소유자만 쓰기).

---

## 4. 기능별 설계

### 인증 (`features/auth`)
- Supabase Auth **이메일 + 구글 OAuth** (카카오 로그인은 이후 추가).
- 세션: `supabase.auth.onAuthStateChange` → `authStore` 동기화.
- **온보딩**(최초 가입): 닉네임 + 카카오맵으로 동네 선택(역지오코딩 → dong_name·좌표) + 반경.
- 비밀번호 변경(이메일 회원), 회원탈퇴.

### 게시물 (`features/post`)
- 등록: 사진 다중 업로드(Storage), 제목·설명·가격·거래장소·카테고리, 상태 토글(판매중/거래중/거래완료).
- 상세: 이미지 캐러셀, 판매자 매너온도, 찜·댓글, "채팅하기" → 방 생성/진입, 조회 시 `increment_view_count` + `recently_viewed` upsert.

### 조회 (`features/browse`)
- `nearby_posts` RPC로 내 동네 반경 목록. 필터: 카테고리 / 인기(view_count) / 방금전(bumped_at) / 찜많은순 / 가격.
- 검색: `pg_trgm` 기반 제목·설명 ILIKE. 무한스크롤: `useInfiniteQuery` + keyset 커서.
- 지도 보기: 카카오맵 위 주변 게시물 마커.

### 채팅 (`features/chat`)
- 게시물당 1:1 방. Realtime 구독으로 메시지 수신 → 쿼리 캐시 갱신.
- **가격 제안**: `type='price_offer'`, `offer_amount`, `offer_status`(pending/accepted/rejected) 수락·거절 UI.

### 그 외
- **매너온도·후기**(`review`): 거래완료 후 상호 평가 → 매너온도 반영.
- **알림**(`notification`): Realtime 구독, 읽음 처리.
- **차단**(`block`) / **신고**(`report`) / **프로필**(`profile`: 판매관리·구매내역·최근 본 상품·매너온도).
- **다크모드**: Tailwind `class` 전략 + `uiStore`.

---

## 5. 컨벤션 준수 규칙

- **화살표 함수 금지** → 컴포넌트·핸들러·콜백 모두 `function` 선언/표현식.
  예: `function PostCard(props: PostCardProps) {}`, `items.map(function renderItem(item) {})`.
- **파일명 camelCase** → `postCard.tsx`가 `function PostCard()` export (컴포넌트 식별자는 PascalCase 유지).
- **`any` 금지** → `supabase gen types typescript`로 생성한 `database.types.ts` 사용.
- **상수 UPPERCASE** → `const DEFAULT_RADIUS_M = 2000`, `const PAGE_SIZE = 20`.
- **긴 함수 분리 / 역할별 컴포넌트 분리** → 컨테이너(데이터·훅) vs 프레젠테이션(UI) 분리.

---

## 6. 테스트 전략 (Jest)

- **단위**: 순수 유틸/포매터/셀렉터, Zustand 스토어 액션.
- **컴포넌트**: React Testing Library 렌더·상호작용.
- **훅/통합**: TanStack Query 훅은 QueryClient 래퍼로 테스트.
- **"mock 데이터 금지" 해석**: *앱 런타임*은 항상 실제 Supabase에서 읽는다(하드코딩 배열 금지).
  테스트는 **로컬 Supabase 인스턴스(`supabase start`)** 를 시드해 실제 스키마로 검증(= mock이 아닌 실 DB 동작).
  *(구현 착수 전 재확인 권장)*

---

## 7. 사전 준비물 & 저장소 주의

- **Supabase 프로젝트** URL·anon key, **Google OAuth** 클라이언트, **카카오맵 JS 앱키**(+도메인 등록) 필요(구현 단계).
- 현재 폴더는 홈 디렉터리 git 저장소(무관한 히스토리) 내부 → 구현 착수 시 **별도 git 저장소 초기화 + `develop` 브랜치 생성**
  (`SKILL.md`가 `develop` 대상 PR 요구, `main` push 금지).
