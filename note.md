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
