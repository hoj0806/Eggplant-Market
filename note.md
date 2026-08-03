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
