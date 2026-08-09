# EggPlant Market — 아키텍처 설계 문서

당근마켓 클론 중고거래 플랫폼의 구현 설계 문서. 기능 명세는 [`../feature.md`](../feature.md),
코딩 규칙은 [`../convention.md`](../convention.md), 개발 원칙은 [`../CLAUDE.md`](../CLAUDE.md) 참고.

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
| 테스트 | **Jest** + ts-jest + React Testing Library | `CLAUDE.md` 요구 |

> Vite에선 Vitest가 더 자연스럽지만 `CLAUDE.md`가 Jest를 명시하므로 Jest(ts-jest, jsdom) 사용.

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
- Supabase Auth **카카오 + 구글 OAuth만**. 이메일·비밀번호는 2026-08-07에 걷어냈고
  대시보드의 Email 프로바이더도 껐다(2026-08-08) — API로도 이메일 가입이 안 된다.
- **가입과 로그인을 가르지 않는다.** OAuth가 처음 온 사람이면 계정을 만들고 이미 있으면
  들여보내므로 `/signup`이 없다. `profiles` 행은 `handle_new_user` 트리거가 만든다.
- 세션: `supabase.auth.onAuthStateChange` → `authStore` 동기화.
- **온보딩**(최초 가입): 닉네임 + 카카오맵으로 동네 선택(역지오코딩 → dong_name·좌표) + 반경.
  **소셜이 준 이름·사진은 쓰지 않는다** — 닉네임은 직접 받는다.
- 회원탈퇴(Edge Function `delete-account`). 비밀번호가 없으니 변경 화면도 없다.

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

`jest.config.cjs`가 **세 갈래(projects)** 로 나뉜다.

| 갈래 | 무엇을 묻나 | 돌리는 법 |
|---|---|---|
| `unit` (jsdom) | 로직이 맞는가 | `npm run test:unit` |
| `integration` (node) | DB·정책이 맞는가 | `npm run test:integration` |
| `build` (node) | **제대로 실려 나갔는가** | `npm run test:build` |

`npm test`는 **앞의 둘만** 돌린다. `build`는 빌드가 있어야 의미가 있어서
`test:build`가 `npm run build`부터 하고 돌린다 — 섞으면 낡은 `dist/`를 검사한 초록이 나온다.

### unit (jsdom) — `*.test.ts(x)`

- **단위**: 순수 유틸/포매터/셀렉터, Zustand 스토어 액션.
- **컴포넌트**: React Testing Library 렌더·상호작용.
- **훅**: TanStack Query 훅은 QueryClient 래퍼로.
- api 계층은 mock한다. 그쪽이 `supabaseClient`(=`import.meta`)에 닿아 ts-jest에서 못 읽힌다.

### integration (node) — `*.int.test.ts`

**실제 Supabase 프로젝트에 붙는다. mock이 없다.**

- **로컬 인스턴스가 아니라 원격이다.** `supabase start`는 Docker를 요구하는데 이 환경에 없다.
- `moduleNameMapper`가 앱의 `shared/lib/supabaseClient`를 테스트용 클라이언트로 갈아끼운다.
  덕분에 테스트가 SQL을 새로 쓰지 않고 **화면이 실제로 부르는 함수**를 그대로 밟는다.
- **심는 것은 서비스 키, 확인은 언제나 anon 키.** 서비스 키로 읽으면 RLS가 꺼져
  "안 보여야 할 것이 안 보인다"를 검증할 수 없다.
- 각 스위트가 **자기 데이터를 심고 `afterAll`에서 치운다**(`shared/testUtils/integration/fixtures.ts`).
  남이 심어 둔 데이터에 기대면 화면에서 글 하나 지울 때 무더기로 깨지고,
  jest가 파일을 병렬로 돌리므로 옆 스위트와도 부딪힌다.
- `SUPABASE_SERVICE_ROLE_KEY`가 없으면 씨앗이 필요한 스위트가 **이유를 적어 두고 실패한다**
  (조용히 건너뛰지 않는다).

**닿지 못하는 곳**: 로그인한 사용자로서의 RLS. 소셜 전용이 되며 Email 프로바이더를 껐기 때문에
테스트가 세션을 만들 수 없다(`admin.createUser`는 되지만 `signInWithPassword`가 막힌다).
"자기 글은 찜할 수 없다"(0006)처럼 **정책에만 있는 규칙**이 그 그늘에 있다.

### build (node) — `*.build.test.ts`

**소스가 아니라 `dist/`를 읽는다.** 앞의 둘과 묻는 것이 다르다.

`import.meta.env`는 **빌드 시점에 값이 박힌다.** 단위는 그 모듈을 mock하고, 통합은
`process.env` 쌍둥이로 갈아끼운다 — **그 경로를 밟는 테스트가 구조적으로 없었다.**
2026-08-08에 카카오 앱키가 한 글자 잘린 채 배포됐는데 828개가 전부 초록이었던 이유다.

- **값이 무엇인지는 안 본다**(저장소에 정답이 없다). **형식과 길이**만 본다 —
  한 글자 잘린 키는 형식에서 걸린다.
- **비밀이 안 섞였는가.** `sb_secret_` **문자열 자체**는 supabase-js의 형식 판별 코드에
  정상적으로 들어 있어서, 접두사만 찾으면 매번 오탐이 난다. **뒤에 실제 키가 붙은 경우만** 잡는다.
- **Tailwind가 클래스를 담았는가.** 단위 테스트는 CSS를 `cssStub.ts`로 통째 대체해
  **Tailwind를 한 번도 보지 않는다.** purge 사고를 잡는 유일한 그물이다.
- **`dist/`가 소스보다 낡으면 실패시킨다.** 낡은 번들을 검사한 초록은 지금 코드에 대한 말이
  아니다. 테스트 파일 변경은 세지 않는다(빌드에 안 들어간다).

**닿지 못하는 곳**: 실제로 서비스되는 것. 빌드가 맞아도 배포가 틀릴 수 있다
(2026-08-08에 환경변수를 고치고 재배포를 안 해 옛 번들이 계속 나갔다). 그쪽은 배포 주소를
받아 검사하는 스모크(계획 ⑧B)의 몫이고, 브라우저가 있어야 아는 것
(캔버스 축소·Realtime·로그인 플로우)은 **여전히 사람 눈에 남는다.**

---

## 7. 사전 준비물 & 저장소 주의

- **Supabase 프로젝트** URL·anon key, **Google OAuth** 클라이언트, **카카오 개발자 앱** 필요.
  카카오 앱 하나가 **지도(JS 앱키)와 로그인(REST API 키 + Client Secret)을 함께** 맡는다 —
  앱을 나누지 않는다. 로그인 쪽은 Redirect URI로 `https://<project-ref>.supabase.co/auth/v1/callback`을
  등록하고, Web 플랫폼 사이트 도메인에도 그 주소를 넣어야 등록 칸이 열린다.
- 현재 폴더는 홈 디렉터리 git 저장소(무관한 히스토리) 내부 → 구현 착수 시 **별도 git 저장소 초기화 + `develop` 브랜치 생성**
  (`SKILL.md`가 `develop` 대상 PR 요구, `main` push 금지).
