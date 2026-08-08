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

---

## 알림 (2026-08-05)

`todo.md` 7단계. 여기는 **만들 것이 없는 단계에 가까웠다** — `notifications` 테이블도 정책도
0001부터 있었고, 트리거 둘이 **이미 행을 쌓고 있었다.**

```sql
-- 0008 on_message_insert : 채팅·가격제안이 들어올 때마다
insert into notifications (user_id, type, payload)
values (v_recipient, ...,  jsonb_build_object('room_id', new.room_id, 'message_id', new.id));

-- 0001 recalc_manner_temp : 후기가 들어올 때마다
insert into notifications (user_id, type, payload)
values (new.reviewee_id, 'review', jsonb_build_object('post_id', ..., 'review_id', new.id));
```

없던 것은 **읽는 쪽**이다. 알림이 쌓이기만 하고 아무도 보지 않는 상태였다.

### 무엇을 만들었나

1. **`/notifications`** — 알림 목록. 무한 스크롤, 안 읽은 줄 표시, "모두 읽음".
2. **홈 헤더의 종 + 안 읽은 배지** — 마이페이지 메뉴에도 링크를 뒀다(배지는 없이).
3. **`fetch_notifications`** — `payload jsonb`의 id를 서버가 풀어 상대·게시물·미리보기까지 준다.
4. **Realtime 구독** — `notifications`가 publication에 아예 없었다.
5. **`notificationText.ts`** — payload를 사람의 말과 이동 경로로 바꾸는 순수 함수.
6. **차단하면 그 사람에게서 온 알림도 지운다** — 6단계가 남긴 구멍이다.

마이그레이션은 `0015_notification.sql`. `todo.md`는 "댓글·찜 알림을 넣을 때만 필요"라고
적어 뒀지만, 실제로는 그것 말고도 손댈 곳이 넷이었다(아래 1·2·4번).

### 설계 결정

#### 1. Realtime publication에 `notifications`가 없었다

`todo.md`는 "Realtime 구독은 `useChatRealtime.ts` 패턴을 그대로 따른다"고만 적어 뒀다.
그런데 0008이 publication에 넣은 것은 `messages`와 `chat_rooms` 둘뿐이다.

```sql
alter publication supabase_realtime add table notifications;
```

이 한 줄이 없으면 **구독은 조용히 성공하고 이벤트만 영원히 오지 않는다.** 실패로 보이지 않아
더 찾기 어려운 종류의 누락이다. `replica identity full`은 걸지 않았다 — 그것이 필요한 것은
update의 이전 행을 볼 때인데(메시지 읽음 표시가 그랬다) 알림은 insert만 구독한다.

#### 2. `payload jsonb`는 누가 푸는가 — 서버

payload에 들어 있는 것은 id뿐이다(`{"room_id": 9, "message_id": 23}`). 화면이 쓸 문구
("가지팔이님이 메시지를 보냈어요")를 만들려면 보낸 사람의 닉네임과 메시지 내용이 필요하다.

이대로 내려보내면 알림 한 줄마다 메시지·방·프로필을 따로 조회하게 된다. 스무 줄이면 수십 번이다.
그래서 `fetch_notifications`가 한 번에 푼다 — 0009의 마이페이지 목록, 0013의 `fetch_user_reviews`가
제목·닉네임을 함께 내려준 것과 같은 판단이다.

푸는 방법은 `left join` 넷이다. 타입별 `case`로 갈래를 나누지 않았다 — payload에 그 키가 없으면
`->>`가 null을 주고 join이 그냥 비어 남는다.

```sql
left join messages   m     on m.id  = (n.payload ->> 'message_id')::bigint
left join chat_rooms cr    on cr.id = m.room_id
left join reviews    rv    on rv.id = (n.payload ->> 'review_id')::bigint
left join posts      p     on p.id  = coalesce(cr.post_id, rv.post_id,
                                               (n.payload ->> 'post_id')::bigint)
left join profiles   actor on actor.id = coalesce(m.sender_id, rv.reviewer_id)
```

`security invoker`(기본)로 뒀다. join하는 `messages`·`chat_rooms`에 각자의 select 정책이
그대로 걸리는데, 알림을 받은 사람은 그 방의 참여자라 통과한다. 우회할 이유가 없으면 우회하지 않는다.

#### 3. 문구와 경로는 화면이 아니라 순수 함수가 만든다

서버가 값을 풀어 줘도 "그래서 뭐라고 쓸 것인가"는 남는다. 이 분기를 컴포넌트 안에 두면
어떤 알림이 어디로 가는지 확인하려고 화면을 그려야 한다.

```ts
export function toNotificationView(notification: AppNotification, viewerId: string): NotificationView
```

`viewerId`를 받는 이유는 후기 하나 때문이다 — **받은 후기는 내 프로필에 붙는다.** 후기 한 건만
여는 화면이 없어서 알림 행만 봐서는 갈 곳을 알 수 없다.

갈 곳이 없으면(`to === null`) 그 줄은 링크가 아니라 그냥 줄로 그린다. 눌러도 아무 일이 없는
링크를 남겨 두면 "눌렀는데 왜 안 가지"가 된다.

`comment`·`like`도 함께 다뤘다. **이 값을 넣는 트리거는 아직 없다**(댓글·찜 기능 자체가 없다).
그래도 enum에 있는 값이라, 나중에 트리거만 더하면 화면은 그대로 굴러간다.

#### 4. `notifications_update`가 무엇이든 바꿀 수 있었다

0001의 정책은 `auth.uid() = user_id` 하나뿐이다. 내 알림이면 **payload까지 바꿀 수 있다는 뜻**이라
알림이 가리키는 대상을 사후에 바꿔치기할 수 있었다.

`messages`에 `guard_message_update`(0008)를 둔 것과 같은 이유로 컬럼을 잠갔다. 화면이 보내는
update는 `is_read` 하나뿐이라 잃는 것이 없다. 덕분에 읽음 처리에 RPC가 필요 없다 —
채팅의 `markRoomRead`와 같이 평범한 update로 충분하다.

#### 5. 배지는 왜 목록을 나눠 쓰지 않는가

채팅 배지(`useUnreadChatCount`)는 채팅 목록 쿼리를 그대로 합쳐서 낸다. 알림은 그럴 수 없다 —
목록이 무한 스크롤이라 첫 페이지만 받은 상태에서는 **20까지밖에 못 센다.** 방 목록은 페이징 없이
통째로 오기 때문에 가능했던 일이다.

그래서 `count_unread_notifications()` RPC를 따로 뒀고, 부분 인덱스(`where is_read = false`)를
그 동선에 깔았다.

배지를 **한 곳에만** 두는 것은 채팅과 같다. 홈 헤더의 종 하나뿐이고 마이페이지 메뉴에는 숫자가
없다 — 같은 숫자를 두 곳에 그리면 한쪽만 늦게 갱신될 때 어느 쪽이 맞는지 알 수 없다.

탭바에 여섯 번째 자리를 만들지 않은 이유는 따로 있다. 알림은 "하러 가는 곳"이 아니라
"왔을 때 가는 곳"이라 다섯 칸을 여섯으로 좁힐 만큼 늘 필요하지 않다.

#### 6. Realtime은 캐시에 꽂지 않고 다시 읽게 한다

`useChatRoomRealtime`은 payload를 캐시에 직접 얹는다. 알림은 그럴 수 없다 — Realtime이 주는 것은
`notifications` 행 그대로(id가 든 payload)인데 목록이 쓰는 모양은 서버가 join해서 푼 것이라
둘이 다르다. 앞에서 풀어 준 값을 화면에서 다시 만들 방법이 없다.

그래서 "무언가 왔다"만 신호로 쓰고 무효화한다 — `useChatRoomsRealtime`이 방 목록에 한 것과 같다.

구독은 홈 헤더의 종에서 건다. 홈은 앱을 켜면 처음 닿는 화면이라, 알림 화면을 열지 않아도
새 알림이 오면 숫자가 곧바로 바뀐다.

#### 7. 읽음 표시는 보내기 전에 캐시부터 고친다

알림을 누르면 곧바로 다른 화면으로 넘어간다. 응답을 기다렸다 고치면 **그 결과를 받을 화면이 이미
없다.** 그래서 `onMutate`에서 캐시를 먼저 고치고, 실패해도 되돌리지 않는다 — 잃는 것이 굵은 글씨
하나뿐이고 다음 조회가 서버 값으로 덮는다.

"모두 읽음"은 반대다. 화면에 머무른 채 누르는 버튼이라 `onSuccess`에서 고친다. 실패하면 굵은
글씨가 그대로 남아 다시 누를 수 있다.

### 파일 구성

```
supabase/migrations/
└─ 0015_notification.sql       publication에 notifications 추가
                               guard_notification_update
                               fetch_notifications · count_unread_notifications
                               notifications_unread_idx
                               purge_blocked_notifications (blocks after insert)

notification/                  (여태 .gitkeep만 있던 폴더)
├─ api/notificationApi.ts      fetchNotifications · fetchUnreadNotificationCount
│                              markNotificationRead · markAllNotificationsRead
│                              subscribeToMyNotifications
├─ hooks/useNotificationQueries.ts    목록(무한) · 안 읽은 수
├─ hooks/useNotificationRealtime.ts   insert만 구독하고 무효화
├─ hooks/useNotificationMutations.ts  읽음 하나 · 모두 읽음
├─ utils/notificationText.ts   payload → 문구·경로 (순수 함수)
├─ utils/notificationCache.ts  읽음 표시를 캐시에 반영하는 순수 함수들
├─ utils/notificationCursor.ts
└─ components/                 notificationPage · notificationList
                               · notificationListItem · notificationBellLink

app/router.tsx                 /notifications 추가 (탭바 안)
browse/components/homePage     MemberGreeting 오른쪽에 종
profile/components/myPageMenu  알림 항목 추가(배지 없음)
block/hooks/useBlockMutations  ['notifications'] 무효화 추가
```

### 검증

`npx jest` 77 스위트 · 542건 통과(신규 4 스위트 23건). `tsc --noEmit`·`eslint` 무경고,
`vite build` 성공.

실제 DB에서 `set local role authenticated` + `request.jwt.claims`로 사용자를 흉내 내 확인했다.

- `fetch_notifications()` → 쌓여 있던 채팅 알림 1건이 **닉네임·게시물 제목·미리보기까지 채워져** 나온다
  (`actor_nickname`, `post_title: '아이패드'`, `preview: 'dwedwd'`)
- `count_unread_notifications()` → `1`
- payload를 바꾸는 update → `23514 알림은 읽음 표시만 바꿀 수 있습니다.`
- `update ... set is_read = true where is_read = false`("모두 읽음") → 성공, 안 읽은 수 `1 → 0`
  (`user_id`로 좁히지 않아도 RLS가 내 행만 건드린다)
- `purge_blocked_notifications`의 delete 조건을 select로 돌려 → 두 사람 사이의 알림 1건이 잡힌다
- `pg_publication_tables` → `chat_rooms`, `messages`, `notifications`

### 이번 범위 밖

- **댓글·찜 알림** — enum에는 있지만 넣는 트리거가 없다. 댓글 기능 자체가 없어서다.
  `notificationText`는 두 타입을 이미 다루므로 트리거만 더하면 화면은 그대로 굴러간다
- **알림 지우기 · 알림 설정** — 목록에서 개별 삭제, 종류별 on/off. 당근에는 있다.
  `notifications`에 delete 정책을 열어야 하고 설정은 `profiles`에 칸이 필요하다
- **푸시 알림** — 앱이 꺼져 있을 때 오는 알림. 웹 푸시는 서비스 워커·VAPID 키·구독 저장이 필요해
  이 단계와 무게가 다르다
- **차단 해제 시 알림 되살리기** — 지운 것이라 돌아오지 않는다. 알림은 "그때 알려 주는 것"이라
  되돌릴 값이 아니라고 봤다(방과 대화는 0014대로 그대로 돌아온다)

## 계정 — 비밀번호 변경 · 회원탈퇴 (2026-08-05)

`todo.md` 8-1. 앞 일곱 단계와 달리 **DB에 미리 깔려 있던 것이 없는 단계다.** `auth.users`는
우리 스키마가 아니라 GoTrue의 것이라 마이그레이션으로 손댈 자리가 없고, 그래서 이 단계에는
마이그레이션이 하나도 없다. 대신 이 프로젝트의 **첫 Edge Function**이 생겼다.

### 무엇을 만들었나

1. **`/settings/account`** — 계정 설정 화면. 마이페이지 메뉴 맨 아래에서 들어간다.
2. **비밀번호 변경** — 현재 비밀번호로 본인을 확인한 뒤 바꾼다. 구글로만 가입한 사람에게는
   폼 대신 "로그인에 쓰는 서비스에서 바꿔 주세요"가 보인다.
3. **회원탈퇴** — `supabase/functions/delete-account`. 확인 문구(`탈퇴합니다`)를 적어야 열린다.
4. **스토리지 뒷정리** — 행은 FK가 지우지만 버킷의 파일은 아무도 지워 주지 않는다.

### 설계 결정

#### 1. 비밀번호 변경에 현재 비밀번호를 왜 묻는가

`supabase.auth.updateUser({ password })`는 **지금 세션만 있으면 통과한다.** 현재 비밀번호를
묻지 않는다. 남이 열어 둔 브라우저를 잡으면 비밀번호를 바꿔 계정을 통째로 가져갈 수 있다는 뜻이다.

그래서 바꾸기 전에 한 번 더 로그인한다.

```ts
// accountApi.changePassword
const { error: signInError } = await supabase.auth.signInWithPassword({
  email: input.email, password: input.currentPassword,
});
if (signInError !== null) throw signInError;

const { error } = await supabase.auth.updateUser({ password: input.newPassword });
```

Supabase에도 같은 일을 하는 "Secure password change" 설정이 있지만 대시보드 스위치라
**코드만 보고는 켜져 있는지 알 수 없다.** 여기서 확실히 한다(개발 편의로 Confirm email을 꺼 둔
것과 같은 종류의 위험이다 — 대시보드 상태에 기대면 배포 때 잊는다).

이 확인 로그인이 세션을 새로 발급하지만 사용자는 그대로다. `onAuthStateChange`가 새 세션을 받아
`authStore`를 갱신하므로 화면은 아무 일 없다는 듯 이어진다.

#### 2. "이 계정에 비밀번호가 있는가"는 `identities`로 본다

구글로만 가입한 사람에게 폼을 보여 주면 무엇을 넣어도 통과하지 못하는 막다른 화면이 된다.
판단 근거로 `app_metadata.provider`를 쓰고 싶어지지만 **그 값은 마지막으로 로그인한 방법 하나**다.
이메일로 가입한 사람이 구글로 한 번 들어오면 `'google'`이 되고 비밀번호 변경이 사라져 버린다.

진짜 목록은 `user.identities`뿐이다 — 한 계정에 로그인 방법이 여럿 붙을 수 있고(같은 이메일로
구글을 이어 붙이면 identity가 둘이 된다) 그 전부가 여기 있다. `app_metadata`는 identities가
없는 응답일 때의 차선책으로만 남겼다(`passwordLogin.ts`, 단위 테스트 5건).

#### 3. 탈퇴는 왜 Edge Function인가 — 그리고 누구를 지우는가

`auth.admin.deleteUser`는 `service_role` 키를 요구한다. 그 키는 RLS를 통째로 무시하므로
브라우저에 둘 수 없다. 서버가 필요한 첫 자리다.

지울 사람은 **요청에 실린 토큰이 정한다.** 클라이언트는 아무 인자도 넘기지 않는다.

```ts
// accountApi.deleteAccount — 몸통이 비어 있다
await supabase.functions.invoke('delete-account', { method: 'POST' });
```

몸통으로 id를 받으면 남의 id를 적어 보내는 길이 열린다. 함수 안에서도 클라이언트를 둘 만들어,
**앞의 것(anon 키 + 그 사람의 토큰)은 신원만 판단하고 뒤의 것(service_role)만 지운다.**
하나로 합치면 service_role 권한으로 신원을 확인하는 셈이 된다.

DB는 손대지 않는다. 0001의 FK가 모두 `on delete cascade`라 `auth.users` 한 행이 사라지면
profiles → posts · chat_rooms · messages · reviews · notifications · blocks · reports까지
따라 지워진다. **따라오지 않는 것은 스토리지뿐이고**, 그 뒷정리가 함수가 하는 나머지 일이다.

#### 4. 순서 — 계정 먼저, 파일 나중

```ts
const roomIds = await fetchRoomIds(admin, userId);   // 행이 살아 있는 동안에만 알 수 있다
const { error } = await admin.auth.admin.deleteUser(userId);
if (error !== null) return jsonResponse({ error: error.message }, 500);
await removeUserFiles(admin, userId, roomIds);       // 실패해도 던지지 않는다
```

파일을 먼저 지우면 삭제가 실패했을 때 **사진만 사라진 계정**이 남는다. 계정을 먼저 지우면
실패해도 남는 것은 아무도 안 보는 파일뿐이다. 뒷정리 실패를 무시하는 것은
`profileApi.removeAvatarObject`·`postApi.removeUploadedImages`와 같은 판단이다.

방 번호를 먼저 읽어 두는 이유는 5번에 있다.

#### 5. 채팅 사진만 경로가 다르다

| 버킷 | 경로 | 훑는 법 |
| --- | --- | --- |
| `avatars` | `{user_id}/{stamp}.ext` | 접두사 하나 |
| `post-images` | `{user_id}/{stamp}-{i}.ext` | 접두사 하나 |
| `chat-images` | **`{room_id}/{user_id}/…`** | 방 번호를 먼저 알아야 한다 |

0008이 채팅 사진의 첫 칸을 방으로 둔 것은 storage 정책이 "이 방 사람인가"를 봐야 했기 때문이다.
그 덕에 사용자 접두사로는 훑을 수 없다. 버킷 전체를 훑는 것은 방 수에 비례하는 일이라,
**삭제 전에 `chat_rooms`에서 내 방 번호를 읽어 두고** `{room_id}/{user_id}` 폴더만 지운다.
방을 통째로 비우지 않는 이유는 같은 방에 상대가 올린 사진이 함께 들어 있어서다.

#### 6. 탈퇴는 한 번 더 묻는 것으로 모자란다

차단(`blockToggleButton`)·게시물 삭제(`postOwnerMenu`)도 확인 단계를 두지만 그쪽은
되돌릴 수 있거나 잃는 것이 하나다. 탈퇴는 돌아올 곳이 없다. 그래서 **문구를 직접 적어야**
버튼이 열리고, 무엇이 사라지는지를 그 자리에서 함께 보여 준다.

확인 화면의 목적은 겁을 주는 것이 아니라 지금 무엇을 지우는지 알고 누르게 하는 것이다.

성공하면 완료 화면이 없다 — 세션이 비는 순간 `RequireMember`가 로그인 화면으로 보내고
이 컴포넌트는 사라진다. 그때 `signOut()`이 아니라 `signOut({ scope: 'local' })`을 쓴다
(`troble.md` 같은 절 3번).

### 파일 구성

```
supabase/functions/delete-account/index.ts   신원 확인(anon) → deleteUser(service_role)
                                             → 스토리지 세 버킷 뒷정리

account/                                     (새 폴더 — .gitkeep도 없던 자리)
├─ api/accountApi.ts          changePassword(재로그인 후 변경) · deleteAccount(함수 호출)
├─ hooks/useAccountMutations.ts
├─ utils/passwordLogin.ts     identities로 "비밀번호가 있는 계정인가" 판단 (순수 함수)
├─ utils/validatePasswordChange.ts
├─ utils/accountErrorMessage.ts
└─ components/                accountSettingsPage · passwordChangeForm · deleteAccountSection

auth/api/authApi.ts           signOutLocally 추가 (탈퇴 직후용)
app/router.tsx                /settings/account 추가 (탭바 밖)
profile/components/myPageMenu 계정 설정 항목 추가
```

### 검증

`npx jest` 81 스위트 · 563건 통과(신규 4 스위트 21건). `tsc --noEmit`·`eslint` 무경고,
`vite build` 성공.

Edge Function은 `delete-account` v1로 배포했다(`verify_jwt: true`, status ACTIVE).
엔드포인트를 직접 두드려 확인한 것은 둘이다.

```
OPTIONS /functions/v1/delete-account   → 204, 우리 CORS 헤더 그대로
POST    /functions/v1/delete-account   → 401 {"code":"UNAUTHORIZED_NO_AUTH_HEADER"}
        (토큰 없이)
```

첫 줄이 중요하다. `verify_jwt`를 켜 두면 **preflight(OPTIONS)까지 401로 막혀 브라우저에서
아예 부를 수 없게 되는 것 아닌가**가 이 함수의 유일한 배포 위험이었는데, 게이트웨이가 OPTIONS는
검사 없이 통과시켰다. 그래서 `verify_jwt`를 끄지 않아도 된다 — 함수 안의 신원 확인 위에
게이트웨이 검사가 한 겹 더 남는다.

**실제 계정 삭제까지는 확인하지 못했다.** 확인하려면 진짜로 지워도 되는 계정과 그 사람의
토큰이 필요하다. 앱에서 시험 계정으로 한 번 밟아 보는 것이 남은 검증이다 —
탈퇴 후 로그인 화면으로 밀려나는지, 그 이메일로 다시 가입되는지, 버킷에 파일이 남지 않았는지.

```bash
# 재배포가 필요하면
supabase functions deploy delete-account
```

### 이번 범위 밖

- **비밀번호 재설정(잊었을 때)** — 로그인 화면의 "비밀번호를 잊으셨나요"다.
  `resetPasswordForEmail` + 메일로 오는 recovery 링크가 필요한데, 지금은 개발 편의로
  Confirm email이 꺼져 있어 메일 경로 자체를 시험할 수 없다. 커스텀 SMTP를 붙이는 때
  함께 한다.
- **소셜 계정 연결·해제** — 이메일 계정에 구글을 이어 붙이거나 떼는 것(`linkIdentity`).
  `hasPasswordLogin`이 이미 identity가 여럿인 경우를 다루므로 화면만 얹으면 된다.
- **탈퇴 사유 수집 · 재가입 제한** — 당근에는 있다. 사유를 남기려면 사용자가 사라진 뒤에도
  남는 테이블이 필요하고(지금은 전부 cascade), 재가입 제한은 지운 이메일을 어딘가 들고 있어야 해서
  "지웠다"는 말과 어긋난다.

---

## 후기가 사라질 때의 매너온도 (2026-08-05)

`backlog.md`에서 꺼낸 첫 항목. 새 기능이 아니라 **바로 앞 단계(회원탈퇴)가 열어 둔 구멍**을
닫는 일이다. 마이그레이션 하나(`0016_review_delete.sql`)뿐이고 TS는 한 줄도 바뀌지 않았다.

### 무엇이 문제였나

0001의 `recalc_manner_temp`는 `reviews_after_insert` **하나뿐**이다. 후기가 들어오면 온도를
더하는데, 나가는 길은 아무도 보고 있지 않다.

0013이 "후기는 수정·삭제 정책을 두지 않는다"고 못 박았으니 사용자가 직접 지우는 길은 없다.
그런데 cascade로 사라지는 길이 셋이다.

| 길 | FK | 언제부터 |
| --- | --- | --- |
| ① 게시물 삭제 | `reviews.post_id → posts` | **2단계**(게시물 삭제, 08-04) |
| ② 후기 쓴 사람 탈퇴 | `reviews.reviewer_id → profiles` | **8단계**(회원탈퇴, 08-05) |
| ③ 후기 받은 사람 탈퇴 | `reviews.reviewee_id → profiles` | 8단계 |

③은 온도를 들고 있던 프로필이 함께 사라지므로 어긋날 것이 없다. 남는 것은 ①②다 —
후기 목록에서는 사라졌는데 그 점수는 상대의 온도에 그대로 녹아 있다.

찾을 때는 탈퇴(②)만 보고 있었는데, `posts_delete`에 상태 제한이 없고 `deletePost`도 무조건
지운다는 것을 확인하면서 **①이 하루 먼저 열려 있었다**는 것이 드러났다. 거래완료된 글을
지우는 것은 판매자가 흔히 하는 일이라 드문 경로도 아니다.

밖에서는 확인할 수 없는 어긋남이라 더 나쁘다. 후기 목록은 근거를 보여주지만 온도는 숫자
하나뿐이라, 한 번 어긋나면 무엇이 맞는지 아무도 되짚을 수 없다.

### 설계 결정

#### 1. 빼지 않고 다시 계산한다

지우는 쪽을 `manner_temp - old.score`로 짜면 0001의 더하기와 짝이 맞아 보인다. 맞지 않는다 —
양쪽 다 `greatest(0, least(99, …))`로 가두기 때문에 **한 번이라도 끝에 닿으면 되돌아오지
않는다**(`troble.md` 같은 절 1번).

그래서 증감을 누적하지 않고 매번 `36.5 + 후기 합계`로 되짚는 `sync_manner_temp(uuid)`를 두고,
넣을 때(`recalc_manner_temp`)와 뺄 때(`revert_manner_temp`) 둘 다 그것을 부른다.
어떤 경로로 몇 건이 사라지든 결과가 같고, **이미 어긋나 있던 값도 다음 후기 한 건에 스스로
맞춰진다.** 0001의 트리거(`reviews_after_insert`)는 건드리지 않았다.

#### 2. 알림은 넣지도 지우지도 않는다

넣지 않는 것은 사라진 후기를 두고 알릴 말이 없어서고(`notification_type`에 그런 값도 없다),
이미 보낸 후기 알림을 지우지 않는 것은 0015가 이미 견디게 돼 있어서다 —
`fetch_notifications`가 `reviews`를 left join이라 후기가 없으면 미리보기만 비고,
`notificationText`가 그것을 `알 수 없는 이웃`으로 흘려보낸다. 지우는 쪽이 오히려
"그때 알려 준 일"을 없던 것으로 만든다(0014의 차단 알림 정리와는 목적이 다르다).

#### 3. 백필은 profiles 전체를 돈다

①이 2단계부터 열려 있었으니 이 파일 이전의 어긋남이 남아 있을 수 있다. `reviews`에 남아 있는
사람만 훑고 싶어지지만 그러면 **가장 어긋난 사람을 놓친다** — 받은 후기가 전부 사라진 사람은
`reviews`에 흔적이 없는데 온도는 옛 값 그대로다. 되돌리는 값이 아니라 다시 계산하는 값이라
여러 번 돌려도 결과가 같다.

### 검증

TS가 바뀌지 않아 새 Jest 테스트는 없다. 대신 **실제 DB에서 세 경로를 다 밟았다.**
만들고 지운 뒤 마지막에 일부러 예외를 던져 통째로 롤백하는 `do` 블록이라 데이터가 남지 않는다.

```
시작        : 36.5
후기 3건    : 37.0   (+0.5 +0.5 −0.5)
ⓐ 후기 삭제 : 37.5   ← −0.5가 빠지므로 온도는 올라간다
ⓑ 게시물삭제 : 37.0   ← post_id cascade
ⓒ 작성자탈퇴 : 36.5   ← reviewer_id cascade
남은 후기   : 0
```

롤백 뒤 프로필 3행·후기 0건·온도 전부 36.5로 그대로였다.
`npx jest` 81 스위트 563건 통과(변화 없음), `tsc --noEmit` 무경고.

### 이번 범위 밖

- **후기 수정** — 0013이 정책을 두지 않은 이유가 "고치면 온도는 그대로고 문구만 바뀐다"였는데,
  이제 다시 계산하는 함수가 생겨 그 이유가 사라졌다. `reviews_after_update`를 붙이면 되지만
  후기를 고칠 수 있게 할지는 별개 판단이라 함께 하지 않았다.
- **매너온도 이력** — 언제 무엇 때문에 올랐는지. 지금은 현재값 하나뿐이라 어긋남이 생겨도
  사후에 되짚을 수 없다(이번에 백필로 밀어 버릴 수 있었던 것도 그래서다).

---

## 게시물 댓글 (2026-08-05)

`backlog.md` §2-1. `feature.md` §2.1의 "게시물에 댓글, 찜 가능" 중 찜만 되어 있었다.
`src/features/comment/`는 `.gitkeep` 하나뿐인 빈 폴더였다.

### 무엇을 만들었나

게시물 상세 맨 아래에 **1단 댓글**. 읽기·쓰기·삭제까지고 대댓글은 넣지 않았다.
`comments.parent_id`는 그대로 두되 아무도 채우지 않는다 — 목록을 트리로 접었다 펴는 일이
따로 붙는데, 그것은 "댓글이 도는가"와 다른 문제라 나눴다.

### 설계 결정

#### 1. 0001이 만들어 둔 것과 비어 있던 것

테이블·인덱스·RLS 네 개가 0001에 이미 있어 화면만 얹으면 되는 것처럼 보였다. 실제로는
정책이 한 번도 다시 읽히지 않은 채였고 두 군데가 비어 있었다.

- `content`가 자유 text — 공백만 있는 댓글도, 10만 자짜리도 들어간다
- `comments_select`가 `using (true)` — **6단계에서 만든 차단이 여기만 비껴간다**

0013(reviews)·0014(reports)에서 되풀이된 것과 같은 자리다. 0001은 "테이블을 만드는" 파일이라
값의 모양까지는 보지 않았고, 그 칸을 쓰는 화면이 생기는 지금이 처음 읽는 때다.

#### 2. 차단을 RPC가 아니라 **정책**에 뒀다

0014는 목록 넷(`search_posts`·`fetch_chat_rooms`·`open_chat_room`·`messages_insert`)에서
걸렀는데, 그건 그 목록들이 이미 RPC였기 때문이다. 댓글은 RPC를 만들지 않았다 — 한 글에
딸린 전부를 시간순으로 읽을 뿐이라 조인이 하나뿐이고, PostgREST 임베드로 충분하다.
그러면 걸러낼 자리가 질의문에 없다.

```sql
create policy comments_select on comments
  for select using (author_id <> all (private.blocked_user_ids()));
```

정책에 두면 어느 경로로 읽든 같은 규칙이 걸리고, 나중에 목록 RPC를 만들더라도 한 번 더
적을 필요가 없다. 행마다 `blocks`를 뒤지지 않을까 걱정했는데 `private.blocked_user_ids()`는
**인자가 없는 stable 함수라 질의당 한 번만 계산된다.** 0014가 배열 하나로 만들어 둔 이유가
이것이었다.

쓰는 쪽도 막았다. 차단하면 그 사람 글은 목록에서 안 보이지만 주소를 직접 치면 상세는 열린다.
그 자리에서 댓글까지 써지면 "차단했는데 계속 말이 오간다"가 된다 — 0014가
`open_chat_room`·`messages_insert`에서 막은 그 길이다.

"지워진 글에 댓글이 들어가지 않나"도 확인했는데 그건 이미 막혀 있었다. `post_id`가 FK다.
`posts_select`도 `using (true)`라 "볼 수 있는 글인가"를 따로 물을 것이 없다.

#### 3. 삭제는 댓글 작성자 + **게시물 판매자**

0001은 작성자만 지울 수 있게 했다. 여기에 판매자를 더했다. 내 글에 달린 광고나 시비를
내가 못 지우면 유일한 길이 신고인데, **신고는 즉시 아무것도 감추지 않는다**(0014).
그 사이 글은 그대로 남는다. 당근도 게시물 주인은 자기 글의 댓글을 지울 수 있다.

수정은 넣지 않았다. `comments_update` 정책은 0001 그대로 두되 화면을 붙이지 않는다 —
고칠 수 있게 하려면 "수정됨" 표시가 따라와야 하고, 그건 게시물도 아직 안 하고 있다.

#### 4. 쓴 댓글은 다시 부르지 않고 이어 붙인다

`invalidateQueries`로 목록을 다시 불러오면 방금 쓴 댓글이 한 박자 늦게 나타난다. 쓴 사람은
자기 글이 바로 보이기를 기대하므로, 서버가 돌려준 행을 캐시 끝에 붙인다
(`chatMessageCache.appendMessage`와 같은 판단 — 가짜 행을 그리지 않고 서버가 만든
id·created_at을 그대로 받는다).

캐시가 아직 없으면 아무것도 하지 않는다. 목록을 한 번도 안 받아 온 상태에서 배열을 새로
만들면 "방금 쓴 댓글 하나만 있는 목록"이 되고, 사용자는 그것이 전부인 줄 알게 된다.

#### 5. 페이징하지 않는다

중고 거래 글의 댓글은 "아직 있나요" 몇 줄이라 나눌 만큼 쌓이지 않고, 나누면 "댓글 3"이라는
개수를 따로 세어 와야 한다. 실제로 길어지는 글이 생기면 그때 커서를 붙인다 —
0017의 인덱스를 `(post_id, created_at)`으로 만들어 뒀으므로 그대로 받는다.

오래된 것이 위다. 댓글은 위에서 아래로 읽는 대화라, 새 것이 맨 위로 오면 답이 물음보다
먼저 보인다(0015의 알림 목록과 반대 방향이다).

### 파일 구성

```
supabase/migrations/0017_comment.sql   내용 제약 · select/insert/delete 정책 · 정렬 인덱스

comment/                               (.gitkeep만 있던 자리)
├─ api/commentApi.ts                   임베드로 읽고, 쓴 행을 작성자까지 붙여 돌려받는다
├─ hooks/useCommentQueries.ts          ['comments', postId]
├─ hooks/useCommentMutations.ts        쓰면 이어 붙이고 지우면 빼낸다
├─ utils/validateCommentInput.ts       공백만 있는 값을 막는다(제약과 같은 기준)
├─ utils/commentErrorMessage.ts
└─ components/                         commentSection · commentList(Item) · commentForm

post/components/postDetailPage.tsx     맨 아래에 CommentSection
```

### 검증

`npx jest` 83 스위트 578건 통과(신규 2 스위트 15건), `tsc --noEmit`·`eslint` 무경고,
`vite build` 성공.

정책은 화면으로는 확인할 수 없어 **실제 DB에서 사용자를 갈아 끼워 가며 밟았다**
(`set local role authenticated` + `request.jwt.claims`의 sub 교체, 마지막에 예외로 롤백).

```
① 차단 전 B가 보는 댓글    : 2    (기대 2)
② 차단 후 B가 보는 댓글    : 1    (기대 1)
③ 차단 후 C가 보는 댓글    : 1    (기대 1)   ← 양방향
④ C가 A의 글에 댓글        : 통과 (기대 통과)
⑤ 판매자 차단 후 댓글 쓰기 : 42501 (기대 막힘)
⑥ 판매자가 B의 댓글 삭제   : 1행  (기대 1)
⑦ 제3자가 남의 댓글 삭제   : 0행  (기대 0)
⑧ 공백만 있는 댓글         : 23514 (기대 막힘)
```

롤백 뒤 댓글 0건·차단 0건·검증용 글 0건으로 그대로였다.

### 이번 범위 밖

- **대댓글** — ✅ 나중에 붙였다(아래 "대댓글" 절). 여기 적은 대로 정책은 그대로 썼고
  마이그레이션도 없었다. 부모가 지워질 때는 함께 사라지는 쪽을 유지하되 미리 알리기로 했다.
- **댓글 알림** — `notification_type`에 `comment`가 있고 `notificationText`도 이미 다루는데
  넣는 트리거가 없다. `on_message_insert`를 본떠 만들면 되지만, 자기 글에 자기가 단 댓글은
  빼야 하고 대댓글이 생기면 "부모 댓글 작성자에게도" 갈지가 함께 정해져야 한다.
- **댓글 수정** — 3번에 적은 이유로 뺐다.
- **게시물 카드의 댓글 수** — 목록에 "댓글 3"을 붙이려면 `posts`에 집계 칸이나
  조인이 필요하다. `like_count`처럼 열을 두고 트리거로 세는 방식이 이 저장소의 결에 맞는다.
- **비밀 댓글** — 당근에는 있다. 판매자와 작성자만 보이는 댓글인데, 정책 한 줄이 아니라
  "누구에게 보이는가"가 하나 더 생기는 일이라 따로 다룬다.

## 댓글 · 찜 알림 (2026-08-05)

`0018_comment_like_notification.sql`. `backlog.md` §3-2.

`notification_type` enum(0001)에 다섯 값이 다 있는데 `comment`·`like`를 **넣는 쪽이 없었다.**
넣고 있던 것은 `on_message_insert`(chat/price_offer)와 `recalc_manner_temp`(review)뿐이다.
읽는 쪽은 0015가, 문장은 `notificationText.ts`가 이미 갖고 있었다. 남은 것이 트리거였다.

댓글은 0017로 생겼고 찜은 0001부터 있었으므로 이제 둘 다 붙는다.

### 1. 트리거만 더하면 끝날 줄 알았다

0015가 "댓글·찜도 함께 풀어 두었다"고 적어 둔 것을 믿고 시작했는데, 풀려 있던 것은
**게시물과 미리보기 자리까지**였고 정작 **누가 했는가**는 풀리지 않았다.

```sql
left join profiles actor on actor.id = coalesce(m.sender_id, rv.reviewer_id)
```

댓글·찜에는 메시지도 후기도 없다. 이대로 트리거만 붙였으면 알림이 전부
"알 수 없는 이웃님이 댓글을 남겼어요"가 됐을 것이다. 화면은 멀쩡히 그려지고 문장도
완성되므로 **버그로 보이지도 않는다** — 프로필이 지워졌을 때 쓰라고 만들어 둔 폴백
(`UNKNOWN_ACTOR`)이 정상 동작인 척 덮어 버린다.

같은 이유로 두 군데가 더 걸렸다. 미리보기 `case`에 댓글 내용이 들어갈 자리가 없었고,
`purge_blocked_notifications`가 `message_id`·`review_id`만 훑어 차단해도 댓글·찜 알림은 남았다.

**"자리를 미리 만들어 뒀다"는 말은 "그 자리가 채워진다"와 다르다.** 0015는 성실하게
앞을 내다봤지만, 내다본 것은 payload에서 id를 꺼내는 부분이었지 그 id로부터 사람을
찾아가는 경로가 아니었다.

### 2. 찜은 가리킬 id가 없다

기존 세 타입은 payload에 사람을 담지 않았다. 담을 필요가 없었다 — 메시지에 `sender_id`가,
후기에 `reviewer_id`가 있어서 id 하나만 넣어 두면 사람까지 따라온다.

찜에는 그 길이 없다. `likes`의 기본키가 `(user_id, post_id)`라 **가리킬 id 자체가 없다.**
`post_id`만 넣으면 "누가 찜했는지"가 사라진다. 댓글은 `comment_id`로 따라갈 수 있지만
댓글이 지워지면 그 길도 끊긴다.

그래서 두 타입은 `actor_id`를 payload에 직접 넣기로 했다.

```
comment : {"post_id": 7, "comment_id": 12, "actor_id": "…"}
like    : {"post_id": 7,                   "actor_id": "…"}
```

덤이 하나 있었다. 차단 청소가 **타입을 묻지 않는 갈래 하나**로 끝난다.

```sql
or (
  (n.payload ->> 'actor_id')::uuid in (new.blocker_id, new.blocked_id)
  and (n.payload ->> 'actor_id')::uuid <> n.user_id
)
```

0015가 message_id·review_id를 각각 join해 "그 사람이 보낸 것인가"를 물어야 했던 것은
사람이 payload에 없었기 때문이다. 앞으로 사람을 담는 타입이 늘어도 이 갈래가 그대로 받는다.

### 3. 찜은 중복을 막고 댓글은 막지 않는다

찜은 눌렀다 뗐다 하는 버튼이다. 막지 않으면 **두 번 누르는 것만으로** 판매자에게 알림을
얼마든지 쌓을 수 있다. 그래서 같은 사람이 같은 글을 다시 찜해도 알림은 한 번뿐이다.

```sql
if exists (
  select 1 from notifications n
   where n.type = 'like'
     and n.payload ->> 'post_id'  = new.post_id::text
     and n.payload ->> 'actor_id' = new.user_id::text
) then
  return new;
end if;
```

기준은 "이미 알렸다"이지 "아직 안 봤다"가 아니다. 읽었더라도 다시 보내지 않는다.

댓글은 반대다. 누를 때마다 **새 내용**이 생기므로 매번 알릴 것이 있다. 같은 사실이
되풀이되는 것과 새 사실이 쌓이는 것의 차이다.

중복 확인 전용 부분 인덱스를 조건과 같은 모양으로 두었다. 없으면 찜 한 번마다
알림 테이블 전체를 훑는다.

### 4. 대댓글 알림을 미리 넣었다

받는 사람이 둘 나올 수 있다 — 게시물 판매자, 그리고 부모 댓글 작성자다.
후자는 지금 일어나지 않는다(0017이 1단까지만 만들었고 `parent_id`를 채우는 화면이 없다).

그래도 넣었다. **대댓글 화면이 붙는 날 트리거를 다시 열지 않아도 되고, 지금도 SQL로
직접 넣어 동작을 확인할 수 있어서** 검증되지 않은 채 잠들어 있는 코드가 아니다.
실제로 아래 ③④가 그 경로를 밟는다.

겹치는 경우를 셋 거른다. 자기 글에 자기가 단 댓글, 자기 댓글에 자기가 단 답글,
그리고 **판매자가 부모 댓글을 쓴 경우** — 이때 거르지 않으면 한 사람에게 같은 알림이 두 번 간다.

### 5. 찜에는 차단 방어선이 트리거뿐이다

0014는 차단을 넷에 걸었고(글 목록·방 목록·새 대화·메시지 쓰기) 0017이 댓글을 다섯 번째로
더했다. **찜은 어디에도 없다.** 0006의 `likes_insert`는 자기 글만 본다.

차단해도 목록에서 글이 안 보일 뿐 주소를 직접 치면 상세가 열리고 찜이 눌린다.
확인해 보니 실제로 들어간다(아래 ⓒ). 그 자리에서 알림까지 가면
"차단했는데 저쪽 이름이 계속 뜬다"가 된다.

정책을 고쳐 찜 자체를 막을 수도 있었지만 트리거에서 알림만 막았다. 찜은 **상대에게 닿지
않는 행위**다 — 개수는 이미 `like_count`로 합쳐져 있어 누가 눌렀는지 판매자가 볼 길이 없다.
막을 것은 알림이지 찜이 아니다. 댓글·메시지와 다른 점이다.

### 6. 확인

두 번 나눠 밟고 각각 예외로 통째로 롤백했다.

```
① 남의 댓글 → 판매자 알림        : 1건
② 자기 글 자기 댓글 후 전체      : 1건 (안 늘어남)
③ 대댓글 후 A(판매자) / B(부모)  : 2건 / 1건
④ 판매자가 부모인 대댓글 후 A    : 3건 (두 번 아님)
⑤ 찜 → 판매자 알림               : 1건
⑥ 취소 후 재찜                   : 1건 (중복 없음)
⑦ 판매자 본인 찜                 : 안 늘어남
⑧ fetch_notifications (A로 실행) : actor=이웃B / post=검증용 자전거 / preview=아직 있나요?
⑨ 차단 후 B발 알림 / C발 알림    : 0건 / 2건, 댓글 자체는 4건 그대로
```

```
ⓐ 차단 상태 댓글 쓰기            : 42501 (0017의 정책)
ⓑ 정책 우회 삽입 후 알림         : 0건 (트리거가 막는다)
ⓒ 차단 상태 찜 쓰기              : 통과 — 찜 행 1건, 알림 0건
```

ⓑ가 필요한 이유는 ⓐ가 정책만 확인하기 때문이다. 트리거는 `security definer`라
시드·관리 작업에서도 도는데 그 경로에는 정책이 걸리지 않는다.

⑧은 `set local role authenticated` + JWT `sub`를 갈아 끼워 A로서 실행했다.
`postgres`는 BYPASSRLS라 그냥 부르면 `auth.uid()`가 null이고 아무것도 안 나온다.

### 7. 화면은 한 줄도 고치지 않았다

`notificationText.ts`가 두 타입의 문장을 이미 들고 있었고, Realtime 구독은
`notifications` 테이블 insert 전체를 보므로 새 타입이 그대로 흘러온다.
고친 것은 "아직 트리거가 없다"고 적혀 있던 주석뿐이다.

미리 만들어 둔 것이 실제로 값을 절약한 경우다. 다만 §1에서 본 대로, **미리 만들어 둔 자리가
빠짐없이 채워지는지는 붙이는 쪽이 다시 확인해야 한다** — 문장은 맞았지만 그 문장에 들어갈
이름을 찾는 경로는 비어 있었다.

### 이번 범위 밖

- **알림 종류별 on/off** — `backlog.md` §5-4. 찜 알림이 생기면서 "이건 끄고 싶다"가
  실제로 나올 만한 상태가 됐다. 지금 켤 수 있는 것은 전부 켜져 있다.
- **찜 취소 시 알림 회수** — 하지 않는다. 알림은 "그때 알려 주는 것"이라
  0015가 차단 해제에 대해 정한 것과 같은 결이다.
- **댓글 알림 묶기** — 한 글에 댓글이 열 개 달리면 알림도 열 줄이다. 당근은 묶어서 보여준다.
  묶으려면 "읽지 않은 같은 글의 알림"을 한 줄로 접어야 하는데, 이는 목록 RPC가 아니라
  **알림 모델 자체**를 건드리는 일이라 따로 다룬다.

## 대댓글 (2026-08-05)

`feature.md` §2.1 "게시물에 댓글" 중 남아 있던 절반. `backlog.md` §2-1·§7-4.

**마이그레이션이 없다.** 서버는 이미 다 서 있었다 — `parent_id`와 `comments_parent_idx`는
0001부터 있고, 0017의 정책 넷은 일부러 `parent_id`를 보지 않게 써 두었으며, 0018의
`notify_post_commented`는 부모 댓글 작성자에게 보내는 갈래를 미리 넣어 두고 SQL로
검증까지 마쳤다(그때의 ③④). 이번에 붙인 것은 화면뿐이다.

### 무엇을 만들었나

1. **`buildCommentTree`** — 평평한 배열을 2단 트리로 접는다. `countReplies`가 함께 산다.
2. **답글 버튼 · 답글 입력칸** — 1단 댓글에만. 한 번에 하나만 열린다.
3. **`CommentForm`의 답글 모드** — `fieldId`·문구·취소 버튼만 다르고 나머지는 같은 폼이다.
4. **삭제 확인에 답글 수** — "답글 2개도 함께 지워집니다."
5. **삭제 캐시가 답글까지 걷어낸다** — 1단만 있을 때는 맞았던 코드가 틀린 코드가 됐다.

### 설계 결정 다섯 가지

#### 1. 2단으로 고정했다 — 알림이 가리키는 사람과 화면이 같아야 한다

답글에는 답글 버튼을 두지 않는다. `parent_id`는 깊이를 묻지 않으므로 3단도 넣을 수 있고,
흔한 방식은 **깊은 답글을 루트로 접어 붙이는 것**이다(당근도 그렇게 보인다).
그 방식을 버린 이유는 0018에 있다.

```sql
if new.parent_id is not null then
  select c.author_id into v_parent from comments c where c.id = new.parent_id;
```

알림은 **부모 댓글 작성자 한 사람**에게 간다. 답글을 루트로 접어 붙이면 `parent_id`는
루트를 가리키므로 알림도 루트 작성자에게 가고, **정작 답을 받은 사람은 모른다.**
화면에서는 B에게 답하는 것처럼 보이는데 알림은 A에게 가는 것이다.

깊이를 열려면 트리거도 함께 고쳐야 한다("가리킨 사람"과 "부모"를 나눠 payload에 담는 식).
2단으로 묶어 두면 둘이 언제나 같은 곳을 가리킨다. 중고 거래 글의 댓글은 "아직 있나요 —
네 있습니다"가 대부분이라 3단이 필요해질 자리가 아니다.

#### 2. 트리는 질의가 아니라 화면에서 접는다

재귀 CTE도, 전용 RPC도 만들지 않았다. 깊이가 2로 정해져 있으면 배열을 두 번 훑는 것이
싸고, 무엇보다 **캐시를 평평한 채로 둘 수 있다.**

```ts
return [...previous, created];   // 답글도 그냥 끝에 붙는다
```

0017이 정한 대로 목록은 `['comments', postId]` 한 줄이고 create는 서버가 돌려준 행을
끝에 잇는다. 트리를 캐시에 담았으면 "이 답글의 부모를 찾아 그 밑 배열에 넣기"가 됐을 텐데,
평평하게 두면 그릴 때 알아서 제자리로 간다. 0017이 페이징을 미뤄 둔 것과도 맞물린다 —
한 글의 댓글을 전부 받아 오므로 트리를 접을 재료가 언제나 다 있다.

부모를 나중에 훑는 이유는 순서에 기대지 않기 위해서다. 지금 질의는 시간순이라 부모가
언제나 먼저 오지만, 정렬이 바뀌는 날 조용히 깨지는 자리다.

#### 3. 부모를 잃은 답글은 버리지 않고 1단으로 올린다

이런 일이 실제로 생긴다. **차단하면 그 사람 댓글만 사라진다**(0017의 `comments_select`).
거기 달린 내 답글은 차단 대상이 아니므로 그대로 온다.

버리면 목록에서 사라진 채로 남아 **지울 수도 없고**, 화면의 "댓글 n"과 실제 줄 수도
어긋난다. 맥락 없는 한 줄이 되기는 하지만, 있는 것을 안 보이게 하는 편보다 낫다.
6단계에서 "차단은 상대를 지우는 것이 아니라 안 보이게 하는 것"으로 정한 결과가
여기까지 이어진다 — 안 보이게 할 것은 상대의 말이지 내 말이 아니다.

#### 4. cascade가 캐시에 뚫어 놓은 구멍

0017의 삭제 캐시는 이랬다.

```ts
return previous.filter(function keepOthers(comment) {
  return comment.id !== commentId;      // 1단만 있을 때는 정확했다
});
```

`parent_id`의 FK가 `on delete cascade`(0001)라 서버는 한 번의 delete로 답글까지 지운다.
그런데 캐시에서는 부모만 빠지므로 답글이 부모를 잃고, **§3의 규칙에 걸려 1단으로 떠오른다.**
지워진 대화가 맥락 없이 살아남는 셈이다. 다시 불러오기 전까지 "댓글 n"도 실제보다 많다.

`comment.parentId !== commentId`를 한 줄 더 봐서 닫았다. **기능을 더한 것이 아니라
전에 쓴 코드가 틀린 코드가 된 것**이라 눈에 띄지 않는 자리였다 — 0017을 쓸 때는
답글이 없어 정확했다. 0001의 정책을 0017에서 다시 읽어야 했던 것과 같은 결이다.

같은 이유로 삭제 확인 문구에 개수를 얹었다. 되돌릴 수 없는데(복구 화면이 없다)
부모 줄만 보고 누르면 답글이 함께 사라진다는 사실을 알 길이 없다.

#### 5. 답글 폼을 따로 만들지 않았다

다른 것은 문구와 취소 버튼뿐이고 검사·비우기·오류 표시는 같다. 나누면 그 셋이 두 벌이 된다.

대신 `fieldId`를 밖에서 받는다. 답글 칸이 열리면 한 화면에 폼이 둘이 되는데 `id`가
`comment-content`로 같으면 **label 클릭이 엉뚱한 칸으로 간다.** `comment-reply-${id}`로 가른다.

비우는 방법이 둘로 갈린 것도 적어 둔다. 1단 폼은 성공 뒤 `key`를 바꿔 다시 세우고
(0017 그대로), 답글 폼은 **성공하면 닫히면서 사라지므로** 그럴 필요가 없다.
열어 둔 채로 두면 방금 쓴 답글 밑에 빈 칸이 남는다.

### 확인

`buildCommentTree.test.ts` 5개 · `commentSection.test.tsx` 4개를 더했다(전체 592개 통과).

```
접기         : 답글이 부모 밑으로 / 답글이 부모보다 먼저 와도
부모 없음    : 버리지 않고 1단으로, 순서는 자기 시각대로
개수         : 딸린 답글만 센다
답글 쓰기    : parentId=1로 보내고, 붙고, 입력칸이 닫히고, 목록을 다시 부르지 않는다
2단 고정     : 답글 줄에는 답글 버튼이 없다
비로그인     : 답글 버튼이 없다
cascade      : "답글 2개도 함께 지워집니다" → 지우면 답글 둘도 함께 사라진다
```

### 이번 범위 밖

- **삭제된 부모를 "삭제된 댓글입니다"로 남기기** — 답글이 살아 있어도 부모와 함께 사라진다.
  남기려면 `deleted_at` 같은 칸과 그것을 아는 정책이 필요해 마이그레이션이 붙는다.
  지금은 함께 지워진다는 사실을 **미리 알리는 쪽**으로 갈음했다.
- **답글 접기/펼치기** — 답글이 여럿이면 부모 밑이 길어진다. 몇 개부터 접을지는
  실제로 쌓여 봐야 정해진다(댓글 페이징을 미룬 것과 같은 이유).
- **답글에 @상대 표시** — 2단 고정이라 누구에게 답하는지가 위치로 드러난다.
  3단을 열지 않는 한 필요 없다.

## 알림 개별 삭제 (2026-08-05)

`0019_notification_delete.sql`. `backlog.md` §4 "알림 개별 삭제 — 마이그레이션 한 줄."
실제로 한 줄이었다. 나머지는 그 한 줄이 무엇을 바꾸고 무엇을 안 바꾸는지였다.

### 무엇을 만들었나

1. **`notifications_delete` 정책** — `using (auth.uid() = user_id)`.
2. **줄마다 × 버튼** — 링크 밖에 둔다.
3. **`withoutNotification`** — 무한 스크롤 캐시에서 한 줄만 빼낸다.
4. **배지 동기화** — 안 읽은 알림을 지우면 숫자도 하나 줄어든다.

### 설계 결정 네 가지

#### 1. 0001이 delete 정책을 안 둔 것은 판단이 아니라 자리가 없어서였다

0001은 `notifications`에 select와 update만 두었다. 그때는 트리거가 **쌓기만 하고 아무도
보지 않는** 상태였고(0015가 읽는 쪽을 만들기 전이다), 읽을 화면이 없으니 지울 화면도 없었다.

0015가 목록을, 0018이 다섯 타입을 다 채우고 나서야 "치우고 싶다"가 생긴다. 특히 찜 알림처럼
볼 일이 끝난 줄이 쌓인다. §5-4의 **알림 종류별 on/off와 이것은 서로를 대신하지 못한다** —
저쪽은 "앞으로 받지 않겠다"이고 이쪽은 "이미 받은 것을 치우겠다"다.

#### 2. update에는 트리거가 필요했지만 delete에는 필요 없다

0015는 `guard_notification_update`를 붙여 `is_read` 말고는 못 바꾸게 했다. 내 알림이면
payload까지 바꿀 수 있어서, 남이 보낸 알림의 **근거를 사후에 바꿔치기**할 수 있었기 때문이다.

삭제에는 그런 어긋남이 없다. 행이 통째로 사라질 뿐 **남는 행이 거짓말을 하게 되지 않는다.**
그래서 정책 한 줄로 끝난다. "update는 위험하고 delete는 안전하다"가 아니라, 위험이
**남는 데이터의 정합성**에 있었다는 이야기다.

#### 3. 링크 안에 버튼을 넣을 수 없다

알림 한 줄은 통째로 `<Link>`였다. 그 안에 삭제 버튼을 넣으면 유효하지 않은 HTML이고,
무엇보다 **지우려다 화면이 넘어간다.** 그래서 `<li>`가 링크와 버튼을 나란히 안는 모양으로 바꿨다.

```
<li class="flex">
  <Link class="flex-1">…내용…</Link>   ← 누르면 이동 + 읽음
  <button>×</button>                    ← 누르면 삭제만
</li>
```

갈 곳이 없는 알림(방·글이 지워진 경우)은 원래 링크가 아니라 그냥 줄로 그렸는데, 그쪽에도
버튼은 붙는다. **오히려 그런 줄이야말로 치우고 싶은 줄이다.**

버튼 이름에 알림 제목을 넣었다. "삭제"만으로는 스무 줄의 버튼 이름이 전부 같아져
스크린리더로 훑을 때 어느 줄인지 알 수 없다.

#### 4. 한 번 더 묻지 않는다 — 댓글 삭제와 다른 판단

댓글은 지우기 전에 확인을 받는다. 알림은 받지 않는다. 잘못 눌러도 **잃는 것이 알림 한 줄뿐**이기
때문이다 — 가리키던 방·글·후기는 그대로 있고, 안 읽은 채팅이라면 채팅 탭 배지가 여전히 알려 준다.
되돌릴 수 없다는 점은 같지만 되돌릴 만한 것이 아니다.

대신 캐시를 **응답 뒤에** 고친다. 읽음 표시는 보내기 전에 고쳤는데(누르는 즉시 화면이 넘어가
응답을 받을 화면이 없다) 삭제는 그 자리에 남는다. 실패했는데 줄이 사라졌다 다시 나타나는 편보다
잠깐 남아 있다 사라지는 편이 낫다.

무효화하지 않는 이유는 무한 스크롤이라서다. 다시 부르면 **첫 페이지만 남고 아래로 읽어 둔 것이
전부 날아간다.** 페이지가 통째로 비어도 페이지 자체는 남긴다 — 페이지 배열은 커서의 흔적이라
개수가 줄면 `getNextPageParam`이 보는 마지막 페이지가 달라진다.

### 이 정책이 손대지 않는 것 둘

- **차단 청소**(`purge_blocked_notifications`)는 `security definer`라 이 정책과 무관하게 돈다.
  지금까지 delete 정책 없이도 돌던 이유가 그것이다. 이번 변경이 그 동작을 바꾸지 않는다.
- **Realtime은 여전히 insert만** 흘린다(0015의 1번). 다른 기기에서 지운 알림이 이쪽에서 즉시
  사라지지는 않는다. delete까지 구독하려면 `replica identity`를 손봐야 하는데
  "다음에 열 때 없다"로 충분하다 — 읽음 표시를 구독하지 않기로 한 것과 같은 판단이다.

### 확인

정책은 트랜잭션 안에서 A·B 두 사람의 알림을 만들어 A로 행세해 밟고 통째로 롤백했다.

```
남의 알림 삭제 시도 : 0건 (오류가 아니라 조용히 걸러진다)
내 알림 삭제        : 1건
남은 행             : A=0 / B=1
```

**RLS의 delete는 지울 수 없는 행을 조용히 건너뛴다.** 0건 삭제도 성공이라 화면은 응답만으로
무엇이 지워졌는지 알 수 없고, 자기 목록에 있는 줄의 버튼만 누를 수 있다는 사실에 기댄다.

화면·캐시는 `notificationCache.test.ts` 4개와 `notificationListItem.test.tsx` 4개를 더했다
(전체 600개 통과). 삭제를 눌러도 `onSelect`가 불리지 않는지를 따로 본다 — 3번이 막으려는 것이
바로 그것이라 구조가 되돌아가면 이 테스트가 먼저 깨진다.

### 이번 범위 밖

- **알림 전체 삭제** — "모두 읽음" 옆에 "모두 삭제"를 둘 수도 있다. 한 줄씩 지우는 것과 달리
  실수의 크기가 달라져 확인 절차가 따라오고, 그러면 이 절의 4번 판단을 다시 해야 한다.
- **지운 알림 되돌리기** — 없다. 트리거는 사건이 일어난 순간에만 돌므로 지나간 알림을
  다시 만들어 낼 방법이 아예 없다.
- **다른 기기와 즉시 맞추기** — 위의 Realtime 이야기.

## "수정됨" 표시 · 댓글 수정 (2026-08-05)

`0020_edited_mark.sql`. `backlog.md` §4가 둘을 **한 묶음**으로 묶어 둔 것을 그대로 따랐다.

묶은 이유는 "댓글을 고칠 수 있게 하려면 수정됨 표시가 따라와야 하는데 게시물이 아직 안 하고
있다"였는데, 게시물 쪽을 열어 보니 이유가 하나 더 있었다 — **표시를 붙이기 전에 `updated_at`이
무슨 뜻인지부터 정리해야 했다.**

### 무엇을 만들었나

1. **`posts.updated_at`의 뜻을 좁혔다** — 상태 변경은 더 이상 "수정"이 아니다.
2. **`comments.updated_at`** — 새 칸 + 트리거.
3. **`guard_comment_update`** — 댓글 update는 content만.
4. **`isEdited`** — 게시물과 댓글이 함께 쓰는 판정 하나.
5. **화면** — 게시물 상세의 "· 수정됨", 댓글의 수정 버튼·인라인 폼·"· 수정됨".

### 설계 결정 다섯 가지

#### 1. 제외 목록을 포함 목록으로 뒤집었다

`updated_at`은 세 번에 걸쳐 다듬어졌다. 0005가 조회수·찜을 빼고, 0010이 끌올을 뺐다.
**전부 제외 목록**이라 새로 생기는 칸은 자동으로 "수정"이 된다. 그 길로 하나가 들어와 있었다.

```sql
-- 0008: 상태 변경은 "수정"이 아니라고 볼 여지도 있으나, 판매자가 의도적으로 누른
--       변경이므로 updated_at은 그대로 따라 오르게 둔다
```

**그때는 맞았다.** 읽는 화면이 없었으므로 그 값의 뜻은 "이 행이 마지막으로 바뀐 때"였고,
상태 변경은 분명히 행을 바꾼다. 지금은 같은 값이 화면에 "수정됨" 세 글자로 나온다.
뜻이 달라진 것이다 — **예약중으로 바꿨을 뿐인데 "수정됨"이 뜨면 읽는 사람은 글이나 가격이
바뀐 줄 안다.** 상태는 이미 배지로 보이고 있어 두 번 말할 이유도 없다.

그래서 `postApi.updatePost`가 실제로 쓰는 칸만 적는 포함 목록으로 바꿨다.

```sql
for each row when (
  old.title is distinct from new.title
  or old.description is distinct from new.description
  or old.price is distinct from new.price
  ...
)
```

덤이 하나 있다. 제외 목록이었다면 **상태를 끼워 넣는 것만으로 수정 표시를 지울 수 있었다**
(한 문장에 status와 title을 함께 보내면 `when`이 걸러 버린다). 포함 목록은 반대로 동작한다.

이것이 0017·0018에서 되풀이한 것과 같은 자리다 — **미리 만들어 둔 칸은 그것을 읽는 화면이
생길 때 뜻이 확정된다.** 그전까지는 "행이 바뀐 때"와 "내용을 고친 때"가 구별되지 않는다.

#### 2. 이미 쌓인 값은 되돌리지 않았다

지금 `updated_at > created_at`인 게시물이 세 건 있는데, 내용 수정이었는지 상태 변경이었는지
**되짚을 방법이 없다.** 그 구분을 남긴 곳이 없어서다. 앞으로 쌓이는 값부터 정확하다.

되돌릴 수 있는 척 추측해서 덮는 것보다 낫다고 봤다. 어차피 셋 다 개발 중에 만든 글이다.

#### 3. 댓글의 새 칸에 default를 그대로 두면 전부 "방금 수정됨"이 된다

```sql
alter table comments add column if not exists updated_at timestamptz not null default now();
update comments set updated_at = created_at where updated_at is distinct from created_at;
```

두 번째 줄이 핵심이다. `add column ... default now()`는 **이미 있는 행도 그 값으로 채운다.**
지금 이 저장소의 댓글은 0건이라 아무 일도 일어나지 않지만, 이 파일은 다른 환경에서도
같게 돌아야 한다.

`null`로 두고 "값이 있으면 수정된 것"으로 만들 수도 있었다. `profiles`·`posts`가 이미
`not null default now()` + 트리거 모양이라 같은 결로 맞췄다 — 읽는 쪽이 규칙 하나만
알면 된다("created_at보다 크면 고쳐진 것"). 그 규칙이 `isEdited` 하나다.

#### 4. 0017이 "위험하지 않다"고 한 정책에 구멍이 있었다

0017은 이렇게 적었다 — "수정 정책은 0001 그대로 둔다. 정책만 남아 있는 것은 위험하지 않다.
작성자 본인만 통과한다."

본인만 통과하는 것은 맞다. update는 `with check`를 안 쓰면 `using`이 새 행에도 걸려
author_id를 남의 것으로 바꿔 넣을 수도 없다. 그런데 **본인이 자기 댓글로 할 수 있는 일**이
열려 있었다.

```
post_id    다른 글로 옮긴다 — 엉뚱한 글에 내 댓글이 나타난다
parent_id  아무 댓글 밑으로 옮겨 붙인다 — 대댓글이 생기면서 실제로 뜻이 생긴 칸이다
created_at 시간을 바꿔 목록 맨 위로 올린다
```

`guard_message_update`(0008)·`guard_notification_update`(0015)와 같은 자리, 같은 모양으로 닫았다.
**"본인만 할 수 있다"와 "본인이 해도 되는 일인가"는 다른 질문이다.**

트리거 이름을 `comments_guard_update`로 둔 것은 우연이 아니다. before 트리거는 이름순으로
돌아서 `comments_set_updated_at`보다 먼저 걸린다 — 막을 것을 먼저 막고 시각을 찍는다.

#### 5. 고칠 수 있는 사람은 작성자뿐 — 삭제와 다르다

삭제는 0017이 **게시물 판매자에게도** 열었다. 내 글에 달린 광고를 지울 길이 신고뿐이면
곤란해서다. 수정은 작성자 본인뿐이다(0001 그대로) — **남의 말을 치울 수는 있어도 바꿔 쓸 수는
없다.** 화면도 같은 모양으로 갈렸다: 판매자에게는 삭제 버튼만 보이고 수정 버튼은 없다.

고치는 동안에는 답글·수정·삭제 버튼을 감춘다. 고치던 것을 두고 다른 일을 시작할 수 있으면
쓰던 글이 어디로 갔는지 알 수 없게 된다. 폼은 `CommentForm` 하나를 그대로 쓰고
`initialContent`만 더했다 — 답글 때와 같은 판단으로, 다른 것은 문구·취소·처음 담긴 값뿐이다.

### 확인

트리거는 트랜잭션 안에서 밟고 통째로 롤백했다.

```
게시물
  ① 상태만 변경        : updated_at 그대로
  ② 끌올만             : 그대로
  ③ 제목 변경          : 오른다
  ④ 상태+가격 한 문장  : 오른다 (제외 목록이었다면 안 올랐다)

댓글
  ⑤ 새 댓글            : updated_at = created_at
  ⑥ 같은 내용으로 저장 : 그대로 (when이 거른다)
  ⑦ 내용을 고침        : 오른다
  ⑧ parent_id 옮기기   : "댓글은 내용만 수정할 수 있습니다."
```

④를 처음 쟀을 때 `false`가 나왔는데 트리거 문제가 아니었다 — **한 트랜잭션 안의 `now()`는
모두 같은 값**이라 ③에서 찍은 시각과 구별되지 않았을 뿐이다. `updated_at`을 옛 시각으로
직접 밀어 두고 다시 재서 확인했다(그 update는 내용 칸을 건드리지 않으므로 트리거가 안 돈다 —
이 방법 자체가 포함 목록이 도는 증거이기도 하다).

화면은 `isEdited.test.ts` 5개와 `commentSection.test.tsx` 4개를 더했다(전체 609개 통과).

### 이번 범위 밖

- **수정 이력** — 무엇을 어떻게 고쳤는지는 남기지 않는다. 당근도 안 한다.
- **게시물 목록 카드의 "수정됨"** — 붙이지 않았다. 카드에서 궁금한 것은 값·상태·거리이지
  고쳐졌는지가 아니다. 상세로 들어가면 보인다.
- **언제 고쳤는지 함께 보이기** — 읽는 사람에게 필요한 것은 "지금 보는 내용이 처음 그대로냐"이지
  고친 시각이 아니다. 시각이 둘 붙으면 어느 쪽이 글의 나이인지 헷갈린다.
- **댓글 수정 이력·수정 횟수 제한** — 없다.

## 첫 거래 안내 (2026-08-05)

`0021_first_review.sql`. `backlog.md` §4 "첫 거래 안내 — '첫 후기를 받았어요' 같은 축하 화면.
**지금은 온도만 조용히 오른다.**"

마지막 문장이 문제의 전부다. 첫 후기를 받으면 `manner_temp`가 36.5°에서 움직이는데,
그 사실을 어디서도 말해 주지 않는다. 프로필에 들어가 눈금을 봐야 안다.

### 무엇을 만들었나

1. **첫 후기 표식** — `recalc_manner_temp`가 payload에 `is_first`를 남긴다.
2. **`fetch_notifications`의 `is_first` 컬럼** — 표를 화면까지 내려 준다.
3. **후기 알림의 두 번째 갈래** — 첫 후기만 문구가 다르다.

### 설계 결정 네 가지

#### 1. 축하 "화면"을 만들지 않았다 — 알림이 이미 그 상태를 갖고 있다

모달이든 배너든 한 번만 보여 주려면 **"이미 봤는가"를 어딘가 적어야 한다.** 지금 그 자리가
없다 — `profiles`에 칸을 하나 더하거나 기기에 저장해야 하고, 기기에 저장하면 폰을 바꾸면
다시 뜬다.

**알림은 그 상태를 이미 갖고 있다**(`is_read`). 게다가 첫 후기 알림은 **이미 가고 있었다** —
0001의 `recalc_manner_temp`가 후기마다 넣고 있었고, 다른 후기와 구별되지 않았을 뿐이다.
새 통로를 파는 대신 이미 가고 있는 줄에 표를 붙였다.

0018에서 배운 것과 같은 자리다. 그때는 "자리는 있는데 채워지지 않는다"였고,
이번에는 **"줄은 가고 있는데 다른 줄과 구별되지 않는다"**였다.

#### 2. "처음 받아 본 적 있는가"가 아니라 "지금 한 건인가"

```sql
select count(*) = 1 into v_is_first from reviews r where r.reviewee_id = new.reviewee_id;
```

트리거가 `after insert`라 새 행이 이미 세어진다. 그래서 이 조건이 곧 "이번이 처음"이다.

첫 후기를 **쓴 사람이 탈퇴하면** 그 후기가 cascade로 사라지고(0016의 ②), 다음 후기가 다시
"첫 후기"가 된다. 막지 않았다. 0016이 온도를 다루는 방식과 같은 이유다 —
**증감을 누적하지 않고 매번 현재 사실로 되짚는다.** 그 사람이 지금 가진 후기는 실제로
한 건뿐이고 프로필에도 "받은 후기 1"로 보인다. 여기서만 "두 번째"라고 하면 그쪽과 어긋난다.

막으려면 "축하를 보낸 적 있다"를 `profiles`에 적어야 하는데, 그것이 1번에서 피한 바로 그
칸이다. 아주 드문 경우에 축하가 한 번 더 가는 쪽이 칸 하나를 늘리는 쪽보다 싸다.

#### 3. 온도 값은 payload에 담지 않는다

"매너온도가 37.0°가 됐어요"라고 적을 수도 있었다. 담지 않은 이유는 그 숫자가
**찍힌 순간의 값**이라서다. 그 뒤 후기가 더 들어오면 알림에 남은 숫자와 프로필의 눈금이
달라지고, 어느 쪽이 맞는지는 아무도 모른다.

대신 "프로필에서 확인해 보세요"로 보낸다. 후기 알림이 원래 가는 곳이 자기 프로필이라
(0015의 `notificationText`) 누르면 지금 값이 눈금으로 있다.

#### 4. 이 한 줄만 주어가 바뀐다

`NotificationView.title`은 "누가 무엇을 했다"로 못 박아 둔 자리다. 다섯 타입이 전부 그렇다.
첫 후기만 어긴다.

```
가지팔이님이 거래후기를 남겼어요     ← 두 번째부터
🎉 첫 거래후기를 받았어요            ← 처음
```

**상대가 무엇을 했는가보다 나에게 처음 생긴 일이 알릴 값이기 때문이다.** 상대가 사라지는
것도 아니다 — 아바타는 그대로 그 사람이고, 눌러 간 내 프로필에 그 후기가 이름과 함께 있다.

무엇이 첫 후기인지 **화면에서 세지 않는다.** 받아 온 목록에는 첫 페이지 스무 줄밖에 없어
셀 수도 없고, 서버가 후기가 들어오는 순간에 이미 판단해 실어 보낸다.

### 시그니처가 바뀌는 함수는 replace가 안 된다

```sql
drop function if exists fetch_notifications(timestamptz, bigint, integer);
create function fetch_notifications(...)
```

반환 컬럼이 늘면 `create or replace`가 거절한다. 0018은 본문만 고쳐 replace로 끝났지만
이번에는 drop이 필요했다. 잠깐 함수가 없는 순간이 생기는데 마이그레이션 한 트랜잭션
안이라 밖에서는 볼 수 없다.

`coalesce((n.payload ->> 'is_first')::boolean, false)`로 세운다. 다른 네 타입에는 이 키가
없어 null이 오는데, 그대로 내려보내면 화면이 "모르는 값"과 "첫 후기가 아님"을 가려야 한다.
서버가 정리하는 편이 0015가 payload를 풀어 주기로 한 판단과 같은 결이다.

### 확인

트랜잭션 안에서 밟고 통째로 롤백했다.

```
① 첫 후기            : is_first = t
② 두 번째 후기       : f
③ 표가 없는 옛 알림  : f (0021 이전에 쌓인 줄은 지금까지와 똑같이 보인다)
④ 매너온도           : 36.5 → 37.5 (0.5 + 0.5)
⑤ fetch_notifications: 실제 사용자로 실행 — type=chat is_first=f
```

②를 만들 때 `reviews_post_id_reviewer_id_key`에 걸렸다. 같은 사람이 같은 글에 후기를
두 번 못 쓴다는 제약(0001)이라 **다른 글로 바꿔서** 밟았다 — 검증이 제약을 다시 알려 준 셈이다.

화면은 `notificationText.test.ts`에 3개를 더했다(전체 612개 통과). 그중 하나는
**후기가 아닌 알림에 `isFirst: true`가 와도 축하 문구를 쓰지 않는지**를 본다.
서버가 false로 세워 주지만, 그 약속이 깨져도 화면이 엉뚱한 말을 하지 않아야 한다.

### 이번 범위 밖

- **첫 판매·첫 구매 안내** — "첫 거래"의 다른 뜻이다. 후기와 달리 트리거가 붙을 자리가
  `posts.status` 전이라 0008의 전이 트리거를 건드려야 한다.
- **매너온도가 오른 폭 보여 주기** — 3번의 이유로 담지 않았다. 이력이 생기면 그때 다시 본다
  (`backlog.md` §4의 "매너온도 이력").
- **축하 화면·색종이** — 1번의 이유로 안 한다. 화면을 만들려면 "봤는가"를 적을 칸이 먼저다.

## 알림 종류별 on/off (2026-08-05)

`0022_notification_prefs.sql` · `0023_profile_guard.sql`. `backlog.md` §5-4.

§5는 "코드 문제가 아니라 **결정 문제**"를 모아 둔 절이다. 여기서 정할 것은 하나였다 —
**어느 단위로 끌 것인가.**

정한 것: **댓글 · 관심(찜) · 거래후기 셋만 끌 수 있다.** 채팅과 가격 제안은 못 끈다.

### 무엇을 만들었나

1. **`profiles`에 칸 셋** — `notify_comment` · `notify_like` · `notify_review`.
2. **`private.wants_notification`** — 판정 하나.
3. **트리거 셋에 조건 추가** — 끈 알림은 **아예 만들지 않는다**.
4. **알림 설정 화면** (`/settings/notifications`) — 스위치 셋, 저장 버튼 없음.
5. **`guard_profile_update`** (0023) — 아래 4번. 이번에 발견한 구멍이다.

### 설계 결정 네 가지

#### 1. 못 끄는 것에는 칸을 만들지 않는다

채팅을 끄면 상대는 답을 기다리는데 나는 모르는 상태가 된다. 그 **피해가 나에게 오지 않고
거래 상대에게 간다**는 것이 다른 셋과 결정적으로 다른 점이다. 알림을 끄는 것은 내 화면을
조용하게 만드는 일이어야지 남을 기다리게 만드는 일이면 안 된다.

이 판단을 스키마에 박았다. `jsonb` 한 칸에 다섯 키를 넣는 방법도 있었지만 그러면
"chat도 넣을 수 있는데 왜 안 넣지"가 되고, **끌 수 없다는 사실이 코드 어딘가의 `if`로만 남는다.**
칸이 없으면 끌 방법도 없다. 0020에서 제외 목록을 포함 목록으로 뒤집은 것과 같은 결이다.

`wants_notification`은 다섯 타입을 다 받되 그 둘은 언제나 true를 준다 — "끌 수 없다"가
서버에도 한 줄로 적혀 있다.

#### 2. 끈 알림은 아예 만들지 않는다

만들어 두고 목록에서 감출 수도 있었다. 0015가 차단 청소를 만들며 적어 둔 문장이 그대로 답이다.

> **목록만 걸러 내면 배지 숫자와 어긋난다.**

`count_unread_notifications`는 테이블을 세지 목록 RPC를 세지 않는다. 감추기만 하면
"안 읽음 3"인데 목록에는 한 줄도 없는 상태가 생긴다.

받는 사람마다 따로 묻는다. 댓글 알림은 판매자와 부모 댓글 작성자 **둘에게** 가는데(0018),
한 사람이 껐다고 다른 사람 것까지 막으면 안 된다.

껐다가 다시 켜도 그동안의 알림은 오지 않는다. 알림은 "그때 알려 주는 것"이라
0015(차단 해제) · 0018(찜 취소) · 0021(첫 후기)이 정한 것과 같은 결이다.

#### 3. 후기만 모양이 다르다 — 온도는 끄지 못한다

`recalc_manner_temp`는 두 가지 일을 하는데 그중 **하나만** 끈다.

```
sync_manner_temp  언제나 돈다. 매너온도는 알림이 아니라 받은 후기의 결과다
알림 insert       notify_review가 false면 넣지 않는다
```

알림을 껐다고 온도가 안 오르면 프로필의 숫자가 후기 목록과 어긋난다 — 0016이 통째로
막으려 했던 바로 그 어긋남이다. **"알림을 끈다"와 "그 일이 안 일어난 것으로 친다"는 다르다.**

0021의 `is_first` 계산은 알림 insert 안으로 옮겼다. 안 보낼 사람에게 "첫 후기인가"를
세어 볼 이유가 없다.

#### 4. 딸려 나온 구멍 — 매너온도를 스스로 올릴 수 있었다 (0023)

칸을 더하면서 "이 테이블은 사용자가 무엇까지 쓸 수 있나"를 다시 읽었는데 답이 **전부**였다.

```sql
-- 0001
create policy profiles_update on profiles for update using (auth.uid() = id);
```

내 행이면 어느 칸이든 쓸 수 있다. 실제로 밟아 봤다.

```
update profiles set manner_temp = 99 where id = auth.uid();   → 36.5 → 99.0
```

**0013이 후기에 들인 공이 이 한 줄로 전부 비켜 간다.** 그때 `create_review`를 RPC로 만들고
점수를 화이트리스트로 막고 대상을 서버가 고르게 한 이유가 매너온도를 스스로 못 올리게
하려는 것이었는데, 정작 온도 자체가 열려 있었다.

다른 guard 셋(0008 messages · 0015 notifications · 0020 comments)과 한 가지가 다르다.
저쪽은 "이 칸은 **아무도** 못 바꾼다"였지만 `manner_temp`는 **시스템은 계속 써야 하는 칸**이다.
그래서 칸이 아니라 **경로**를 본다.

```sql
if current_user in ('authenticated', 'anon') and new.manner_temp is distinct from old.manner_temp
```

`auth.uid()`로는 가를 수 없다 — definer 함수 안에서도 그 값은 그대로 세션의 사용자다
(JWT 클레임을 읽는 GUC이지 실행 권한이 아니다). `current_user`는 다르다. PostgREST로 온
update는 `authenticated`이고, `sync_manner_temp`는 `security definer`라 그 안에서는 함수
주인이 된다. 트리거 함수는 invoker라 그 문맥을 그대로 물려받는다.

### 화면

저장 버튼을 두지 않았다. 스위치 셋짜리 화면에 저장 버튼을 두면 **누르지 않고 나간 사람이
안 바뀐 채로 지낸다.** 대신 누르는 즉시 움직이고(`onMutate`) **실패하면 되돌린다**(`onError`).

읽음 표시(0015)도 보내기 전에 캐시를 고치지만 그쪽은 되돌리지 않는다 — 잃는 것이 굵은 글씨
하나뿐이고 다음 조회가 덮기 때문이다. 여기는 다르다. **껐다고 믿은 알림이 계속 오면 설정이
고장 난 것으로 보인다.**

한 종류씩 보낸다. 셋을 통째로 보내면 두 개를 빠르게 누를 때 나중 요청이 앞 요청의 값을
옛 상태로 되돌린다.

못 끄는 둘은 목록에서 빼는 데 그치지 않고 **이유를 화면에 적었다.** 없는 것만으로는
"빠뜨렸나"로 읽힌다.

### 확인

트랜잭션 안에서 밟고 통째로 롤백했다.

```
끈 상태  : 찜 0건 · 댓글 0건 · 후기 0건 / 매너온도 36.5 → 37.0  ← 온도는 오른다
켠 상태  : 찜 1건 · 댓글 1건 · 후기 1건
못 끄는 것: 셋을 다 꺼도 채팅 알림 1건 / wants(chat)=t wants(price_offer)=t

0023
① 사용자가 manner_temp = 99  → "매너온도와 가입 시각은 직접 바꿀 수 없습니다."
② 사용자가 닉네임 수정        → 그대로 된다
③ 후기가 들어와 sync         → 36.5 → 37.0
```

②③을 함께 잰 이유는 이 트리거가 **막아야 할 것만 막는지**가 핵심이라서다.
프로필 수정이나 온도 계산이 함께 막히면 고장이 조용히 퍼진다.

화면은 `notificationSettingsPage.test.tsx` 5개를 더했다(전체 617개 통과).
그중 하나는 **응답을 붙잡아 둔 채** 스위치가 이미 움직였는지를 본다.

### 이번 범위 밖

- **글별 알림 끄기** — "이 글의 알림만 끄기". `profiles` 칸으로는 안 되고 `muted_posts` 같은
  테이블이 따로 붙는다. 타입별이 먼저 있어야 의미가 생기는 기능이라 순서가 이쪽이 먼저였다.
- **끈 알림을 나중에 모아 보기** — 없다. 안 만들었으므로 볼 것도 없다.
- **푸시 알림과의 관계** — `backlog.md` §5-6. 푸시가 붙으면 "앱 안에서는 받고 푸시는 안 받기"가
  따로 생길 수 있다. 지금 칸 셋은 "알림 자체를 받는가"라 그때 한 겹이 더 얹힌다.
- **`onboarded_at` 잠그기** (0023) — 열어 뒀다. 온보딩을 마치며 클라이언트가 직접 찍는 값이라
  (0002) 잠그면 가입 흐름이 멈춘다. 스스로 앞당겨도 잃는 것은 자기 온보딩뿐이다.

## 반경 검색 — 법정동과 병행 (2026-08-06)

`backlog.md` §5-1의 앞쪽 절반이다. 셋을 한 묶음으로 보기로 하고, **검색 기준은 병행**으로
정했다. 지도 화면은 다음 PR로 넘긴다.

깔려만 있던 자산 셋 중 둘이 살아났다 — `profiles.search_radius_m`(0001, 읽는 코드 0)과
`posts.location`(0005, 쌓이기만 하던 값)이다. 셋째인 `nearby_posts` RPC는 **살리지 않고
지웠다.** 왜인지가 이번의 핵심이다.

### `nearby_posts`를 지운 이유

backlog에는 "호출 0회"라고만 적혀 있었다. 잇기만 하면 되는 줄 알았는데 열어 보니
**0001이 아무 화면도 없을 때 적어 둔 함수라, 그동안 목록에 쌓인 규칙을 하나도 모른다.**

| 그동안 목록에 붙은 것 | `nearby_posts` |
|---|---|
| 차단 사용자 제외 (0014) | 없다 — 반경으로 보는 순간 차단이 비껴간다 |
| 검색어·가격·거래가능 필터 (0007) | 카테고리 하나뿐 |
| (정렬값, id) keyset (0011) | 커서가 `bumped_at` 하나 |
| 목록 카드의 반환 모양 | `setof posts` — `thumbnail_url`·`like_count`가 없다 |

채워 넣으면 `search_posts`와 같아진다. **그리고 같아진 둘을 나란히 두면, "목록이라면 모두
적용돼야 하는 규칙"이 생길 때마다 두 곳을 고쳐야 한다.** 0014가 실제로 그 값을 치렀다 —
차단 하나를 넣느라 목록 RPC·채팅방 목록·새 대화·메시지 넷을 한꺼번에 고쳤다.
`fetchNeighborhoodPosts`가 홈 전용 질의를 따로 두지 않고 `search_posts`를 그대로 부르는 것도
같은 이유다(0007).

그래서 **기준을 함수로 가르지 않고 인자로 갈랐다.**

```sql
where ($1 is null or p.region_code = $1)          -- 기준 ①: 법정동
  and ($11 is null or st_dwithin(p.location, $11, $12))  -- 기준 ②: 반경
```

둘은 배타적이지 않다. 안 쓰는 쪽이 null이라 통과할 뿐이다. 그래서 둘 다 보내면 교집합이
된다 — 지금 화면은 그렇게 부르지 않지만 "이 동네 안에서 500m"를 나중에 열 자리는 여기다.

`create or replace`로는 안 됐다. 인자가 늘고 반환 모양이 바뀌어 **옛 시그니처가 남은 채
새 함수가 하나 더 생긴다.** 그러면 PostgREST가 어느 쪽을 부를지 못 정해 PGRST203으로 거절한다.
먼저 `drop`한다.

### 반경이 고르는 것은 물건이 아니라 동네다

착수하고 가장 먼저 걸린 것이다. `posts.location`은 **판매자 동네의 대표 좌표**이지
판매자의 위치가 아니다 — 0005가 그렇게 정했다("거래장소를 location에 넣으면 옆 동네 카페에서
만나기로 한 글이 그 동네 글이 되어버린다"). **같은 동 글은 좌표가 전부 같다.**

실제 데이터가 그렇다. 27건이 모두 석관동이고 거리가 전부 `1000.45506895`로 같았다.

그래서 이 기능은 "2km 안의 물건"이 아니라 **"2km 안에 중심이 있는 동네의 물건"**이다.
그 사실을 세 군데에 박았다.

- 정렬 이름이 "가까운 순"이 아니라 **"가까운 동네순"**이다.
- 설정 화면 문구가 "이 거리 안에 드는 **동네**의 글이 함께 보여요"다.
- 기준 전환 아래 설명도 같은 말을 한다.

"가까운 순"이라고 적었으면 물건 하나하나까지 재 준다는 뜻이 되어 **거짓말이 된다.**
값이 틀린 것이 아니라 **화면이 그 값의 뜻을 넘겨 말하는 것**이 문제다.

### 거리순의 keyset — 최악 조건이 기본값이다

같은 동 글의 거리가 전부 같다는 말은, **거리순에서 tie-breaker가 거의 언제나 걸린다**는
뜻이다. 다른 정렬은 값이 겹치는 것이 예외지만 여기서는 그것이 정상이다.
0011이 정렬값 하나로는 부족하다고 보고 `(정렬값, id)`로 만들어 둔 것이 여기서 값을 했다.

27건을 10건씩 세 페이지로 끊어 확인했다. **중복 0, 누락 0.**

```
page1: 28,27,26,25,24,23,22,21,20,19
page2: 18,17,16,15,14,13,12,11,10,9
page3: 8,7,6,5,4,3,2          → 27건 / distinct 27
```

정렬 키가 컬럼이 아니라 **식**이라는 것도 이번이 처음이다. 0011이 만든 `format()` 틀에
컬럼 이름 대신 `st_distance(p.location, $11)`을 그대로 넣었다 — `$11`은 `using`의 중심 좌표라
동적 SQL 안에서 그대로 바인딩된다.

커서 값은 문자열로 오간다(0011). 부동소수를 문자열로 왕복시키는 것이 처음이라 확인했다 —
Postgres의 float8 출력과 JS의 `String(number)`가 **둘 다 최단 왕복 표기**라 비트가 그대로
보존된다. `1000.45506895` → `::double precision` → 같은 값. 잘라 쓰면 경계의 글이 겹치거나
사라진다.

### 거리순은 반경 기준에서만

법정동으로 보면서 거리순을 고르면 정렬 키가 전부 null이 된다. 그러면 순서는 사실상 id뿐인데
화면에는 "가까운 동네순"이라고 적힌다. **거짓말이 되기 전에 서버가 거절한다.**

그런데 화면에서 안 보이게 하는 것만으로는 모자랐다. **필터의 원본이 URL**이라(0007)
`?sort=distance`를 손으로 칠 수 있고, 그러면 요청이 그대로 나가 목록이 오류로 죽는다.
그래서 `toPostSortOption`이 **기준을 함께 받는다** — 이름을 아는 값이어도 이 기준에서 쓸 수
없으면 모르는 값과 같다.

같은 구멍이 하나 더 있었다. **반경으로 거리순을 보다가 "우리 동네"로 되돌리는 순간**이다.
정렬은 URL에 남아 있는데 그 기준에서는 뜻이 없어진다. 기준을 바꿀 때 정렬을 한 번 더
거르는 것으로 닫았다.

### 반경은 프로필에, 기준은 URL에

둘을 갈라 둔 것이 이번의 작은 판단이다.

- **반경(`search_radius_m`)은 프로필이다.** 한 번 정하면 계속 쓰는 값이고, 0001이 칸을
  만들어 둔 자리다.
- **기준(`scope`)은 URL이다.** "지금 이 화면을 어떻게 보고 있는가"라 뒤로가기로 되돌아가야
  한다. 필터·정렬과 같은 성격이다.

반경까지 URL에 넣으면 링크를 공유할 때마다 남의 반경이 내 화면에 실린다. 반대로 기준을
프로필에 넣으면 뒤로가기가 안 먹는다.

값의 범위는 **서버만** 조인다(100~20000). 스키마에 제약을 걸지 않은 이유는 같은 규칙이 두
곳에 생기고, 범위를 넓힐 때 마이그레이션이 한 번 더 필요해지기 때문이다.
`toSearchRadius`가 화면 쪽에서 걸러 내는 것은 **뜻이 서지 않는 값**(null·0 이하)뿐이다 —
목록에 없는 값이어도 그대로 쓴다. 기본값으로 되돌리면 사용자가 정한 적 없는 반경으로
조용히 바뀐다.

0023이 이 칸을 잠그지 않은 것이 그대로 맞았다. 사용자가 자기 뜻으로 정하는 값이고,
남에게 보여도 거짓말이 되지 않는다.

### 홈은 그대로 둔다

반경 기준을 검색(`/search`)에만 열었다. "우리 동네"는 사람들이 **이름으로 아는 단위**라
그 범위가 조용히 바뀌면 안 되고, 범위를 고르고 싶은 순간에는 이미 찾는 것이 있다 —
3단계에서 홈에 정렬 선택을 두지 않은 것과 같은 이유다.

### 화면

기준 전환은 필터 줄이 아니라 **그 위**에 뒀다. 필터는 "우리 동네 안에서 무엇을"이지만
이것은 "우리 동네가 어디까지인가"라, 같은 줄에 놓으면 조건 하나로 읽힌다.
"필터 초기화"가 되돌리는 대상도 아니다.

반경 설정은 `/settings/region`에 붙였다. 값은 검색에서만 쓰이지만 **무엇을 기준으로 재는지가
동네**라, 떨어뜨려 두면 "어디서부터 2km인가"를 알 수 없다.
정렬과 달리 select가 아니라 칩인 이유는 **지금 고른 것과 고를 수 있는 것이 함께 보여야**
하기 때문이다 — "2km가 얼마나 넓은지" 감이 없는 값이라 접힌 목록에서는 옆 칸과 견줄 수 없다.

게스트는 반경을 못 바꾼다. 저장할 곳이 없다. 동네처럼 브라우저에 남기지 않은 것은
**반경이 동네가 정해진 뒤에야 뜻이 서는 값**이라서다 — 동네 없이 반경만 남으면 다음에 왔을 때
무엇을 기준으로 잰 값인지 알 수 없다. 그래서 게스트에게는 "반경 바꾸기" 링크 대신
"로그인이 필요해요"를 적는다. 없는 것만으로는 막다른 길이 된다.

### 확인

```
법정동 기준 27건 / distance_m 채워진 행 0        ← 기존과 같다
반경 2000m  27건 / 최소 거리 1000.5m
반경  500m   0건                                 ← 1km 밖이라 아무것도 안 걸린다
반경   -1   → 100으로 조여 0건
기준 없음         → 거절: 검색 기준이 없습니다
위도만 / 경도만   → 거절: 좌표는 위도와 경도가 함께 있어야 합니다
좌표 없이 거리순  → 거절: 거리순으로 보려면 기준 좌표가 필요합니다
모르는 정렬       → 거절: 알 수 없는 정렬 기준입니다: nearest
동네+반경 교집합  → 20건 / 다른 동네+반경 → 0건
```

PostgREST를 통해서도 밟았다 — 시그니처가 바뀌었으므로 오버로드가 하나만 남았는지,
`anon`·`authenticated`가 그대로 실행할 수 있는지가 실제 확인 대상이었다.

테스트는 34개를 더했다(전체 651개 통과). `searchRadius` 12 · `postSort` 5 ·
`postSearchFilters` 4 · `postSearchCursor` 3 · `searchScopeToggle` 7 · `searchRadiusSelect` 3.
그중 둘은 **틀리기 쉬운 자리**를 노렸다 — 부동소수 커서를 잘라 쓰지 않는지, 거리가 null일 때
0으로 갈음하지 않는지다(0으로 보내면 서버가 "0m보다 먼 글부터"로 읽어 목록을 처음부터 다시 준다).

### 이번 범위 밖

- **지도 화면** — §5-1의 나머지 절반. 다음 PR이다. 마커는 **동 단위 묶음**으로 간다 —
  좌표가 동 대표 좌표라 글마다 핀을 찍으면 한 점에 겹쳐 쌓이고, 흩뿌리면 없는 위치를 지어낸다.
- **카드에 거리 적기** — 안 붙였다. 같은 동 글이 전부 같은 숫자라 "이 물건은 1km 거리"로
  읽히면 거짓말이 된다. 붙인다면 카드가 아니라 **동네 이름 옆**이 맞는 자리다.
- **홈의 기준 전환** — 위 참고. 재검토 대상 아님.
- **게스트의 반경** — 저장할 곳이 없어 언제나 기본값(2km)이다.
- **거리 기반 인덱스 확인** — `posts_location_gix`(0001)가 `st_dwithin`을 받지만, 27건짜리
  테이블에서는 계획기가 어차피 seq scan을 고른다. 글이 쌓인 뒤에 다시 볼 자리다.

## 지도 — 동네 단위 마커 (2026-08-06)

`backlog.md` §5-1의 나머지 절반이자 `feature.md` §2.2의 마지막 구멍이다.
`src/features/map/`이 `.gitkeep` 하나였던 자리에 화면이 생겼다.

### 마커 하나 = 동네 하나

가장 먼저 정한 것이고, 나머지 설계가 전부 여기서 나왔다.

`posts.location`은 판매자 **동네의 대표 좌표**다(0005). 그래서 같은 동 글은 좌표가 사실상
한 점이다 — 0024에서 27건의 거리가 전부 `1000.45506895`로 같았던 그 이유다.
글마다 핀을 찍으면 **한 자리에 27개가 겹쳐 쌓이고**, 보기 좋으라고 흩뿌리면 **없는 위치를
지어낸다.** 그래서 겹치는 것을 서버에서 미리 세어 내려보낸다(`nearby_region_counts`).

`posts.trade_location`(거래희망장소)은 진짜 POI라 겹치지 않지만 **장소를 고른 글에만** 있다.
그것만 찍으면 나머지 글이 지도에서 통째로 사라진다. 둘을 섞으면 지도 위에 뜻이 다른 마커
두 종류가 놓인다. 그래서 쓰지 않았다.

화면에도 그대로 적었다 — "마커 하나가 **동네 하나**입니다." 적지 않으면 "석관동 27"을 보고
물건 하나의 위치를 찍어 준 것으로 읽는다.

### 0024에서 한 말을 하루 만에 뒤집지 않기

0024는 `nearby_posts`를 지우면서 "같은 결과를 내는 함수가 둘이면 목록 규칙을 넣을 때마다
두 곳을 고쳐야 한다"고 적었다. 그런데 지도에도 **같은 조건**(검색어·카테고리·가격·거래가능·
**차단**)이 걸려야 한다. 그대로 다시 적으면 그 말을 뒤집는 셈이다.

특히 차단이 위험하다. 목록에서는 빠지는데 지도에서는 세어지면, **마커에 적힌 숫자와 눌러
들어간 목록의 길이가 어긋난다.** 사용자는 글이 사라졌다고 읽는다.

그래서 **WHERE를 함수 하나로 빼고 둘이 함께 쓴다** — `private.posts_in_scope`.

```sql
from private.posts_in_scope($1, $2, $3, $4, $5, $6, $7, $8, $9) p   -- search_posts
from private.posts_in_scope(null, v_center, v_radius, ...) p        -- nearby_region_counts
```

0024가 함수를 나누지 말라고 한 것은 **같은 질문**(글 목록)에 대해서였다. 여기는 다른
질문(동네별 개수)이라 함수가 갈리는 것이 맞고, 갈리면 안 되는 것은 **조건**이다.

### 인라인 — plpgsql로 적었으면 반경 검색이 통째로 느려질 뻔했다

공유 함수를 `language sql` · `returns setof` · 단일 SELECT로 적은 것은 취향이 아니라
**계획기가 인라인해야 하기 때문**이다. 인라인되지 않으면 `st_dwithin`이 함수 안에 갇혀
`posts_location_gix`를 못 타고, 반경 검색이 전부 seq scan이 된다.

확인은 계획을 직접 읽었다. 행이 27개뿐이라 평소에는 어차피 seq scan을 고르므로,
`enable_seqscan = off`로 **인덱스를 고를 수 있는지**를 봤다.

```
Index Scan using posts_location_gix on posts p
  Index Cond: (location && _st_expand('…'::geography, '2000'))
```

`Function Scan`이 아니라 `Index Scan`이 나왔다 — 인라인됐다는 뜻이다.
plpgsql로 적거나 `security definer`를 붙였으면 여기가 막혔다.

### 같은 동네가 마커 둘로 갈리는 자리 (실제 데이터를 보고 고쳤다)

처음에는 `(region_code, dong_name, location)`으로 묶으려 했다. 데이터를 열어 보니 **둘 다
쪼개진다.**

```
region_code   dong_name                profiles  distinct_coords
1129013900    서울특별시 성북구 석관동      2         1
1130510300    서울 강북구 수유동           1         1        ← 표기가 다르다
```

- **이름**: 같은 코드인데 표기가 갈린다. `coord2RegionCode`는 "서울특별시", `addressSearch`는
  "서울"을 준다. 카카오가 그렇게 내려준다.
- **좌표**: 동네를 고른 방법에 달렸다. GPS로 잡으면 카카오의 동 대표 좌표지만, 이름으로
  검색하면 **그 지번의 좌표**가 들어온다(`fromAddressSearchResult`가 `address.x/y`를 쓴다).

그래서 **코드로만 묶고**, 이름은 최빈값(`mode() within group`), 좌표는 평균을 쓴다.
평균이 맞는 이유는 이 마커가 애초에 한 점이 아니라 **한 무리를 대표하는 점**이라서다.
거리도 그 평균점에서 잰다 — 마커가 놓인 자리와 적힌 거리가 어긋나면 안 된다.

한 동에 이름 두 표기·좌표 두 개를 넣고 롤백해 확인했다.

```
3건(이름 2종·좌표 2종) → 마커 1개 / 이름 "서울특별시 강북구 수유동"(2건) / 좌표 평균 / 74m
```

### `libraries` 옵션은 건드릴 것이 없었다

backlog가 "로더 옵션(`libraries`)과 타입 선언부터 넓혀야 한다"고 적어 뒀는데 **절반만
맞았다.** SDK 부트스트랩을 직접 읽어 보니 이렇다.

```js
var o = ["v3"];                        // 지도 API는 언제나 실린다
if (v) o = o.concat(v.split(","));     // libraries는 "더" 얹는 옵션
```

`libraries=services`는 services를 **추가**하는 것이지 지도를 빼는 것이 아니다.
넓힐 것은 `shared/types/kakaoMaps.ts`뿐이었다 — `Map`·`Circle`·`CustomOverlay`를 더했다.
("지도(Map)는 만들지 않는다"고 못 박아 둔 주석도 이제 사실이 아니라 함께 고쳤다.)

`Marker`를 안 쓰고 `CustomOverlay`를 쓴 이유는 **숫자를 적어야** 해서다. 마커의 내용이
"이 동네에 몇 건"이라 기본 핀으로는 표현되지 않는다. `content`로 HTMLElement를 주면 평범한
DOM 리스너를 달 수 있어 `kakao.maps.event`도 필요 없다 — 그래서 타입 표면이 더 줄었다.

### 마커를 React로 그리지 않은 이유

`createRegionMarkerElement`는 `document`만 알고 지도는 모른다. 포털로 React를 밀어 넣을 수도
있었지만, 마커는 지도가 살아 있는 동안 붙었다 떨어지기를 반복하는 것이라 **생명주기 주인이
둘(React와 지도)이 된다.**

덕분에 jsdom에서 그대로 테스트된다 — 지도 없이 마커만 8개 케이스로 밟았다.
그중 둘은 실수하기 쉬운 자리다: `button`의 기본 `type`이 `submit`이라는 것과,
클릭이 지도까지 올라가면 마커를 누를 때마다 지도도 반응한다는 것.

### 다시 그릴 때는 전부 걷고 다시 얹는다

바뀐 것만 고치는 편이 빨라 보이지만, 마커는 많아야 수십 개이고 **무엇이 바뀌었는지 재는
코드가 마커를 그리는 코드보다 길어진다.** 그리고 한 번이라도 어긋나면 지도에 유령 마커가
남는다 — 목록에서는 사라졌는데 지도에는 있어서, 눌러도 아무 일이 없는 자리가 생긴다.

대신 두 가지를 조심했다.

- `onSelect`를 deps에 넣지 않는다(ref로 잡는다). 부르는 쪽에서 인라인으로 만드는 함수라
  렌더마다 신원이 달라지고, 그러면 **렌더할 때마다 전부 걷었다 다시 얹는다.**
- 빈 목록을 `?? []`로 적지 않는다. 그것도 렌더마다 새 배열이라 같은 일이 벌어진다.

### 주소가 `/map`이 아니라 `/search/map`인 이유

**탭바다.** `isTabActive`가 하위 주소를 그 탭으로 보므로(`/my/likes`가 마이페이지인 것과
같다) 지도를 보는 동안 검색 탭이 켜져 있다. `/map`으로 두면 다섯 칸이 전부 꺼져 어디에
있는지 알 수 없다. 주소가 관계를 그대로 말해 주기도 한다 — 지도는 검색의 한 모습이다.

필터는 URL에서 그대로 이어받고, "목록으로" 링크도 쿼리를 그대로 들고 돌아간다.
검색에서 "노트북"을 걸고 넘어왔는데 지도가 전부 다 세고 있으면, 개수가 어긋나 보인다.

### 지도 옆에 목록을 또 둔 이유

`RegionCountList`는 마커와 같은 것을 글로 적은 줄이다. 중복 같지만 **지도만으로는 닿을 수
없는 마커가 생긴다** — 마커 둘이 겹치면 뒤엣것을 누를 방법이 없고, 확대해서 떼어 놓는 것은
화면이 좁을수록 어렵다. SDK가 아예 안 뜬 상황에서도 이 줄은 그대로 남는다.

거리를 여기에 적는다. 마커에는 자리가 없어 이름과 개수만 들어가는데, "가까운 순으로 놓였다"는
사실은 숫자가 보여야 확인된다.

### 딸려 나온 수정 — `toSearchRadiusLabel`이 "5.0km"를 냈다

테스트를 쓰다 잡혔다. 그 함수는 500·1000·2000처럼 **고른 값**만 다뤄서 나누면 늘 딱
떨어졌는데, 지도가 **잰 거리**를 적기 시작하니 4971m이 들어와 `4.971 → toFixed(1)` →
**"5.0km"**가 됐다. 값은 맞지만 아무도 그렇게 쓰지 않는다.

소수점을 **먼저 정리하고** 0으로 끝나면 떼는 순서로 바꿔 `shared/utils/formatDistance`로
올렸다. 고른 값과 잰 값이 같은 규칙으로 보여야 "2km 이내"와 "5km"가 한 화면에서 어긋나지 않는다.

### 확인

```
0024 회귀 — region 27건 / radius 2km 27건 / 500m 0건 / region 기준 distance_m = null
             keyword 5건 / availableOnly 24건            ← 전부 0024와 같다
집계        — 5km 안에 1동(석관동 27건, 1000.5m)
필터 일치   — 조건 4가지에서 지도 합계 == 목록 건수 (27/27 · 5/5 · 24/24 · 26/26)
동네 묶기   — 이름 2종·좌표 2종 3건 → 마커 1개(최빈 이름·평균 좌표·74m)
인라인      — enable_seqscan=off에서 Index Scan using posts_location_gix
거절        — 명시적 null 좌표 → "지도는 기준 좌표가 있어야 합니다"
              반경 -1 → 100으로 조여 0동 / 99999 → 20000으로 조여 1동
SDK         — 앱키로 부트스트랩 200, o=["v3"]가 지도 API를 언제나 싣는 것을 소스에서 확인
```

**필터 일치는 이번에 가장 중요한 확인이다.** 공유 함수를 만든 이유가 그것이고,
어긋나면 마커의 숫자가 거짓말이 된다.

테스트는 27개를 더했다(전체 678개 통과). `regionMarkerElement` 8 · `regionCountList` 6 ·
`formatDistance` 6 · `mapLevel` 4 · `mapErrorMessage` 4.

### 못 해 본 것 (정직하게)

**브라우저에서 지도가 실제로 그려지는 것은 보지 못했다.** dev 서버가 `/search/map`을 200으로
내주고 모듈이 전부 변환되는 것, SDK 부트스트랩이 앱키로 200을 내는 것, 쓰는 심볼
(`Map`·`CustomOverlay`·`Circle`·`relayout`…)이 core 번들에 있는 것까지는 확인했지만,
타일이 그려지고 마커가 그 자리에 붙는 것은 **눈으로 봐야 아는 일**이다.
`npm run dev` 후 `/search/map`에서 한 번 봐 주면 좋겠다.

### 이번 범위 밖

- **지도를 끌어 다른 동네 보기** — 지금 중심은 언제나 내 동네다. 끌어서 보게 하려면
  "지도 중심"이 "내 동네"와 갈라지고, 반경의 기준도 함께 옮겨야 한다. 그때 `search_radius_m`이
  설정인지 지금 화면의 상태인지가 다시 문제가 된다(0024가 URL과 프로필을 갈라 둔 자리).
- **확대·축소에 따라 다시 세기** — level이 바뀌어도 반경은 그대로다. 붙이려면 화면 경계
  (`LatLngBounds`)를 반경 대신 쓰는 쪽이 맞고, 그러면 RPC의 인자가 원이 아니라 사각형이 된다.
- **마커 겹침 정리** — 동네가 가까우면 풍선이 서로 겹친다. `clusterer` 라이브러리를 얹는
  방법이 있지만, 이미 서버에서 한 번 묶은 것을 화면에서 또 묶는 일이라 숫자의 뜻이 두 겹이 된다.
  지금은 옆의 목록이 그 자리를 맡는다.
- **거래희망장소 핀** — 위 참고. 뜻이 다른 마커를 섞지 않기로 했다.
- **지도 탭** — 탭바는 다섯 칸으로 이미 좁다. 검색 안의 한 모습으로 두었다.

## 가격 제안 취소 (2026-08-06)

`backlog.md` §5-2. `todo.md`가 4단계 때부터 조건을 달아 둔 항목이다.
**정한 것: 답변 대기 중인 제안만 무를 수 있다.**

### 왜 필요했나 — 잘못 보낸 제안에 갇힌다

혼자서는 안 보이고 **둘이 겹쳐야 보이는 문제**였다.

- 0008이 `messages_update`를 "발신자가 **아닌** 참여자"로 좁혔다. 상대 말풍선의 content를
  못 고치게 하려던 것이고 옳은 판단이었다. 그 바람에 **자기 제안도 못 건드린다.**
- `hasPendingOfferFrom`이 대기 중인 제안이 있으면 새 제안을 막는다. 수락 버튼이 여러 개
  남으면 그중 무엇을 눌러도 "합의된 금액"이 되기 때문이고, 이것도 옳은 판단이었다.

둘을 겹치면 **50,000원을 5,000원으로 잘못 보낸 사람이 아무것도 할 수 없다** — 무를 수도,
새로 보낼 수도 없이 판매자가 답할 때까지 기다려야 한다. 각자는 맞는데 둘이 만나 막다른 길이 됐다.

### 수락된 제안은 무르지 않는다

`pending → cancelled`만 열었다. `accepted`·`rejected`는 **상대가 이미 답한 것**이라 한쪽이
혼자 되돌리면 합의가 깨진다. 말풍선 주석이 처음부터 "되돌리는 길은 없고, 마음이 바뀌면 새로
제안한다"고 적어 둔 그대로다.

지우지 않고 상태로 남기는 것도 같은 결이다. 0008이 "대화 기록이 사후에 바뀌면 채팅을
신뢰할 수 없다"고 정한 자리라, 취소는 **없던 일**이 아니라 **취소했다는 기록**이다.

### 파 보니 나온 구멍 — 전이를 아무도 막고 있지 않았다

0008의 guard를 다시 읽다 알았다. 그 트리거는 "바뀌면 안 되는 칸"만 세고 `offer_status`는
통째로 열어 두었다(주석도 "offer_status는 열어 둔다"였다). 즉 **받는 쪽이 `accepted`를
`rejected`로 뒤집을 수 있었다.**

화면은 막고 있었다 — `respondToOffer`가 `.eq('offer_status', 'pending')`을 건다.
그래서 **버그로 보이지 않았다.** 클라이언트가 스스로 지키던 규칙이라 요청을 직접 보내면
그만이었다. 0023이 `manner_temp`에서 겪은 것과 같은 모양이다 — *"화면이 막고 있으니 괜찮다"*가
두 번째로 틀린 자리다.

안 닫았으면 "수락된 제안은 못 무른다"는 이번 결정이 **`cancelled`에만 걸리고 `rejected`로
가는 길은 열린 채**가 됐을 것이다.

### enum 값 하나 때문에 마이그레이션이 둘로 갈렸다

`alter type ... add value`로 더한 값은 **같은 트랜잭션에서 쓸 수 없다.**

```
ERROR: unsafe use of new value "cancelled" of enum type offer_status
```

프로브를 만들어 직접 밟아 확인했다(롤백했다). 마이그레이션 파일 하나가 트랜잭션 하나이므로
**0026은 값만 더하고, 0027이 그 값을 쓰는 규칙을 얹는다.** 파일이 갈린 것은 취향이 아니라
Postgres가 그렇게 시켜서다.

정책 식에 `'cancelled'`를 적지 않은 것도 여기서 나왔다. 정책은 만들 때 곧바로 파싱되므로
값을 보는 일은 트리거가 맡는다 — 0008이 "정책이 누가를, 트리거가 무엇을"로 나눠 둔 구도가
여기서 한 번 더 값을 했다.

### 정책은 문을 좁게 낸다

발신자에게 여는 문을 **자기 가격 제안 행**으로만 냈다.

```sql
auth.uid() <> sender_id      -- 받는 쪽 (0008 그대로)
or type = 'price_offer'      -- 보낸 쪽: 이 종류만
```

`type` 조건이 없으면 발신자가 자기 글·사진 메시지도 update 대상으로 삼을 수 있게 되고,
그때 막는 것은 트리거뿐이 된다. 문을 좁게 내면 트리거가 실수해도 피해가 작다.

**대신 넘어온 몫이 하나 있다.** 0008에서는 정책이 발신자를 아예 빼서 `read_at`도 자동으로
막혔는데, 문을 열었으니 그 몫이 트리거로 온다 — 안 옮겼으면 보낸 사람이 자기 메시지를
읽음으로 만들어 **상대는 읽지도 않았는데 "안읽음"이 사라진다.**

### 딸려 나온 수정 — 문구를 늘렸더니 옛 패턴이 안 걸렸다

트리거의 예외 문구를 "메시지는 읽음 표시**만** 바꿀 수 있습니다"에서 "읽음 표시**와 제안
답변만**…"으로 늘렸는데, `chatErrorMessage`가 `/읽음 표시만/`으로 잡고 있었다.
**조용히 기본 문구로 떨어진다** — 오류가 나는 것이 아니라 덜 친절해질 뿐이라 눈에 안 띈다.

패턴을 고치고, **서버 문구를 그대로 넣는 테스트**를 붙였다. 다음에 또 늘리면 여기서 먼저 깨진다.

### 확인

정책과 트리거를 실제 사용자로 가장해(`request.jwt.claims`) 전이를 하나씩 밟았다.
**시나리오마다 제안을 새로 심었다** — 처음에는 한 행을 이어 썼다가 `cancelled → cancelled`가
no-op으로 "통과"해 잘못 읽을 뻔했다(아래 `troble.md`).

```
보낸쪽 pending -> cancelled            통과      ← 이번에 여는 길
받은쪽 pending -> accepted / rejected  통과
보낸쪽 pending -> accepted (셀프수락)   거절: 보낸 제안은 취소만 할 수 있습니다
받은쪽이 남의 pending 제안을 대신 취소   거절: 받은 제안은 수락하거나 거절할 수 있습니다
받은쪽 accepted -> rejected            거절: 이미 답이 끝난 제안은 바꿀 수 없습니다  ← 0008의 구멍
보낸쪽 accepted -> cancelled           거절: 이미 답이 끝난 제안은 바꿀 수 없습니다
보낸쪽 rejected -> cancelled           거절: 이미 답이 끝난 제안은 바꿀 수 없습니다
보낸쪽 cancelled -> pending (되살리기)  거절: 이미 답이 끝난 제안은 바꿀 수 없습니다
제3자가 pending -> cancelled           정책이 막음(0행)
보낸쪽이 자기 글 content 수정           정책이 막음(0행)
보낸쪽이 자기 메시지를 읽음으로          정책이 막음(0행)
보낸쪽이 제안 금액 수정                 거절: 메시지는 읽음 표시와 제안 답변만 바꿀 수 있습니다
```

테스트는 17개를 더했다(전체 695개 통과). `priceOffer` 7 · `chatMessageList` 6 ·
`chatErrorMessage` 4. 그중 하나는 **취소가 도는 동안 상대의 수락 버튼은 잠기지 않는지**를 본다 —
누르는 사람이 다른 두 버튼을 한 플래그로 묶으면 안 되는 자리다.

### 이번 범위 밖

- **취소 알림** — 보내지 않는다. 0015·0018이 "알림은 그때 알려 주는 것이라 되돌릴 값이 아니다"로
  정한 결과 그대로다. 상대가 방에 들어와 있으면 Realtime이 말풍선을 갈아 끼운다.
- **취소 이유 남기기** — 차단 사유를 두지 않은 것과 같다. 무르는 데 설명이 필요하면 대화로 한다.
- **판매자가 제안을 먼저 물리기** — 제안은 사는 쪽만 건다(`canSendPriceOffer`). 방향이 하나라
  물리는 쪽도 하나다.
- **여러 제안 히스토리 화면** (4단계) — 여전히 대화 흐름 안의 말풍선으로 충분하다고 본다.
  취소가 생기면서 "몇 번 부르고 몇 번 물렸나"가 오히려 대화에 그대로 남는다.

## §4의 자잘한 것 둘 — 끌올 시간 실시간 갱신 · 글쓰기 FAB (2026-08-06)

`backlog.md` §4에서 **판단이 끝나 손만 대면 되는** 것 둘을 집었다. 마이그레이션이 없다.

### 멈춰 있던 "지금"

상대 시각을 적는 화면들이 전부 렌더 순간의 `new Date()`를 기준으로 삼고 있었다.

```ts
// 카드마다 new Date()를 부르면 같은 목록에서 기준 시각이 어긋난다.
const now = new Date();
```

주석이 말하는 문제(카드마다 다른 기준)는 맞게 풀었지만, **그 값이 그대로 멈춰 있다**는 것은
다루지 않았다. 목록을 열어 두고 10분을 보고 있어도 계속 "3분 전"이라고 적힌다.

**끌올 버튼은 더 나쁘다.** `postOwnerMenu`가 메뉴를 여는 순간의 시각으로 남은 시간을 재는데,
그 자리에서 24시간이 되어도 버튼이 잠긴 채로 남는다. backlog가 "어긋나야 몇 분이고 서버가
한 번 더 보므로 급하지 않다"고 적어 둔 것은 맞지만, 고치는 값은 한 줄이었다.

`shared/hooks/useNow`가 1분마다 흐른다. **1분인 이유는 문구가 분 단위까지만 적기 때문**이다 —
`toBumpRemainingText`가 "초까지 적으면 화면을 다시 그리지 않는 한 곧바로 거짓말이 된다"고
적어 둔 그 규칙을, 이번에는 반대 방향으로 읽었다. 더 자주 흐르게 하면 바뀌는 것 없이 목록만
다시 그린다.

세 곳이 이 훅을 쓴다 — `PostList`(홈·검색), `myPostList`(마이페이지 넷), `postOwnerMenu`(상세).

### 글쓰기 FAB

탭바 가운데를 원으로 띄웠다. 다섯 중 글쓰기만 **하러 오는** 자리이고 나머지 넷은 **보러 오는**
자리라, 같은 크기로 늘어놓으면 이 앱에서 무엇을 할 수 있는지가 드러나지 않는다.

**어느 탭인지를 배열 가운데로 계산하지 않고 값(`isPrimary`)으로 적었다.** 계산하면 자리를
하나 더하거나 순서를 바꿀 때 엉뚱한 탭이 떠오른다. 대신 "값이 실제로 가운데인가"를 테스트가 본다.

모양만 바꾸고 하는 일은 그대로 링크다. 아이콘을 `aria-hidden`으로 감췄으므로 **라벨을 지우면
이름 없는 링크가 된다** — 그래서 라벨을 남겼고, 테스트가 이름으로 찾는다.

**딸려 나온 수정**: `AppLayout`의 아래 여백이 `pb-16`이었다. 원이 탭바 위로 24px 올라오므로
탭바 높이만으로는 모자라, 마지막 줄이 원 밑으로 들어가 눌리지 않는다. `pb-24`로 넓혔다.

### 확인

테스트 9개를 더했다(전체 704개 통과). `useNow` 5 · `appTabs` 2 · `appTabBar` 2.
`useNow`의 다섯 중 둘은 **틀리기 쉬운 자리**다 — 1분이 안 됐을 때 흐르지 않는지,
화면을 떠난 뒤 타이머가 남지 않는지(`jest.getTimerCount()`).

**FAB의 생김새는 눈으로 보지 못했다.** 빌드·라우트까지는 확인했지만 원이 탭바 위로 얼마나
올라오는지, `ring`이 다크모드에서 자연스러운지는 화면을 봐야 안다.

### 이번 범위 밖

- **채팅방·상세 헤더 통일** (§4) — 같은 "자잘한 것" 칸에 있지만 성격이 다르다. 탭바 밖 화면
  여덟 곳(상세·채팅방·설정 넷·후기·프로필)의 되돌아가는 링크가 제각각(`← 홈으로`·`←`·`← 홈`)인데,
  통일하려면 공용 헤더 컴포넌트를 만들고 여덟 곳을 갈아 끼워야 한다. **덩어리가 하나 더 큰 일**이라
  따로 뺐다.
- **`useNow`를 채팅에도 쓰기** — 말풍선 시각은 절대 시각("오후 3:12")이라 흐를 필요가 없다.
  채팅방 목록의 "3분 전"은 대상이 되지만, 그쪽은 Realtime이 이미 자주 다시 그린다.

## 게시물 카드의 댓글 수 (2026-08-06)

`backlog.md` §4. 0017이 댓글을, 대댓글이 답글을 붙였지만 **목록에서는 그 사실이 전혀 보이지
않았다** — 상세로 들어가야만 댓글이 달렸는지 알 수 있었다.

### 이 일의 크기는 컬럼이 아니라 반복이었다

착수 전에 backlog가 "`like_count`처럼 열을 두고 트리거로 세면 된다"고 적어 둔 것은 맞다.
컬럼·트리거·백필은 0005를 그대로 베끼면 되는 쉬운 쪽이었다.

**진짜 크기는 목록 RPC가 여섯이라는 것이었다.** `PostCard`를 홈·검색과 마이페이지가 함께
쓰는데("같은 게시물이 화면마다 다르게 보일 이유가 없다"고 그 컴포넌트가 적어 두었다),
한 곳만 고치면 **마이페이지 카드만 늘 "댓글 0"으로 거짓말을 한다.**

```
search_posts · fetch_liked_posts · fetch_purchased_posts
fetch_recently_viewed_posts · fetch_selling_posts · fetch_user_posts
```

전부 `returns table`이라 반환 모양이 바뀌면 `create or replace`가 통하지 않는다 —
하나하나 `drop` 후 다시 만들어야 한다(0024에서 겪은 자리다). 조건·정렬·커서는 한 줄도 안
고쳤고 칸 하나만 늘렸는데도 마이그레이션이 300줄이 넘는다.

**여섯이 같은 요약 모양을 베껴 쓰고 있다는 것 자체가 부채다.** 이번에 합치지는 않았다 —
공통 모양을 뷰나 타입으로 빼는 일은 여섯을 한꺼번에 다시 짜는 일이라 이 PR과 섞이면
"칸 하나 늘렸다"를 검토할 수 없게 된다. 다음에 이 모양을 또 건드릴 일이 생기면 그때가 신호다.

### 0020 덕분에 안 해도 됐던 일

`posts_set_updated_at`을 건드리지 않았다. 0020이 그 트리거를 **제외 목록에서 포함 목록으로
뒤집어** 두었기 때문이다.

제외 목록이었다면 여기에 `comment_count`를 더해 주지 않는 순간 **댓글이 달릴 때마다
"수정됨"이 뜬다** — 판매자는 글을 고친 적이 없는데. 그때 적어 둔 "앞으로 칸이 늘어도
기본값이 수정 아님"이 이번에 실제로 값을 했다. 실제로 밟아 확인했다(댓글을 달고 `updated_at`
불변).

### 대댓글도 함께 센다

카드에 적히는 "댓글 3"은 그 글에 달린 **말의 개수**이지 1단만 센 값이 아니다. 화면에서도
답글은 부모 밑에 붙어 한 덩어리로 읽힌다.

덕분에 삭제 쪽이 재미있어졌다 — 부모를 지우면 답글이 cascade로 함께 사라지는데,
트리거가 행마다 돌아 **한 번에 3이 줄어든다.** 세어 보니 맞았다.

### 0인 것은 빼고 적는다 (바꾼 것 하나)

지금까지 카드는 `찜 {n} · 조회 {n}`을 통째로 적었다. 둘뿐일 때는 "찜 0 · 조회 3"도 견딜 만했지만
댓글이 붙어 셋이 되면서 **없는 것이 있는 것보다 길어진다** — "찜 0 · 조회 3 · 댓글 0".

`toPostCountsText`가 0인 것을 빼고 이어 붙인다. 순서는 찜 · 조회 · 댓글로, 앞의 둘은 지금까지의
자리를 그대로 두고 새것을 뒤에 붙였다 — 익숙한 자리가 움직이면 같은 카드가 달라 보인다.

### 확인

트리거는 롤백 트랜잭션 안에서 다섯 단계를 밟았다. `comment_count`와 `count(*)`를 매번 나란히 쟀다.

```
갓 만든 글                  0 / 0
1단 2 + 답글 2              4 / 4
1단 하나 삭제               3 / 3
부모 삭제(답글 2 cascade)   0 / 0   ← 한 번에 3이 준다
글 삭제(댓글 cascade)       오류 없이 통과
```

마지막 줄이 중요하다. 글을 지우면 댓글이 cascade되며 트리거가 **사라지는 중인 글**을
갱신하려 든다. 0행을 고치고 끝나므로 문제가 없지만, 확인하지 않으면 알 수 없는 자리다(찜도 같다).

RPC 여섯은 반환 모양에 `comment_count`가 들어갔는지와 **오버로드가 하나씩만 남았는지**를
함께 봤다 — 옛 시그니처가 남으면 PostgREST가 PGRST203으로 거절한다.

테스트는 4개를 더했다(전체 708개 통과). `postCardCounts` 넷 중 하나는 **가운데가 빌 때**를 본다
("찜 1 ·  · 댓글 3"처럼 구분점이 남으면 안 된다).

### 이번 범위 밖

- **댓글 수로 정렬하기** — 인덱스를 두지 않았다. 정렬 기준에 없어서다(§5-3에서 인기순을
  미룬 것과 함께 볼 자리다 — 그때 조회·찜·댓글을 섞는다면 이 칸이 재료가 된다).
- **여섯 RPC의 공통 요약 모양 합치기** — 위 참고.
- **상세 화면의 댓글 수** — 이미 댓글 목록이 통째로 보이므로 숫자를 따로 적을 이유가 없다.
- **"댓글 99+"로 줄이기** — 채팅 배지와 달리 카드의 곁가지라 자리가 넉넉하다.
  실제로 세 자리가 되는 글이 생기면 그때 본다.

## 탭바 밖 화면의 헤더 통일 (2026-08-06)

`backlog.md` §4. 1단계 때 "탭바 밖 화면들은 손대지 않았다. 시각적 부채"로 적어 두고
여기까지 온 항목이다. **판단이 끝나 손만 대면 되는 것 중 마지막 큰 덩어리**였다.

### 무엇이 흩어져 있었나

탭바가 없는 화면은 뒤로가기 하나로 나가야 한다. 그 링크가 **열 곳**에 있었고 모양이 제각각이었다.

```
←                    채팅방
← 홈으로              게시물 상세 · 남의 프로필 · 동네 설정
← 마이페이지           계정 설정 · 알림 설정 · 프로필 수정 · 마이페이지 하위 목록 넷
← 게시물로 돌아가기     글 수정
← 거래한 물건          후기 쓰기
```

색·크기·hover까지 각자 적고 있어서 **한 곳을 고치면 나머지 아홉이 어긋난다.**
줄바꿈 위치까지 달라서 같은 클래스 문자열이 두 가지 모양으로 존재했다.

### 두 갈래인 줄 알았는데 한 틀로 덮였다

구조를 세어 보니 둘이었다.

- **세로형**(6): 돌아가는 링크 **아래**에 제목 — 설정 넷 · 글 수정 · 마이페이지 목록
- **가로형**(2): 돌아가는 링크와 메뉴가 **한 줄** — 게시물 상세 · 남의 프로필

억지로 합칠 필요가 없었다. `PageHeader`가 **첫 줄(링크 + 선택적 action)** 과
**그 아래(선택적 제목 · 설명)** 를 그리면 둘 다 지금과 똑같이 나온다 —
세로형은 `action`이 없어 첫 줄에 링크만 남고, 가로형은 `title`이 없어 아래가 빈다.

**틀을 맞추려고 생김새를 바꾸지는 않았다.** 통일한 것은 코드이지 화면이 아니다.

### 채팅방만 뺐다

거기 헤더는 한 줄에 **아바타 · 상대 이름 · 신고 메뉴**가 함께 있어 "링크와 action" 두 칸으로
나뉘지 않는다. 억지로 맞추면 `PageHeader`가 채팅방 전용 인자(아바타·이름)를 이고 다니게 된다.

그래서 **컴포넌트를 둘로 나눴다** — `BackLink`(링크 하나)와 그것을 쓰는 `PageHeader`.
채팅방은 `BackLink`만 가져다 쓴다. 열 곳 모두 같은 링크를 쓰되, 그 위의 틀은 맞는 곳만 쓴다.

### 파 보니 나온 것 — 이름 없는 링크

채팅방의 뒤로가기는 `←` **한 글자뿐이었다.** 스크린리더에는 "왼쪽 화살표 링크"로 읽힌다 —
어디로 가는 링크인지 알 수 없다.

`BackLink`가 `isLabelHidden`을 받는다. 글자는 감추되 이름은 `aria-label`로 남긴다("채팅 목록").
반대로 감추지 않을 때는 `aria-label`을 **붙이지 않는다** — 글자가 이미 이름이고, 겹쳐 두면
둘이 어긋날 때 화면과 다르게 읽힌다. 테스트가 양쪽을 다 본다.

화살표에는 `aria-hidden`을 걸었다. 안 그러면 "왼쪽 화살표 마이페이지"로 읽힌다.

### 목적지는 통일하지 않았다

화면마다 돌아갈 곳이 **실제로 다르다** — 설정은 마이페이지로, 상세는 홈으로, 후기는 그 거래의
게시물로. 같게 만드는 것은 통일이 아니라 기능 변경이다. 동네 설정이 `/my`가 아니라 `/`로
돌아가는 것도 그대로 뒀다(홈 헤더의 동네 링크에서도 오는 자리다).

**말하는 방식만 손봤다.** `← 게시물로 돌아가기` → `← 게시물` — "돌아가기"는 화살표가 이미
하는 말이고, 나머지 아홉은 전부 목적지 이름만 적고 있었다.

### 확인

테스트 9개를 더했다(전체 717개 통과). `backLink` 4 · `pageHeader` 5.
그중 셋은 **보조기기에 어떻게 읽히는가**를 본다 — 화살표가 읽히지 않는지, 감춰도 이름이
남는지, 감추지 않을 때 `aria-label`이 겹치지 않는지.

바꾼 열 곳의 기존 테스트가 그대로 통과한다(마이페이지 목록·알림 설정·상세 등). 이름으로
링크를 찾는 테스트들이라, 라벨을 잘못 옮겼으면 여기서 깨졌을 것이다.

`grep`으로 `←`를 직접 적은 곳이 하나도 남지 않은 것도 확인했다.

### 이번 범위 밖

- **채팅방 헤더를 틀로 만들기** — 위 참고. 지금은 그 화면 하나뿐이라 틀이 될 이유가 없다.
- **탭바 안 화면의 제목** — 홈·검색·채팅·마이페이지는 뒤로가기가 없어 이 컴포넌트의 대상이
  아니다. 제목 스타일까지 합치려면 `PageHeader`에서 링크를 뺄 수 있게 해야 하는데,
  그러면 "돌아가는 길"이라는 이 컴포넌트의 뜻이 흐려진다.
- **브라우저 뒤로가기와 맞추기** — 이 링크는 **주소가 정해진 길**이라 히스토리와 다르다.
  검색에서 상세로 들어와 `← 홈`을 누르면 검색으로 돌아가지 않는다. 그것이 지금까지의
  동작이고 이번에 바꾸지 않았다.

## 메시지 삭제 · 채팅방 나가기 (2026-08-06)

`backlog.md` §4. 3단계 때 "아직 어디에도 없다"로 미뤄 둔 항목이고, 거기 적어 둔 대로
**나가기는 실제로 `chat_rooms`에 칸이 붙었다.** 다만 §5로 넘어가지는 않았다 —
정할 것이 하나씩뿐이었다.

마이그레이션 둘. `0029_message_delete.sql` · `0030_chat_room_leave.sql`.

### 정한 것 둘

**메시지 삭제는 소프트 삭제다.** `deleted_at`을 찍고 `content`를 비운다. 행은 남는다.

0008이 `content` 변경을 통째로 막은 이유("대화 기록이 사후에 바뀌면 채팅을 신뢰할 수
없다")는 지금도 옳다. 그때 막은 것은 **상대가 보낸 말을 고치는 일**이었고, 여기서 여는 것은
**잘못 보낸 내 말을 무르는 일**이다. 0027이 제안 취소를 "없던 일"이 아니라 "취소했다는
기록"으로 남긴 것과 같은 결이다.

하드 삭제였다면 붙었을 것이 셋이다.

```
방 요약(chat_rooms.last_message)이 없는 메시지를 가리킨다
알림 payload의 message_id가 뜬다
Realtime DELETE를 받는 캐시 경로가 새로 하나 생긴다
```

소프트 삭제라 셋 다 없었다. 상대 화면에는 **UPDATE로 도착**해 `withUpdatedMessage`가
있던 자리를 그대로 갈아 끼운다 — 읽음 표시·제안 답변이 쓰던 길이다.

**나가기는 목록에서만 감춘다.** 대화도 방도 지우지 않고 상대 화면은 그대로다.
상대가 다시 말을 걸면 돌아온다. 안 돌아오게 하려면 나간 사람에게 메시지가 닿지 않아야
하는데 그것은 나가기가 아니라 **차단(0014)이 하는 일**이고, 둘이 같아지면 차단이 가벼워진다.

### 삭제하지 못하는 것 하나 — 가격 제안

`canDeleteMessage`가 `type !== 'price_offer'`를 본다. 그 자리는 0027의 취소가 이미 맡고
있다. 열어 두면 **수락된 제안을 지워 합의를 없앨 수 있고**, 그것은 0027이 `accepted`를
잠근 이유와 같다. `pending`만 골라 열 수도 있지만 그러면 같은 말풍선에 뜻이 같은 버튼이
둘이 된다.

`isDeletedMessage`가 `content`가 아니라 `deleted_at`을 보는 것도 여기서 나온다 —
제안은 원래 `content`가 비어 있어서(금액은 다른 칸), `content`로 판단하면 답변 대기 중인
제안이 지운 말로 보인다.

### 밟아 보고 안 것 — `with check` 없는 update 정책은 자기를 막는다

**이번에 가장 값이 나간 자리다.** 정책을 이렇게 적었다.

```sql
using ( 방 참여자 and (auth.uid() <> sender_id or deleted_at is null) )
```

"지운 메시지는 발신자에게 다시 열리지 않는다"를 정책에도 박으려던 것이었다.
그런데 삭제 자체가 실패했다.

```
update messages set deleted_at = now() …
  → new row violates row-level security policy for table "messages"
```

**update 정책에 `with check`가 없으면 Postgres는 `using` 식을 새 행에도 그대로 쓴다.**
0008·0027은 그래도 됐다 — 그 식이 보는 칸(`sender_id`·`type`)을 아무도 바꾸지 않으니
새 행에서도 언제나 참이었다. 여기서는 식이 `deleted_at`을 보고, 지우는 순간 그 값이
null이 아니게 되므로 **삭제가 자기 정책에 걸린다.**

`with check`를 "방 참여자인가" 하나로 따로 적어 갈랐다. `using`은 옛 행에서 "누가 손댈 수
있는가", `with check`는 새 행에서 "결과가 여전히 내 방의 행인가", 어느 칸이 어떻게 바뀌었는지는
여전히 트리거다. 이 저장소에서 update 정책에 `with check`가 붙는 것은 0008의
`posts_update`에 이어 두 번째다.

### 값은 서버가 정한다

트리거가 `deleted_at`을 `now()`로 덮고 `content`를 직접 비운다. 클라이언트가 보낸 값은
자리를 채우는 뜻뿐이다. 비우는 일을 클라이언트에 맡기면 **"지웠는데 내용이 남은 행"**이
생길 수 있고, 그 행은 밖에서 보면 지워진 것처럼 보여 아무도 눈치채지 못한다.

### 방 요약도 따라가야 했다

`chat_rooms.last_message`는 `on_message_insert`가 **보낼 때** 적어 둔 값이다.
마지막 메시지를 지우면 채팅 목록에는 지운 문장이 그대로 남는다 — 방에 들어가야만 사라지는
셈이라 지운 사람에게는 지워지지 않은 것과 같다.

`messages_after_soft_delete` 트리거가 **마지막 메시지일 때만** 요약을 고친다. 판단 기준은
`(created_at, id)`다(0011이 목록에 쓴 그 이유 — 같은 시각 두 건이면 시각만으로는 못 정한다).
`last_message_at`은 그대로 둔다. 함께 옮기면 목록에서 방의 자리가 흔들리는데,
지운 것은 내용이지 "그때 대화가 있었다"는 사실이 아니다.

두 경우를 실제로 밟아 확인했다.

```
마지막 메시지를 지움  →  목록 요약 = 지운 메시지입니다
중간 메시지를 지움    →  목록 요약 = 뒤엣말      (손대지 않는다)
```

### 안 읽은 수에서도 뺐다

지운 줄을 배지가 세면, 방에 들어가 "지운 메시지입니다"만 보고 나오게 된다.
서버(`fetch_chat_rooms`)와 화면(`countUnreadFromPartner`) 양쪽에 같은 조건을 넣었다.
한쪽만 넣으면 배지 숫자와 읽음 처리 방아쇠가 어긋나 **방에 들어갈 때마다 요청이 한 번씩
더 나간다.** `markRoomRead`(쓰는 쪽)는 손대지 않았다 — 지운 줄까지 읽음으로 찍어도
세지 않으므로 결과가 같고, 조건을 하나 더 다는 만큼 어긋날 자리가 는다.

### 나가기 — 조건 한 줄이 되돌아오는 일까지 했다

```sql
and (
  p_include_left
  or 내_left_at is null
  or coalesce(r.last_message_at, r.created_at) > 내_left_at
)
```

되살리는 트리거를 따로 두면 "메시지가 들어올 때 상대의 `left_at`을 지운다"를
`on_message_insert`에 얹게 되는데, 그 함수는 이미 요약·알림 둘을 하고 있고 셋째 일이
붙을 이유가 없다.

**칸 둘이지 테이블이 아니다.** 참여자가 정확히 둘로 고정된 테이블이라(`unique (post_id,
buyer_id)`), `chat_room_hidden` 같은 테이블을 두면 조인만 늘고 늘어난 자유도("셋째 사람이
나갔다")는 표현할 데가 없다. 0022가 알림 설정에서 jsonb 한 칸 대신 칸 셋을 고른 것과 같다.

**정책 대신 함수로 문을 냈다.** `chat_rooms`에는 update 정책이 아예 없다(0001에 select ·
insert만). 여기서 정책을 열면 `last_message`까지 함께 열려 "무엇을"을 지킬 트리거가 하나
더 필요해진다. `leave_chat_room`을 `security definer`로 두면 그 짐이 없다 — 대신
"내가 이 방 사람인가"를 함수가 직접 확인한다. 0008의 `open_chat_room`이 **definer가 아닌**
것과 반대 방향인데, 그쪽은 insert 정책이 이미 규칙을 들고 있어 그것을 그대로 태워야 했다.

### 인자로 갈랐다 — `fetch_chat_rooms(p_include_left)`

나간 방도 **주소로는 열려야 한다.** 나가기는 목록에서 치우는 일이라고 정했고, 실제로
열려야 하는 자리도 있다 — 나간 뒤 게시물 상세에서 "채팅하기"를 누르면 `open_chat_room`이
있던 방 id를 그대로 돌려주는데, 여기서 걸러 버리면 그 길이 "채팅방을 찾을 수 없습니다"로
끝난다.

함수를 둘로 쪼개는 대신 인자를 하나 붙였다(0024가 반경 검색에서 한 것과 같은 이유).
쪼개면 여기 쌓인 규칙 — 차단(0014) · 안 읽은 수(0029) · 상대 고르기(0008) — 을 두 벌
유지하게 된다. 다만 **기본값을 더하는 것만으로는 안 됐다**: 0인자 함수가 남아 있으면 호출이
모호해져 드롭하고 다시 만들어야 했다(`fetch_chat_room`이 매달려 있어 함께).

차단은 이 인자에 걸리지 않는다. 그쪽은 주소로도 안 열려야 하는 것이 0014의 결정이다.

### ⋯ 메뉴에 슬롯 하나

채팅방 헤더는 한 줄에 아바타·이름·⋯가 이미 차 있어 **⋯를 둘 놓을 자리가 없다.**
`SafetyMenu`에 `extraItems`를 받는 자리를 냈고 나가기가 거기 붙는다. 신고·차단과 결이
다르지만 셋 다 "이 대화를 어떻게 할까"를 정하는 자리라 찾는 곳이 같다.
메뉴 한 줄의 생김새는 `SAFETY_MENU_ITEM_CLASS`로 내보내 밖에서도 같은 모양을 쓴다.

나가기 확인 문구는 **되돌릴 수 없어서가 아니라 안내할 것이 있어서** 둔다 —
"대화는 지워지지 않고 상대에게는 그대로 보여요. 상대가 다시 말을 걸면 목록에 돌아와요."
안 적으면 나가기를 차단 대신 쓰게 된다.

### 확인

서버 규칙을 실제 데이터로 밟았다(시나리오마다 메시지를 새로 심는다 — `troble.md`의
"롤백 테스트가 '통과'라고 거짓말한다"에서 배운 대로다).

```
보낸쪽이 자기 글을 지움          통과 (content=NULL, 지운시각 찍힘)
보낸쪽이 자기 사진을 지움        통과
받은쪽이 남의 글을 지움          거절: 내가 보낸 메시지만 지울 수 있습니다
이미 지운 것을 또 지움           정책이 막음(0행)
지운 것을 되돌림(보낸쪽)         정책이 막음(0행)
지운 것을 되돌림(받은쪽)         거절: 지운 메시지는 되돌릴 수 없습니다
가격 제안을 지움                 거절: 가격 제안은 지울 수 없습니다
보낸쪽이 내용을 고침             거절: 메시지는 읽음 표시와 제안 답변, 삭제만…
받은쪽이 남의 내용을 고침        거절: 같은 문구
```

나가기도 같은 방식으로 밟았다 — 나가기 전 1건 → 나간 뒤 0건 → 주소로는 열림 →
상대 목록에는 그대로 → 상대가 말을 건 뒤 다시 1건 → 남의 방 나가기는 거절.
밟은 뒤 심은 행을 모두 걷어내고 방 상태를 원래대로 되돌렸다.

테스트 16개를 더했다(전체 733개 통과). `messageDelete` 7 · `chatMessageList` 5 ·
`chatErrorMessage` 3 · `useMarkRoomRead` 1.

`chatErrorMessage`의 패턴을 **0027이 겪은 자리에서 또 고쳤다.** 서버 문구가
`읽음 표시만` → `읽음 표시와 제안 답변만` → `…, 삭제만`으로 두 번 늘었는데, 문장 끝을 잡는
패턴은 늘 때마다 조용히 어긋난다(오류가 아니라 기본 문구로 떨어져 눈에 안 띈다).
이번에는 **앞부분만** 잡게 바꾸고 두 문구를 모두 넣은 테스트를 붙였다.

**화면은 아직 눈으로 못 봤다.** 서버 규칙과 테스트까지다.

### 이번 범위 밖

- **채팅 목록에서 바로 나가기** — 지금은 방에 들어가야 나갈 수 있다. 당근은 목록에서 길게
  눌러 나간다. 목록 줄에 메뉴를 다는 일이라 방 안의 ⋯와 항목이 갈릴 소지가 있다.
- **모두 지우기 · 대화 내용 지우기** — 방 하나의 내 말을 통째로 지우는 것. 확인 절차가
  따라오고, 한 번에 수십 건이 트리거를 도는 자리라 statement 트리거를 다시 봐야 한다.
- **지운 메시지 되살리기** — 열지 않는다. `content`를 비운 뒤라 돌려놓을 값이 없다.
  **재검토 대상 아님.**
- **나간 방을 상대도 모르게 하기** — 지금은 상대 화면이 그대로다(그것이 결정이다).
  "나갔습니다" 같은 시스템 메시지를 넣을 수도 있으나, 그러면 나가기가 상대에게 통보하는
  행위가 되어 차단과 무게가 비슷해진다.
- **나간 방을 다시 들어갈 때의 안내** — 주소로 열면 그냥 열린다. "나갔던 방입니다" 같은
  표시는 없다. 목록에서 감춘 것뿐이라 알릴 일이 아니라고 봤다.

## 양쪽이 다 나간 방은 지운다 (2026-08-06)

`0031_chat_room_purge.sql`. 바로 앞 절(0030)의 이어지는 결정이다.

### 왜 이제는 지워도 되나

0030이 나가기를 "목록에서만 감추는 일"로 만든 이유는 **상대가 아직 보고 있기 때문**이었다.
둘 다 나간 방은 그 이유가 사라진다 — 아무도 볼 수 없는 행과 사진이 남아 있을 뿐이라
지워도 잃는 사람이 없고, **사용자가 결정할 것도 없어서 버튼을 만들 필요가 없다.**

사용자가 누르는 "채팅방 삭제"는 만들지 않았다. 한쪽이 누르면 상대의 기록까지 사라져
0008이 그은 선을 정면으로 넘고, 방금 만든 소프트 삭제·나가기가 그 선을 지키려고 고른
모양이라 앞뒤가 안 맞게 된다.

### "둘 다 나갔다"는 시각 둘이 찍혔다는 뜻이 아니다

0030에서 방은 **나간 뒤에 말이 오면 돌아온다.** 돌아와 있는 방을 지우면 보고 있는 사람의
화면에서 대화가 사라진다. 그래서 조건이 하나 더 붙는다.

```
양쪽 left_at이 모두 있고
마지막 말이 둘 중 먼저 나간 시각보다 앞설 때
```

0030의 "목록에 보인다" 조건의 정확한 반대다. 그래서 한 군데
(`private.is_chat_room_purgeable`)에 적고 셋이 나눠 쓴다 — 나가기 · 지우기 · 사진 정리.
갈리면 "지울 수 있다고 해 놓고 안 지워지는" 상태가 생긴다(0025가 지도와 목록의 WHERE를
합친 것과 같은 이유).

### 지우지 않는 방 하나 — 거래 상대로 걸려 있는 방

**착수 전에 실제로 밟아 보고 알았다.** 방을 지우면 이런 일이 벌어진다.

```
예약중이던 글을 판매자가 수정  →  new row violates row-level security policy for table "posts"
```

0008의 `posts_update`가 `with check`로 "거래 상대는 채팅을 건 사람 중에서만"을 지키는데,
그 판단의 **유일한 근거가 `chat_rooms` 행**이다. 지워 버리면 근거가 사라져 예약중인 글의
판매자가 제목조차 못 고친다.

지금은 닿을 수 없는 구멍이다 — 회원탈퇴로 방이 사라질 때는 `posts.buyer_id`가
`on delete set null`로 함께 비워져서 안 걸린다. **방 삭제를 여는 순간 열린다.**

두 갈래가 있었다.

1. 정책의 판정을 "`buyer_id`가 **바뀔 때만** 확인하는" 트리거로 옮긴다 — 규칙의 뜻
   ("고를 때 지킨다")에 더 가깝다. 다만 핵심 정책을 건드린다.
2. **그런 방은 지우지 않는다** — 좁고, 이번 일에 필요한 만큼만이다.

2를 골랐다. 거래가 걸려 있는 방이 남는 것은 손해가 아니다(어차피 양쪽 목록에 없다).
1은 §"이번 범위 밖"에 적어 뒀다.

### 알림에는 cascade가 없다

`payload`가 jsonb라 FK가 걸릴 자리가 없다. 방이 사라지면 **눌러도 갈 곳이 없는 알림**이
남는다 — 밟아서 1건 남는 것을 확인했다. 0015가 차단에서 같은 자리를 같은 방식으로 치웠다
(목록에서 거르는 대신 그 순간 지운다). 여기서는 거를 방법조차 없다.

**같은 구멍이 게시물 삭제 쪽에도 있다.** 글을 지우면 방·메시지는 cascade로 사라지는데
알림은 남는다(실험 뒷정리 중에 그대로 재현됐다). 이번 범위 밖으로 적어 뒀다.

### 사진은 DB가 못 지운다 — 그래서 순서가 규칙이 됐다

`storage.objects` 행을 지워도 실제 파일은 남는다. `delete-account` Edge Function이 같은
이유로 같은 모양의 코드를 이미 갖고 있다.

그래서 **파일 먼저, 행 나중**이다.

```
leave_chat_room   나가기 + "이제 지울 수 있는가"를 돌려준다
(참이면) 클라이언트가 방 폴더를 비운다
purge_chat_room   알림 정리 + 방 삭제(메시지는 cascade)
```

반대로 하면 방이 사라진 뒤라 `chat_images_select`가 막혀 **목록조차 못 읽는다.**
중간에서 끊기면 방이 남지만, 양쪽에게 안 보이는 상태 그대로라 지금과 같을 뿐이다.

`chat_images_delete`도 한 겹 열었다. 0008에서는 **올린 사람 본인**에게만 열려 있었는데
(메시지 insert 실패 시 보상용), 그대로 두면 **상대가 올린 사진을 아무도 못 지운다.**
지울 수 있는 방의 폴더에 한해서만 연다 — 오가는 중인 방에 열면 대화 도중 상대의 사진을
지울 수 있게 되고, 그건 0008이 `content`를 잠근 이유와 같은 종류의 구멍이다.

### 뒷정리 실패는 실패가 아니다

`useLeaveChatRoomMutation`이 세 걸음을 한 동작으로 묶되, ②③이 실패해도 **성공으로 끝난다.**
사용자가 누른 것은 "나가기"이고 그것은 ①에서 이미 끝났다. 여기서 오류를 올리면 나가졌는데
실패했다고 뜨고 화면도 안 넘어간다. 남는 것은 아무에게도 안 보이는 방 하나뿐이다.

### 확인 문구가 두 갈래를 다 말한다

이 버튼은 결과가 둘인데 누르는 사람은 어느 쪽인지 모른다. 하나만 적으면 한쪽에서
거짓말이 된다.

> 이 채팅방을 목록에서 치울까요? 상대에게는 대화가 그대로 보이고, 상대가 다시 말을 걸면
> 목록에 돌아와요. 다만 **둘 다 나간 방은 대화와 사진이 완전히 지워져요.**

**상대가 나갔는지는 알려 주지 않는다.** 그건 상대의 행동이고, 알려 주지 않아도
"둘 다 나간 방은 지워진다"는 규칙만으로 충분히 정확하다.

### 테스트가 드러낸 것 — 문자열 하나가 기능 전체를 끌고 왔다

`leaveChatRoomButton`이 메뉴 항목의 클래스 문자열을 `safetyMenu.tsx`에서 가져오고 있었다.
컴포넌트 테스트를 붙이자마자 죽었다.

```
leaveChatRoomButton → safetyMenu → blockToggleButton → useBlockMutations → blockApi
                                                                             → supabaseClient
SyntaxError: Cannot use 'import.meta' outside a module
```

문자열 하나 때문에 block 기능 전체와 supabase 클라이언트를 함께 불러온 것이다.
`shared/ui/menuItem.ts`로 올렸다 — **생김새는 기능에 속하지 않는다.**
덤으로 `blockToggleButton`이 따로 들고 있던 같은 문자열도 한 곳으로 모였다(셋이 쓴다).

### 확인

서버 규칙 9가지를 실제 데이터로 밟았다(시나리오마다 글·방·메시지를 새로 심는다).

```
한 명만 나감                    지울 수 있는가 = false
둘 다 나감                      지울 수 있는가 = true  → 지우기 true
   그 뒤 남은 방·메시지·알림     0건 · 0건 · 0건
이미 지운 방을 또 지우기        false (오류 아님 — 두 번 불러도 같은 답)
나간 뒤에 말이 온 방            false (그 사람 목록에 돌아와 있다)
거래 상대로 걸린 방             false (0008의 근거라 남긴다)
남이 남의 방 지우기             거절: 참여 중인 채팅방이 아닙니다
```

밟은 뒤 심은 행을 모두 걷어내고 원래 상태로 되돌렸다.
테스트 5개를 더했다(전체 738개 통과) — 세 걸음의 **순서**를 재는 것 하나가 그중 핵심이다.

**화면은 아직 눈으로 못 봤다.**

### 이번 범위 밖

- **`posts_update`의 판정을 트리거로 옮기기** — 위 참고. "거래 상대는 채팅한 사람 중에서만"은
  `buyer_id`를 **고를 때** 걸어야 할 규칙인데 지금은 글을 고칠 때마다 걸린다. 지금은
  거래가 걸린 방을 안 지우는 것으로 비껴갔다. 열면 그 방들도 지울 수 있게 된다.
- **게시물 삭제 때 알림 정리** — 같은 구멍이 그쪽에도 있다(글을 지우면 방·메시지는 cascade로
  가는데 알림이 남는다). `purge_chat_room`이 하는 일을 `posts` 삭제 트리거에도 붙이면 되지만,
  알림 payload의 갈래를 전부 훑는 일이라 이번 일과 크기가 다르다.
- **게시물 삭제·회원탈퇴 때의 채팅 사진** — 회원탈퇴는 Edge Function이 이미 치운다.
  게시물 삭제는 아무도 안 치운다. 위 항목과 같은 자리에서 함께 볼 일이다.
- **끊긴 뒷정리 다시 시도하기** — ②③ 사이에서 끊기면 방이 남는다. 지금은 아무도 다시
  부르지 않는다(누구에게도 안 보이므로 손해는 없다). 주기적으로 훑는 일은 cron이 붙는 일이라
  이 단계와 무게가 다르다.

## 게시물 삭제의 뒷정리 (2026-08-06)

`0032_post_delete_cleanup.sql`. 0031이 `backlog.md`에 남긴 부채 둘 중 하나다.
**0031을 만들다 실험 뒷정리 중에 재현됐다** — 심어 둔 글을 지웠더니 방과 메시지는 사라졌는데
알림 한 줄이 그대로 남아 있었다.

### 게시물을 지우면 무엇이 따라가나

FK를 세어 보니 여섯이 전부 cascade였다.

```
chat_rooms · comments · likes · post_images · recently_viewed · reviews
```

**후기까지 함께 사라지고 0016의 `reviews_after_delete`가 상대 매너온도를 다시 계산한다.**
여기까지는 이미 맞게 돌아가고 있었다(밟아서 확인했다 — 아래 참고).

**FK가 걸릴 수 없는 것이 둘 남았다.**

```
① 알림       payload가 jsonb라 FK를 걸 자리가 없다
② 채팅 사진   스토리지는 DB 밖이다
```

### 알림 — 0016은 그냥 뒀는데 왜 이번엔 지우나

0016이 "이미 보낸 후기 알림도 지우지 않는다"고 적은 근거는 `fetch_notifications`가 left join이라
대상이 없으면 미리보기만 빈다는 것이었고, 그건 맞다.

**다만 그때와 남는 줄의 모양이 다르다.** 0016의 경우는 후기 행만 사라지고 게시물은 살아 있어서,
payload의 `post_id`로 제목이 붙고 갈 곳(`/users/{나}`)도 있었다. 게시물이 사라지면 조인이 전부 빈다.

```
이름     없다   actor는 message·review를 거쳐 나오는데 둘 다 사라졌다
제목     없다   post가 없다
미리보기 없다
갈 곳    없다   toPostPath·toRoomPath가 null을 준다 → 누를 수 없는 줄
```

즉 **"알 수 없는 이웃님이 메시지를 보냈어요" 한 줄만 남는다.** 정보가 0이고 눌러도 아무 일이 없다.
0031이 방을 지울 때 알림을 함께 지운 것과 같은 판단이다.

조건은 둘이다. payload 모양이 타입마다 달라서다.

```
post_id   후기(0016) · 댓글 · 찜(0018)    payload에 직접 있다
room_id   채팅 · 가격 제안(0008)          방을 거쳐야 게시물에 닿는다
```

**`before delete`여야 한다.** after면 cascade가 이미 방을 걷어간 뒤라 둘째 조건이 아무것도 못 찾는다.
그리고 **RPC가 아니라 트리거다** — 글을 지우는 길이 하나가 아니다. 판매자가 직접 지우는 길 말고도
**회원탈퇴가 그 사람의 글을 전부 지운다**(`posts.seller_id → profiles` cascade).

### 사진 — 순서가 규칙이 됐다(또)

0031이 `chat_images_delete`에 낸 문 둘이 여기엔 **둘 다 안 맞았다.**

```
본인 것만        판매자가 지우는데 사진은 구매자가 올린 것일 수 있다
지울 수 있는 방   게시물이 사라지면 방도 cascade로 사라져 그 판단 자체가 불가능하다
```

그래서 세 번째 문을 냈다 — **방이 더는 없는 폴더.** 넓어 보이지만 넓지 않다.
`chat_images_select`가 방 행을 요구하므로 그런 폴더의 파일은 **이미 아무도 읽을 수 없다.**
열어 주는 것이 쓰레기를 치울 권한뿐이라 잃을 것이 없고, 살아 있는 방에는 절대 열리지 않는다.
덤으로 0031의 세 걸음이 중간에 끊겨 남은 폴더와 그전부터 쌓인 옛 고아 파일도 이제 치울 수 있다.

클라이언트 순서는 **모으기 → 글 삭제 → 치우기**다. 0031과 반대인데 이유도 반대다.

```
0031  방이 살아 있어야 지울 수 있다   →  파일 먼저, 행 나중
0032  방이 사라져야 지울 수 있다      →  행 먼저, 파일 나중
```

목록은 어느 쪽이든 방이 살아 있을 때만 읽을 수 있어서, 0032는 **모으는 일만 앞으로 당겼다.**
`deletePost`가 게시물 사진에 이미 쓰던 모양(주소 먼저 챙기고 나중에 치우기)과 같다.
`fetchPostChatPartners`(0008)가 방 번호와 구매자 id를 함께 주므로 후보를 따로 만들 필요가 없었다.

### 확인 문구에 후기를 더했다 — 그리고 "내려간다"는 틀렸다

지금까지 "이 글의 채팅과 찜도 함께 사라집니다"였는데 **거래후기가 빠져 있었다.**
사라지는 것 중 **유일하게 이 글 밖에 자국을 남기는 것**이라, 빠뜨리면 판매자는 상대의 매너온도가
움직인다는 것을 모른 채 누른다.

처음에 "매너온도가 내려갑니다"라고 적었다가 밟아 보고 고쳤다.

```
① 판매자 온도 처음      36.5
② 좋은 후기(+0.5) 뒤    37.0
③ 글을 지운 뒤          36.5   되돌아갔다
④ 나쁜 후기(−0.5) 뒤    36.0
⑤ 글을 지운 뒤          36.5   ← 이 경우엔 **올라간다**
```

방향이 후기에 달렸다. 0016이 증감을 누적하지 않고 **남은 후기 합계로 다시 계산**하기 때문이다
(그때 greatest/least 때문에 그렇게 만들었다). 그래서 "되돌아갑니다"로 적었다 — 양쪽 다 맞는 말이다.

### 확인

```
글 하나에 딸린 알림 4건(채팅·가격 제안·댓글·찜) → 글을 지운 뒤 0건
방·댓글·찜                                     → 0건 (cascade)
매너온도                                        → 후기가 사라진 만큼 되돌아감(양방향 확인)
경로 판정: `9/…`(살아 있는 방) 지울 수 없음 · `99999/…`(없는 방) 지울 수 있음
```

밟은 뒤 심은 행을 모두 걷어내고 원래 상태로 되돌렸다(게시물 28 · 방 1 · 알림 2 · 온도 36.5).
전체 738개 통과.

**실제 채팅 사진으로는 못 밟았다** — 버킷이 비어 있어 지울 파일이 하나도 없다. 정책 판정식만
값을 넣어 확인했다.

### 이번 범위 밖

- **회원탈퇴 때의 채팅 사진** — `delete-account` Edge Function이 이미 방 단위로 치운다.
  다만 그건 **탈퇴하는 사람의 폴더만** 훑는다(상대 사진은 남는다). 이제 방이 사라진 폴더는
  누구나 치울 수 있으니 그쪽도 한 겹 넓힐 수 있는데, Edge Function 배포가 따라오는 일이라 나눴다.
- **옛 고아 파일 청소** — 지금은 "방 번호를 아는 사람이 지나가면 그때" 정리된다.
  한 번에 훑으려면 관리자 도구나 cron이 붙는다.
- **댓글 알림의 `comment_id`** — 지금은 `post_id`로 함께 걸려 지워진다. 댓글 하나만 지울 때는
  알림이 남는데, 그건 게시물이 살아 있어 제목과 갈 곳이 있는 줄이라 0016과 같은 취급이다.

## 비밀 댓글 (2026-08-07)

`backlog.md` §5-9 구현. `feature.md`에는 없는 기능이다 — 명세 대비 남은 구멍은 카카오
로그인 하나뿐이고(§1-2, 콘솔 준비가 사람 손을 탄다), 이건 "당근에는 있다"에서 온 항목이다.

§5-9가 적어 둔 문장이 이 절의 전부다 — **"정책 한 줄이 아니라 '누구에게 보이는가'가
하나 더 생기는 일이다."**

### 무엇을 만들었나

1. **`comments.is_secret`** — 칸 하나. `not null default false`.
2. **`comments_select`에 축 하나** — 0017의 차단 조건을 그대로 두고 공개 범위를 `and`로 얹었다.
3. **`private.comment_thread_author`** — 이 댓글이 속한 실타래를 연 사람. definer.
4. **`inherit_comment_secret`** — before insert. 답글의 공개 범위를 부모에서 받아 적는다.
5. **`guard_comment_update`에 `is_secret` 추가** — 사후에 공개로 뒤집을 수 없다.
6. **`sync_post_comment_count`가 공개 댓글만 센다** — 카드의 "댓글 n"에서 비밀이 빠진다.
7. **화면** — 1단 폼의 체크칸, 댓글 줄의 "비밀" 표, 비밀 댓글에 답글을 달 때의 안내 한 줄.

### 설계 결정 다섯 가지

#### 1. 누가 보는가 — 게시물 판매자 + 그 실타래를 연 사람

둘뿐이다. 여기까지는 당근과 같고 고민할 것이 없었다.

**"실타래를 연 사람"이라고 적은 것이 핵심이다.** "작성자"라고 적으면 답글에서 어긋난다 —
비밀 댓글에 판매자가 답하면 그 답글의 `author_id`는 판매자이고, 물어본 사람은 거기 없다.
그 사람이 자기가 받은 답을 못 보게 된다.

#### 2. 답글의 공개 범위는 부모를 따라간다 — 고를 수 없다

§5-9가 "함께 정해야 한다"고 남겨 둔 자리다. **각자 고르게 하면 안 된다.**

비밀 댓글 밑에 공개 답글이 달릴 수 있게 되는데, 답이란 물음을 되풀이하기 마련이라
**가린 내용이 답글로 새어 나간다.** ("5만원까지요"는 그 자체로 누가 얼마를 물었는지 알린다.)
화면에서도 부모 없는 답글 한 줄이 1단으로 떠오른다 — `buildCommentTree`가 차단을 위해
만들어 둔 그 갈래를 엉뚱한 이유로 타게 된다.

**정책이 아니라 트리거로 지켰다.** 정책은 막을 수만 있고 고쳐 넣을 수는 없다. 막는 쪽으로
만들면 화면이 부모의 `is_secret`을 정확히 실어 보내야 하고 틀리면 답글이 통째로 거절된다 —
규칙을 아는 곳이 서버와 화면 둘이 된다. 받아 적으면 규칙이 한 군데에만 있고 화면은
몰라도 틀릴 수가 없다.

조용히 값을 바꾸는 것이 위험한 방향인지 따졌다. 두 가지뿐이다.

```
공개 부모 + 비밀 답글 요청 → 공개가 된다. 새어 나갈 비밀이 애초에 없다
비밀 부모 + 공개 답글 요청 → 비밀이 된다. 감추는 쪽으로 틀린다
```

위험한 쪽으로는 틀릴 수 없어서 `guard_message_update`(0008)처럼 거절로 가지 않았다.

#### 3. 남에게는 완전히 감춘다 — "비밀 댓글입니다" 자리도 안 남긴다

당근은 자리를 남긴다. 안 따라간 이유는 **RLS가 행 단위**라서다 —
"행은 주되 content만 비운다"를 정책으로는 못 한다. 하려면 목록 RPC나 뷰를 하나 세워
내용을 지워 내려보내야 하고, 그 순간 0017이 "댓글은 RPC 없이 임베드로 읽는다"고 정한 자리가
통째로 바뀐다. 감추는 쪽은 정책 하나로 끝난다.

#### 4. 카드의 "댓글 n"은 공개 댓글만 센다

0028의 `comment_count`는 `posts`의 **평범한 컬럼**이라 RLS가 안 걸린다. 보는 사람이 누구든
같은 값 하나가 나가므로, 그 하나를 무엇으로 채울지가 문제였다.

전부 세면 못 보는 사람에게 "댓글 2"라고 적고 상세에서는 한 줄만 보여 준다. 숫자가 틀린
것보다 나쁜 것은 **그 차이가 "여기 비밀 댓글이 있다"는 신호**라는 점이다 — 3번에서 감추기로
한 사실이 숫자 하나로 새어 나간다.

공개만 세면 판매자·작성자에게는 카드가 실제보다 적게 적힌다. 이쪽도 어긋나지만
**"더 있다"를 안 알릴 뿐 없는 것을 지어내지 않는다.** 카드의 숫자가 보는 사람마다 달라질 수
없는 이상 기준은 **가장 적게 보는 사람**이어야 한다.

상세의 "댓글 n"은 이 컬럼이 아니라 **받아 온 목록의 길이**라(`commentSection`) 언제나 보는
사람 기준으로 맞다. `PostDetail`에는 `commentCount`가 아예 없어서 한 화면에서 두 숫자가
부딪히는 일은 없다 — 붙이기 전에 확인했다.

#### 5. 한 번 정한 공개 범위는 안 바뀐다

`guard_comment_update`에 `is_secret`을 더했다. 0020이 `post_id`·`parent_id`·`created_at`을
잠근 그 자리다.

열어 두면 **이미 답을 받은 뒤에 공개로 돌릴 수 있다.** 판매자가 비밀인 줄 알고 적은 가격이
나중에 모두에게 보이게 되는데, 그 답글은 판매자의 글이지 여는 사람의 글이 아니다.
0027이 제안에, 0008이 대화 기록에 그은 선과 같다.

반대 방향(공개 → 비밀)도 함께 막힌다. 덤으로 **4번의 집계가 대칭이 된다** — 값이 바뀔 수
있었다면 "insert에서 안 센 것을 delete에서 빼는" 경우가 생겨 `greatest(0, ...)` 바닥이
실제로 걸렸을 것이다.

### 파 보니 안 것 — 알림은 손댈 곳이 없었다

착수 전에는 0018을 고쳐야 할 줄 알았다. 아니었다. `notify_post_commented`가 알리는 상대는

```
게시물 판매자     — 비밀 댓글을 볼 수 있다 (정책의 넷째 갈래)
부모 댓글 작성자  — 자기 실타래를 볼 수 있다 (정책의 셋째 갈래)
```

**받는 사람이 곧 볼 수 있는 사람이다.** 우연이 아니라 같은 규칙에서 나온다 — 알림은
"이 대화에 관계된 사람"에게 가고, 비밀 댓글도 "이 대화에 관계된 사람"만 본다.

미리보기도 그대로다. `fetch_notifications`는 security invoker라 `comments` join에 새 정책이
그대로 걸리고, 볼 수 있는 사람이 받으므로 내용이 정상적으로 채워진다 —
0018이 차단에 대해 적어 둔 성질이 여기서 한 번 더 값을 했다.

실제 알림 4건을 심어 받는 사람을 확인했다(비밀 댓글 → 판매자, 판매자의 답글 → 물어본 사람).
못 보는 사람에게 간 알림은 0건이다.

### 확인

비밀 1단 + 그 답글(판매자) + 공개 1단 + 그 답글, 넷을 심고 네 사람으로 읽었다.

```
비밀 댓글 작성자   → 29,30,31,32   (넷 다)
게시물 판매자      → 29,30,31,32   (넷 다)
남                 → 31,32         (공개만)
비로그인           → 31,32         (공개만)
```

트리거는 **양방향 모두** 부모를 따랐다 — `is_secret=false`로 보낸 비밀 답글이 true가 됐고,
`true`로 보낸 공개 답글이 false가 됐다.

집계는 댓글 4건에 카드 2. 비밀 실타래를 지웠을 때 2 그대로, 공개 실타래를 지웠을 때 0.

잠금은 `update ... set is_secret = false`가 `check_violation`으로 거절되고 같은 행의
내용 수정은 통과하는 것까지 봤다.

밟은 뒤 심은 댓글 넷과 알림 넷을 모두 걷어내고 원래 상태로 되돌렸다. 전체 742개 통과.

**화면은 아직 눈으로 못 봤다.** 체크칸·"비밀" 표·안내 한 줄은 테스트로만 확인했다.

### 이번 범위 밖

- **비밀 댓글의 알림 문구** — 지금은 공개 댓글과 같은 "…님이 댓글을 남겼어요"다. 받는 사람이
  볼 수 있는 사람이라 틀린 말은 아니지만, 목록에서 어느 것이 비밀인지는 안 보인다.
  `notificationText`가 `is_secret`을 알려면 `fetch_notifications`에 칸이 하나 붙는다.
- **판매자가 자기 글에 다는 비밀 댓글** — 막지 않았다. 판매자 = 작성자라 자기만 보는 메모가
  된다. 해롭지 않고, 막으려면 "내 글인가"를 폼까지 내려야 해서 두었다.
- **3단 답글이 열리는 날** — `private.comment_thread_author`가 한 번만 올라간다(2단 고정이
  전제다). 그때는 루트까지 거슬러야 하는데, 애초에 3단은 0018의 알림 때문에 안 열기로 했다.

## 매너온도 이력 (2026-08-07)

`backlog.md` §4의 "매너온도 이력(0016)" 구현. 0016이 남긴 항목이다 —
"언제 무엇 때문에 올랐는지. 지금은 현재값 하나뿐이라 **어긋남이 생겨도 사후에 되짚을 수 없다.**"

**0016은 어긋남을 막는 일을 했고(합계로 다시 계산), 이 파일은 어긋났을 때 되짚는 일을 한다.**
둘은 다른 일이다 — 다시 계산하는 함수가 있어도 "언제부터 틀렸나"는 못 답한다.

### 왜 이것을 먼저 골랐나

§4에 남은 것들 중 유일하게 **미루면 미룬 만큼 영영 비는** 항목이다. 이 표는 앞으로
지나가는 것만 담는다 — 이미 지나간 변화는 되살릴 방법이 없다(후기가 사라진 자국이 어디에도
안 남아 있어서다. 그것이 이 표가 생긴 이유다).

### 무엇을 만들었나

1. **`manner_temp_events`** — 바뀐 값 둘 + 그 순간의 후기 개수·합계. 본인만 읽는다.
2. **`log_manner_temp_change`** — `profiles`의 after update 트리거. 값이 실제로 바뀔 때만 적는다.
3. **`/my/manner` 매너온도 기록 화면** — 마이페이지 프로필 카드의 온도를 눌러 들어간다.
4. **`toMannerTempCauseText` 외 둘** — 이유를 앞뒤 줄에서 **읽어 내는** 함수들.

### 설계 결정 네 가지

#### 1. "왜"를 손으로 적지 않고 **근거**를 남긴다

처음에는 `reason` enum(`review_added` · `review_removed` · …)을 두려 했다. 버렸다.

**① 손으로 붙인 이름은 거짓말을 할 수 있다.** 앞으로 온도를 건드리는 길이 하나 늘 때 그쪽이
이유를 안 넘기거나 틀리게 넘기면, 표는 멀쩡해 보이면서 틀린 말을 한다. 0018이 겪은 자리와
같은 모양이다 — `actor`가 비어 "알 수 없는 이웃님이"로 떨어지는데 **폴백이 정상 동작인 척
덮어 버려 버그로 보이지도 않았다.**

**② 이유를 적어 둬도 어긋남은 못 잡는다.** 되짚고 싶은 것은 "그때 이 값이 맞았나"인데
`reason = 'review_added'`는 그 답을 안 준다. 근거를 적으면 답이 나온다.

```sql
after_temp = greatest(0, least(99, 36.5 + review_sum))   -- 이 등식이 깨진 줄이 곧 어긋남이다
```

실제로 온도를 99로 직접 밀어 넣어 보니 그 줄만 등식이 깨졌다(아래 확인).

"무엇 때문에"는 앞 줄과 견주면 나온다 — 개수가 늘었으면 들어온 것이고 줄었으면 사라진 것이다.
지어내지 않고 읽어 낸다. 화면에서도 **견줄 앞 줄이 없으면 이유를 안 붙이고 근거만 적는다.**

#### 2. 적는 자리는 `profiles`의 트리거다 — `sync_manner_temp` 안이 아니다

지금은 온도를 바꾸는 길이 하나뿐이라 어디에 적든 같다. 그래도 트리거로 간 이유는
**0016이 실제로 밟은 실패가 그 모양**이었기 때문이다 — `recalc_manner_temp`가 insert에만
붙어 있어 나가는 길을 아무도 보고 있지 않았다.

기록하는 자리는 바꾸는 자리보다 **아래**에 있어야 한다. 칸이 바뀌는 것을 보고 적으면 앞으로
어떤 길이 생기든 함께 적힌다. 0032가 "회원탈퇴도 그 사람의 글을 전부 지우므로 RPC가 아니라
트리거"라고 한 것과 같은 판단이다.

`when (old.manner_temp is distinct from new.manner_temp)`가 함께 필요했다. `sync_manner_temp`는
후기가 들고 날 때마다 **무조건** update를 날리므로 값이 그대로인 update가 흔하다 —
그대로 적으면 이력이 "아무 일도 없었다"로 뒤덮인다. 0020이 `posts_set_updated_at`을
포함 목록으로 뒤집은 것과 같은 결이다.

#### 3. 이력은 본인만 읽는다

온도 자체는 누구에게나 보인다. 그런데 **이력은 다른 것을 더 말한다.**

- 언제 거래가 끝났는지가 분 단위로 드러난다(후기가 들어온 시각이다)
- **사라진 후기의 자국이 남는다** — 상대가 글을 지웠거나 탈퇴했다는 사실이 새어 나간다
- 언제 나쁜 후기를 받았는지가 짚어진다. 공개 후기 목록에는 순서만 있지 눈금이 없다

"이미 공개된 값의 이력이니 공개해도 된다"가 아니었다. 이 표가 답하는 질문은
**"내 온도가 왜 이런가"** 하나이므로 본인만 읽으면 족하다.

#### 4. 백필하지 않는다

할 수가 없다. 지금 37.0인 사람이 언제 어떤 순서로 거기 닿았는지는 남은 곳이 없고
(후기의 `created_at`으로 되짚으면 **사라진 후기가 통째로 빠진다** — 바로 그 구멍을 메우려고
만드는 표다), 지어낸 줄을 넣으면 어긋남을 잡으려던 표가 스스로 어긋난다.

0020이 "그 구분을 남긴 곳이 없다"며 이미 쌓인 값을 되돌리지 않은 것과 같다.
그래서 빈 화면의 문구도 "기록이 없어요"가 아니라 **"아직 움직인 적이 없어요"**다 —
한 번도 안 움직인 사람과 이력이 생기기 전부터 있던 사람이 같은 화면을 보는데, 둘 다에게
맞는 말이 그것이다.

### 밟다가 안 것 둘

**① 한 문장으로 후기 여러 건이 들어오면 이력은 한 줄이다.** after 트리거는 문장이 끝난 뒤에
몰려 돌아, 첫 `sync_manner_temp`가 이미 **셋을 다 센 합계**로 온도를 올려놓는다. 나머지 둘은
값이 그대로라 `when`에 걸려 안 적힌다. 틀린 기록이 아니다 — 온도는 실제로 한 번 움직였고
그 줄의 개수·합계도 그 순간의 사실이다. 앱은 `create_review`로 한 건씩 넣으므로(0013)
실제로는 한 건에 한 줄씩 남는다.

**② `grant`로는 아무것도 못 좁힌다.** Supabase는 public 스키마의 표에 `anon`·`authenticated`
양쪽으로 **DELETE·INSERT·UPDATE까지 기본 부여**한다(`reports`도 같은 상태였다). 그래서
`grant select`를 적어도 좁아지는 것이 없어 지웠다 — 적어 두면 "권한으로 막았다"고 읽힌다.
좁히는 것은 RLS뿐이고, 정책이 없을 때 세 명령이 막히는 **모양이 서로 다르다.**

```
insert : 42501 new row violates row-level security policy   ← 오류로 튄다
update
delete : 오류가 아니라 0행에 걸린다 — 조용히 성공하고 아무것도 안 지워진다
```

### 확인

후기 셋을 한 건씩 넣고(+0.5 → −0.5 → +0.1) 그중 나쁜 것 하나를 지웠다.

```
before → after   개수  합계   등식
36.5 → 37.0        1   +0.5   ✓
37.0 → 36.5        2    0.0   ✓
36.5 → 36.6        3   +0.1   ✓
36.6 → 37.1        2   +0.6   ✓   ← 후기가 사라져 온도가 되돌아온 줄(개수 −1)
```

- 값이 그대로인 `sync_manner_temp` 호출은 **한 줄도 안 남겼다**
- 온도를 99로 직접 밀어 넣으니 그 줄만 등식이 깨졌고(`37.1 → 99.0`, 합계 +0.6),
  0016의 다시 계산이 되돌린 줄은 다시 등식이 맞았다 — **표가 어긋남을 실제로 잡는다**
- 본인 6줄 / 남 0줄 · 끼워 넣기는 42501 · 지우기는 0행

밟은 뒤 심은 후기·이력·알림을 모두 걷어내고 온도를 36.5로 되돌렸다. 전체 758개 통과.

**화면은 아직 눈으로 못 봤다.**

### 이번 범위 밖

- **이력 페이징** — 후기 한 건에 한 줄이라 50건이 쌓이려면 거래를 오십 번 해야 한다.
  붙일 때가 오면 `manner_temp_events_user_idx`가 `(user_id, created_at desc, id desc)`라
  0011의 keyset을 그대로 받는다.
- **어긋난 줄을 화면에서 알리기** — 등식이 깨진 줄은 지금 숫자로만 보인다. 사용자에게
  "확인이 필요해요"를 띄우는 것은 겁만 주고 할 수 있는 일이 없어 두었다. 되짚는 것은
  질의로 하는 일이다.
- **후기 하나하나로 이어지는 길** — `review_id`를 두지 않았다. 사라진 후기를 가리키는 칸이
  되므로 FK를 걸 수 없고(0018·0032와 같은 자리), FK 없는 id는 지워진 뒤에 아무 데도 못 간다.

## 거래 상대 판정을 정책에서 트리거로 (2026-08-07)

`backlog.md` §4가 0031의 "새로 미룬 것"으로 적어 둔 항목. 0031이 길까지 적어 두었다 —
"정책의 판정을 `buyer_id`가 **바뀔 때만** 확인하는 트리거로 옮기는 길도 있다."

**옮기러 왔다가 구멍을 하나 찾았다. 옮기는 일보다 그쪽이 크다.**

### 찾은 것 — 정책이 update에만 걸려 있었다

0008이 "거래 상대는 채팅을 건 사람 중에서만"을 `posts_update`의 `with check`에 두었다.
그런데 **`posts_insert`는 0001 그대로 `auth.uid() = seller_id` 하나뿐이다.**
있는 글의 구매자를 바꾸는 것은 막히는데, **처음부터 박아 넣고 만드는 것은 안 막힌다.**

평범한 계정 하나로 밟아 확인했다.

```
① 채팅 한 번 안 한 이웃을 buyer_id로 박은 status='sold' 글을 새로 만든다  → 통과
② 그 글을 근거로 그 이웃에게 −0.5 후기를 넣는다                          → 통과
③ 피해자 매너온도 36.5 → 36.0
```

②가 통과하는 이유는 0013의 `reviews_insert`가 "거래완료된 글의 두 당사자인가"를 보는데
**그 글을 공격자가 방금 지어냈기** 때문이다. 조건은 전부 맞다 — 근거가 가짜일 뿐이다.
후기는 한 글에 한 번이지만(0001의 unique) 글은 얼마든지 만들 수 있어 **되풀이된다.**

0013의 머리말이 막겠다고 적은 바로 그것이다("거래한 적 없는 이웃에게 −점수를 꽂을 수 있고").
뒤의 것(`score`에 −99)은 `reviews_score_allowed`가 닫았고, **앞의 것은 0008이 update 쪽만
닫았다.** 0013은 "거래한 적 없는"을 `posts`가 보증한다고 믿었고, 0008은 자기가 만지는 명령만
보았다. 둘 사이의 틈이다.

### 무엇을 만들었나

1. **`guard_post_buyer`** — `before insert or update on posts`. 거래 상대를 **고를 때만** 본다.
2. **`posts_update`는 소유만 본다** — 0008이 얹은 `with check`의 구매자 갈래를 걷어냈다.
3. **`private.is_chat_room_purgeable`에서 거래 상대 조건을 뺐다** — 0031의 부채.
4. **`postStatusControl`이 `toPostActionErrorMessage`를 쓴다** — 아래 참고.

### 설계 결정 세 가지

#### 1. 왜 트리거로 옮기면 둘이 함께 닫히는가

정책은 **명령마다 따로** 적는다(insert 정책, update 정책). 규칙 하나를 지키려면 두 군데에
같은 말을 적어야 하고, 한쪽을 잊으면 지금처럼 조용히 벌어진다. 트리거는
`before insert or update`로 **한 번에** 건다.

**새로 만드는 글은 저절로 막힌다.** 방금 번호를 받은 글을 두고 오간 대화가 있을 리 없어
`exists`가 반드시 빈다 — "새 글에는 거래 상대가 없다"를 따로 적지 않아도 나온다.

#### 2. 0031의 부채는 "안 바뀌면 안 묻는다" 두 줄이 갚는다

정책의 `with check`는 **모든 update에서** 다시 물었다. 그래서 근거가 되는 방이 사라지면
예약중인 글의 판매자가 **제목조차 못 고쳤다**(0031이 밟아 확인한 자리다). 트리거는
`buyer_id`가 실제로 바뀔 때만 묻는다.

그래서 `is_chat_room_purgeable`에서 "거래 상대로 걸린 방은 안 지운다"를 뺐다. 방이 사라진 뒤에
상대를 **바꾸려면** 다시 채팅을 걸어야 하는데, 맞는 동작이다 — 근거 없이 고르는 일을 막는 것이
이 규칙의 뜻이고 옛 방은 이미 양쪽이 다 나간 방이다.

#### 3. 이름을 `posts_guard_buyer`로 둔 것은 우연이 아니다

before 트리거는 이름순으로 돈다. `posts_status_transition`(0008)이 "판매중으로 돌아오면
예약자를 지운다"를 하므로, 이 트리거가 **먼저** 돌아 사용자가 보낸 값을 그대로 봐야 한다 —
뒤에 돌면 이미 지워진 뒤라 무엇을 고르려 했는지 알 수 없다.
0020이 `comments_guard_update`에서 쓴 것과 같은 수다.

`tg_op`으로 "바뀌었나"를 가르는 것은 문법 때문이다. `before insert or update` 트리거의
`when` 절에는 `old`를 쓸 수 없다(insert에는 없는 값이다).

### 딸려 나온 것 — 오류 문구가 조용히 뭉개질 뻔했다

판정이 정책에서 트리거로 가면서 **오류 모양이 바뀐다.**

```
전: 42501  new row violates row-level security policy for table "posts"
후: 23514  거래 상대는 채팅을 나눈 이웃 중에서만 고를 수 있습니다.
```

그런데 그 화면(`postStatusControl`)이 `toPostErrorMessage`를 쓰고 있었다. 이 함수는 패턴
목록이라 한국어 문구가 아무 데도 안 걸리고 **기본 문구로 떨어진다** —
"게시물을 저장하지 못했습니다. **잠시 후 다시 시도해 주세요.**" 되풀이해도 안 되는 일이라
거짓말이 된다. 0027이 `chatErrorMessage`에서 겪은 자리와 같다.

`toPostActionErrorMessage`로 바꿨다(한글이 섞여 있으면 서버 문구를 그대로 쓴다).
서버 문구를 **그대로 넣은** 테스트를 둘 붙였다 — 0035의 것과 0008의 전이 문구.

### 확인

```
A 채팅 없는 사람을 구매자로 update      → 막힘 [23514] 거래 상대는 채팅을 나눈 이웃 중에서만…
B 채팅한 사람을 구매자로 update         → 통과, 예약자가 박힌다
C 근거가 된 방을 지운 뒤 제목 수정      → 통과   ← 0031의 부채가 풀린 자리
D 남에게 글 넘기기(seller_id 변경)      → 막힘 [42501] with check
E 가짜 거래 글 insert (위 ①의 재시도)   → 막힘 [23514]
```

`buyer_id`가 찬 글은 이 저장소에 0건이라 되돌릴 옛 데이터가 없었다.
다른 환경을 위해 **찾는 질의만** 마이그레이션 주석에 적어 두었다 — 무엇을 할지는
사람이 정할 일이라(지운다 · 상태를 되돌린다 · 후기만 걷어낸다) 자동으로 손대지 않는다.

전체 760개 통과.

### 이번 범위 밖

- **`newPostPage`·`postEditPage`의 오류 문구** — 그대로 뒀다. 새 글에는 `buyer_id`를 안 보내고,
  수정 화면은 `buyer_id`를 건드리지 않아 이 트리거까지 오지 않는다. 올 일이 없는 문구를
  미리 고치지 않는다.
- **`reviews_insert`가 글을 얼마나 믿을 것인가** — 이번에는 글 쪽을 고쳐 닫았다. 후기 쪽에서
  "이 거래에 방이 있었나"를 한 번 더 보는 길도 있지만, 같은 규칙이 두 군데가 되는 것이
  애초에 이 구멍의 원인이었다.

## 비밀번호 재설정 (2026-08-07)

`backlog.md` §5-5. **커스텀 SMTP를 붙이기로 하면서 열린 자리다** — 그전에는 Confirm email이
꺼져 있어 메일 경로 자체를 시험할 수 없었다(사용자가 2026-08-07에 다시 켰다).

### 코드가 할 수 없는 것부터

이 기능의 절반은 **대시보드**에 있다. 셋을 사람이 해야 한다.

1. **커스텀 SMTP** — 내장 SMTP는 한도가 낮아(`over_email_send_rate_limit`) 메일이 안 나간다
2. **Redirect URLs에 `/reset-password` 추가** — 없으면 링크가 Site URL로 떨어진다
3. **Secure password change** — 아래 3번에서 설명한다

`supabase/`에 `config.toml`이 없어 이 설정들은 저장소에 남지 않는다. 그래서 여기 적어 둔다.

### 무엇을 만들었나

1. **`/forgot-password`** — 이메일을 받아 재설정 링크를 보낸다.
2. **`/reset-password`** — 링크가 데려다주는 곳. 새 비밀번호만 정한다.
3. **`authStore.isPasswordRecovery`** — 지금 세션이 재설정 링크로 선 것인가.
4. 로그인 화면의 "비밀번호를 잊으셨나요?" · 오류 문구 셋 · 검사 함수 하나.

### 설계 결정 네 가지

#### 1. 착지 지점을 `/auth/callback`과 갈랐다

그쪽은 **세션이 서면 곧바로 홈으로 보내는 화면**이다(`authCallbackPage`). 재설정 링크를 거기로
보내면 **로그인만 되고 새 비밀번호를 정할 자리 없이 밀려난다.** 링크가 데려다줄 곳은
"새 비밀번호를 정하는 화면"이어야 한다.

#### 2. 가입 여부를 알려 주지 않는다

"그런 이메일은 없습니다"를 내면 **아무나 주소를 넣어 보며 누가 이 서비스를 쓰는지** 알아낼 수
있다. 중고거래는 사는 동네가 붙어 다니는 서비스라 그 노출이 가볍지 않다.

Supabase도 없는 주소에 성공으로 답하므로, 화면이 **아는 것보다 더 말하지 않으면** 된다.
문구는 "가입된 이메일이라면 재설정 링크를 보냈습니다"다.

#### 3. "로그인돼 있으면 통과"로 두면 안 된다 — 이 화면의 핵심

새 비밀번호를 정할 때 **현재 비밀번호를 묻지 않는다.** 잊어버려서 온 사람에게 물어볼 수 없는
값이고, 본인이라는 증명은 **메일함을 열었다는 사실**이 대신한다.

그러면 그 증명이 실제로 있었는지를 화면이 확인해야 한다. 안 하면 **남이 열어 둔 브라우저로
`/reset-password`만 치면 비밀번호를 바꿔 계정을 가져갈 수 있다** — `accountApi.changePassword`가
바꾸기 전에 현재 비밀번호로 다시 로그인하는 이유가 정확히 그것이다.

세션 객체만으로는 가릴 수 없어 `PASSWORD_RECOVERY` 사건을 스토어에 기억한다.

**다만 이 확인은 화면에만 있다.** 서버는 세션만 있으면 `updateUser`를 받아 준다. 진짜 잠금은
Supabase의 "Secure password change"(최근 로그인 요구)이고 그건 대시보드 스위치라 코드가
켤 수 없다 — 위 목록의 3번이 이것이다. **화면 쪽 확인을 보안 경계로 착각하지 않는다.**

#### 4. 구독을 세션 읽기보다 먼저 건다

`useAuthSessionSync`가 지금까지는 세션을 먼저 읽고 그다음에 구독했다. 순서를 뒤집었다.

supabase-js 소스를 읽고 정했다. `GoTrueClient.initialize()`가 `_pendingInitNotifications`를
열어 두고 **초기화 중에 생긴 알림을 큐에 담았다가, 초기화가 끝난 뒤 그때 등록돼 있는
구독자에게** 흘려보낸다. 재설정 링크의 `PASSWORD_RECOVERY`가 그 큐를 타므로 늦게 구독하면
**그 사건을 통째로 놓치고**, 놓치면 3번의 확인이 "링크가 만료됐다"로 잘못 답한다.

잃는 쪽으로 틀리기는 하지만 정상 흐름이 막히므로, 순서 하나로 피할 수 있는 일은 피했다.

### 딸려 나온 것

- **`AuthLayout.footer`를 선택으로** — 새 비밀번호 화면은 **그 자리에서 끝나는** 화면이라
  보낼 곳이 없다. 빈 줄만 남기느니 안 그린다.
- **메일 한도 문구를 좁혔다.** 예전에는 일반 rate limit과 한 문구를 썼는데
  ("요청이 너무 잦습니다"), 재설정 화면이 생기면서 **사용자가 이 오류를 실제로 보게 됐다** —
  거기서는 무엇을 기다려야 하는지 알려 주지 않는다. 기존 테스트가 그 문구를 잡고 있어
  함께 고쳤다.
- 만료된 링크(`otp_expired`)·같은 비밀번호(`same_password`) 문구를 더했다.

### 확인

775개 통과, lint·build 통과. 새로 붙인 것은 15개다(폼 검사 · 중립 문구 · 만료 안내 ·
"로그인만으로는 못 지나간다" · 재설정 창이 닫히는지 · 스토어의 표 셋).

**메일이 실제로 오가는 것은 못 밟았다.** SMTP가 아직 안 붙었고, 붙어도 진짜 메일을
보내는 일이라 사람이 할 자리다. 아래 순서로 확인하면 된다.

```
1. /login → "비밀번호를 잊으셨나요?" → 가입한 주소 입력
2. 메일의 링크 → /reset-password 로 떨어지는가 (Redirect URLs 확인)
3. 새 비밀번호 입력 → 홈으로, 그 비밀번호로 다시 로그인되는가
4. 같은 링크를 다시 열면 만료 안내가 뜨는가
5. 로그인한 채로 /reset-password 를 직접 치면 만료 안내가 뜨는가  ← 3번 결정이 실제로 도는 자리
```

**5번이 이번 PR에서 가장 확인이 필요한 줄이다.** 4번 결정(구독 순서)이 틀렸다면 정상 흐름인
2~3번이 막히고, 3번 결정이 안 돌면 5번이 통과해 버린다.

### 이번 범위 밖

- **가입 확인 메일 화면** — `signUpPage`의 `needsEmailConfirm` 안내는 이미 있다(0단계부터).
  Confirm email이 켜졌으니 이제 실제로 쓰이는데, **그 경로도 눈으로는 못 봤다.**
- **재설정 후 다른 기기 세션 끊기** — 비밀번호가 바뀌어도 다른 기기의 토큰은 살아 있다.
  `signOut({ scope: 'others' })`로 끊을 수 있지만, 계정을 잃었을 때만 뜻이 있는 동작이라
  "재설정 = 도난 대응"으로 볼 것인지부터 정해야 한다.
- **메일 본문 문구** — Supabase 기본 템플릿이 영어다. 대시보드에서 바꾸는 일이라 코드 밖이다.

## 로그인을 소셜만으로 (2026-08-07)

**방향이 바뀌었다.** 하루 전까지 이메일·구글 둘이었고 비밀번호 재설정까지 붙였는데,
"무조건 소셜(카카오·구글)만"으로 정하면서 이메일 쪽을 통째로 걷어냈다.

`feature.md`의 "카카오·구글·이메일"에서 **이메일이 빠진 셈**이라 명세도 함께 좁아진다.

### 무엇을 걷어냈나

파일 21개가 사라졌다.

```
회원가입/로그인 폼   signUpForm · signUpPage · signInForm (+테스트)
비밀번호 재설정      forgotPasswordPage · resetPasswordPage (+테스트)   ← 어제 붙인 것
폼 부품              authTextField · authSubmitButton · authDivider
검사                 validateAuthInput · validatePasswordChange (+테스트)
비밀번호 변경        passwordChangeForm · passwordLogin (+테스트) · accountApi.changePassword
```

**어제 만든 비밀번호 재설정을 하루 만에 지운 셈이다.** 그중 살아남은 것이 둘 있다 —
`useAuthSessionSync`의 구독 순서(아래 4번)와 `AuthLayout.footer`를 선택으로 바꾼 것.
둘 다 재설정과 무관하게 맞는 수정이라 남겼다.

### 설계 결정 넷

#### 1. 가입과 로그인을 나누지 않는다

`/signup`을 없애고 `/login`으로 돌려보낸다. OAuth는 처음 온 사람이면 계정을 만들고 이미
있으면 들여보내므로 **나눠 물을 것이 없다.** 홈의 게스트 버튼도 "로그인 / 회원가입" 둘에서
**"시작하기" 하나**로 줄였다 — 고를 것이 없는데 둘을 두면 무엇을 눌러야 할지 고민하게 된다.

옛 주소를 지우지 않고 리다이렉트로 남긴 것은 북마크나 밖에 걸린 링크가 막다른 길이 되지
않게 하려는 것이다.

#### 2. 버튼을 프로바이더 목록으로 그린다

`googleSignInButton`을 `socialSignInButton`으로 바꾸고 **차이만 표로** 모았다
(라벨 · 색 · 로고 · 진행 문구). 화면은 `SOCIAL_PROVIDERS` 배열을 돌 뿐이라, 셋째가 생기면
표에 한 줄과 배열에 한 칸이다.

`SocialProvider` 타입도 `'google' | 'kakao'`로 좁혔다. supabase-js의 `Provider`는 수십 개라
그대로 쓰면 **버튼을 안 만든 프로바이더를 부를 길이 열린다.**

카카오 노랑(`#FEE500`)은 **다크 모드에서도 그대로** 둔다. 배경에 맞춰 바꾸면 그 버튼을
알아보게 하는 유일한 표시가 사라진다.

"어느 것을 누르는 중인가"는 `variables`로 가린다. 안 그러면 하나를 눌렀을 때 둘 다 잠겨,
동의 화면으로 안 넘어갔을 때 다른 쪽을 고를 길이 없어진다.

#### 3. 카카오 버튼을 **미리** 둔다

Supabase에 카카오를 아직 안 켰다. 그래도 버튼을 두고 오류로 알린다 —
`authErrorMessage`가 `provider is not enabled`를 "아직 활성화되지 않았습니다"로 옮긴다.

준비될 때까지 감춰 두는 쪽도 있었지만, **감추면 준비가 끝났을 때 되살릴 자리를 잊는다.**
0018이 "트리거가 없어 안 오는 알림"을 겪은 것과 같은 결이다.

#### 4. 계정 설정의 갈래가 하나로 줄었다

예전에는 `hasPasswordLogin`으로 "비밀번호 변경 폼"과 "소셜이라 비밀번호가 없어요"를 갈랐다.
이제 뒤쪽만 남아 **갈래 자체가 사라졌다.** 어느 소셜로 들어왔는지는 `app_metadata.providers`를
읽어 적는다("구글 계정으로 로그인하고 있어요").

### 오류 문구를 일곱에서 여섯으로

이메일 갈래를 전부 뺐다(잘못된 비밀번호 · 중복 가입 · 미확인 메일 · 약한 비밀번호 ·
못 쓰는 주소 · 만료된 링크 · 같은 비밀번호). **일어나지 않는 일을 옮기는 문구는
다음 사람에게 "그 길이 있다"고 거짓말을 한다.**

대신 소셜이 실제로 내는 것 하나를 더했다 — **동의 화면에서 취소하고 돌아온 경우**
(`access_denied`). 사용자가 스스로 한 일이라 "로그인을 취소했습니다"로 적는다.

### 확인

727개 통과, lint·build 통과. 로그인 화면 테스트를 새로 붙였는데 그중 첫 줄이
**"이메일·비밀번호를 묻지 않는다"**다 — 되살아나면 거기서 걸린다.

**화면은 눈으로 못 봤고, 카카오는 켜기 전이라 아예 밟을 수 없다.**

### 딸려 나오는 것 — 이메일 계정 둘이 잠긴다

`auth.users`가 셋인데 둘이 이메일 계정이다.

```
aa01055183324@gmail.com   google   ← 실제 사용자
test123@naver.com         email    ← 글 27개를 가진 주 판매자 계정
test9999@naver.com        email
```

**데이터는 그대로 남지만 화면으로는 못 들어간다.** 개발 데이터라 그대로 두되, 그 계정으로
화면을 밟아야 할 일이 생기면 소셜 계정으로 글을 다시 심는 편이 빠르다.

### 이번 범위 밖

- **카카오 프로바이더 켜기** — 콘솔 앱 등록 · REST API 키 · 리다이렉트 URI 등록. 사람 일이다.
- **Supabase의 Email 프로바이더 끄기** — 앱은 안 쓰지만 켜져 있으면 **API로는 여전히
  이메일 가입이 된다.** 끄면 그 길이 닫힌다.
- **잠긴 이메일 계정 정리** — 지울지, 소셜 신원을 이어 붙일지는 정하지 않았다.

## 데스크탑 반응형 (2026-08-07)

"앱이 너무 모바일스럽다 — 데스크탑에서는 데스크탑답게, 지금 모양은 모바일에서"라는 요청.
마이그레이션 없음. **규칙과 근거는 `design.md`에 따로 모았다** — 화면을 새로 만들 때
읽어야 하는 문서라 구현 노트와 수명이 다르다.

### 무엇을 만들었나

1. **폭 유틸리티 셋** (`page-narrow` · `page-wide` · `page-detail`) — CSS에 한 번만.
2. **`AppHeaderNav`** — `md`부터 나오는 상단 내비게이션. 하단 탭바는 `md:hidden`.
3. **목록이 격자로** — `PostList`·`MyPostList`가 `md` 2열 · `xl` 3열.
4. **카드가 타일로** — `PostCard`가 가로에서 세로로.
5. **상세가 2단으로** — `lg`부터 사진(sticky)과 정보를 나란히.

### 설계 결정 셋

#### 1. 폭을 파일마다 적지 않는다 — CSS 유틸리티 셋으로

`max-w-screen-sm`이 **스물세 파일**에 그대로 있었다. 거기에 `md:max-w-4xl`을 더하면
같은 문자열이 스물세 번 복사되고, 다음에 값을 바꿀 때 또 스물세 곳이다.
**한 곳을 빠뜨려도 오류가 아니라 "조금 좁은 화면"이라 눈에 안 띈다.**

그래서 화면이 **폭이 아니라 성격**을 적게 했다. `src/styles/index.css`가 이미
"바탕색은 화면이 아니라 여기서 한 번만 정한다"고 적어 둔 그 자리다 — 같은 이유의 값이라
같은 곳에 뒀다.

TS 상수 모듈(`shared/ui/menuItem.ts` 방식)도 후보였는데, 그러면 스물세 파일에 **import가
스물세 줄** 늘어난다. 폭은 값이 아니라 표현이라 CSS 쪽이 맞다.

Tailwind v4의 `@utility` + `@apply`로 적었고, **빌드된 CSS를 열어 미디어쿼리 안에
제대로 들어갔는지 확인했다**(48rem·64rem). `@apply`에 반응형 변형을 섞는 것이 v4에서
되는지 확신이 없어 짐작으로 넘기지 않았다.

#### 2. 길잡이는 감추는 것이 아니라 **자리를 옮기는** 것

하단 탭바를 데스크탑에서 그대로 두면, **화면 아래는 눈에서 가장 먼 곳**이라 마우스가
매번 끝까지 내려가야 한다. 엄지를 위해 만든 물건이기 때문이다.

그래서 같은 `APP_TABS`를 두 모양으로 그린다. 자리를 더하면 양쪽에 함께 생긴다.
데스크탑에서는 **아이콘을 뺐다** — 글자가 들어갈 폭이 충분하면 아이콘은 같은 말을 두 번
하는 셈이고, 이모지는 키우면 거칠어진다.

글쓰기는 `isPrimary` **값 하나**가 두 모양(떠 있는 원 / 채워진 버튼)을 만든다.
"이것만 성격이 다르다"는 사실은 하나고 그리는 방법이 화면마다 다를 뿐이다.

**딸려 나온 것**: 헤더가 로고와 알림 종을 들면서 홈과 겹쳐, 홈 쪽을 `md:hidden`으로
감췄다. 특히 알림 배지는 **한 화면에 둘이면 어느 쪽이 맞는지 알 수 없다** —
`myPageMenu`가 예전에 같은 이유로 배지를 안 단 자리다.

#### 3. 격자 열 수는 "몇 개 들어가나"가 아니라 "한 칸이 읽히나"

`page-wide`가 `lg`에서 1152px까지 벌어진다. 4열로 나누면 카드가 260px 밑으로 좁아져
**제목이 대부분 잘린다.** 그래서 `md` 2열 · `xl` 3열에서 멈췄다.

무한스크롤 표식(`<li>`)이 격자에서 한 칸을 먹으면 **빈 칸이 생겨 마지막 줄이 어긋난다.**
`md:col-span-full`로 한 줄을 통째로 쓰게 두면 1px 띠로만 남는다.

### 확인

734개 통과, lint·build 통과. `AppHeaderNav` 테스트 일곱을 새로 붙였다.

**눈으로는 못 봤다.** 브라우저 자동화 도구가 저장소에 없다 —
`design.md` §7에 확인 순서 여섯 줄을 적어 두었다.

### 이번 범위 밖

- **채팅 2단**(왼쪽 방 목록 + 오른쪽 대화) — 폭만으로 되는 일이 아니다. 지금은
  `/chats`와 `/chats/:id`가 **다른 화면**이라 2단으로 만들면 두 주소가 한 화면을 가리키고
  뒤로가기의 뜻도 달라진다. 라우팅부터 정해야 한다.
- **지도 좌우 분할** — 같은 이유 + 지도 인스턴스를 다시 그려야 한다.
- **폰트·간격 스케일** — 폭 문제와 별개다. 섞으면 무엇 때문에 달라 보이는지 못 가린다.

## 아이콘을 이모지에서 SVG로 (2026-08-07)

"이모지로 된 아이콘 전부 실제 아이콘으로, 라이브러리 써도 좋다"는 요청.
마이그레이션 없음. **규칙과 고른 이유는 `design.md` §6에 모았다.**

### 왜 이모지가 문제였나

세 가지가 겹쳐 있었다.

1. **기기마다 모양이 다르다.** 후기의 `😐`가 애플에서는 무표정, 안드로이드에서는
   뾰로통하다 — **남의 평가를 옮겨 적는 자리라 그 차이가 뜻을 바꾼다.**
2. **색을 정할 수 없다.** 탭바가 켜진 탭과 꺼진 탭의 **글자색만** 갈랐고 아이콘은 늘 같은
   색이었다. 이모지는 자기 색을 들고 있어 `text-emerald-600`이 안 먹는다.
   반응형 작업 때 상단 바에 아이콘을 못 넣은 이유도 이것이었다("이모지는 확대하면 거칠어진다").
3. **줄 높이에 따라 흔들린다.** `←`·`›`·`⋯` 같은 글꼴 글자가 특히 그랬다.

### 무엇을 했나

`lucide-react`(+8.5 kB raw / +3 kB gzip)를 넣고 스물몇 자리를 바꿨다.

- **탭·메뉴 아이콘은 타입이 바뀌었다** — `icon: string` → `Icon: LucideIcon`.
  값이 문자열에서 컴포넌트가 되면서 `<tab.Icon size={20} />`으로 그린다.
- 인라인 글리프(`←` `›` `‹` `✕` `♡` `⋯` `📍` `🔍`)를 전부 컴포넌트로.
- `REVIEW_RATING_EMOJI` → `REVIEW_RATING_ICON`.

### 판단이 필요했던 셋

#### 1. 찜 하트는 **같은 아이콘을 `fill`로만** 가른다

예전에는 `♥`와 `♡`가 **서로 다른 글자**라 폰트에 따라 굵기·크기가 달라, 누르는 순간
아이콘이 살짝 움찔했다. 이제 `<Heart fill={isLiked ? 'currentColor' : 'none'} />`다.

#### 2. 첫 후기 알림의 `🎉`는 **아이콘으로 안 바꾸고 뺐다**

그 값은 알림 제목 **문자열**이라 컴포넌트를 넣을 자리가 없다. 넣으려면
`notificationText`가 문자열 대신 노드를 돌려줘야 하는데, 그러면 그 유틸의 테스트
스물몇 개가 전부 모양이 바뀐다. 목록에서 **그 줄만 그림이 붙으면 줄 높이도 어긋난다.**
"첫 후기"라는 사실은 본문("매너온도가 올랐어요")이 이미 말하고 있다.

#### 3. 브랜드 표식은 **직접 그렸다**

lucide에 가지가 없다. `🍆`를 그대로 두면 **서비스 이름 옆 표식이 보는 사람마다 다른
가지**가 되는데 그건 표식이 아니다. `shared/ui/brandMark.tsx`에 열몇 줄 SVG로 그렸다
(라이브러리를 하나 더 들일 일이 아니다).

**여기만 `currentColor`를 안 쓴다.** 다른 아이콘은 글자색을 따라가는 것이 맞지만
브랜드는 어디에 놓이든 같은 색이어야 한다 — **가지가 초록이면 가지가 아니다.**

기본 프로필 이미지의 `🍆`도 걷어냈다. 닉네임이 없을 때 첫 글자 대신 넣던 값인데,
그건 "이 사람의 첫 글자"가 아니라 브랜드 표식이라 자리에 안 맞았다 → `User`.

### 그대로 둔 것

`·` 구분점과 매너온도의 `→`(`36.5°C → 37.0°C`)는 **아이콘이 아니라 글**이다.
값과 값을 잇는 문장부호라 아이콘으로 바꾸면 오히려 읽기 어려워진다.

### 확인

734개 통과, lint·build 통과. 고친 테스트는 둘이다 —
`backLink`(화살표가 SVG라 글자로 안 잡힌다)와 `notificationText`(🎉를 뺀 문구).

**눈으로는 못 봤다.** `design.md` §8의 확인 순서에 0번을 더해 두었다 —
**탭바에서 켜진 탭의 아이콘이 초록으로 바뀌는지**가 이번 작업으로 처음 가능해진 것이라
거기부터 보면 된다.

---

## 카카오 로그인 개통 (2026-08-08)

`feature.md` §1 "카카오, 구글, 이메일 로그인 지원"의 마지막 한 조각.
**코드는 한 줄도 안 고쳤다** — 마이그레이션도 없다. 오늘 만진 것은 콘솔 두 곳뿐이다.

### 왜 코드가 안 나왔나

2026-08-07 "로그인을 소셜만으로"에서 **카카오 버튼을 미리 만들어 두었기 때문이다.**
그때 적은 판단이 이것이었다 — "프로바이더를 안 켠 채로 버튼을 두고 오류로 알린다.
감추면 준비가 끝났을 때 되살릴 자리를 잊는다." 하루 뒤 그 판단이 값을 했다.
대시보드에서 스위치를 켜는 것으로 기능이 끝났고, **되살릴 자리를 찾는 일이 없었다.**

`SocialProvider`를 `'google' | 'kakao'`로 좁혀 둔 것도 같은 이유로 도움이 됐다 —
켜야 할 것이 무엇인지 타입이 이미 답하고 있었다.

### 콘솔에서 한 일

**카카오 앱을 새로 만들지 않았다.** 지도에 쓰던 앱에 카카오 로그인 제품을 얹었다.
한 앱이 **JS 앱키(지도)와 REST API 키(로그인)를 함께** 낸다 — 나눌 이유가 없고,
나누면 도메인 등록을 두 번 하게 된다.

| 카카오 쪽 | Supabase 쪽 |
|---|---|
| REST API 키 | Client ID |
| **Client Secret 코드** | Client Secret |
| Redirect URI `https://<ref>.supabase.co/auth/v1/callback` | (Callback URL 칸에 그대로 있다) |

밟으면서 걸린 순서 둘:

- **Secret은 생성만으로는 안 된다.** 활성화 상태를 "사용함"으로 바꿔야 한다.
- **Web 플랫폼에 `https://<ref>.supabase.co`를 먼저 넣어야** Redirect URI 칸이 열린다.
  로그인이 돌아오는 곳은 우리 앱(`localhost:5173`)이 아니라 **Supabase**다. localhost는
  그 다음 단계(Supabase의 Redirect URLs)가 맡는다 — 구글 때와 같은 구조다.

### 이메일은 안 올 각오를 했는데 왔다

`account_email`은 **비즈 앱으로 전환해야** 열리는 동의항목이라, 동의항목에서 빼고
Supabase의 **Allow users without an email**을 켜 두고 시작했다. 그런데 실제로는
`email_verified: true`로 들어왔다.

**어느 쪽이든 상관없게 되어 있었다.** `profiles`에 email 칸이 아예 없고
`handle_new_user`가 `id`와 자동 닉네임만 쓰기 때문이다(`0001_init.sql`).
계정 설정 화면도 `user.email ?? ''`로 비워 둔다. 스키마가 이메일을 안 들고 있던 것이
**소셜을 하나 더 붙일 때 값을 했다.**

### 딸려 나온 정리 — Email 프로바이더를 껐다

앱에서 이메일 로그인을 걷어낸 뒤에도 **API로는 여전히 이메일 가입이 되고 있었다.**
화면에 길이 없는 것과 길이 닫힌 것은 다르다. 이제 `/auth/v1/settings`가
`google: true, kakao: true, email: false`를 답한다.

대가가 있다 — **`test123@naver.com`(글 27개를 가진 주 판매자)과 `test9999@naver.com`이
화면에서 잠겼다.** 데이터는 그대로 남고 SQL로는 다룰 수 있다. 씨앗 데이터를 눈으로
확인해야 할 때는 이 점을 기억해야 한다.

### 확인한 것 — 가입부터 탈퇴, 재가입까지

02:54~03:00, 6분 동안 한 줄기로 밟았다. **auth 로그에 에러가 하나도 없다.**

```
02:54:03  /authorize  → Redirecting to external provider (kakao)
02:54:07  /callback   → 302 · user_signedup (provider: kakao)
02:54:07  handle_new_user 트리거가 profiles 행 생성 (91ms 뒤)
02:54:25  온보딩 완료 (석관동 · 반경 2km · 좌표)
02:59:41  POST /functions/v1/delete-account → 200 (939ms)
02:59:56  같은 카카오로 재가입 → 새 uuid
03:00:13  온보딩 처음부터 다시
```

**온보딩 설계가 지켜지는 것도 여기서 처음 눈으로 봤다.** 카카오가 `name: 홍재훈`과
프로필 사진을 내려줬지만 `nickname`은 직접 입력한 값이고 `avatar_url`은 `null`이다.
구글 때 정한 "소셜이 준 이름·사진을 쓰지 않는다"가 프로바이더가 바뀌어도 그대로다.

**회원탈퇴는 이날 처음 앱에서 밟혔다**(8-1 이후 사흘 만이다 — 진짜로 지워도 되는 계정이
없어서 미뤄져 있었다). 지운 uuid를 **열한 군데에서 찾아 전부 0**이었다:
`auth.users`·`identities`·`sessions`, `profiles`, `posts`, `chat_rooms`, `messages`,
`reviews`, `comments`, `notifications`, `storage.objects`.

재가입은 **새 uuid로 새 계정**이 선다. 카카오 id(`5028829867`)는 같지만 우리 쪽에서는
처음 온 사람이다 — 탈퇴하면 정말 남남이 되는 것이 의도한 동작이다.

### 알아 둘 것 — 같은 이메일이면 소셜이 합쳐진다

Supabase는 **verified 이메일이 같은 소셜 둘을 한 계정으로 자동 병합**한다.
지금은 카카오(naver 메일)와 구글(gmail)이 달라 별개지만, 같은 메일을 쓰면
`providers: ["kakao","google"]` 한 계정이 된다. 계정 설정 화면이 `app_metadata.providers`를
배열로 읽어 "카카오 · 구글 계정으로 로그인하고 있어요"로 적는 것이 이 경우를 위한 것이다.

### 이번 범위 밖

- **cascade와 스토리지 정리는 아직 검증 못 했다.** 지운 계정에 글도 사진도 없었다.
  확인된 것은 "빈 계정이 깨끗이 지워진다"까지다. 사진 붙인 글과 프로필 사진을 가진
  계정으로 한 번 더 지워 봐야 `chat-images`의 `{room_id}/{user_id}/…` 경로까지 닫힌다.
- **화면은 여전히 눈으로 못 본 것이 여덟 건**이다(`design.md` §8).

---

## 실제 DB에 붙는 통합 테스트 (2026-08-08)

"기능들을 실제 데이터로 테스트해 달라"는 요청. 기존 734개는 **화면과 유틸**을 보는 테스트라
api 계층을 전부 mock한다 — 정책도, 트리거도, RPC도 한 번도 밟히지 않았다. 그쪽을 열었다.

마이그레이션 없음. 앱 코드도 한 줄 안 고쳤다. **62개가 늘어 796개가 됐다.**

### 무엇을 만들었나

1. **`jest.config.cjs`를 두 갈래로** — `unit`(jsdom, 기존 그대로) / `integration`(node, 실제 서버).
2. **`shared/testUtils/integration/`** — 환경변수 로더 · anon 클라이언트 · 서비스 클라이언트 · 픽스처.
3. **통합 테스트 다섯 벌** — 검색 22 · RLS 차단 16 · 비밀 댓글 8 · 거래 규칙 8 · 매너온도와 알림 10.

### 설계 결정 넷

#### 1. 로컬 Supabase가 아니라 **원격 프로젝트**에 붙는다

`docs/architecture.md`가 처음부터 적어 둔 길은 `supabase start`로 로컬 인스턴스를 띄우는
것이었다(*"구현 착수 전 재확인 권장"*이라는 단서와 함께). **재확인해 보니 못 쓴다** —
`supabase start`는 Docker를 요구하는데 이 환경에 없다.

원격에 붙는 대신 **테스트가 자기 데이터만 만지도록** 만들었다. 남의 데이터를 지우지 않고,
자기가 심은 것만 되돌린다.

#### 2. **앱 코드를 그대로 부른다** — moduleNameMapper로 클라이언트만 갈아끼운다

이 작업의 핵심이다. 통합 테스트가 SQL을 새로 쓰면 그것은 **DB를 검증하는 것이지 앱을
검증하는 것이 아니다.** 화면이 `searchPosts`를 부르는데 테스트가 `select ...`를 직접 짜면,
그 사이에 있는 `toAreaParams`·`toPostSummary`가 검증에서 통째로 빠진다.

그런데 앱 모듈은 `import.meta.env`를 읽어 ts-jest에서 문법 오류가 난다(`troble.md` #5의
그 벽이다). 그래서 **경로만 바꿔치기했다.**

```js
moduleNameMapper: {
  '^.*shared/lib/supabaseClient$': '<rootDir>/src/shared/testUtils/integration/supabaseTestClient.ts',
}
```

앱 코드는 자기가 `supabaseClient`를 부른다고 믿고, 실제로는 `process.env`를 읽는 쌍둥이가
온다. **검증 대상은 진짜 앱 코드로 남으면서** 벽만 없어진다.

이 매핑을 `unit` 갈래에 걸지 않은 것이 중요하다. 거기 걸면 mock을 쓰던 기존 734개가
조용히 진짜 서버에 붙는다.

#### 3. 심는 것은 서비스 키, **확인은 언제나 anon 키**

이 규칙을 어겼다가 한 번 틀렸다(`troble.md` 1번). 서비스 키로 읽으면 RLS가 꺼지므로
**"안 보여야 할 것이 안 보인다"를 확인할 수 없다.** 비밀 댓글 검증이 통째로 무의미해지는데,
초록으로 통과하기 때문에 무의미해진 줄도 모른다.

그래서 `getAdminClient()`는 픽스처에서만 부르고, 단언은 전부 `supabaseTestClient`가 받는다.

키 이름에 `VITE_`를 붙이지 않은 것도 같은 종류의 안전장치다 — Vite는 `VITE_`로 시작하는
값을 **번들에 그대로 넣는다.** 이름 하나로 그 사고가 막힌다.

#### 4. 스위트마다 **자기 몫의 세계**를 만든다

처음에는 "DB에 있는 것"에 기대어 성질만 단언했다(`toBeGreaterThan(0)`). 두 번 깨졌다 —
사람이 화면에서 글을 지웠을 때, 그리고 jest가 파일을 병렬로 돌릴 때. 자세히는 `troble.md` 2번.

이제 각 스위트가 **실제와 겹치지 않는 법정동 코드**(`99`+타임스탬프)와 **아무도 안 사는
좌표**(태평양, 실행마다 무작위)를 잡고 거기에만 심는다. 그 결과 단언이 오히려 촘촘해졌다:

```
expect(posts.map(toPrice)).toEqual([0, 30000, 90000, 120000, 150000]);
expect(near.length).toBe(3);   // 반경 1km 안에 심은 것이 셋
```

치우는 일은 **사용자 삭제 한 번**이면 끝난다. `profiles`가 cascade로 글·댓글·채팅까지
데려가기 때문이다 — 회원탈퇴가 기대는 바로 그 길이라, 픽스처를 치우는 것 자체가
그 길을 매번 한 번 더 밟는 셈이다.

### 무엇이 검증되나

지금까지 **아무 테스트도 밟지 않던 것들**이다.

- **정책** — 익명은 읽되 쓰지 못한다. 채팅·메시지·알림·최근본글·신고는 아예 안 보인다.
  찜 개수·매너온도를 직접 올리려는 시도가 값을 못 바꾼다.
- **비밀 댓글(0033)** — 익명에게 한 줄도 안 오고, **자리 표시도 안 남는다.**
  답글이 부모의 비밀을 물려받는지, 카드의 "댓글 n"이 공개 댓글만 세는지까지.
- **거래 상대 가드(0035)** — 채팅 없는 사람은 구매자로 못 고른다. **만들 때 박아 넣는 것도**
  막힌다(0035가 찾아낸 그 구멍이 다시 열리면 여기서 잡힌다).
- **상태 전이** — 거래완료는 되돌릴 수 없고, 판매중으로 돌아오면 예약자가 지워지고,
  완료 시각이 저절로 찍힌다.
- **매너온도(0013·0016)** — 후기로 오르고, **후기가 사라지면 되돌아간다.**
  점수는 셋 말고 못 넣는다(−99를 막는 그 제약). 한 거래에 후기는 한 번.
- **알림(0018·0022)** — 댓글·후기로 생기고, 자기 글에 자기가 달면 안 생기고,
  설정에서 끄면 안 온다.
- **검색 RPC(0007·0024)** — 반경·거리순·커서 페이징, 그리고 `%`·`_`·`'`가 든 검색어가
  와일드카드나 문법으로 새지 않는지.

### 이번 범위 밖

- **로그인한 사용자로서의 RLS.** Email 프로바이더를 끈 탓에 테스트가 세션을 못 만든다
  (`troble.md` 3번). "자기 글은 찜할 수 없다"(0006)처럼 **정책에만 있는 규칙**이 여기 걸린다.
  트리거·제약으로 지키는 것은 전부 닿는다.
- **스토리지.** 파일 업로드·삭제 경로를 안 밟았다. 회원탈퇴의 스토리지 정리도 같은 자리다.
- **Realtime.** 채팅이 상대 화면에 즉시 뜨는지는 여전히 눈으로 봐야 한다.
