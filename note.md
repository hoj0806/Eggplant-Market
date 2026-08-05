# 구현 노트

기능별로 "무엇을 어떻게 구현했는지"를 남기는 문서. 해당 기능을 고치면 이 문서도 함께 고친다.

---

## 동네 설정 (2026-08-02)

`feature.md` §1 "최초 가입 시 자신의 동네 설정 (추후 변경 가능 — 카카오맵 API 사용)" 구현.

### 무엇을 만들었나

1. **온보딩 2단계화** — 1단계 닉네임·프로필 사진 → 2단계 동네 선택. 둘 다 마쳐야 앱에 들어간다.
2. **동네 선택 위젯** — 현재 위치(GPS) 버튼 + 동 이름 검색. 지도는 띄우지 않는다.
3. **동네 변경 화면** — `/settings/region`. 온보딩과 같은 위젯을 재사용한다.

### 설계 결정 세 가지

#### 1. 법정동(B) 기준

카카오는 한 좌표에 대해 행정동(`region_type: 'H'`)과 법정동(`'B'`)을 모두 준다. **법정동을 쓴다.**

- 행정동은 `수유1동`처럼 숫자가 붙어 사용자가 검색하고 인지하는 이름과 어긋난다.
- 주소 검색(`addressSearch`)이 돌려주는 것도 법정동 코드(`address.b_code`)다.
- 두 경로(GPS·검색)를 같은 코드 체계로 맞춰야 "검색해서 고른 이름"과 "저장된 이름"이 갈리지 않는다.

`pickRegionCodeResult`가 B를 우선 고르고, 없으면 H로 물러선다.

#### 2. 저장하는 좌표는 사용자 위치가 아니라 동네 대표 좌표

`profiles`는 RLS가 `profiles_select using (true)` — **누구나 조회할 수 있다.**
정확한 GPS를 저장하면 집 위치가 그대로 공개된다.
그래서 위치 권한으로 읽은 좌표는 "어느 동네인지" 알아내는 데만 쓰고 버리며,
저장하는 것은 카카오가 돌려준 동네 대표 좌표다. (`src/features/region/types.ts`의 `Region.coords` 주석)

#### 3. `geography`는 EWKT로 쓰고, 좌표는 생성 컬럼으로 읽는다

PostgREST의 평범한 `.update()`로 PostGIS `geography` 컬럼에 쓸 수 있다.
값이 컬럼 타입의 입력 함수(`geography_in`)를 그대로 타기 때문이며, 별도 RPC가 필요 없다.

```ts
// src/features/profile/api/profileApi.ts
function toRegionColumns(region: Region) {
  return {
    dong_name: region.fullName,
    region_code: region.code,
    region_depth1: region.depth1,
    region_depth2: region.depth2,
    region_depth3: region.depth3,
    // POINT의 인자 순서는 (경도, 위도)다.
    location: `SRID=4326;POINT(${region.coords.lng} ${region.coords.lat})`,
  };
}
```

반대로 `location`을 select하면 EWKB hex(`0101000020E6100000…`)가 와서 클라이언트가 쓸 수 없다.
그래서 좌표는 **생성 컬럼**으로 따로 노출한다.

```sql
-- supabase/migrations/0003_profile_region.sql
alter table profiles
  add column if not exists location_lat double precision
    generated always as (st_y(location::geometry)) stored,
  add column if not exists location_lng double precision
    generated always as (st_x(location::geometry)) stored;
```

`geography→geometry` 캐스트와 `st_x`/`st_y`가 모두 IMMUTABLE이라 생성 컬럼에 쓸 수 있다.
쓰기는 `location` 한 곳뿐이라 좌표가 어긋날 수 없다.

### 온보딩 완료 판정 — 무한 리다이렉트를 막는 지점

`onboarded_at`만 보면 안 된다. 이 기능 이전에 가입한 사용자는 닉네임만 정하고도 `onboarded_at`이 차 있어
동네를 영영 못 정한다. 그래서 판정을 함수 하나로 모았다.

```ts
// src/features/profile/utils/onboardingStatus.ts
export function isOnboardingComplete(profile: Profile): boolean {
  return profile.onboardedAt !== null && profile.region !== null;
}
```

**라우트 가드(`requireOnboarding.tsx`)와 온보딩 화면(`onboardingPage.tsx`)이 반드시 이 같은 함수를 쓴다.**
한쪽만 조건을 바꾸면 두 화면이 서로를 밀어내며 무한히 리다이렉트한다.

덕분에 데이터 백필 없이 기존 사용자가 자연스럽게 동네 단계로 유도된다.

### 저장은 마지막에 한 번뿐

두 단계로 나뉘어 있어도 DB 쓰기는 2단계 끝에서 `update` 한 번이다.
중간에 그만두면 아무것도 저장되지 않아 "닉네임만 있고 동네는 없는" 어중간한 상태가 생기지 않는다.

단계 상태는 쿼리스트링(`?step=region`)에 둔다. 휴대폰 뒤로 가기 제스처가 온보딩을 통째로 빠져나가
입력을 날리는 대신 1단계로 돌아가게 하기 위해서다. 값 자체는 컴포넌트 상태에 있으므로,
새로고침해서 닉네임이 비면 2단계 주소로 들어와도 1단계로 되돌린다.

### 파일 구성

```
src/features/region/                 ← Supabase를 전혀 모른다. 동네를 고르기만 한다.
├─ types.ts                          Region, RegionCoords, RegionErrorCode
├─ api/regionApi.ts                  카카오 Geocoder 호출을 감싸는 유일한 자리
├─ utils/
│  ├─ toRegion.ts                    SDK 응답 → Region (순수 함수)
│  ├─ getCurrentCoords.ts            Geolocation을 Promise로
│  ├─ regionErrors.ts                문자열 code를 가진 Error로 통일
│  └─ regionErrorMessage.ts          code → 한국어 안내 문구
├─ hooks/
│  ├─ useRegionSearch.ts             디바운스 + TanStack Query
│  └─ useCurrentRegionMutation.ts    GPS → 동네
└─ components/regionPicker.tsx (+ 하위 4개)

src/shared/lib/kakaoMapLoader.ts     SDK 스크립트 로딩 (import.meta.env 경계)
src/shared/types/kakaoMaps.ts        any 없이 쓰기 위한 최소 타입
src/features/profile/                동네 "저장"은 profiles의 일이라 이쪽이 맡는다
```

**`RegionPicker`는 저장하지 않는다.** 어디에 어떻게 저장할지는 화면마다 달라서 부모의 몫이다.
그래서 온보딩과 설정 화면이 같은 컴포넌트를 고치지 않고 쓴다.

### 오류 처리

브라우저 `GeolocationPositionError.code`는 숫자(1·2·3)이고 message는 브라우저마다 다른 영어라
그대로 흘리면 원인을 구분할 수 없다. 그래서 문자열 code를 가진 Error로 통일하고
`Record<RegionErrorCode, string>`으로 문구를 찾는다.

위치를 쓸 수 없는 상황(`insecure_origin`, `geolocation_denied`, `geolocation_unsupported`)의 문구에는
**반드시 "동네 이름으로 검색해 주세요"를 함께 넣는다.** 사용자가 막히면 안 된다.

`isSecureContext`를 먼저 확인하는 이유: http로 열린 페이지에서도 브라우저는 `navigator.geolocation`을
그대로 노출한 채 `PERMISSION_DENIED`(1)로 실패시켜 진짜 권한 거부와 구분할 수 없다.
`localhost`는 보안 컨텍스트라 개발에는 영향이 없고, 휴대폰에서 `http://192.168.x.x`로 접속할 때 이 분기가 산다.

### 함께 고친 것

`completeProfileOnboarding`이 `avatar_url`을 무조건 써서, 사진 없이 온보딩을 다시 거치면
기존 사진이 지워졌다. 새 파일을 고른 경우에만 payload에 넣도록 고쳤다.

### 사전 준비 (카카오 콘솔)

세 가지가 **각각** 필요하다. 하나라도 빠지면 SDK가 거부된다.

1. JavaScript 키 발급
2. 앱 설정 → 플랫폼 → Web에 도메인 등록 (`http://localhost:5173`)
3. **제품 설정 → 카카오맵 → 활성화 ON**

`.env.local`의 `VITE_KAKAO_MAP_KEY`에 JavaScript 키를 넣는다.
**Vite는 `.env.local`을 서버 시작 시 한 번만 읽으므로 값을 바꾸면 dev 서버를 다시 띄워야 한다.**

2번의 도메인은 **포트까지 정확히 일치**해야 한다. 그래서 `vite.config.ts`에서 개발 서버 포트를
`5173`으로 고정하고 `strictPort: true`를 켰다 — 포트가 밀리면(5174 등) 카카오가 401로 거부하는데,
화면에는 "카카오 콘솔을 확인하라"는 엉뚱한 문구만 뜬다. 조용히 옮기는 대신 즉시 실패시킨다.

### 테스트

카카오 SDK는 jsdom에서 로드할 수 없다. `regionApi.ts`가 그 의존성을 가두는 경계이므로
컴포넌트 테스트는 이 모듈만 `jest.mock`한다. (자세한 함정은 `troble.md` 참고)

| 파일 | 검증 |
|---|---|
| `region/utils/toRegion.test.ts` | B 우선·H 폴백, 빈 depth 조합, 좌표 파싱, dedupe |
| `region/utils/getCurrentCoords.test.ts` | 비보안 출처·미지원·거부·불가·타임아웃 |
| `region/utils/regionErrorMessage.test.ts` | 코드별 문구, 안내 포함 여부 |
| `region/components/regionPicker.test.tsx` | 검색→선택, GPS 성공·거부 |
| `profile/utils/onboardingStatus.test.ts` | 레거시 사용자 미완료 판정 |
| `profile/components/onboardingSteps.test.tsx` | 2단계 흐름, 이전 시 값 유지, 저장 1회 |

### 실제 DB 검증 결과

```
dong_name     서울특별시 성북구 석관동
region_code   1129013900
depth1/2/3    서울특별시 / 성북구 / 석관동
location_lat  37.612986      location_lng  127.061401      srid  4326
```

### 이번 범위 밖

- `search_radius_m`(내 동네 범위) 설정 UI — 컬럼은 있으나 게시물 조회가 없어 효과를 확인할 수 없다
- 지도 렌더링(주변 물품 마커) — `feature.md` §2.2
- `nearby_posts` RPC 연동

---

## 중고물품 게시물 등록 · 카테고리 2단계 (2026-08-02)

`todo.md`의 두 가지 — 카테고리 대분류·소분류 정하기, 게시물 올리기(찜·조회수 포함) 구현.

### 무엇을 만들었나

1. **카테고리 2단계** — `categories.parent_id` 자기참조. 대분류 12개 / 소분류 73개.
2. **글쓰기** (`/posts/new`) — 사진·제목·카테고리·가격·설명·거래희망장소.
3. **상세** (`/posts/:postId`) — 사진 넘김, 판매자·매너온도, 조회수, 찜.
4. **홈 목록** — 내 동네 최신 글 20개. 검색·필터·무한스크롤은 다음 작업.

### 설계 결정

#### 1. 좌표를 두 개로 나눈다 — `location`과 `trade_location`

| 컬럼 | 값 | 쓰임 |
| --- | --- | --- |
| `posts.location` | 판매자 **동네 대표 좌표**(프로필에서 복사) | 목록·반경 검색의 기준 |
| `posts.trade_location` | **거래희망장소 좌표** | 상세 화면 표시(선택 사항) |

거래장소를 `location`에 넣으면 "옆 동네 카페에서 만나기로 한 글"이 그 동네 글이 되어
동네 목록이 어긋난다. 같은 이유로 `region_code`·`dong_name`도 작성 시점에 게시물에 박아 둔다
(판매자가 나중에 이사해 동네를 바꿔도 이미 올린 글의 동네는 그대로여야 한다).

읽고 쓰는 방식은 동네 설정 때와 같다 — EWKT로 쓰고, 좌표는 생성 컬럼(`*_lat`/`*_lng`)으로 읽는다.

#### 2. 찜 개수는 컬럼 + 트리거

목록에서 글마다 `count(*)`를 세지 않으려고 `posts.like_count`를 두고 `likes`의 insert/delete
트리거가 유지한다. `feature.md` §2.2의 "찜 많은 순" 정렬도 이 컬럼 하나로 끝난다.

트리거 함수는 `security definer`여야 한다. 찜하는 사람은 **남의 글**에 찜을 하는데
`posts_update` 정책이 `auth.uid() = seller_id`라 호출자 권한으로는 그 글을 갱신할 수 없다.

#### 3. 자기 글은 찜할 수 없다

찜 개수는 "찜 많은 순" 정렬의 근거라, 판매자가 자기 글을 찜할 수 있으면 정렬이 곧바로 의미를 잃는다.
화면에서는 자기 글에 찜 버튼 대신 "내가 올린 상품이에요"를 보여주고, 규칙 자체는 서버가 들고 있다.

`check` 제약으로는 못 막는다 — 판매자가 누구인지는 `posts`에 있고 check는 다른 테이블을 볼 수 없다.
그래서 RLS insert 정책에 조건을 얹었다(`0006_disallow_self_like.sql`).

```sql
create policy likes_insert on likes for insert
  with check (
    auth.uid() = user_id
    and not exists (
      select 1 from posts where posts.id = likes.post_id and posts.seller_id = auth.uid()
    )
  );
```

#### 4. 조회수 — 클라이언트와 서버가 각각 막는다

- 클라이언트: 탭 세션당 한 번(`sessionStorage`의 `viewedPostIds`). 새로고침으로 부풀지 않는다.
- 서버: `increment_view_count`가 `seller_id <> auth.uid()` 조건으로 본인 글을 제외한다.

서버에도 두는 이유는, 클라이언트 가드만 있으면 판매자가 저장소를 비우고 새로고침해
자기 글 조회수를 얼마든지 올릴 수 있기 때문이다.

`updated_at` 트리거에는 조건을 달았다. 조회수·찜 개수만 바뀐 update는 "수정"이 아니다.

```sql
create trigger posts_set_updated_at
  before update on posts
  for each row when (
    old.view_count is not distinct from new.view_count
    and old.like_count is not distinct from new.like_count
  )
  execute function set_updated_at();
```

#### 5. 거래희망장소는 지도 없이 장소 검색으로

`features/place`를 `features/region`과 같은 구조로 만들었다(카카오 SDK를 건드리는 자리를
feature 단위로 격리 — ts-jest의 `import.meta` 문제 때문에 테스트에서 통째로 모킹할 수 있어야 한다).
동네 검색이 Geocoder(주소)라면, 거래장소는 Places(장소 이름)를 쓴다.

검색할 때 사용자 동네 좌표를 `location`, 반경 20km, 정렬을 거리순으로 넘긴다.
옵션 없이 부르면 전국에서 15건이 뽑혀 내 동네 장소가 밀린다.

#### 6. 등록은 세 번 쓰고, 실패하면 되돌린다

`createPost`는 ① 사진 업로드 → ② `posts` → ③ `post_images` 순서다. 스토리지가 끼어 있어
트랜잭션으로 묶을 수 없으므로 직접 보상한다.

- ②가 실패하면 → 올린 파일을 지운다 (아무도 못 보는 파일이 남지 않게)
- ③이 실패하면 → 게시물 행을 지우고 파일도 지운다 (사진 없는 게시물이 남지 않게)

### 파일 구성

```
supabase/migrations/0004_category_hierarchy.sql   categories.parent_id
supabase/migrations/0005_post_create.sql          posts 컬럼·찜 트리거·조회수·post-images 버킷
supabase/migrations/0006_disallow_self_like.sql   자기 글 찜 금지(RLS)
supabase/seed.sql                                 소분류 73개 추가

src/features/category/    트리 변환(순수) · 조회 · 2단 select
src/features/place/       카카오 Places 래퍼 · 거래장소 선택 위젯
src/features/post/        등록/상세/목록 API · 검증 · 조회수 규칙 · 화면
src/features/like/        찜 API · 낙관적 토글 · 하트 버튼
src/features/browse/      홈 목록(postCard · neighborhoodPostList)
src/shared/ui/textArea.tsx            여러 줄 입력
src/shared/utils/formatTimeAgo.ts     "n분 전"
```

### 찜은 낙관적으로 뒤집는다

하트는 누르는 즉시 바뀌어야 한다. 왕복을 기다리면 안 눌린 줄 알고 한 번 더 눌러
찜·해제가 번갈아 나간다. `onMutate`에서 캐시를 뒤집고 `onError`에서 되돌린다.
연타로 중복 insert가 나가도 되도록 `addLike`는 `upsert`다.

### 테스트

| 파일 | 확인하는 것 |
| --- | --- |
| `category/utils/toCategoryTree.test.ts` | 트리 접기, 정렬, 부모 없는 행 버리기 |
| `category/components/categorySelect.test.tsx` | 대분류 변경 시 소분류 초기화, 값 복원 |
| `place/utils/toPlace.test.ts` | 도로명/지번 선택, 빈 좌표 거르기 |
| `place/components/tradePlacePicker.test.tsx` | 내 동네 중심 검색, 선택·해제 |
| `post/utils/validatePostInput.test.ts` | 길이·형식·장수·용량, 0원 나눔 |
| `post/utils/viewedPosts.test.ts` | 세션 1회, 본인 글 제외, 깨진 저장값 |
| `post/components/postForm.test.tsx` | 필수 항목 안내, 제출 payload, 나눔 |
| `like/components/likeButton.test.tsx` | 낙관적 토글과 실패 시 롤백 |
| `shared/utils/formatTimeAgo.test.ts` | 단위별 내림, 미래·잘못된 값 |

### 실제 DB 검증 결과

`authenticated` 역할과 실제 사용자 uid로 RLS를 통과시켜 확인했다.

```
게시물 insert   RLS 통과, region_code/dong_name/좌표 저장 확인
생성 컬럼       location_lat 37.612986 / trade_location_lat 37.6135
조회수          비로그인 +1, 다른 사용자 +1, 판매자 본인 0
찜              insert → like_count 1, delete → 0 (트리거)
자기 글 찜      판매자 본인 insert는 RLS가 거부, 다른 사용자는 성공
updated_at      조회수·찜으로는 바뀌지 않음
목록 조회       region_code 필터 + bumped_at 내림차순
```

검증에 쓴 행은 모두 지웠다.

브라우저에서 실제로 한 건 올려서도 확인했다.

```
사진        post-images/{user_id}/{timestamp}-0.png 로 업로드, 공개 URL 200 (456KB)
post_images 1건, sort_order 0, posts.thumbnail_url과 같은 URL
카테고리    소분류 id로 저장 (가구/인테리어 > 거실가구)
거래장소    이름 + 좌표 모두 저장 (컴포즈커피 수유시장점)
상세 조회   비로그인 anon 키로 앱과 같은 select 실행 → 판매자·카테고리·사진 임베드 정상
조회수      0 — 판매자 본인이 본 것이라 서버가 제외한 결과다
```

### 이번 범위 밖

- 게시물 수정·삭제, 상태 변경(판매중→예약중→거래완료)
- 찜 목록 화면(내가 찜한 상품) — 데이터는 쌓이지만 모아 보는 화면이 없다
- 검색·카테고리 필터·정렬·무한 스크롤 (`feature.md` §2.2)
- 지도에서 주변 물품 보기, `nearby_posts` RPC 연동
- 댓글, 채팅, 최근 본 상품(`recently_viewed` 기록)

---

## 게시물 검색 및 필터링 (2026-08-02)

`feature.md` §2.2 "자신의 동네에서 판매하는 물품들 검색 가능 / 카테고리별·가격 필터 / 무한 스크롤" 구현.

### 무엇을 만들었나

1. **`/search` 화면** — 제품 이름·게시물 내용 검색 + 카테고리 + 가격 구간 + 거래 가능만 보기.
   조건은 모두 **중첩(AND)** 되고, 필터 초기화 버튼이 있다.
2. **비로그인 사용자도 사용 가능** — 게스트는 동네를 직접 고르고 브라우저에 남긴다.
3. **무한 스크롤** — `(bumped_at, id)` keyset 커서로 20개씩.

검색·필터는 언제나 **내 동네 안에서만** 돈다. 동네는 조건이 아니라 전제라
`PostSearchFilters`에 들어 있지 않고 `regionCode`로 따로 넘어간다.

### 설계 결정 네 가지

#### 1. 쿼리 빌더가 아니라 RPC (`search_posts`)

제목과 본문을 OR로 묶으려면 PostgREST에서는 **필터를 문자열로** 조립해야 한다.

```ts
// 이렇게 하지 않았다
.or(`title.ilike.%${keyword}%,description.ilike.%${keyword}%`)
```

사용자가 검색창에 `,`나 `(`를 치는 순간 저 문자열의 문법이 깨진다.
실제로 "노트북 거치대, 마우스패드"처럼 쉼표가 든 제목이 흔하다.
RPC는 값이 파라미터로 바인딩돼 그런 걱정이 없다 — 0001의 `nearby_posts`와도 결이 같다.

와일드카드는 SQL 쪽에서 걷어낸다. 이게 없으면 `%` 한 글자에 동네 글 전체가 나온다.

```sql
create or replace function escape_like_pattern(p_text text)
returns text language sql immutable as $$
  select replace(replace(replace(p_text, '\', '\'), '%', '\%'), '_', '\_');
$$;
```

대분류/소분류는 파라미터 하나(`p_category_id`)로 받는다. 게시물은 언제나 소분류에 붙지만
필터는 "디지털/가전 전체"로 넓게 거는 쪽이 쓸모 있어서, 대분류가 들어오면 자식까지 훑는다.

```sql
and (p_category_id is null
     or p.category_id = p_category_id
     or p.category_id in (select c.id from categories c where c.parent_id = p_category_id))
```

#### 2. 커서는 `bumped_at` 하나로 부족하다

`bumped_at`만 커서로 쓰면 **같은 시각에 올라온 글**이 페이지 경계에서 통째로 잘리거나 겹친다.
`(bumped_at, id)` 쌍으로 잡고 정렬도 같은 순서로 맞춘다.

```sql
and (p_cursor_bumped_at is null
     or p.bumped_at < p_cursor_bumped_at
     or (p.bumped_at = p_cursor_bumped_at and p.id < coalesce(p_cursor_id, 0)))
order by p.bumped_at desc, p.id desc
```

offset(`.range()`)을 쓰지 않은 이유는, 스크롤하는 동안 누가 글을 올리면 이미 본 글이
다시 나오거나 못 본 글이 밀려 사라지기 때문이다.

인덱스도 이 동선에 맞춰 새로 깔았다. 0001에 title trgm은 있었지만 본문 검색용이 없었다.

```sql
create index posts_description_trgm_idx on posts using gin (description gin_trgm_ops);
create index posts_region_keyset_idx    on posts (region_code, bumped_at desc, id desc);
create index posts_region_price_idx     on posts (region_code, price);
```

#### 3. 필터의 원본은 컴포넌트 state가 아니라 URL

`useSearchParams`가 유일한 원본이다. 새로고침·뒤로가기·링크 공유가 공짜로 따라오고,
"필터 초기화"가 쿼리를 다시 쓰는 한 줄이 된다.

```ts
// src/features/browse/components/searchPage.tsx
function handleResetFilters(): void {
  setSearchParams(toSearchParams(clearFilters(filters)));
}
```

초기화는 **필터만 지우고 검색어는 남긴다**. "'노트북' 검색 결과에서 조건만 풀어 보고 싶다"가
흔한 요구라, 검색어까지 지우면 처음부터 다시 쳐야 한다.

대신 URL은 사용자가 직접 고칠 수 있어 `fromSearchParams`가 들어오는 값을 하나도 믿지 않는다.
`?minPrice=abc`나 `?category=-1`은 오류가 아니라 "그 필터가 없는 것"으로 본다.

#### 4. 검색어는 즉시, 필터는 "적용하기"에서 한 번에

두 입력의 성격이 다르다.

- **검색어**(`postSearchField`): 400ms 디바운스 후 바로 URL 반영. 결과가 바로 보여야 검색하는 맛이 난다.
- **필터**(`postFilterPanel`): 자기 안에 draft로 들고 있다가 "적용하기"에서 한 번에 넘긴다.
  가격을 한 글자씩 칠 때마다 반영하면 "1", "10", "100"까지 세 번 헛돈다.

### 비로그인 사용자의 "내 동네"

게스트는 저장할 프로필이 없다. 온보딩과 같은 `RegionPicker`로 동네만 고르게 하고
localStorage에 남긴다(`region/utils/storedRegion.ts`, `region/store/activeRegionStore.ts`).
zustand 스토어를 겸하는 이유는 localStorage만으로는 리렌더가 걸리지 않아서다.

로그인/게스트 분기는 `browse/hooks/useActiveRegion.ts` 한 곳에만 둔다.

```ts
// 로그인이면 profiles가 원본, 아니면 게스트가 고른 동네
const { region, isLoading, isGuest, setGuestRegion } = useActiveRegion();
```

### 검증

실제 DB(`hcmpbpeyhmmismxjkkzv`)에 게시물 26건을 넣고 `search_posts`를 직접 호출해 확인했다.

```
키워드 "노트북"      제목·본문 양쪽에서 4건 (맥북/갤럭시탭/거치대/그램)
키워드 "%"          1건 — 와일드카드가 아니라 글자로 취급됨
키워드 "거치대, 마우스"  1건 — 쉼표가 있어도 깨지지 않음
대분류 1            22건 (소분류 글 전부 포함) / 소분류 15 → 2건
가격 30000~60000    5건, 30000과 60000 모두 포함(경계 이상/이하)
거래 가능만          24건 (selling+reserved) / 끄면 27건 (sold 3건 포함)
중첩 4개 동시        2건
keyset 페이징        limit 5로 6페이지 순회 → 27행 수집, 중복 0
                    (같은 bumped_at 3건을 일부러 넣고 확인)
anon 역할            27건 조회 가능 — 비로그인도 RLS 통과
```

앱이 실제로 타는 경로(PostgREST HTTP + anon 키)로도 같은 결과가 나오는지 확인했다.

```bash
curl -X POST "$VITE_SUPABASE_URL/rest/v1/rpc/search_posts" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"p_region_code":"1129013900","p_keyword":"노트북","p_category_id":1,
       "p_min_price":200000,"p_max_price":1200000,"p_available_only":true,"p_limit":20}'
```

커서를 `{"p_cursor_bumped_at":"2026-08-02T05:10:00+00:00","p_cursor_id":26}`로 넘겼을 때
같은 시각의 id 25가 먼저, 그다음 id 28이 나오는 것까지 확인했다.

Jest는 201건 통과. 새로 붙인 것은 필터↔URL 변환(16), 커서 판정(3),
카테고리 필터 select(6), 필터 패널(7), 검색어 디바운스(4)다.

### 이번 범위 밖

- 정렬 옵션(조회수순·찜 많은 순) — 지금은 최신순(`bumped_at desc`) 고정
- 반경 기반 검색(`nearby_posts`, `profiles.search_radius_m`) — 여전히 법정동 코드 일치 기준이다
- 지도에서 주변 물품 보기
- 홈 화면의 최신 목록 — 검색창 진입점만 붙였고 목록 자체는 그대로다

---

## 채팅 · 거래 상태 (2026-08-03)

`todo.md`의 네 줄 — 채팅 기능, 남의 게시물에서 "채팅하기", 당근마켓의 물건 상태 변화 재현,
채팅에서 사진 전송.

### 무엇을 만들었나

1. **채팅** (`/chats`, `/chats/:roomId`) — 게시물당 1:1 방, 실시간 수신, 안 읽은 수, 위로 무한 스크롤.
2. **채팅 사진** — 비공개 버킷 + 서명 URL. 한 장이 메시지 한 건이다.
3. **거래 상태 변경** — 판매중 ⇄ 예약중 → 거래완료. 예약자·구매자를 채팅 상대 중에서 고른다.
4. **입구** — 상세의 "채팅하기", 홈 헤더의 `💬 채팅`(안 읽은 수 뱃지).

DB는 절반쯤 준비돼 있었다. `0001_init.sql`에 `chat_rooms`·`messages`·`message_type('text','image','price_offer')`·
`post_status('selling','reserved','sold')`가 이미 있었고, `on_message_insert` 트리거가 방 요약과 알림까지 넣고 있었다.
**없던 것은 규칙(누가 방을 팔 수 있는가·무엇을 고칠 수 있는가·상태는 어디로 갈 수 있는가)과
배관(Realtime publication, 채팅 사진 저장소), 그리고 클라이언트 전부다.**

### 당근마켓의 실제 상태 흐름 — 무엇을 재현했나

| 전이 | 당근의 동작 | 이 앱 |
| --- | --- | --- |
| 판매중 → 예약중 | 채팅 상대 중 **예약자 선택**, 건너뛸 수 있음 | 같다 |
| 예약중 → 판매중 | 자유롭게 되돌림 | 같다. 예약자는 서버가 지운다 |
| → 거래완료 | "누구와 거래하셨나요?" + "거래한 이웃을 찾을 수 없어요" | 같다. 확인을 한 번 더 받는다 |
| 거래완료 → ? | **되돌릴 수 없음** | 같다 (트리거가 막는다) |
| 바꿀 수 있는 사람 | 판매자만 | 같다 |
| 바꾸는 자리 | 게시물 상세 + 채팅방 | 같다. 채팅방에서는 그 방 상대가 미리 골라져 있다 |

`거래완료 → 후기 작성`으로 이어지는 뒷부분은 이번 범위 밖이다. 구매자를 **지정**하는 데까지가 이번 작업이고,
`reviews` 테이블은 그 지정된 `posts.buyer_id`를 근거로 다음에 붙는다.

### 설계 결정

#### 1. 채팅과 거래 상태는 한 작업이다

따로 보면 별개 기능이지만, **당근에서 상태를 바꾸는 행위는 "누구와 거래했는지"를 고르는 행위**이고
그 후보 목록이 곧 채팅 상대다. 채팅 없이 상태만 만들면 "누구와" 자리가 빈 채로 남는다.

그래서 `posts.buyer_id`를 두고, 그 값이 될 수 있는 사람을 **서버가 채팅 상대로 한정**한다.
`check` 제약으로는 못 막는다 — 상대가 누구인지는 `chat_rooms`에 있고 check는 다른 테이블을 볼 수 없다
(0006에서 자기 글 찜을 막을 때와 같은 자리다).

```sql
-- 0008. 이 저장소의 다른 update 정책은 using만 쓴다. 여기만 with check가 붙는 이유다.
create policy posts_update on posts for update
  using (auth.uid() = seller_id)
  with check (
    auth.uid() = seller_id
    and (buyer_id is null
         or exists (select 1 from chat_rooms r
                     where r.post_id = posts.id and r.buyer_id = posts.buyer_id))
  );
```

예약자와 구매자를 컬럼 하나로 겸한다. 둘로 나누면 "예약자와 구매자가 다른" 상태를 표현할 수 있게 되는데
그건 화면에 없는 상태다.

#### 2. 전이 규칙은 트리거가, 버튼은 같은 규칙으로 잠근다

```sql
-- 0008
if old.status = 'sold' then
  raise exception '거래완료된 게시물의 상태는 되돌릴 수 없습니다.' using errcode = 'check_violation';
end if;
if new.status = 'selling' then new.buyer_id := null; end if;   -- 판매중엔 예약자가 없다
if new.status = 'sold'    then new.sold_at  := now(); end if;
```

거래완료를 종착점으로 둔 이유는 후기·매너온도·구매내역이 전부 여기 매달리기 때문이다.
되돌릴 수 있게 하면 "후기를 쓴 거래가 다시 판매중이 된" 상태를 뒷 기능들이 각자 처리해야 한다.

화면 쪽 `postStatusTransition.ts`가 **같은 규칙**을 들고 버튼을 잠근다. 한쪽만 고치면
눌리는데 서버가 거부하는 버튼이 생기므로, 두 파일에 서로를 가리키는 주석을 남겼다.

#### 3. 채팅 사진만 비공개 버킷이다

`avatars`·`post-images`는 공개다. 원래 남에게 보이라고 올리는 것이라 그래도 됐다.
**채팅 사진은 1:1 대화 내용**이라 공개로 두면 URL을 아는 누구나 본다.

그래서 `public = false`로 두고 경로 첫 칸을 `room_id`로 잡아 방 참여자만 읽게 했다.

```
{room_id}/{user_id}/{timestamp}-{index}.{ext}
   └ 정책이 "이 방 사람인가"를 본다   └ "본인이 올린 것인가"를 본다
```

대가는 클라이언트에 붙는다. 공개 URL이 없으므로 `messages.content`에는 **저장 경로**가 들어가고,
볼 때마다 `createSignedUrl`로 바꾼다. 서명 URL은 1시간짜리인데 캐시는 50분에 낡게 해서
만료 직전 값을 붙들고 있다가 사진이 깨지는 일을 막는다.

```ts
// chat/hooks/useChatQueries.ts
const CHAT_IMAGE_STALE_TIME_MS = (CHAT_IMAGE_SIGNED_URL_TTL_SECONDS - 600) * 1000;
```

사진을 여러 장 고르면 **한 장이 메시지 한 건**이다(당근과 같다). 실패 보상은 게시물 등록과 같은 방식이라,
업로드는 됐는데 `messages` insert가 실패하면 방금 올린 파일을 지운다.

#### 4. 메시지는 읽음 표시만 고칠 수 있다

0001의 `messages_update`는 "방 참여자면 update 가능"이라 **상대가 보낸 메시지의 `content`까지 고칠 수 있었다.**
대화 기록이 사후에 바뀌면 채팅을 신뢰할 수 없다.

정책은 "어느 컬럼이 바뀌었는가"를 볼 수 없다(`with check`도 새 행만 본다).
그래서 둘로 나눴다 — **정책이 "누가"를, 트리거가 "무엇을"을 막는다.**

```sql
create policy messages_update on messages for update
  using (auth.uid() <> sender_id and exists (…방 참여자…));   -- 읽음은 받은 사람이 찍는다
```

`guard_message_update`가 `read_at`·`offer_status` 외의 변경을 거부한다.
(`offer_status`는 다음 작업의 수락·거절을 위해 열어 뒀다.)

덕분에 읽음 처리에 RPC가 필요 없다. 평범한 update 한 번이면 된다.

#### 5. 안 읽은 수는 컬럼이 아니라 부분 인덱스

`like_count`(0005)처럼 비정규화 컬럼을 둘 수도 있었다. 하지만 찜과 달리 **보내는 쪽과 읽는 쪽 양쪽에서**
갱신해야 해 트리거가 둘 필요하다. 방 개수가 적으므로 세는 쪽을 골랐다.

```sql
create index messages_unread_idx on messages (room_id, sender_id) where read_at is null;
```

대신 목록에서 방마다 따로 세지 않도록 `fetch_chat_rooms()` RPC 하나가
상대 프로필·게시물 요약·마지막 메시지·안 읽은 수를 한 번에 돌려준다.
`search_posts`(0007)와 같이 **security invoker**다 — 호출자 권한이어야 `chat_rooms_select`가 그대로 걸린다.

#### 6. "채팅하기"는 RPC다

방이 없으면 만들고 있으면 들어가는 한 동작이다. 클라이언트가 `seller_id`를 보내지 않게 하려고
서버가 `posts`에서 직접 읽는다. `unique (post_id, buyer_id)` 충돌은 오류가 아니라 "이미 있는 방"이라
`exception when unique_violation`으로 받아 기존 방을 돌려준다 — 연타해도 같은 방이 나온다.

`security definer`가 아니다. 0008의 `chat_rooms_insert` 정책을 그대로 통과해야 하고,
함수 안의 `raise`는 **RLS에 걸리기 전에 왜 안 되는지 알려 주기 위한 것**이다(RLS는 이유를 말해 주지 않는다).

#### 7. 낙관적 메시지를 만들지 않는다

찜은 낙관적으로 뒤집었지만 메시지는 그러지 않는다. `insert`가 서버가 만든 행을 그대로 돌려주므로
그것을 캐시에 얹으면 임시 id를 진짜 id로 갈아 끼우는 단계가 아예 없어진다.
곧이어 Realtime 에코가 같은 행을 한 번 더 들고 오는데 `withInsertedMessage`가 id로 거른다.

입력창은 서버 응답을 기다리지 않고 비운다. 대화는 리듬이 있어서 왕복을 기다리는 동안 글자가 남아 있으면
두 번 보낸 것처럼 느껴진다.

#### 8. 읽음 처리는 방 요약을 기다리지 않는다

안 읽은 수를 **방 요약(`unread_count`)** 으로 판단하면 상대 메시지가 도착한 뒤
"요약을 다시 받아오는" 왕복이 하나 더 낀다. 브라우저 두 창으로 실제로 대화해 보니
그 왕복이 제때 돌지 않아 상대의 "안읽음"이 **21초** 동안 남아 있었다.

안 읽은 수는 이미 화면에 있는 메시지로 셀 수 있고, 그 목록은 Realtime이 도착하는 순간 갱신된다.

```ts
// chat/hooks/useMarkRoomRead.ts
export function countUnreadFromPartner(messages, viewerId) {
  return messages.filter((m) => m.senderId !== viewerId && m.readAt === null).length;
}
```

21초 → 0.8초가 됐다. 자세한 경위는 `troble.md` #6.

#### 9. Realtime은 캐시만 갱신한다

`docs/architecture.md`가 정한 방침 그대로다. 화면은 여전히 TanStack Query만 본다.

`supabase` 를 아는 자리는 `api/chatApi.ts` 한 곳이라는 규칙이 구독에도 적용된다.
훅이 직접 채널을 열면 화면 테스트가 `import.meta`에 닿아 로드 단계에서 죽는다(`troble.md` #5).
그래서 `subscribeToRoomMessages`가 채널을 감싸고 훅은 콜백만 받는다.

채팅 목록은 방마다 채널을 열지 않는다 — 방이 늘수록 채널이 늘고, 목록에 필요한 것은
"무언가 바뀌었다"뿐이다. 필터 없이 `chat_rooms`를 구독해도 RLS가 내 방만 흘려보낸다.

### 파일 구성

```
supabase/migrations/0008_chat_and_trade_status.sql
  posts.buyer_id·sold_at / posts_update with check / 상태 전이 트리거
  chat_rooms_insert 강화 / messages_update 축소 + guard 트리거
  on_message_insert 사진 요약 / realtime publication / chat-images 비공개 버킷
  RPC 4개: fetch_chat_rooms · fetch_chat_room · open_chat_room · fetch_post_chat_partners

src/features/chat/
├─ types.ts                    ChatRoomSummary · ChatMessage · PostChatPartner
├─ api/chatApi.ts              supabase를 아는 유일한 자리(구독·스토리지 포함)
├─ hooks/
│  ├─ useChatQueries.ts        방 목록·방 하나·메시지(무한)·상대 후보·서명 URL
│  ├─ useChatMutations.ts      방 열기·텍스트·사진
│  ├─ useMarkRoomRead.ts       읽음 처리(곁가지라 실패를 알리지 않는다)
│  └─ useChatRealtime.ts       구독 → 캐시 갱신
├─ utils/
│  ├─ chatCursor.ts            id keyset 커서 + 페이지를 화면 순서로 펴기
│  ├─ chatMessageCache.ts      캐시에 메시지 얹기·갈아 끼우기(순수)
│  ├─ validateChatInput.ts     빈 메시지·길이·사진 장수/용량/형식
│  └─ chatErrorMessage.ts      0008이 남긴 한국어 문구를 그대로 살린다
└─ components/                 목록·방·말풍선·사진·입력줄·채팅하기·상대 선택(9개)

src/features/post/
├─ utils/postStatusTransition.ts     전이 규칙(트리거와 같은 규칙) + 화면 문구
├─ components/postStatusControl.tsx  판매자용 상태 변경 패널
├─ hooks/useUpdatePostStatusMutation.ts
└─ api·types                          buyer 임베드·soldAt 추가

src/setupTests.ts                     jsdom에 없는 scrollIntoView 스텁 추가
```

`chat`이 `post`의 타입·뱃지를 읽고, `post`가 `chat`의 상대 선택 위젯을 읽는다.
서로를 가리키지만 순환하지 않는다 — 채팅 화면은 `fetch_chat_room`이 주는 요약만 보고
`postApi`를 아예 부르지 않는다. 그래서 채팅방 헤더는 "지금 예약자가 누구인지"를 모른다.
대신 상대 선택 목록에 그 방 상대가 미리 골라져 있어 실제로 고르는 데는 지장이 없다.

### 테스트

Jest 273건 통과(새로 붙인 것 72건).

| 파일 | 확인하는 것 |
| --- | --- |
| `chat/utils/chatCursor.test.ts` | 덜 찬 페이지면 종료, 최신순 페이지 뒤집기, 중복 제거 |
| `chat/utils/chatMessageCache.test.ts` | 첫 페이지에 붙이기, id 중복 거르기, 읽음 갈아 끼우기 |
| `chat/utils/validateChatInput.test.ts` | 공백만 있는 메시지, 길이·장수·용량·형식 경계 |
| `chat/utils/chatErrorMessage.test.ts` | 0008의 raise 문구별 안내 |
| `chat/hooks/useMarkRoomRead.test.ts` | 상대가 보낸 안 읽은 것만 세기 |
| `chat/components/chatComposer.test.tsx` | 빈 입력 잠금, trim 전송, Enter/Shift+Enter, 사진 |
| `chat/components/chatRoomListItem.test.tsx` | 안읽음 뱃지, 999+ 축약, 대화 없음 |
| `chat/components/chatMessageList.test.tsx` | 내 메시지만 안읽음 표시, 사진은 경로로 서명 URL |
| `chat/components/tradePartnerPicker.test.tsx` | 예약/거래완료 문구 차이, 건너뛰기(null), 상대 없음 |
| `post/utils/postStatusTransition.test.ts` | sold에서 나가는 전이 전부 거부 |
| `post/components/postStatusControl.test.tsx` | 현재 상태 잠금, 거래완료 확인, payload |

### 실제 DB 검증 결과

먼저 `authenticated` 역할과 실제 uid로 SQL에서 RLS·트리거를 훑었고,
그다음 **앱이 실제로 타는 경로**(anon 키 + 사용자 JWT + Realtime 웹소켓 + Storage HTTP)를
Node 스크립트로 재현해 30가지를 확인했다. 임시 사용자 3명을 `signUp`으로 만들어 썼다.

```
자기 글에 채팅        판매자 본인 open_chat_room → "내 게시물에는 채팅을 걸 수 없습니다."
같은 사람 재호출       같은 방 id (unique 충돌 경로)
seller_id 위조        RLS 거부(42501)
Realtime             판매자가 텍스트·사진 2건 실시간 수신 / 제3자는 0건
사진 업로드            방 참여자 성공, 방 밖 사람 거부
서명 URL              참여자 발급·다운로드 200 / 제3자 발급 실패 / 공개 URL 400
방 요약               사진 전송 후 last_message = "사진을 보냈어요"
알림                  구매자→판매자 1건, 판매자→구매자 2건
안 읽은 수             판매자 2 → 읽음 처리 후 0
읽음 처리              수신자 성공 / 발신자 자기 메시지 0행
메시지 내용 조작        "메시지는 읽음 표시만 바꿀 수 있습니다." (트리거)
읽음 표시 실시간        UPDATE 이벤트로 도착
채팅 안 한 사람 지정    RLS 거부
예약중 전환            reserved + buyer_id 저장
판매중 복귀            buyer_id가 null로 지워짐
구매자가 상태 변경      0행 (판매자만 가능)
거래완료               sold + sold_at 기록
거래완료 되돌리기       "거래완료된 게시물의 상태는 되돌릴 수 없습니다." (트리거)
채팅 상대 목록         판매자 1명 / 구매자 0명 (남의 글 문의자는 볼 수 없다)
제3자 방 목록          0개
```

검증에 쓴 사용자·게시물·방·메시지·알림·사진은 모두 지웠다(`chat-images`도 0건).

### 브라우저 검증 결과

마지막으로 **실제 앱을 브라우저 두 창으로 눌러** 확인했다(Playwright, 판매자·구매자 계정 각 1개).
21가지 모두 통과했다.

```
자기 글 상세          "채팅하기" 없음 / 상태 변경 버튼 있음
남의 글 상세          "채팅하기" → 방 생성 → /chats/:id 이동
채팅방                상품 요약·상태 뱃지 표시, 구매자에게는 상태 변경 없음
판매자 채팅 목록       새 방이 상대 닉네임으로 뜸
메시지                보낸 즉시 입력창 비움, 상대 창에 새로고침 없이 도착
읽음                  상대가 방을 보고 있으면 "안읽음"이 0.8초 만에 사라짐
사진                  상대 창에 도착하고 서명 URL로 실제로 그려짐(naturalWidth > 0)
채팅 목록 요약         저장 경로가 아니라 "사진을 보냈어요"
예약중                채팅방에서 변경 → 예약자 목록 → 선택 → 뱃지 반영
거래완료              "되돌릴 수 없어요" 확인 → 구매자 선택 → 되돌리기 UI 사라짐
거래 상대             "…님과 거래했어요" 표시
반영 범위             상세·홈 목록의 뱃지가 함께 바뀜
안 읽은 수            홈 헤더 💬 채팅에 뱃지
```

이 과정에서 위 8번(읽음 처리 21초)을 찾아 고쳤다. **단위 테스트로는 잡히지 않는 종류였다** —
두 사용자가 동시에 있어야 드러난다.

### 이번 범위 밖

- 가격 제안(`price_offer`) — 컬럼과 말풍선 자리는 있으나 보내기·수락·거절이 없다
- 거래 후기·매너온도(`feature.md` §2.3) — 구매자 **지정**까지만이다
- 메시지 삭제, 채팅방 나가기·숨기기, 차단·신고
- 알림 화면 — `notifications`에 행은 쌓이지만 모아 보는 곳이 없다
- 하단 탭바 — 채팅 입구는 홈 헤더 링크다

---

## 마이페이지 (2026-08-03)

`todo.md`의 세 줄 — 마이페이지에서 내 정보 보기·관리, 네 목록(관심목록·최근 본 글·구매내역·판매관리),
닉네임·프로필 사진 변경.

### 무엇을 만들었나

1. **`/my`** — 프로필 요약(사진·닉네임·매너온도·동네) + 네 목록으로 가는 메뉴 + 로그아웃.
2. **목록 넷** — `/my/likes` · `/my/recent` · `/my/purchases` · `/my/sales`. 전부 무한 스크롤.
3. **`/settings/profile`** — 닉네임·사진 변경. 기본 이미지로 되돌리기 포함.
4. **최근 본 글 기록** — 게시물 상세에 들어가면 `recently_viewed`에 남는다.

DB는 **거의 다 준비돼 있었다.** `likes`·`recently_viewed`(0001), `posts.buyer_id`/`sold_at`(0008)이
이미 있었다. 다만 `recently_viewed`는 **읽는 코드도 쓰는 코드도 없었다** — 테이블만 서 있었다.
새 테이블은 하나도 만들지 않았고, 0009는 읽는 RPC 넷 + 쓰는 RPC 하나가 전부다.

### 설계 결정

#### 1. 네 목록의 정렬 기준이 저마다 다른 테이블에 있다

이것이 이번 작업의 핵심이다.

| 목록 | 어디서 읽나 | 정렬 기준 |
| --- | --- | --- |
| 관심목록 | `likes` ⋈ `posts` | `likes.created_at` (찜한 순서) |
| 최근 본 글 | `recently_viewed` ⋈ `posts` | `viewed_at` (본 순서) |
| 구매내역 | `posts` | `sold_at` (거래완료 순서) |
| 판매관리 | `posts` | `bumped_at` (끌올 순서) |

PostgREST 임베드로는 **조인 상대의 컬럼으로 keyset 페이징**이 나오지 않는다.
`.order('likes.created_at')` 같은 것을 쓸 수 없고, 쓸 수 있다 해도 커서 조건을 걸 자리가 없다.
그래서 RPC 넷으로 간다 — `0007 search_posts`·`0008 fetch_chat_rooms`와 같은 판단이다.

#### 2. 네 RPC가 **같은 컬럼**을 돌려준다

```sql
-- 앞 아홉 칸은 0007 search_posts와 글자 그대로 같다(= PostSummary).
returns table (id, title, price, status, thumbnail_url, dong_name,
               like_count, view_count, bumped_at,
               sort_at timestamptz)   -- ← 이 하나만 목록마다 다르다
```

`sort_at` 하나로 정렬·커서·화면 문구가 전부 해결된다. 덕분에 클라이언트에는
**행 변환 하나(`toMyPostSummary`), 커서 하나(`toNextMyPostCursor`), 훅 하나(`useMyPostsQuery`),
목록 컴포넌트 하나(`MyPostList`)** 만 있으면 된다. `kind`만 갈아 끼운다.

```ts
const RPC_BY_KIND: Record<MyListKind, string> = {
  likes: 'fetch_liked_posts',
  recent: 'fetch_recently_viewed_posts',
  purchases: 'fetch_purchased_posts',
  sales: 'fetch_selling_posts',
};
```

카드도 홈·검색과 같은 `PostCard`다. 같은 게시물이 화면마다 다르게 보일 이유가 없다.
다만 **시간 자리의 뜻이 다르다** — 홈에서는 "언제 올라왔나"지만 여기서는 "내가 언제 이걸 했나"다.
그래서 `PostCard`에 선택 prop `timeText` 하나를 열었다. 넘기지 않으면 지금까지와 같다.

```ts
// 목록마다 시각의 뜻이 다르다. 구매내역만 상대 표기가 아니라 날짜다 — 기록이기 때문이다.
toMyListTimeText('likes',     sortAt) // "3일 전 찜"
toMyListTimeText('recent',    sortAt) // "3일 전 봄"
toMyListTimeText('purchases', sortAt) // "2026년 7월 30일 구매"
toMyListTimeText('sales',     sortAt) // undefined → 카드 기본값(끌올 시각)
```

#### 3. 누구의 목록인지는 **보내지 않는다**

네 RPC 모두 `auth.uid()`로 직접 판단한다. 클라이언트가 남의 id를 실어 보낼 여지를 두지 않는다.
`security definer`도 쓰지 않는다 — 호출자 권한이어야 `recently_viewed_select`(본인 행만)가
그대로 걸려 남의 발자취가 새지 않는다(0007·0008과 같은 이유).

`likes`는 사정이 하나 더 있다. `likes_select`가 `using (true)`라 남의 찜도 읽힌다
(게시물의 찜 개수를 세려면 그래야 한다). 그래서 이 RPC에서는 `l.user_id = auth.uid()`로 직접 좁힌다.

#### 4. 최근 본 글은 조회수와 **규칙이 다르다**

둘 다 "상세에 들어왔을 때" 일어나지만 같은 훅에 넣을 수 없다.

| | 조회수 | 최근 본 글 |
| --- | --- | --- |
| 같은 글을 다시 보면 | 세지 **않는다** (탭당 1회) | `viewed_at`을 **갱신한다** |
| 어디에 기록하나 | `sessionStorage` | `recently_viewed` 테이블 |
| 비로그인 | 센다 | 남기지 않는다 |

그래서 `useViewCount` 옆에 `useRecordRecentView`를 따로 두었다. StrictMode 이중 실행을 막는
`ref` 패턴과 "실패해도 조용히 넘어간다"는 정책만 가져왔다.

기록은 RPC(`record_recently_viewed`)로 감쌌다. 클라이언트 upsert 한 번으로도 되지만,
**본인 글 제외**를 서버가 판단해야 하고(내 글은 판매관리에 이미 다 있다 — `increment_view_count`와 같은 자리),
**오래된 기록 잘라 내기**(최근 100건)까지 한 번의 왕복으로 끝나기 때문이다.

#### 5. 프로필 수정에서 "사진 없음"은 두 가지 뜻이다

온보딩에는 없던 갈림길이다.

```
avatarFile === null && !removeAvatar  →  사진은 그대로 둔다 (payload에서 avatar_url을 뺀다)
removeAvatar                          →  기본 이미지로 되돌린다 (avatar_url = null)
```

무조건 쓰면 사진을 안 건드리려던 사용자의 사진이 지워진다. `completeProfileOnboarding`이
같은 이유로 payload에서 칸을 빼던 것을 그대로 이어받았다.

새 사진을 고르면 되돌리기는 자동으로 풀린다. 두 뜻이 동시에 서면 무엇을 저장할지 알 수 없다.

#### 6. 사진을 바꾸면 옛 파일을 지운다

`uploadAvatar`는 파일명에 타임스탬프를 붙여 매번 새 파일을 만든다(CDN 캐시 때문에 그래야 한다).
지워 주지 않으면 버킷에 아무도 안 보는 이미지가 계속 쌓인다.

지우려면 URL이 아니라 경로가 필요한데 우리가 들고 있는 것은 `profiles.avatar_url`뿐이다.

```ts
// avatarStoragePath.ts — 우리 버킷 URL이 아니면 null. 남의 URL을 지우려 들지 않게 하는 안전선이다.
toAvatarStoragePath('…/object/public/avatars/user-1/1754.png') // 'user-1/1754.png'
toAvatarStoragePath('https://lh3.googleusercontent.com/a/abc')  // null
```

스토리지는 트랜잭션에 들어가지 않으므로 **양쪽으로 보상한다** — update가 실패하면 방금 올린 파일을 지우고
(`createPost`와 같은 형태), 성공하면 이제 아무도 안 보는 옛 파일을 지운다.
뒷정리 실패는 무시한다. 프로필은 이미 저장됐다.

#### 7. 탭이 아니라 하위 라우트

목록 넷을 `/my` 안의 탭으로 묶으면 새로고침·뒤로가기에서 어느 목록을 보던 중이었는지 잃는다.
각자 주소를 갖게 하고 `/my`에는 링크만 둔다.

가드는 두 겹이다. `RequireOnboarding`은 **게스트를 통과시킨다**(홈·검색·상세는 게스트에게도 보여야 한다).
마이페이지는 내 것을 보는 자리라 보여줄 것이 없어 `RequireMember`를 한 겹 더 둘렀다.
채팅 화면들은 같은 판단을 화면 안에 직접 적어 두었지만, 마이페이지는 화면이 여섯이라 컴포넌트로 뽑았다.

#### 8. 판매관리에서 상태를 바꾸지 않는다

상태 변경에는 거래 상대를 고르는 절차(`tradePartnerPicker`)가 따라붙는다. 목록 카드 안에 넣기에는 무겁고,
게시물 상세에 이미 그 자리(`PostStatusControl`)가 있다. 카드를 누르면 그리로 간다.
목록은 **보는 자리**로 두고 필터(전체/판매중/예약중/거래완료)만 얹었다.
상태 문구와 순서는 `postStatusTransition`의 것을 그대로 쓴다 — 두 군데 적어 두면 갈라진다.

### 홈에서 바뀐 것

- 아바타·닉네임이 `/my`로 가는 링크가 됐다
- **로그아웃을 홈 헤더에서 마이페이지로 옮겼다.** 자주 쓰지 않는 버튼이 검색·글쓰기 자리를 계속 차지했다

### 검증

`npx jest` 46 스위트 · 317건 통과(신규 6 스위트 · 22건). `tsc --noEmit`·`eslint` 무경고, `vite build` 성공.

RPC는 **실제 DB에 실제 사용자로 가장해** 확인했다(`set local role authenticated` + `request.jwt.claims`).

```
판매관리 27건        1페이지 20 + 2페이지 7 = 27, 중복 0        ← keyset 커서
상태 필터           판매중 22 / 예약중 2 / 거래완료 3 = 27
관심목록            찜한 사람에게만 1건, 다른 계정에는 0건
구매내역            buyer_id + sold=나 인 글만 1건
최근 본 글          본인 글 → 0건 / 남의 글 → 1건, 두 번 봐도 1건(viewed_at 갱신)
남의 발자취          다른 계정에서 조회 시 0건                  ← recently_viewed_select
p_limit 방어        9999를 보내도 서버가 50으로 막는다
```

확인에 쓴 찜·거래 상대 데이터는 모두 되돌렸다(`leftover_likes` 0, `leftover_buyers` 0).

### 이번 범위 밖

- 게시물 **수정·삭제** — 판매관리는 목록과 필터까지다
- 매너온도는 **보여주기만** 한다. 올리고 내리는 것은 `reviews`(§2.3)가 붙어야 한다
- 회원탈퇴·비밀번호 변경(`feature.md` §1) — 마이페이지에 자리는 있으나 이번 `todo.md`에 없다
- 다른 사람의 프로필 화면 — `/my`는 내 것만 본다
- 관심목록에서 바로 찜 풀기 — 카드를 눌러 상세에서 한다

---

## 앱 껍데기 — 하단 탭바 · 다크모드 (2026-08-04)

`todo.md` 1단계. 기능이 아니라 **기능들이 놓일 자리**를 만드는 작업이다.

### 무엇을 만들었나

1. **하단 탭바** — 홈·검색·글쓰기·채팅·나의 가지마켓. 어느 화면에서든 같은 자리에 있다.
2. **공용 레이아웃** — `appLayout.tsx`(`<Outlet/>` + 탭바)를 주소 없는 부모 라우트로 둔다.
3. **다크모드** — 시스템/라이트/다크 3단 토글. 마이페이지에 있다.

### 설계 결정

#### 1. 탭바를 다는 화면과 달지 않는 화면

주소 없는 부모 라우트 하나로 나눈다. 가드는 화면마다 다르므로 부모로 끌어올리지 않았다.

| 탭바 안 | 탭바 밖 |
| --- | --- |
| `/` `/search` `/posts/new` `/chats` `/my/*` | `/posts/:postId` `/chats/:roomId` `/settings/*` 로그인·온보딩 |

기준은 "여기서 다른 데로 갈 수 있어야 하는가"다. 상세와 채팅방은 한 가지 일에 집중하는 자리라
탭바가 있으면 **"지금 하던 일을 그만두라"는 버튼 다섯 개**가 된다. 로그인·온보딩은 아직 갈 곳이 없다.

#### 2. `min-h-screen`은 레이아웃이 한 번만 잡는다

탭바 안 화면 여섯(홈·검색·글쓰기·채팅목록·마이·마이 목록 틀)에서 `min-h-screen`을 걷어냈다.
페이지가 각자 화면 높이를 잡으면 거기에 탭바 높이가 더해져 **어느 화면에서나 스크롤이 64px 남는다.**
높이는 `appLayout`이 잡고, 안쪽은 내용만큼만 차지한다.

#### 3. 안 읽은 배지가 한 곳에만 있게 한다

홈 헤더의 `ChatEntryLink`를 지우고 그 안의 계산을 `useUnreadChatCount`로 뽑아 탭바가 쓴다.
같은 숫자를 두 곳에 그리면 한쪽만 늦게 갱신될 때 **어느 쪽이 맞는지 알 수 없다.**
쿼리 키는 그대로라 캐시도 그대로다 — 탭바가 늘 떠 있는 덕에 채팅 목록이 즉시 뜬다.

세는 대상이 다른 숫자가 하나 더 있다. 탭바 배지는 **메시지 수**, 채팅 목록의 '안읽음' 탭은 **방 수**다.
둘 다 맞다(배지 5 / 탭 2). 후자는 눌렀을 때 나오는 줄 수와 같아야 하기 때문이다.

같은 이유로 홈의 "+ 글쓰기" 버튼과 화면마다 있던 `← 홈`류 링크도 걷어냈다.

#### 4. 다크모드 — 스위치만 없었다

`index.css`의 `@custom-variant dark`도, 65개 파일의 `dark:` 클래스도 이미 있었다.
**`.dark`를 붙이는 코드만 없어서 영원히 라이트모드였다.** 그래서 이번에 더한 것은 스위치뿐이다.

```
uiStore(고른 값 + localStorage) → useApplyTheme(<html>에 .dark) → 65개 파일의 dark:
                                        ↑ matchMedia는 '시스템'일 때만 구독한다
```

갈래가 셋인 이유: '시스템'이 없으면 기기 설정을 따르던 사람이 **한번 손대는 순간 돌아갈 수 없다.**
그리고 직접 고른 사람의 화면은 해가 져도 혼자 뒤집히면 안 되므로, `theme !== 'system'`이면
`matchMedia` 구독 자체를 걸지 않는다.

계정이 아니라 **기기**에 남긴다(localStorage). 회사 노트북은 라이트, 집 휴대폰은 다크가 자연스럽다.

#### 5. 첫 그림 전에 테마를 붙인다

React가 뜬 뒤에 `.dark`를 붙이면 다크로 쓰는 사람에게 흰 화면이 한 번 번쩍인다.
`index.html`에 인라인 스크립트를 두어 **첫 페인트 전에** 클래스를 붙인다.
키와 규칙("'light'가 아닌 모르는 값은 시스템")은 `uiStore`·`toThemePreference`와 같게 맞췄다.

### 검증

`npx jest` 54 스위트 · 364건 통과(신규 6 스위트 · 27건). `tsc --noEmit`·`eslint` 무경고, `vite build` 성공.

빌드된 CSS에서 바탕색 규칙이 두 줄로 나오는 것까지 확인했다.

```css
body{background-color:var(--color-white);color:var(--color-gray-900)}
body:where(.dark,.dark *){background-color:var(--color-gray-950);color:var(--color-gray-50)}
```

### 이번 범위 밖

- 탭바의 **글쓰기**는 링크일 뿐이다. 가운데를 크게 띄우는 FAB 모양은 하지 않았다
- 채팅방·게시물 상세의 헤더 통일 — 탭바 밖 화면들은 이번에 손대지 않았다
- 테마를 계정에 저장하기(기기별로 두는 편이 낫다고 판단)

## 게시물 수정 · 삭제 · 끌어올리기 (2026-08-04)

`todo.md` 2단계. 올린 글을 **올린 사람이 다시 만지는** 길을 낸다.
지금까지 게시물은 한 번 올리면 상태(판매중/예약중/거래완료)밖에 바꿀 수 없었다.

### 무엇을 만들었나

1. **게시물 수정** — `/posts/:postId/edit`. 등록 폼을 그대로 쓴다(`mode='edit'`).
2. **게시물 삭제** — 상세 ⋯ 메뉴. 확인 한 번을 거친다.
3. **끌어올리기** — 24시간에 한 번, 판매중인 글만. 상세 ⋯ 메뉴와 판매관리 목록 양쪽에 있다.

마이그레이션은 `0010_post_bump.sql` 하나다. 수정·삭제는 RLS(`posts_update`/`posts_delete`)와
Storage 정책이 0001·0005에 이미 있어서 스키마를 건드릴 일이 없었다.

### 설계 결정

#### 1. 사진 한 줄에 "이미 올라간 것"과 "방금 고른 것"을 섞는다

수정 화면의 진짜 문제는 여기 하나였다. 등록 폼의 사진은 `File[]`인데, 수정할 때 화면에 이미
올라가 있는 사진은 파일이 아니라 **주소**로만 존재한다. 그렇다고 내려받아 `File`로 만들 수는 없다 —
고치지도 않은 사진을 다시 올리는 셈이다.

배열 두 개(`existingUrls` + `newFiles`)로 나누는 안을 먼저 생각했다가 접었다. **첫 장이 썸네일**이라
순서가 뜻을 가지는데, 둘로 나누면 "기존 사진들 뒤에 새 사진들"이라는 순서밖에 표현할 수 없다.
새로 고른 사진을 대표로 세우려면 결국 하나의 배열이어야 한다.

```ts
export type PostImageItem =
  | { kind: 'existing'; url: string }
  | { kind: 'new'; file: File };
```

`PostFormValues.imageFiles: File[]` → `images: PostImageItem[]`. 등록 화면은
`toNewImageFiles(values.images)`로 예전 모양을 그대로 돌려받아 `createPost`는 손대지 않았다.

검사 규칙도 여기에 맞췄다 — **개수는 전체로 세고, 용량·형식은 새로 고른 파일만 본다.**
이미 올라간 사진은 등록할 때 같은 검사를 통과한 것이라 다시 볼 방법도 이유도 없다.

#### 2. 되돌릴 수 없는 일은 맨 뒤로 — `updatePost`의 네 단계

등록(`createPost`)이 안고 있던 문제가 수정에서 한 겹 더 깊어진다. 스토리지와 테이블을 함께
묶는 트랜잭션이 없는데, 이번에는 **지워야 할 것**까지 생긴다.

```
① 새 사진 업로드   실패해도 아직 아무것도 안 바뀌었다
② 본문 갱신        실패하면 방금 올린 파일을 지운다
③ 사진 행 교체      실패하면 지웠던 행을 되돌리고 방금 올린 파일도 지운다
④ 빠진 사진 정리    여기서 실패해도 수정은 이미 끝났다 — 고아 파일만 남는다
```

④를 앞으로 당기면 안 된다. 파일을 먼저 지웠다가 ②·③이 거절당하면 **화면에는 남아 있는데
파일은 사라진 사진**이 생긴다. 고아 파일은 용량을 먹을 뿐이지만 깨진 사진은 사용자가 본다.

③이 `delete` 후 `insert`인 것도 같은 이유의 타협이다. 순서(`sort_order`)까지 바뀌므로 행마다
맞춰 고치는 것보다 갈아 끼우는 편이 단순한데, 그 사이에 실패하면 사진 없는 게시물이 된다.
그래서 지우기 전에 읽어 둔 행을 되돌린다.

삭제도 같은 규칙이다. **행을 먼저 지우고 파일을 나중에 치운다.** 반대로 하면 파일 삭제 뒤
행 삭제가 거절당했을 때 사진이 전부 깨진 게시물이 남는다. 이 순서라면 최악이 고아 파일이다.

#### 3. 공개 URL에서 스토리지 경로를 되짚는다

`post_images`는 공개 URL만 들고 있다(등록할 때 그것만 저장했다). 그런데 스토리지에서 파일을
지우려면 `remove(['<uid>/<파일명>'])`처럼 **경로**가 필요하다.

경로 컬럼을 새로 만드는 대신 주소에서 되짚기로 했다. 이미 올라가 있는 사진에도 그대로 통하고
마이그레이션이 필요 없다.

```ts
// .../storage/v1/object/public/post-images/<uid>/<파일명>  →  <uid>/<파일명>
export function toPostImagePath(publicUrl: string): string | null
```

우리 버킷의 주소가 아니면 `null`이고, 정리 대상에서 조용히 빠진다. 쿼리(`?t=`)와 퍼센트 인코딩도
걷어낸다 — `remove()`는 날것의 경로를 받는다.

#### 4. 끌올 쿨다운은 서버가 지킨다

24시간 규칙을 화면에만 두면 요청을 직접 보내는 것만으로 뚫린다. 게다가 **"누르면 목록 맨 위로
간다"는 보상이 걸린 규칙**이라 뚫을 동기도 분명하다. 0008이 상태 전이 규칙을 트리거에 둔 것과
같은 판단으로 `bump_post` RPC에 넣었다.

```sql
-- 판매자 본인 + 판매중 + 마지막 끌올로부터 24시간
create or replace function bump_post(p_post_id bigint) returns timestamptz ...
```

`security definer`를 쓰지 않았다. 끌올은 자기 글에만 하는 일이라 호출자 권한으로 충분하고,
definer로 만들면 `posts_update` 정책이 비켜 간다. (조회수 `increment_view_count`가 definer여야
했던 것은 **남의 글**을 고쳐야 했기 때문이다 — 조건이 다르다.)

거절 사유를 errcode가 아니라 **문구로** 구분해 돌려준다. 왜 막혔는지가 화면에 그대로 필요해서다.

#### 5. 끌올은 "수정"이 아니다

0005가 만든 `posts_set_updated_at` 트리거는 조회수·찜만 예외로 두고 있었다. 그대로 두면
끌어올리기 한 번에 `updated_at`이 따라 올라 **3일 전에 올린 글이 "방금 수정함"이 된다.**
트리거 조건에 `bumped_at`을 더했다.

```sql
for each row when (
  old.view_count is not distinct from new.view_count
  and old.like_count is not distinct from new.like_count
  and old.bumped_at is not distinct from new.bumped_at   -- 이번에 추가
)
```

상태 변경은 0008이 판단한 대로 수정으로 본다(판매자가 의도적으로 누른 변경이다).

#### 6. ⋯ 메뉴에 넣은 것과 넣지 않은 것

수정·끌올·삭제는 접어 두고, **거래 상태 변경(`PostStatusControl`)은 접지 않았다.**
상태는 상품을 볼 때마다 바로 보여야 하는 정보이자 가장 자주 누르는 버튼이다. 당근도 같은 배치다.

끌어올리기만 판매관리 목록에도 뒀다. 고를 것도 되돌릴 것도 없는 한 번의 누름이라 목록 안에서
끝나고, 여러 글을 차례로 올리는 일이 잦아 그래야 값이 산다. 상태 변경을 목록에 두지 않은 이유
(거래 상대를 고르는 절차가 따라붙는다)가 여기에는 해당하지 않는다.

목록 카드에 버튼을 붙이면서 `PostCard`에 `action` 자리를 뒀는데, **링크 안이 아니라 밖**이다.
`<a>` 안에 `<button>`을 넣으면 어느 쪽이 눌린 것인지 브라우저마다 다르게 굴고, 스크린리더도
링크 이름에 버튼 글자를 섞어 읽는다.

### 검증

`npx jest` 57 스위트 · 398건 통과(신규 3 스위트 · 34건). `tsc --noEmit`·`eslint` 무경고,
`vite build` 성공.

`bump_post`는 실제 DB에서 네 갈래를 모두 확인했다 — 성공(`bumped_at`만 오르고 `updated_at`은
그대로), 쿨다운 거절, 판매중 아님 거절, 남의 글 거절.

### 이번 범위 밖

- **끌올 남은 시간의 실시간 갱신** — 메뉴를 여는 순간을 기준으로 잰다. 열어 둔 채 시간이 흘러도
  다시 그리지 않는다. 어긋나 봐야 몇 분이고, 서버가 한 번 더 본다
- **수정 이력** — 당근처럼 "수정됨" 표시를 붙이지 않았다(`updated_at`은 쌓이고 있다)
- **동네 변경** — 수정해도 글이 올라온 동네는 바뀌지 않는다. 올린 뒤에 이사를 갔더라도
  그 글이 그 동네 글이었다는 사실은 그대로다

## 탐색 — 정렬 · 홈 무한 스크롤 (2026-08-04)

`todo.md` 3단계. `feature.md` §2.2가 요구하던 "조회수별·방금전·찜 많은 순·가격" 정렬을 붙이고,
홈에서 21번째 글에 닿는 길을 냈다.

### 무엇을 만들었나

1. **정렬 5종** — 최신순 · 조회 많은 순 · 찜 많은 순 · 낮은 가격순 · 높은 가격순.
   검색 화면의 필터 줄 오른쪽에 select 하나. 필터와 같이 URL(`?sort=`)에 산다.
2. **홈 피드 무한 스크롤** — `NEIGHBORHOOD_POSTS_LIMIT=20`에서 잘려 있던 홈이 끝까지 내려간다.
3. **목록 컴포넌트 하나로 합치기** — 홈과 검색이 `postList.tsx`를 같이 쓴다.

마이그레이션은 `0011_post_sort.sql` 하나다.

### 설계 결정

#### 1. 정렬이 바뀌면 커서도 바뀐다 — 이게 이번 단계의 전부다

정렬 자체는 `order by`를 바꾸면 끝이다. 진짜 일은 **keyset 커서**에 있었다.
0007의 커서는 `(bumped_at, id)`였는데, 이건 "최신순으로 볼 때의" 커서다. 찜순으로 보면서
`bumped_at`을 커서로 보내면 서버는 `like_count`와 시각을 견주게 된다.

정렬 기준마다 커서 타입을 따로 받는 안(`p_cursor_bumped_at` + `p_cursor_number`)을 먼저
생각했다가 접었다. 정렬을 하나 더 붙일 때마다 인자가 늘고, 클라이언트는 "이번엔 어느 칸에
넣어야 하나"를 매번 판단해야 한다. **커서 값을 text 한 칸으로 받고, 정렬 기준을 아는 서버가
알맞은 타입으로 되돌리기로** 했다.

```sql
p_cursor_value text default null   -- '2026-08-02T06:55:00+00:00' 이거나 '35000' 이거나
...
or %1$s %2$s $7::%3$s              -- 정렬 컬럼 / 부등호 / 캐스팅할 타입
```

클라이언트 쪽은 `toNextPostSearchCursor(lastPage, sort)` 한 곳에서만 정렬을 안다.

#### 2. tie-breaker는 언제나 `id desc`

`order by price asc`인데 두 번째 키는 `id desc`다. 어색해 보이지만 의도한 것이다 —
같은 가격 안에서는 새 글이 먼저 보이는 편이 자연스럽고, 커서 비교식이
`(정렬값이 다음이거나) or (정렬값이 같고 id가 더 작다)` 한 모양으로 통일된다.
방향까지 정렬 기준마다 뒤집으면 커서 조건이 네 갈래로 갈라진다.

#### 3. `order by case`를 쓰지 않은 이유는 인덱스다

한 줄로 끝낼 수 있는 길이 있었다.

```sql
order by case p_sort when 'popular' then p.view_count when 'likes' then p.like_count ... end desc
```

이러면 **어떤 인덱스도 이 표현식과 맞지 않아** 동네 글을 전부 읽고 메모리에서 정렬한다.
20개를 보여주려고 5천 개를 정렬하는 셈이다. 정렬 컬럼이 쿼리 문자열에 박혀 있어야 인덱스를 탄다.
그래서 본문을 `format()` + `execute`로 짰다.

주입 걱정은 없다. `p_sort`는 **컬럼명을 만들어 내지 않고 화이트리스트에서 고르기만** 하고,
목록에 없으면 `invalid_parameter_value`로 거절한다. 사용자 입력(검색어·가격·커서)은 전부
`$n` 파라미터로 바인딩된다.

```sql
case coalesce(p_sort, 'latest')
  when 'popular' then v_column := 'p.view_count'; v_direction := 'desc'; v_type := 'integer';
  ...
  else raise exception '알 수 없는 정렬 기준입니다: %', p_sort using errcode = 'invalid_parameter_value';
end case;
```

인덱스는 정렬 기준마다 하나씩, `(region_code, 정렬컬럼 방향, id desc)` 모양으로 채웠다.
**방향까지 같아야 한다** — `(price asc, id desc)`를 거꾸로 읽으면 `(price desc, id asc)`가 되어
tie-breaker가 어긋나므로 가격은 오름·내림 두 벌이다. 0007의 `posts_region_price_idx`는
오름차순 인덱스가 앞부분을 그대로 품고 있어 지웠다.

#### 4. `create or replace`가 교체가 아니라 **추가**가 되는 자리

인자 목록이 바뀌면 `create or replace function`은 기존 함수를 고치지 않고 **오버로드를 하나 더
만든다.** 그대로 두면 `search_posts`가 두 개가 되고, PostgREST가 공통 인자만 담긴 요청을 받았을 때
어느 쪽인지 고르지 못해 PGRST203으로 거절한다. 그래서 0011은 옛 시그니처를 먼저 지운다.

```sql
drop function if exists search_posts(
  text, text, bigint, integer, integer, boolean, timestamptz, bigint, integer
);
```

#### 5. 홈도 `search_posts`를 쓴다

홈 목록은 조건을 하나도 걸지 않은 검색과 결과가 같다(0007이 그렇게 설계돼 있었다).
그래서 `fetchNeighborhoodPosts`는 PostgREST 쿼리 빌더를 버리고 같은 RPC를 부른다.

```ts
export async function fetchNeighborhoodPosts(regionCode, cursor) {
  return searchPosts({ regionCode, filters: EMPTY_POST_SEARCH_FILTERS, sort: DEFAULT_POST_SORT, cursor });
}
```

목록을 두 갈래로 두면 "목록이라면 모두 적용돼야 하는 규칙"을 넣을 때마다 두 곳을 고쳐야 한다.
6단계의 차단 사용자 제외가 곧 그런 규칙이다 — 이제 `search_posts` 한 곳만 고치면 홈까지 따라온다.

캐시 키는 검색과 나눠 뒀다(`['posts','neighborhood',code]`). 결과는 같아도 **스크롤 위치가
같으면 안 된다** — 검색에서 열 페이지를 내린 뒤 홈 탭을 누르면 홈이 처음부터 200개를 그린다.

#### 6. 정렬은 "필터 초기화"의 대상이 아니다

`hasActiveFilter`도 `clearFilters`도 정렬을 세지 않는다. 초기화는 조건을 푸는 버튼이지
보던 순서를 되돌리는 버튼이 아니다. 같은 이유로 결과 0건 안내도 갈랐다 —
`isNarrowed`를 `searchParams.toString() !== ''`로 재던 것을 검색어·필터만 보도록 고쳤다.
정렬만 바꾼 0건은 "조건에 맞는 물건이 없다"가 아니라 "동네에 글이 없다"는 뜻이다.

필터 시트의 `key`에서도 정렬을 뺐다. 가격을 입력하는 중에 정렬을 바꿨다고 draft가 날아가면 안 된다.

### 검증

`npx jest` 59 스위트 · 413건 통과(신규 2 스위트, 기존 2 스위트 보강). `tsc --noEmit`·`eslint`
무경고, `vite build` 성공.

실제 DB(27건)에서 확인한 것:

- 다섯 정렬이 모두 기대한 순서로 나온다
- **같은 값 경계**에서 keyset이 안 샌다 — 가격 10000원짜리 두 건(id 14, 2)이 페이지 경계에
  걸리도록 `p_limit => 3`으로 끊었을 때, 2페이지가 정확히 `2:10000`부터 시작한다
- `p_sort => 'sqli; drop table posts'` → `22023`으로 거절, `posts` 27건 그대로
- `escape_like_pattern`이 동적 SQL 안에서도 산다 — `%` 검색이 전체가 아니라
  "100% 새제품 텀블러" 한 건만 잡고, `_` 검색은 0건
- `enable_seqscan=off`로 확인한 실행계획이 `Index Only Scan using posts_region_price_asc_idx`,
  Sort 노드 없음 (27행뿐이라 평소에는 planner가 seq scan을 고른다)

앱이 실제로 쓰는 경로(PostgREST + anon 키)로도 같은 페이로드를 보내 커서 왕복을 확인했다.
PostgREST가 돌려주는 `2026-08-02T06:55:00+00:00` 문자열이 그대로 `::timestamptz`로 되돌아간다.

### 이번 범위 밖

- **홈의 정렬 선택** — 홈은 "지금 뭐가 올라왔나"를 훑는 자리라 최신순이 전제다.
  순서를 고르고 싶은 순간에는 이미 찾는 것이 있으므로 검색이 맡는다
- **인기순의 정의** — 조회수 하나로 잡았다. 조회·찜·채팅을 섞은 점수는 기준을 정하는 일이지
  거는 일이 아니라 따로 다룬다
- **거리순** — `nearby_posts`(PostGIS)와 `profiles.search_radius_m`이 아직 잠들어 있다.
  지도 기능과 함께 꺼내는 편이 맞다

## 채팅 가격 제안 (2026-08-05)

`todo.md` 4단계. 스키마에는 `message_type='price_offer'`·`offer_amount`·`offer_status`가 처음부터
있었고 말풍선에 분기까지 있었는데 **보내는 길도 답하는 길도 없어** 한 번도 쓰이지 않던 자리다.
마이그레이션 없이 api/hooks/components만 얹어 그 길을 냈다.

### 무엇을 만들었나

1. **제안 보내기** — 입력줄의 `₩` 버튼이 금액 칸을 연다. 사는 쪽에게만, 판매중일 때만 보인다.
2. **수락 · 거절** — 받은 제안 말풍선에 버튼 둘. 답이 끝나면 결과 글자만 남는다.
3. **중복 제안 막기** — 내가 보낸 제안이 대기 중이면 새 제안을 열지 않는다.

### 설계 결정

#### 1. 제안은 한 방향으로만 흐른다

가격 제안을 **사는 쪽만** 걸 수 있게 했다(`canSendPriceOffer`). 파는 쪽은 값을 내리고 싶으면
게시물 가격을 고치면 되므로(2단계) 제안할 이유가 없다.

방향을 하나로 묶은 진짜 이유는 화면이다. 양쪽이 다 제안할 수 있으면 "이 말풍선에 답할 사람이
누구인가"가 방마다·메시지마다 달라진다. 한 방향이면 **받은 쪽 = 판매자**로 고정돼
수락·거절 버튼의 자리가 흔들리지 않는다.

서버는 이 방향을 강제하지 않는다. `messages_insert`(0001)는 방 참여자면 통과시키므로
판매자가 API를 직접 찔러 제안을 넣는 것 자체는 막히지 않는다. 다만 그렇게 들어온 행도
`canRespondToOffer`가 "발신자가 아닌 쪽"만 답하게 하므로 화면은 깨지지 않는다.

#### 2. 답하는 권한은 서버가 이미 정해 두고 있었다

수락·거절에 RPC를 만들지 않았다. 0008이 이미 두 겹으로 막아 뒀기 때문이다.

- `messages_update` 정책 — **발신자가 아닌** 방 참여자만 (누가)
- `guard_message_update` 트리거 — `read_at`·`offer_status` 외의 컬럼 변경 금지 (무엇을)

그래서 평범한 `update` 한 줄이면 된다. 읽음 표시(`markRoomRead`)가 RPC 없이 도는 것과 같은 이유다.

```ts
.update({ offer_status: input.status })
.eq('id', input.messageId)
.eq('type', 'price_offer')
.eq('offer_status', 'pending')
```

마지막 조건이 핵심이다. **이미 답한 제안을 두 번째 답이 덮어쓰지 못하게** 한다 — 버튼을 두 번
눌렀거나 상대 화면이 조금 낡았을 때 마지막 클릭이 이기는 일이 없다. 조건에 걸리면 update는
오류가 아니라 **빈 결과**로 돌아오므로(`maybeSingle` → `null`) 거기서 뜻을 붙여 준다.

#### 3. 수락해도 게시물 가격은 바꾸지 않는다

당근에서도 제안 수락은 "그 값에 하자"는 **합의 표시**일 뿐 판매글의 가격표를 고치는 일이 아니다.
가격을 따라 바꾸면 그 글을 보는 다른 이웃에게도 8,000원짜리로 보이는데, 합의는 이 방 둘 사이의
것이다. 실제 DB에서도 수락 뒤 `posts.price`가 그대로임을 확인했다.

#### 4. 대기 중인 제안은 한 번에 하나

`hasPendingOfferFrom`이 참이면 금액 칸을 열지 않는다. 대기 중인 제안이 여러 개 쌓이면 판매자
화면에 수락 버튼이 여러 개 남고, **그중 어느 것을 눌러도 "합의된 금액"이 되어 버린다.**

막는 방식은 잠긴 버튼이 아니라 **열어서 이유를 보여주는 쪽**을 골랐다. `₩` 버튼은 언제나 눌리고,
눌러서 열린 자리에 "먼저 보낸 제안의 답을 기다리는 중입니다"가 적힌다. 잠긴 버튼은 이유를
말해 주지 않는다(troble.md 같은 절 1번).

이건 화면 규칙일 뿐이라 서버는 두 번째 제안도 받는다. 서버에 두려면 트리거가 필요하고
그건 마이그레이션인데, 어겼을 때 손해가 "판매자 화면이 조금 지저분해진다" 정도라 화면에 뒀다.

#### 5. 제안 폼은 대화 입력줄과 **형제**다

`chatComposer`의 뿌리가 `<form>`이라 제안 입력을 그 안에 넣으면 폼이 중첩된다.
`<div>`으로 감싸 둘을 나란히 뒀다. HTML 규칙 이전에 **Enter의 주인**이 갈리기 때문이다 —
대화 입력에서 Enter는 전송인데, 한 폼이면 금액을 치다 Enter를 눌렀을 때 어느 쪽이 나갈지 모른다.

### 파일 구성

```
chat/
├─ api/chatApi.ts                    sendPriceOfferMessage · respondToOffer
├─ hooks/useChatMutations.ts         useSendPriceOfferMutation · useRespondToOfferMutation
├─ utils/priceOffer.ts               canSendPriceOffer · canRespondToOffer · hasPendingOfferFrom
├─ utils/validateChatInput.ts        validateOfferAmount
├─ components/priceOfferForm.tsx     금액 입력 (신설)
└─ components/chatMessageBubble.tsx  제안 말풍선 + 수락·거절
```

답변은 새 메시지가 아니라 있던 행의 갱신이라 캐시도 `withUpdatedMessage`로 **갈아 끼운다.**
채팅방 요약은 건드리지 않는다 — `last_message`를 고치는 트리거는 insert에만 붙어 있어
답변으로는 목록의 마지막 메시지도 안 읽은 수도 변하지 않는다. 상대 화면은 Realtime UPDATE가
같은 자리를 갈아 끼워 따라온다(`messages`는 replica identity full).

### 검증

`npx jest` 60 스위트 · 444건 통과(신규 1 스위트, 기존 2 스위트 보강).
`tsc --noEmit`·`eslint` 무경고, `vite build` 성공.

실제 DB에서 `set local role authenticated` + `request.jwt.claims`로 양쪽 사용자를 흉내 내
확인한 것:

- 구매자가 넣은 `price_offer` 한 건이 채팅방 요약을 `8000원 제안`으로 만들고,
  판매자에게 `type='price_offer'` 알림을 남긴다 (7단계가 읽을 자리)
- **구매자가 자기 제안에 답할 수 없다** — 0행 (`messages_update`가 발신자를 뺀다)
- 판매자의 수락은 1행, 이어진 두 번째 답변은 0행 (`offer_status='pending'` 조건)
- 수락 뒤에도 `posts.price`는 10,000원 그대로
- 판매자가 `offer_amount`를 고치려 하면 `23514 메시지는 읽음 표시만 바꿀 수 있습니다.`

넣은 행은 검증 뒤 모두 지우고 방 요약을 원래 값으로 되돌렸다.

### 이번 범위 밖

- **제안 취소** — `messages_update`가 발신자를 아예 뺐기 때문에 구매자가 자기 제안을 무를 길이
  없다. 정책을 "발신자는 offer_status를 `cancelled`로만" 쪽으로 손대야 하는데, 그러면
  enum 값 추가까지 마이그레이션이 된다. `todo.md`가 처음부터 이 조건을 달아 뒀다
- **제안 수락 → 예약 자동 전환** — 수락이 곧 거래 약속은 아니다. 상태는 판매자가
  `postStatusControl`에서 직접 바꾼다
- **여러 제안 히스토리 화면** — 주고받은 제안을 따로 모아 보는 자리. 대화 흐름 안에서
  말풍선으로 보는 것으로 충분하다고 봤다

---

## 신뢰 — 다른 사용자 프로필 · 거래후기 (2026-08-05)

`todo.md` 5단계. `reviews` 테이블도, 매너온도를 더하고 알림까지 넣는 `recalc_manner_temp`
트리거도 0001부터 있었는데 **후기를 쓸 화면이 없어 전원이 36.5°에 멈춰 있던** 자리다.
남의 프로필을 볼 곳도 없어서 `postSellerCard`는 링크가 아닌 그냥 카드였다.

### 무엇을 만들었나

1. **다른 사용자 프로필** (`/users/:userId`) — 매너온도 눈금, 판매중·거래완료·받은 후기 개수,
   판매 상품과 받은 후기 두 탭. 게시물 상세의 판매자 줄이 이리로 온다.
2. **거래후기 작성** (`/posts/:postId/review`) — 평가(좋아요·보통·별로) + 매너 태그 + 한 줄.
   판매자·구매자가 서로를 평가한다.
3. **후기 진입점 셋** — 게시물 상세의 거래완료 직후 안내, 구매내역·판매관리 목록의 버튼.
4. **후기 구멍 막기** — 아무나 아무에게나, 아무 점수나 줄 수 있던 0001의 정책을 좁혔다.

마이그레이션은 둘이다. `0012_user_profile.sql`(읽는 길)과 `0013_review.sql`(쓰는 길 + 규칙).
`todo.md`는 5-2를 "마이그레이션 없음"으로 적어 뒀지만, 아래 2번의 구멍을 화면 규칙으로 둘 수
없어서 파일이 하나 늘었다. 그만큼 6단계 차단 필터는 `0014`가 된다.

### 설계 결정

#### 1. 후기 대상은 **클라이언트가 고르지 않는다**

`create_review(p_post_id, p_rating, p_manner_tags, p_comment)` — 인자에 `reviewee_id`가 없다.
서버가 게시물을 보고 "내가 판매자면 구매자를, 구매자면 판매자를" 상대로 정한다.

```sql
if v_user = v_seller then      v_reviewee := v_buyer;
elsif v_user = v_buyer then    v_reviewee := v_seller;
else raise exception '이 거래의 당사자만 후기를 남길 수 있습니다.';
```

`record_recently_viewed`가 `user_id`를 받지 않고, 마이페이지 목록 RPC들이 "누구의 것"인지
묻지 않는 것과 같은 판단이다. **클라이언트가 남의 id를 실어 보낼 자리를 아예 만들지 않는다.**

#### 2. 점수는 서버가 정하고, 컬럼이 한 번 더 막는다

0001의 `reviews_insert`는 `auth.uid() = reviewer_id` 하나뿐이었다. 그래서
거래한 적 없는 이웃에게 `score = -99`를 꽂아 **남의 매너온도를 한 번에 0으로 만들 수 있었다**
(트리거가 0~99로 자르므로 죽지는 않고 바닥에 닿는다).

두 겹으로 막았다.

- **정책** — 후기는 `status='sold'`이고 `buyer_id`가 있는 거래의 **두 당사자 사이에서만**,
  방향이 서로를 향할 때만 들어간다. 이건 `posts`를 봐야 판단할 수 있어 check 제약으로는
  못 막는다(0008 `posts_update`와 같은 자리, troble.md #13).
- **제약** — `score in (-0.5, 0.1, 0.5)`. RPC를 거치지 않고 테이블에 직접 insert하는 길이
  여전히 열려 있으니 마지막 방어선은 컬럼에 둔다.

화면은 점수를 아예 모른다. `good·normal·bad`만 보내고, 받은 후기를 읽을 때도 점수 대신
같은 세 낱말이 온다 — 몇 도가 오르는지 알면 "몇 도 줄까"를 고르는 화면이 되어 버린다.

#### 3. "후기 남기기" 버튼은 서버가 정한 목록으로 그린다

목록 카드마다 버튼을 붙이려면 "이 거래에 후기를 남길 수 있나"를 알아야 하는데, 그 답은
세 가지에 달려 있다 — 거래완료인가 · 거래 상대가 있는가 · 이미 남기지 않았는가.

0009의 네 RPC는 같은 열 벌을 돌려주기로 한 약속이 있어 컬럼을 더할 수 없었다. 그래서
`fetch_pending_reviews()`를 따로 두고 목록과 나란히 한 번 부른다. 화면은 `post_id`가 그 목록에
있는지만 본다(`findPendingReview`).

```tsx
const pending = findPendingReview(pendingReviewsQuery.data, post.id);
return pending === null ? null : <WriteReviewButton pending={pending} />;
```

**없으면 아무것도 그리지 않는다.** 이미 남겼든, 거래 상대를 안 골랐든, 내 거래가 아니든
답은 같다. 눌러 봐야 서버가 거절하는 버튼을 놓지 않는 것은 끌어올리기 버튼을 판매중에만
그리는 것과 같은 판단이다.

거래완료 직후 안내(`ReviewPrompt`)도 같은 목록을 본다. 그래서 게시물 상세에 조건 없이
붙여 두기만 하면 판매자·구매자 양쪽에서 알아서 나타났다 사라진다.

#### 4. 프로필의 판매 목록은 `MyPostList`가 아니라 `PostList`를 쓴다

반환 모양이 같아서(0012가 0009의 열 벌을 그대로 따랐다) `MyPostList`를 쓰고 싶었지만
그쪽 `kind`는 `RPC_BY_KIND`의 열쇠라 다섯 번째 값을 넣을 수 없다 — 남의 프로필 목록은
`p_user_id`를 받는 다른 함수다(troble.md 같은 절 2번).

대신 홈·검색이 쓰는 `PostList`에 `emptyMessage` 한 칸을 열었다. 그쪽 0건 문구가
"아직 우리 동네에 올라온 물건이 없어요"라 남의 프로필에서는 맞지 않는다.

#### 5. 매너온도 문구를 한 곳으로 모았다

`toTemperatureText`가 마이페이지 카드와 판매자 카드에 따로 적혀 있었다. 프로필 카드까지
셋이 되면 한 곳만 고쳐졌을 때 같은 온도가 화면마다 다르게 보인다.
`profile/utils/mannerTemperature.ts`로 옮기고 눈금 비율(`toTemperatureRatio`)을 더했다.

#### 6. 후기는 고칠 수 없다

수정·삭제 정책을 두지 않았다(0001부터 없다). 매너온도를 더하는 트리거가 insert에만 붙어
있어서, 후기를 고치면 **온도는 그대로고 문구만 바뀌는** 앞뒤 안 맞는 상태가 된다.
고치려면 트리거를 update까지 확장하고 "옛 점수를 빼고 새 점수를 더하는" 계산을 넣어야 하는데,
당근도 후기 수정을 열어 두지 않는다.

### 파일 구성

```
supabase/migrations/
├─ 0012_user_profile.sql            fetch_user_profile · fetch_user_posts
└─ 0013_review.sql                  정책·제약 · create_review · fetch_user_reviews
                                    · fetch_pending_reviews

review/                             (여태 .gitkeep만 있던 폴더)
├─ api/reviewApi.ts
├─ hooks/useReviewQueries.ts        useUserReviewsQuery · usePendingReviewsQuery
├─ hooks/useCreateReviewMutation.ts
├─ utils/reviewRating.ts            평가 문구 · 태그 목록 · toggleMannerTag
├─ utils/reviewTarget.ts            toReviewEligibility (0013과 같은 규칙)
├─ utils/pendingReview.ts           findPendingReview
├─ utils/reviewCursor.ts
├─ utils/validateReviewInput.ts
├─ utils/reviewErrorMessage.ts
└─ components/                      reviewForm · reviewWritePage · reviewList
                                    · reviewListItem · reviewPrompt · writeReviewButton

profile/
├─ api/userProfileApi.ts            (신설)
├─ hooks/useUserProfileQuery.ts     (신설)
├─ utils/mannerTemperature.ts       (신설 — 두 카드에서 모아 옴)
└─ components/userProfilePage.tsx · userProfileCard.tsx   (신설)
```

### 검증

`npx jest` 68 스위트 · 484건 통과(신규 7 스위트 40건). `tsc --noEmit`·`eslint` 무경고,
`vite build` 성공.

실제 DB에서 `set local role authenticated` + `request.jwt.claims`로 세 사용자를 흉내 내
확인한 것(임시 거래 한 건을 만들어 쓰고 전부 되돌렸다).

- 구매자가 남긴 `good` 후기 하나로 판매자 매너온도가 **36.5 → 37.0**, `type='review'` 알림 1건
- 같은 사람이 다시 → `23505 이미 후기를 남긴 거래입니다.`
- 제3자가 RPC로 → `42501 이 거래의 당사자만 후기를 남길 수 있습니다.`
- 제3자가 테이블에 직접 insert → `new row violates row-level security policy`
- 당사자가 `score = -99`로 직접 insert → `23514 reviews_score_allowed`
- 판매중인 글에 후기 → `23514 거래완료된 거래에만 후기를 남길 수 있습니다.`
- 판매자가 남긴 `normal` 후기로 구매자 온도 36.5 → **36.6**, 이후 양쪽 모두
  `fetch_pending_reviews()` 0건
- 한 줄 후기의 앞뒤 공백은 잘리고, 빈 문자열은 `null`로 눕는다

검증 뒤 후기 2건·알림·임시 게시물을 지우고 두 사람의 매너온도를 36.5로 되돌렸다.

### 이번 범위 밖

- **후기 수정·삭제** — 위 6번. 매너온도 재계산까지 따라와야 한다
- **매너 태그 통계** — 당근은 프로필에 "시간 약속을 잘 지켜요 12"처럼 태그를 세어 보여준다.
  `manner_tags`가 `text[]`라 `unnest` + `group by`면 되지만, 후기가 쌓이기 전에는 볼 것이 없다
- **후기 알림 화면** — `recalc_manner_temp`가 넣는 `type='review'` 알림은 여전히 읽을 곳이
  없다. 7단계의 몫이다
- **첫 거래 안내** — "첫 후기를 받았어요" 같은 축하 화면. 지금은 온도만 조용히 오른다

## 안전 — 차단 · 신고 (2026-08-05)

`todo.md` 6단계. `blocks`·`reports` 테이블과 RLS는 0001부터 있었고 화면만 0이었다.
그런데 이번 단계의 무게는 화면이 아니라 **차단이 실제로 작동하게 만드는 일**에 있었다 —
차단 버튼만 붙이고 목록을 그대로 두면 차단한 사람의 글이 홈에 그대로 뜬다.

### 무엇을 만들었나

1. **차단 · 해제** — 게시물 상세·프로필·채팅방의 ⋯ 메뉴에서. 마이페이지에 관리 화면(`/my/blocks`).
2. **차단이 걸러내는 자리 넷** — 홈·검색 목록(`search_posts`), 채팅방 목록(`fetch_chat_rooms`),
   새 대화 시작(`open_chat_room`), 이미 열린 방에 메시지 넣기(`messages_insert` 정책).
3. **신고** — 게시물·사용자 신고 시트(사유 선택 + 상세). 접수 뒤 차단을 함께 권한다.
4. **신고에 형태 주기** — 사유 화이트리스트·대상 id 형태·자기 신고·중복을 서버가 막는다.

마이그레이션은 `0014_block_and_report.sql` 하나다. `todo.md`는 6-1을 `0014_block_filter.sql`,
6-2를 "마이그레이션 없음"으로 적어 뒀지만 신고 쪽도 제약이 필요해(0013이 `reviews`에 그랬던
것과 같은 이유) 한 파일에 합쳤다.

### 설계 결정

#### 1. 차단은 양방향인데, `blocks_select`는 한 방향만 보여준다

차단은 내가 건 쪽도 나를 건 쪽도 서로 보이지 않아야 한다. 그런데 0001의 정책은 이것뿐이다.

```sql
create policy blocks_select on blocks for select using (auth.uid() = blocker_id);
```

**내가 건 차단만** 읽힌다. 그리고 RLS 정책 안에서든 `security invoker` 함수 안에서든 다른
테이블을 조회하면 그 테이블의 정책이 그대로 걸리므로, "나를 차단한 사람"은 어떤 방법으로도
보이지 않는다. 그렇다고 `auth.uid() = blocked_id` 정책을 더할 수는 없다 — 그 순간
**누가 나를 차단했는지 목록으로 조회할 수 있게 된다.** 차단은 상대가 몰라야 의미가 있다.

답은 `security definer` 함수를 두되 **클라이언트가 부를 수 없는 곳에 두는 것**이었다.

```sql
create schema if not exists private;

create or replace function private.blocked_user_ids()
returns uuid[] language sql stable security definer set search_path = public as $fn$
  select coalesce(array_agg(counterpart), '{}')
    from (select b.blocked_id as counterpart from blocks b where b.blocker_id = auth.uid()
          union
          select b.blocker_id                from blocks b where b.blocked_id = auth.uid()) s;
$fn$;
```

PostgREST는 노출 스키마(`public`, `graphql_public`)의 함수만 라우팅하므로 `private`에 있으면
SQL 안에서만 쓰이고 `supabase.rpc()`로는 닿지 않는다(검증에서 실제로 확인했다).
남는 노출은 하나 — 나를 차단한 사람의 글이 목록에서 사라지므로 눈치챌 수는 있다.
차단을 양방향으로 만드는 이상 피할 수 없는 값이고, "목록으로 확인할 수 있는 것"과는 무게가 다르다.

낱개 판정(`private.is_blocked(a, b)`)은 따로 뒀다. 정책처럼 "이 상대와 되는가"만 묻는 자리가
배열 전체를 받을 이유가 없다.

#### 2. 목록에서 거르는 조건은 **행마다가 아니라 한 번**

`search_posts`(0011)는 동적 SQL이다. 조건을 행마다 `exists`로 걸면 동네 글 수만큼 `blocks`를
뒤지므로, 함수 시작에 배열로 한 번 받아 파라미터 한 칸($10)으로 넘겼다.

```sql
v_blocked := private.blocked_user_ids();
...
  and p.seller_id <> all ($10)
```

`<> all('{}')`는 참이라 차단이 없는 대부분의 사용자에게는 조건이 없는 것과 같다.
게스트도 마찬가지다 — `auth.uid()`가 null이면 빈 배열이 온다.
인자 목록이 그대로라 `create or replace`가 교체가 된다(0011이 옛 시그니처를 지워야 했던
것과 다른 경우다 — 그때는 인자가 늘었다).

#### 3. 목록에서 지우는 것만으로는 부족하다

차단은 대개 **대화를 나눈 뒤에** 누른다. 즉 방은 이미 있다. 그래서 막을 곳이 넷이었다.

| 자리 | 무엇을 막나 |
| --- | --- |
| `search_posts` | 차단한 사람의 글이 홈·검색에 뜨는 것 |
| `fetch_chat_rooms` | 방 목록에 뜨는 것 (→ `fetch_chat_room`도 함께 빈다) |
| `open_chat_room` | 게시물 상세에서 새 대화를 거는 것 |
| `messages_insert` 정책 | 상대가 자기 화면에 남은 방으로 계속 쓰는 것 |

넷 중 마지막이 가장 놓치기 쉽다. 앞의 셋만 막으면 차단당한 쪽은 **차단한 사람에게 보이지 않는
말을 계속 쌓을 수 있고**, 차단을 풀면 그동안의 말이 한꺼번에 나타난다.

```sql
create policy messages_insert on messages for insert with check (
  auth.uid() = sender_id
  and exists (select 1 from chat_rooms r
               where r.id = messages.room_id and auth.uid() in (r.buyer_id, r.seller_id)
                 and not private.is_blocked(auth.uid(),
                       case when r.buyer_id = auth.uid() then r.seller_id else r.buyer_id end))
);
```

`messages_update`(읽음 표시)는 건드리지 않았다. 차단 전에 받은 메시지를 읽음으로 바꾸는 일까지
막으면 안 읽은 수가 영영 줄지 않는다.

방과 메시지 자체는 지우지 않는다. 차단을 풀면 대화가 그대로 돌아온다.

#### 4. 거절 문구는 **어느 쪽이 걸었는지 말하지 않는다**

```sql
if private.is_blocked(auth.uid(), v_seller) then
  raise exception '차단한 사용자와는 대화할 수 없습니다.' using errcode = 'insufficient_privilege';
```

"상대가 회원님을 차단했습니다"라고 적으면 그 한 줄이 차단을 드러낸다. 그래서 내가 걸었든
상대가 걸었든 같은 문구다. 화면 쪽도 같다 — `BlockToggleButton`이 보여주는 "차단하기 / 차단
해제"는 언제나 **내가 이 사람을 차단했는가**만 말한다.

#### 5. 신고는 `returns void`다 — `reports`에 select 정책이 없어서

이것이 함수 모양을 두 군데 정했다(자세한 사정은 `troble.md` 1번).

- `insert ... returning`을 쓸 수 없다 → `returns bigint`가 아니라 `returns void`
- 중복을 `exists (select 1 from reports ...)`로 미리 볼 수 없다 → unique 인덱스가 막고,
  함수는 그 `23505`를 받아 한국어로 바꾼다. **막는 것은 인덱스, 말해 주는 것은 함수.**

돌려줄 id도 신고자가 두 번 다시 쓸 수 없는 값이라 아쉬울 것이 없다.

#### 6. 사유 목록은 대상별로 나누되, 서버는 나누지 않는다

DB의 `reports_reason_allowed`는 여섯 코드(`fraud`·`prohibited`·`spam`·`abuse`·
`inappropriate`·`other`)만 본다. 게시물용 사유를 사용자 신고에 넣어도 위험한 일은 일어나지
않는다 — 신고는 사람이 읽는다. 여기서 막는 것은 "분류할 수 없는 값"이다.

대상별 목록과 문구는 화면(`reportReason.ts`)이 쥔다. 같은 코드라도 문구가 다르다 —
신고하는 사람이 보는 것은 코드가 아니라 문장이고, "광고 글이에요"와 "광고를 보내요"는 다른 일이다.

"기타"는 언제나 맨 아래고, 유일하게 상세를 요구한다. 위에 있으면 읽지 않고 고르게 되고,
다른 사유는 문장 자체가 이미 무슨 일인지 말하지만 기타는 그 문장이 없다.

#### 7. 신고 완료 화면이 차단을 권한다 — 그런데 의존 방향은 한쪽뿐

신고는 어떤 화면도 바꾸지 않는다(무효화할 캐시조차 없다). 신고를 누른 사람이 원한 것은 대개
"이 사람을 그만 보고 싶다"인데, 그 일을 하는 것은 차단이다. 그래서 접수 안내에 차단 버튼을 둔다.

두 기능이 서로를 가져다 쓰면 어느 쪽도 혼자 시험할 수 없다. `ReportSheet`는 완료 뒤 자리를
`completionAction` 슬롯으로 열어 두기만 하고, 거기에 `BlockToggleButton`을 꽂는 것은
`SafetyMenu`(block 쪽)다. **report는 block을 모른다.**

#### 8. ⋯ 메뉴는 세 화면이 하나를 나눠 쓴다

게시물 상세·프로필·채팅방 셋 다 "이 사람이 이상하다"를 느끼는 자리다. 찾는 곳이 화면마다
다르면 못 찾는다. 게시물 상세에서는 `PostOwnerMenu`(내 글)와 같은 자리에 오는데,
둘이 함께 뜨는 일은 없다 — 내 글이면 관리, 남의 글이면 안전이다.

차단은 한 번 더 묻는다. 되돌릴 수는 있지만 그 사이 채팅방이 사라지고 상대의 말이 도착하지
않는다 — 실수로 눌러 대화가 끊기는 편이 한 번 더 누르는 번거로움보다 나쁘다(게시물 삭제와 같은
판단). 해제는 묻지 않는다. 되돌리는 쪽은 잃는 것이 없다.

### 파일 구성

```
supabase/migrations/
└─ 0014_block_and_report.sql   private.blocked_user_ids · private.is_blocked
                               search_posts · fetch_chat_rooms · open_chat_room 재정의
                               messages_insert 정책 · reports 제약 · create_report
                               · fetch_blocked_users

block/                         (여태 .gitkeep만 있던 폴더)
├─ api/blockApi.ts             blockUser · unblockUser · fetchIsBlocked · fetchBlockedUsers
├─ hooks/useBlockQueries.ts    useBlockedUsersQuery · useBlockStatusQuery
├─ hooks/useBlockMutations.ts  차단 한 번이 흔드는 목록을 한곳에서 무효화
├─ utils/blockErrorMessage.ts
└─ components/                 safetyMenu(신고+차단 ⋯ 메뉴) · blockToggleButton
                               · blockedUsersPage · blockedUserListItem

report/                        (여태 .gitkeep만 있던 폴더)
├─ api/reportApi.ts            createReport
├─ hooks/useCreateReportMutation.ts
├─ utils/reportReason.ts       대상별 사유 목록·문구
├─ utils/validateReportInput.ts
├─ utils/reportErrorMessage.ts
└─ components/reportSheet.tsx

app/router.tsx                 /my/blocks 추가
profile/components/myPageMenu  차단 목록 항목 추가
post/components/postDetailPage · profile/components/userProfilePage
chat/components/chatRoomPage   SafetyMenu 자리 셋
chat/utils/chatErrorMessage    차단 거절 문구 둘 추가
```

### 검증

`npx jest` 73 스위트 · 519건 통과(신규 5 스위트 35건). `tsc --noEmit`·`eslint` 무경고,
`vite build` 성공.

실제 DB에서 `set local role authenticated` + `request.jwt.claims`로 사용자를 흉내 내 확인했다
(전부 트랜잭션 안에서 돌리고 되돌렸다 — `blocks`·`reports` 모두 0행으로 복귀).

- 내가 판매자를 차단 → `search_posts` **20건 → 0건**
- **상대가 나를 차단**(postgres 권한으로 넣음) → 내게 보이는 `blocks` 행 **0**,
  `private.blocked_user_ids()`는 그 사람 **1명**, `search_posts` **0건**
  (정책은 그대로인데 목록만 걸러진다는 뜻이다)
- 채팅: 방 목록 **1건 → 0건**, `fetch_chat_room(방번호)` **0건**,
  `open_chat_room` → `차단한 사용자와는 대화할 수 없습니다.`,
  메시지 insert → `42501 new row violates row-level security policy for table "messages"`
- 신고: 접수 성공 / 같은 대상 재신고 → `이미 신고한 대상입니다.` /
  자기 자신 → `자기 자신은 신고할 수 없습니다.` / 없는 사유 `nope` → `알 수 없는 신고 사유입니다` /
  없는 게시물 → `게시물을 찾을 수 없습니다.`
- `private` 스키마가 REST로 새지 않는지 anon 키로 직접 호출해 확인:
  `POST /rest/v1/rpc/is_blocked` → **404**,
  `Accept-Profile: private` → `PGRST106 Only the following schemas are exposed: public, graphql_public`

### 이번 범위 밖

- **차단한 사람의 프로필 가리기** — `/users/:userId`는 차단해도 그대로 열린다. 왜 차단했는지
  확인하고 해제를 판단하는 자리라 막을 이유가 없다고 봤다
- **찜·최근 본 글에서 걸러내기** — 내가 남긴 흔적이라 상대를 차단해도 그대로 둔다(당근도 같다)
- **신고 처리 화면** — `reports`는 select 정책이 없어 설계상 관리자 전용이다. 관리자 도구는
  이 앱 밖의 일이다
- **차단 사유 남기기** — `blocks`에 사유 칸이 없다. 차단은 신고와 달리 남에게 설명할 일이 아니다
- **자동 차단 · 신고 누적 제재** — 신고가 쌓이면 자동으로 가리는 규칙. 기준을 사람이 정해야 한다
