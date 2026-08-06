# 트러블 슈팅

구현하면서 실제로 막혔던 지점과 해결 방법. 원인을 찾는 데 시간이 걸린 것 위주로 남긴다.

---

## 동네 설정 (2026-08-02)

### 1. 카카오 SDK가 계속 거부됨 — 원인은 도메인도 키도 아니었다

**증상**: 키를 넣고 도메인(`http://localhost:5173`)까지 등록했는데도
"지도 서비스를 불러오지 못했습니다"만 떴다.

**원인 찾기**: 브라우저는 `<script>` 로드 실패의 응답 본문을 읽을 수 없어 화면만 봐서는 알 수 없다.
SDK URL을 직접 찔러 봤다.

```bash
curl -s -D - -H "Referer: http://localhost:5173/" \
  "https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY}&libraries=services&autoload=false"
```

```
HTTP/1.1 403 Forbidden
{"errorType":"NotAuthorizedError",
 "message":"App(Eggplant Market) disabled OPEN_MAP_AND_LOCAL service."}
```

**원인**: 앱에서 **카카오맵 제품이 비활성화** 상태였다.
키 발급·도메인 등록과 제품 활성화는 **각각 별개**다.

**해결**: Kakao Developers 콘솔 → 내 애플리케이션 → 제품 설정 → 카카오맵 → 활성화 ON.

**교훈**: 브라우저에서 원인을 알 수 없는 외부 스크립트 실패는 `curl`에 `Referer`를 붙여
직접 찔러 보면 서버가 이유를 그대로 알려준다.

---

### 2. 오류 문구가 원인을 뭉개서 진단을 방해했다

**증상**: 위 문제를 쫓는 동안 화면에는 "네트워크 연결을 확인해 주세요"가 떴다. 네트워크는 멀쩡했다.

**원인**: `loadGeocoder`의 catch가 **모든** 실패를 `sdk_load_failed` 하나로 뭉갰다.
앱키가 비어 있는 경우까지 네트워크 문구로 바뀌어, 정작 무관한 곳을 의심하게 만들었다.

**해결**: 로더가 원인별로 다른 code를 던지고, 호출한 쪽이 구분하게 했다.

```ts
// src/shared/lib/kakaoMapLoader.ts
export const KAKAO_KEY_MISSING_CODE = 'kakao_key_missing';
export const KAKAO_LOAD_FAILED_CODE = 'kakao_load_failed';

// src/features/region/api/regionApi.ts
.catch(function forgetFailedLoad(error: unknown): never {
  geocoderPromise = null;
  throw toRegionError(isKeyMissing(error) ? 'sdk_key_missing' : 'sdk_load_failed');
})
```

`sdk_key_missing`은 `.env.local`과 **개발 서버 재시작**을, `sdk_load_failed`는
**카카오맵 활성화와 도메인 등록**을 짚어 준다.

**교훈**: 오류 문구가 엉뚱한 곳을 가리키면 문제를 못 찾는 정도가 아니라 **더 오래 걸리게 만든다.**
원인이 다르면 조치도 다르므로 뭉치면 안 된다.

---

### 3. `Number('')`은 `0`이라 빈 좌표가 유효값으로 통과했다

**증상**: 좌표를 못 읽는 검색 결과를 거르는 테스트가 실패했다.

**원인**:

```ts
Number('')          // 0
Number.isFinite(0)  // true  ← 걸러지지 않는다
```

카카오 `addressSearch`는 좌표를 **문자열**로 준다. 빈 문자열이 오면 좌표 `(0, 0)`인
아프리카 앞바다 지점이 유효한 동네로 저장될 뻔했다.

**해결**: 빈 문자열을 먼저 걸러내는 파서를 뒀다.

```ts
// src/features/region/utils/toRegion.ts
function toCoordinate(value: string): number | null {
  if (value.trim().length === 0) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
```

---

### 4. `PROFILE_COLUMNS`를 `+`로 이었더니 supabase 타입 추론이 깨졌다

**증상**: 컬럼을 추가하려고 select 문자열을 여러 줄로 나눴더니 빌드가 깨졌다.

```
error TS2352: Conversion of type 'GenericStringError' to type 'ProfileRow' may be a mistake
```

**원인**: supabase-js는 select 문자열을 **리터럴 타입**으로 읽어 결과 타입을 만든다.
`'a' + 'b'`의 타입은 `'ab'`가 아니라 그냥 `string`이라, 파싱에 실패해 `GenericStringError`가 됐다.

**해결**: 길어도 한 줄 리터럴로 유지한다. 주석으로 이유를 남겼다.

```ts
// 한 줄 리터럴이어야 한다. 문자열을 +로 이으면 리터럴 타입을 잃어
// supabase-js가 select 결과를 GenericStringError로 추론한다.
const PROFILE_COLUMNS = 'id, nickname, avatar_url, manner_temp, dong_name, region_code, ...';
```

---

### 5. ts-jest가 `import.meta`를 그대로 뱉어 테스트가 로드 단계에서 죽는다

**증상**: `react-router` 등을 쓰는 컴포넌트 테스트가 실행조차 되지 않는다.

**원인**: jest 설정이 `module: CommonJS`인데 ts-jest는 `import.meta`를 변환하지 않고 그대로 내보낸다.
**타입 오류도 나지 않는다.** Node가 CJS로 실행하면서 그때서야 터진다.

```
SyntaxError: Cannot use 'import.meta' outside a module
```

이 저장소에서 `import.meta.env`를 쓰는 모듈은 `supabaseClient.ts`와 `kakaoMapLoader.ts` 두 개다.
**import 그래프가 이 둘 중 하나에 닿는 테스트는 전부 죽는다.**

**해결**: 카카오 의존성을 `regionApi.ts` 한 곳에 가두고, 컴포넌트 테스트는 이 모듈을
**팩토리와 함께** mock한다.

```ts
const mockSearchRegionsByKeyword = jest.fn();

jest.mock('../api/regionApi', function mockRegionApi() {
  return {
    searchRegionsByKeyword: function searchRegionsByKeyword(query: string) {
      return mockSearchRegionsByKeyword(query);
    },
    // ...
  };
});
```

**주의**: 팩토리 없는 `jest.mock('...')`은 소용없다. 자동 목을 만들려고 **원본을 읽기 때문**이다.
변수 이름을 `mock`으로 시작해야 hoisting 제한에 걸리지 않는다.

---

### 6. react-router v7이 jsdom에 없는 `TextEncoder`를 쓴다

**증상**:

```
ReferenceError: TextEncoder is not defined
  at node_modules/react-router/dist/development/index.js:350:31
```

**원인**: jsdom은 `TextEncoder`/`TextDecoder`를 제공하지 않는데 react-router v7이 로드 시점에 쓴다.

**해결**: `src/setupTests.ts`에 폴리필을 넣었다.

```ts
import { TextDecoder, TextEncoder } from 'node:util';

if (globalThis.TextEncoder === undefined) {
  Object.assign(globalThis, { TextEncoder, TextDecoder });
}
```

---

### 7. 디바운스 타이머가 `act()` 밖에서 상태를 바꿔 경고가 났다

**증상**: 테스트는 통과하는데 `An update to RegionPicker inside a test was not wrapped in act(...)` 경고.

**원인**: "2자 미만은 검색하지 않는다" 테스트에서 디바운스 시간을 그냥 기다렸더니,
그 사이 `useDebouncedValue`의 `setTimeout`이 `act` 밖에서 `setState`를 호출했다.

**해결**: 기다리는 구간을 `act`로 감쌌다.

```ts
await act(async function advancePastDebounce() {
  await new Promise(function waitPastDebounce(resolve) {
    setTimeout(resolve, 500);
  });
});
```

---

### 8. PostGIS `geography`를 PostgREST로 읽으면 쓸 수 없는 값이 온다

**증상**: `location`을 select하면 `0101000020E6100000D3DEE00B93C15F40280F0BB5A6D14240`이 온다.

**원인**: PostgREST는 `geography`를 EWKB hex 문자열로 직렬화한다. 클라이언트에 파서가 필요하다.

**확인**: 쓰기는 문제없다는 것을 실제 DB에서 먼저 확인했다.
PostgREST가 값을 컬럼 타입의 입력 함수에 태우는 경로를 그대로 재현했다.

```sql
select st_astext((json_populate_record(
  null::public.profiles,
  '{"location":"SRID=4326;POINT(127.0246 37.6379)"}'::json)).location);
-- POINT(127.0246 37.6379)
```

**해결**: 쓰기는 EWKT 문자열로 그대로 두고(RPC 불필요), 읽기는 생성 컬럼을 추가해 해결했다.

```sql
add column location_lat double precision
  generated always as (st_y(location::geometry)) stored
```

`geography→geometry` 캐스트와 `st_x`/`st_y`가 IMMUTABLE인지 먼저 확인했다
(`pg_proc.provolatile = 'i'`). 아니었다면 생성 컬럼을 만들 수 없다.

**검증**: 실제 UPDATE를 `begin` … `rollback`으로 감싸 데이터를 건드리지 않고 왕복을 확인했다.

---

## 중고물품 게시물 등록 (2026-08-02)

### 9. `increment_view_count`가 남의 글에서는 아무 일도 하지 않았다

**증상**: 코드로는 아무 문제가 없어 보였다. RPC를 부르면 오류도 안 나고, 조회수도 안 오른다.

**원인**: 0001의 함수가 `language sql`(= security **invoker**)이라 **호출자 권한**으로
`posts`를 update한다. 그런데 `posts` 정책은 이렇다.

```sql
create policy posts_update on posts for update using (auth.uid() = seller_id);
```

작성자만 자기 글을 수정할 수 있으므로, 남의 글을 대상으로 한 update는 **0행에 매칭되고
조용히 끝난다**. RLS는 권한이 없는 행을 "보이지 않게" 하는 것이지 오류를 내지 않는다.
이것이 실패를 알아채기 어려웠던 이유다.

**해결**: `security definer`로 바꾸고, 함수 안에서 본인 글을 제외했다.

```sql
create or replace function increment_view_count(p_post_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update posts set view_count = view_count + 1
   where id = p_post_id
     and (auth.uid() is null or seller_id <> auth.uid());
end; $$;
```

**교훈**: RLS가 걸린 테이블을 함수로 갱신할 때는 "누구 권한으로 실행되는가"를 먼저 본다.
`update ... where`가 0행이어도 오류가 아니라 성공으로 보인다.
같은 이유로 찜 개수 트리거(`sync_post_like_count`)도 `security definer`여야 했다.

---

### 10. PostgREST 임베드가 `PGRST201`로 거절 — 관계가 하나가 아니었다

**증상**: 게시물 상세에서 판매자를 함께 읽으려고 `seller:profiles (...)`로 적었더니 400.

```json
{"code":"PGRST201",
 "message":"Could not embed because more than one relationship was found for 'posts' and 'profiles'"}
```

**원인**: `posts`와 `profiles`는 `seller_id` 말고도 `likes`·`recently_viewed`를 통해
이어져 있다(다대다). PostgREST가 어느 관계인지 고를 수 없다.

**해결**: FK 이름으로 관계를 짚어 준다.

```ts
'... seller:profiles!posts_seller_id_fkey (id, nickname, avatar_url, manner_temp) ...'
```

**교훈**: 이 오류는 타입 검사에도 테스트에도 걸리지 않는다(응답이 와야 안다).
select 문자열은 화면을 띄우기 전에 REST로 직접 찔러 확인하는 편이 빠르다.

```bash
set -a && . ./.env.local && set +a
curl -s -G "$VITE_SUPABASE_URL/rest/v1/posts" \
  --data-urlencode "select=id,seller:profiles!posts_seller_id_fkey(nickname)" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"
```

`categories`는 `parent_id` 자기참조가 생겼지만 `posts`→`categories` FK는 하나뿐이라
`category:categories (...)`는 그대로 둬도 된다.

---

### 11. jsdom에 `URL.createObjectURL`이 없어 사진 미리보기 테스트가 죽었다

**증상**: `TypeError: URL.createObjectURL is not a function`. 파일을 올리는 순간
컴포넌트가 통째로 언마운트되어, 이어지는 `getByLabelText('제목')`까지 "그런 요소 없음"으로 실패했다.
오류 메시지만 보면 라벨 문제로 보여 엉뚱한 곳을 뒤지기 쉽다.

**원인**: jsdom은 Object URL을 구현하지 않는다. 실제 blob을 만들 방법이 없어서다.

**해결**: `setupTests.ts`에서 stub을 깐다. 미리보기 URL이 목록의 `key`로도 쓰이므로
호출마다 다른 값을 돌려줘야 한다.

```ts
if (typeof URL.createObjectURL !== 'function') {
  let objectUrlCount = 0;
  URL.createObjectURL = function createObjectURL(): string {
    objectUrlCount += 1;
    return `blob:test/${objectUrlCount}`;
  };
  URL.revokeObjectURL = function revokeObjectURL(): void {};
}
```

---

### 12. 트랜잭션 안에서 `updated_at` 갱신 여부를 확인할 수 없었다

**증상**: `updated_at`이 조회수 증가에 안 따라 오르는지 확인하려고 plpgsql 블록 하나에서
"이전 값 → 작업 → 이후 값"을 여러 번 비교했더니 결과가 앞뒤가 안 맞았다.
분명히 갱신되어야 할 **본문 수정**이 "그대로"로 나왔다.

**원인**: 트리거의 `set_updated_at()`은 `now()`를 쓰는데, `now()`는
**트랜잭션 시작 시각**이라 한 트랜잭션 안에서 항상 같은 값이다.
앞선 작업이 이미 `updated_at`을 그 시각으로 올려 둬서, 뒤의 작업은 값이 안 바뀐 것처럼 보였다.

**해결**: 시나리오를 한 트랜잭션에 몰아넣지 않고 나눠 실행해서 확인했다.
(`clock_timestamp()`와 달리 `now()` = `transaction_timestamp()`라는 점을 기억해 둘 것)

---

### 13. 자기 글에 찜이 됐다 — check 제약으로는 막을 수 없다

**증상**: 첫 게시물을 올리고 확인해 보니 판매자 본인이 자기 글을 찜해 `like_count`가 1이었다.
조회수는 본인을 제외하도록 만들어 뒀는데 찜에는 같은 규칙이 없었다.

**왜 문제인가**: 찜 개수는 "찜 많은 순" 정렬(`feature.md` §2.2)의 근거다.
자기 글을 찜할 수 있으면 정렬이 곧바로 의미를 잃는다.

**막다가 걸린 것**: `likes`에 check 제약을 걸려고 했지만 안 된다.
판매자가 누구인지는 `posts`에 있고, **check 제약은 다른 테이블을 참조할 수 없다**
(`ERROR: cannot use subquery in check constraint`).

**해결**: RLS insert 정책에 조건을 얹었다.

```sql
create policy likes_insert on likes for insert
  with check (
    auth.uid() = user_id
    and not exists (
      select 1 from posts where posts.id = likes.post_id and posts.seller_id = auth.uid()
    )
  );
```

**검증**: `authenticated` 역할로 두 경우를 모두 넣어 봤다.

```
판매자 본인이 자기 글 찜 → RLS가 막음
다른 사용자가 찜         → 성공
```

`insufficient_privilege` 예외를 잡아 결과를 표로 돌려주면 한 번에 확인할 수 있다.

**교훈**: "이 행을 쓸 수 있는가"를 다른 테이블의 값으로 판단해야 한다면 check가 아니라 RLS 정책이다.
화면에서도 자기 글에는 찜 버튼을 그리지 않지만, 규칙의 주인은 서버여야 한다.

---

## 게시물 검색 및 필터링 (2026-08-02)

### 1. curl로 RPC를 찔러 검증할 때 한글 검색어만 `PGRST102`

**증상**: 앱과 같은 경로(PostgREST HTTP + anon 키)로 `search_posts`를 확인하는데
한글 검색어를 넣은 요청만 실패했다.

```bash
curl -X POST ".../rpc/search_posts" -d '{"p_region_code":"1129013900","p_keyword":"노트북"}'
# {"code":"PGRST102","message":"Empty or invalid json"}
```

**원인 찾기**: RPC 정의를 의심했지만 SQL로는 잘 돌았다. 같은 요청에서 한글만 빼 보니 통과했다.

```bash
-d '{"p_region_code":"1129013900","p_limit":2}'   # 200 OK
-d '{"p_region_code":"1129013900","p_keyword":"노트북","p_limit":2}'   # PGRST102
```

서버가 아니라 **셸이 범인**이다. Windows의 Git Bash에서 인라인 `-d` 문자열에 든 UTF-8이
깨진 채 전송돼 PostgREST가 JSON으로 파싱하지 못한다.

**해결**: 본문을 파일에 쓰고 `--data-binary @파일`로 넘긴다.

```bash
curl -X POST ".../rpc/search_posts" -H "Content-Type: application/json" \
  --data-binary @payload.json
```

**교훈**: 검증 도구가 실패했다고 검증 대상이 틀린 것은 아니다.
한글이 오가는 API를 이 환경에서 curl로 확인할 때는 처음부터 파일로 넘기는 편이 낫다.

---

## 채팅 · 거래 상태 (2026-08-03)

### 2. 구독이 자리 잡기 전에 보낸 첫 메시지가 사라졌다

**증상**: 실제 경로(anon 키 + 사용자 JWT + Realtime 웹소켓)로 확인하는데,
판매자가 **텍스트·사진 2건 중 1건**만 받았다. 못 받은 것은 언제나 **첫 번째** 메시지였다.

```
OK   판매자 Realtime 구독      SUBSCRIBED
FAIL 판매자가 실시간으로 받은 수   1        ← 2여야 한다
OK   마지막 실시간 메시지 종류    image    ← 뒤엣것은 왔다
```

**원인 찾기**: RLS를 의심했지만 그렇다면 둘 다 안 와야 한다. 구독만 걸고 0·0.5·2·2초 간격으로
네 번 보내는 최소 재현을 따로 만들었더니 **4건 모두 도착**했다.

```
insert #0 -> 6 (delay 0ms)   …   received: repro-0, repro-1, repro-2, repro-3
count: 4 / 4
```

같은 전체 시나리오를 한 번 더 돌리자 이번에는 2/2로 통과했다.
즉 **재현되지 않는 첫 실행만의 문제**였다 — `messages`를 publication에 갓 추가한 직후,
복제 슬롯이 자리 잡는 사이에 지나간 INSERT를 놓친 것으로 보인다.

**왜 그냥 넘기면 안 되는가**: 원인이 무엇이든 **첫 조회와 구독 사이에는 틈이 있다.**
방을 열고(첫 조회) 구독이 붙기까지 몇 백 ms가 있고, 그 사이 도착한 메시지는
조회 결과에도 구독 이벤트에도 안 들어간다. 상대가 새 메시지를 보내야만 화면이 되살아난다.

**해결**: 구독이 자리 잡은 시점(`SUBSCRIBED`)에 메시지 쿼리를 한 번 무효화해 그 틈을 메운다.

```ts
// chat/api/chatApi.ts — 채널 상태를 훅에 알린다
.subscribe(function handleStatus(status): void {
  if (status === 'SUBSCRIBED') { onReady(); }
});

// chat/hooks/useChatRealtime.ts
function handleReady(): void {
  queryClient.invalidateQueries({ queryKey: chatMessagesQueryKey(roomId) });
}
```

**교훈**: 실시간 구독은 "붙은 뒤부터"만 보장한다. 첫 조회와 구독을 함께 쓰는 화면은
**구독이 붙은 시점에 한 번 다시 읽어야** 그 사이가 비지 않는다.
재현되지 않았다고 넘겼으면 사용자에게는 "가끔 메시지가 안 온다"로 남았을 것이다.

---

### 3. `storage.objects`는 SQL로 지울 수 없다

**증상**: 검증에 쓴 채팅 사진을 정리하려고 SQL로 지웠더니 막혔다.

```
ERROR: 42501: Direct deletion from storage tables is not allowed. Use the Storage API instead.
HINT:  This prevents accidental data loss from orphaned objects.
CONTEXT: PL/pgSQL function storage.protect_delete()
```

**원인**: `storage.objects` 행을 지워도 실제 파일은 남는다. Supabase가 그 불일치를 막으려고
트리거로 직접 삭제를 거부한다.

**해결**: Storage API로 지워야 한다. `chat-images`는 비공개 버킷이고 삭제 정책이
`(storage.foldername(name))[2] = auth.uid()::text`라 **올린 본인의 세션**으로 지워야 한다.

```ts
await client.storage.from('chat-images').remove([path]);
```

**교훈**: 스토리지가 낀 검증은 정리도 스토리지 API로 해야 한다.
정책을 "본인 폴더만"으로 좁혔다면 뒷정리 스크립트도 그 본인으로 로그인해야 한다.

---

### 4. jsdom에 `scrollIntoView`가 없어 채팅 목록 테스트가 통째로 죽었다

**증상**: `TypeError: bottomRef.current?.scrollIntoView is not a function`.
렌더 자체가 실패해서 그 파일의 테스트가 한꺼번에 무너졌다.

**원인**: jsdom은 레이아웃을 계산하지 않아 스크롤이라는 개념이 없다.
`URL.createObjectURL`(#11)과 같은 부류다.

**해결**: `setupTests.ts`에 스텁을 깐다.

```ts
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function scrollIntoView(): void {};
}
```

---

### 5. 버튼 안의 아바타 때문에 이름이 두 번 읽혔다

**증상**: 상대 선택 목록에서 `getByRole('button', { name: '호박이웃' })`이 못 찾는다.
화면에는 분명히 그 이름의 버튼이 있다.

**원인**: 버튼의 접근성 이름은 안쪽 내용을 모두 이은 것이다.
`ProfileAvatar`가 `aria-label="호박이웃님의 기본 프로필 이미지"`를 달고 있어
실제 이름이 `"호박이웃님의 기본 프로필 이미지 호박이웃"`이 됐다.

**해결**: 테스트를 정규식으로 느슨하게 만드는 대신 버튼에 이름을 명시했다.
스크린리더에게도 이름이 두 번 들리지 않는 편이 낫다.

```tsx
// 아바타에도 이름이 붙어 있어 그대로 두면 이름이 두 번 읽힌다.
aria-label={partner.nickname}
```

**교훈**: `getByRole`이 못 찾으면 선택자를 느슨하게 하기 전에
**접근성 이름이 실제로 무엇인지**를 먼저 본다. 대개 화면 쪽이 고칠 자리다.

---

### 6. 상대의 "안읽음"이 21초 동안 안 사라졌다 — 왕복 하나가 더 끼어 있었다

**증상**: 브라우저 두 창으로 실제로 대화해 보니, 구매자가 보낸 메시지의 "안읽음"이
판매자가 **답장을 보낼 때**서야 사라졌다. 반대 방향(판매자→구매자)은 1초 남짓이었다.

DB에 시각이 그대로 남아 원인 범위를 좁힐 수 있었다.

```sql
select id, from_seller, created_at, read_at,
       extract(epoch from (read_at - created_at)) as read_after_sec
```

```
12  구매자→판매자  01:49:32.404 → 01:49:53.706   21.30초   ← 판매자가 답장한 시각
13  판매자→구매자  01:49:52.835 → 01:49:54.306    1.47초
14  판매자→구매자  01:49:53.033 → 01:49:54.306    1.27초
```

**원인**: 읽음 처리의 방아쇠가 **방 요약(`fetch_chat_rooms`의 `unread_count`)** 이었다.

```
상대 메시지 도착 → Realtime → 방 요약 무효화 → 다시 받아옴 → unreadCount>0 → 읽음 처리
                                  └─ 이 왕복이 제때 돌지 않으면 전부 멈춘다
```

메시지 자체는 실시간으로 잘 도착했다(화면에 떴다). 멈춘 것은 **그 뒤에 붙은 왕복**이라
증상만 보면 "실시간이 안 된다"로 보이지 않는다. 그래서 더 늦게 발견됐다.

**해결**: 방 요약을 기다릴 이유가 없다. 안 읽은 수는 **이미 화면에 있는 메시지**로 셀 수 있고,
그 목록은 Realtime이 도착하는 순간 갱신된다. 왕복을 통째로 없앴다.

```ts
// chat/hooks/useMarkRoomRead.ts
export function countUnreadFromPartner(messages, viewerId) {
  return messages.filter((m) => m.senderId !== viewerId && m.readAt === null).length;
}

// chatRoomPage.tsx — 방 요약이 아니라 화면에 있는 메시지로 센다
useMarkRoomRead(roomId, viewerId, countUnreadFromPartner(messages, viewerId));
```

브라우저 검증에서 **21초 → 0.8초**가 됐다.

**교훈**: 실시간 화면에서 "이미 손에 있는 데이터로 판단할 수 있는 것"을 굳이 서버에 다시 묻지 않는다.
왕복을 하나 끼우면 그 왕복이 실패하거나 늦는 만큼 화면 전체가 늦어진다.
그리고 이 종류는 **단위 테스트로는 절대 안 잡힌다** — 두 사용자가 동시에 있어야 드러난다.

---

## 재접속 (2026-08-03)

### 1. 잘 되던 카카오맵이 갑자기 거부됨 — 원인은 vite가 바꾼 포트였다

**증상**: 동네 설정에서 "지도 서비스를 불러오지 못했습니다. 카카오 콘솔에서 카카오맵이
활성화되어 있는지, 이 주소가 도메인으로 등록되어 있는지 확인해 주세요."가 떴다.
콘솔 설정은 아무것도 건드린 적이 없고, 전날까지 잘 되던 기능이다.

**원인 찾기**: 문구가 짚어 준 두 가지를 `Referer`를 바꿔 가며 확인했다.

```bash
for ref in "http://localhost:5173/" "http://localhost:5174/"; do
  curl -s -o /dev/null -w "%{http_code}\n" -H "Referer: $ref" \
    "https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY}&libraries=services&autoload=false"
done
# 5173 -> 200
# 5174 -> 401
```

키도 카카오맵 활성화도 멀쩡했다. **주소가 달랐다.**
5173 포트가 이미 점유돼 있어서 vite가 말없이 **5174**로 올린 상태였고,
카카오 콘솔에 등록된 도메인은 `http://localhost:5173` 하나뿐이라 401이 났다.
카카오의 도메인 검사는 포트까지 정확히 일치해야 한다.

**해결**: 포트를 고정하고, 점유됐을 때 조용히 옮기는 대신 즉시 실패하게 했다.

```ts
// vite.config.ts
server: { port: 5173, strictPort: true },
```

`strictPort`가 없으면 "포트가 밀렸다"는 사실이 로그 한 줄로 지나가고,
증상은 엉뚱하게도 **카카오 콘솔 설정 문제처럼** 보인다.
같은 주소가 Supabase Redirect URLs에도 등록돼 있어 인증까지 함께 깨질 수 있다.

**교훈**: 외부 서비스에 **도메인을 등록해 쓰는 앱은 개발 서버 포트가 설정값의 일부**다.
자동으로 옮겨 주는 편의 기능이 오히려 원인을 숨긴다. 고정하고 실패시키는 편이 낫다.

---

### 2. 한 번 실패한 SDK 로딩은 재시도해도 영영 끝나지 않았다

**증상**: 위 문제를 쫓다가 발견했다. 로딩에 실패한 뒤 "다시 시도"를 눌러도
오류도 성공도 없이 버튼이 계속 "불러오는 중"에 머물렀다.

**원인**: 실패한 `<script>` 요소를 **재사용**했다.

```ts
const existing = document.getElementById(SCRIPT_ELEMENT_ID);
const script = existing !== null ? existing : document.createElement('script');
script.addEventListener('load', resolve);
script.addEventListener('error', reject);   // ← 이미 끝난 요소라 둘 다 다시 안 온다
```

`load`/`error`는 일회성 이벤트다. 이미 발생을 마친 요소에 리스너를 새로 달면
resolve도 reject도 되지 않아 Promise가 영원히 pending으로 남는다.
로더는 실패 시 `loadPromise`를 null로 되돌려 재시도를 허용하는데,
정작 그 재시도가 죽은 요소를 붙잡고 있었다.

**해결**: 남아 있는 요소는 지우고 새로 붙인다. 동시 호출은 `loadPromise`가 이미 막고 있으므로
요소 재사용으로 중복을 막을 이유가 없었다.

```ts
const stale = document.getElementById(SCRIPT_ELEMENT_ID);
if (stale !== null) {
  stale.remove();
}
const script = document.createElement('script');
```

**교훈**: 일회성 이벤트를 기다리는 캐시는 **성공 경로만 보면 멀쩡해 보인다.**
"실패한 뒤 다시 시도"까지 따라가 봐야 드러난다.

---

### 3. 이미 가입한 계정에 프로필 설정 화면이 다시 떴다

**증상**: 가입돼 있는 구글 계정으로 접속했는데 닉네임·사진부터 다시 정하라는 화면이 나왔다.

**원인**: 동네 설정 기능 이전에 가입한 행은 `onboarded_at`과 닉네임은 차 있고 동네만 비어 있다.
`isOnboardingComplete`가 이들을 온보딩으로 되돌리는 것 자체는 **의도한 동작**이지만
(그래야 동네를 정할 기회가 생긴다), 온보딩 화면이 **항상 1단계부터** 시작하는 것이 문제였다.
이미 정한 닉네임을 다시 물으니 "가입이 안 된 건가?"로 보인다.

**해결**: 판정을 하나 더 두어 동네 단계만 보여준다.

```ts
// profile/utils/onboardingStatus.ts
export function needsRegionOnly(profile: Profile): boolean {
  return profile.onboardedAt !== null && toInitialNickname(profile).length > 0;
}
```

닉네임이 임시값(`user_1a2b3c4d`)이면 사용자가 정한 적이 없다는 뜻이라 건너뛰지 않는다.
건너뛰면 트리거가 넣은 임시 닉네임이 그대로 굳어 버린다.

**교훈**: 마이그레이션으로 생긴 "중간 상태"의 사용자는 **가드를 통과시키는 것만으로 끝이 아니다.**
그 다음에 보게 될 화면이 자신의 상태에 맞는지까지 봐야 한다.

---

## 마이페이지 (2026-08-03)

### 1. 새 커서 유틸의 테스트가 로드 단계에서 죽었다 — 동네 설정 5번과 같은 함정

**증상**: `myPostCursor.test.ts`만 스위트째 실패했다.

```
SyntaxError: Cannot use 'import.meta' outside a module
  at src/shared/lib/supabaseClient.ts:5
  at Object.<anonymous> (src/features/profile/api/myPostsApi.ts:1:1)
  at Object.<anonymous> (src/features/profile/utils/myPostCursor.ts:1:1)
```

**원인**: 「동네 설정」 5번(`ts-jest`가 `import.meta`를 그대로 뱉는다)과 **완전히 같은 문제**다.
`myPostCursor.ts`가 페이지 크기 상수 하나(`MY_POSTS_PAGE_SIZE`)를 쓰려고 `myPostsApi`를 import했고,
그것이 `supabaseClient`를 끌고 들어왔다. 상수 하나 때문에 Supabase 클라이언트 전체가 로드된다.

**해결**: 같은 처방이다. `postSearchCursor.test.ts`가 이미 쓰고 있던 모듈 mock을 그대로 가져왔다.

```ts
jest.mock('../api/myPostsApi', function mockMyPostsApi() {
  // supabaseClient를 거쳐 import.meta.env에 닿으므로 실제 모듈은 로드하지 않는다.
  return { MY_POSTS_PAGE_SIZE: 20 };
});
```

**교훈**: 이미 한 번 밟은 함정은 **같은 구조를 다시 만들 때 다시 밟는다.** 커서 유틸이 API에서
페이지 크기를 가져오는 구조 자체가 원인이라, 그 구조를 따라 하면 mock도 함께 따라와야 한다.
`postSearchCursor.test.ts`에 남겨 둔 주석이 그대로 진단서가 됐다.

### 2. jsdom에 `IntersectionObserver`가 없어 무한 스크롤 목록을 테스트할 수 없었다

**증상**: `MyPostList`를 렌더하면 `IntersectionObserver is not defined`로 죽었다.

**원인**: 「채팅」 4번(`scrollIntoView`)·「게시물 등록」 11번(`URL.createObjectURL`)과 같은 종류다. jsdom은 레이아웃을
계산하지 않으므로 **"화면에 보인다"는 개념 자체가 없다.** `useInfiniteScroll`이 목록 끝 표식을
관찰하는 데 이 API를 쓴다.

그동안 드러나지 않았던 이유는 무한 스크롤을 쓰는 화면(`postSearchResultList`)에 컴포넌트 테스트가
없었기 때문이다. **API가 없는 것이 아니라 그 API를 쓰는 코드를 테스트한 적이 없었다.**

**해결**: `setupTests.ts`에 stub을 뒀다. 표식이 화면에 들어오는 일은 테스트에서 일어나지 않으므로
콜백은 부르지 않는다 — 관찰을 받아 주기만 하면 된다.

```ts
class StubIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
}
```

**교훈**: jsdom에 없는 브라우저 API는 **하나씩 순서대로 드러난다** — 그 API를 쓰는 코드에
테스트가 처음 붙는 순간에. 이번이 네 번째다(`TextEncoder` → `createObjectURL` → `scrollIntoView` →
`IntersectionObserver`).

### 3. keyset 페이징이 깨진 줄 알았는데 검증 쿼리가 틀렸다

**증상**: 27건짜리 판매관리 목록을 커서로 넘겨 보니 1페이지와 2페이지가 **19건이나 겹쳤다.**

```
page1_rows | page2_rows | overlap
        20 |         20 |      19
```

**원인**: RPC가 아니라 확인용 SQL이 틀렸다. 다음 커서로 삼을 "페이지의 마지막 행"을 이렇게 뽑았다.

```sql
select sort_at, id from page1 order by sort_at desc, id desc limit 1   -- ✗ 가장 새 행
```

목록이 `desc` 정렬이므로 `desc`로 다시 정렬해 하나를 집으면 **첫 행**이 나온다.
커서가 맨 앞 행이니 2페이지는 2~21번째를 돌려줬고, 겹친 19건이 그 증거였다.

**해결**: 커서로 쓸 행은 정렬의 **끝**이다.

```sql
select sort_at, id from page1 order by sort_at asc, id asc limit 1     -- ✓ 가장 오래된 행
```

고치니 `20 + 7 = 27`, 중복 0, distinct 27로 맞았다.

**교훈**: 검증이 실패하면 **검증 자체를 먼저 의심한다.** 겹친 건수(19 = 20 - 1)가 "커서가 한 칸
앞이었다"를 그대로 가리키고 있었다 — 숫자의 모양이 원인을 말해 줄 때가 있다.

### 4. 온보딩의 "기본 이미지 사용" 버튼이 프로필 수정에서는 거짓말이 된다

**증상**: 버그로 터진 것은 아니고 `AvatarPicker`를 재사용하려다 발견했다.

온보딩에서 사진을 고른 뒤 누르는 버튼은 "기본 이미지 사용"이다. 고른 파일을 물리면 정말 기본 이미지로
돌아가니 맞는 문구다. 그런데 **이미 사진이 있는 사용자**가 프로필 수정에서 같은 버튼을 누르면
기본 이미지가 아니라 **원래 쓰던 사진**으로 돌아간다. 같은 버튼이 상황에 따라 다른 일을 한다.

게다가 프로필 수정에는 진짜로 기본 이미지로 되돌리는 동작이 따로 필요하다. 문구를 그대로 두면
버튼 두 개가 같은 이름을 갖게 된다.

**해결**: 되돌아갈 곳을 보고 문구를 고른다. 저장된 사진이 있으면 "선택 취소", 없으면(온보딩)
"기본 이미지 사용" 그대로다. 진짜 삭제는 "기본 이미지로"라는 별도 버튼이다.

```tsx
const resetLabel = currentAvatarUrl !== null && !isRemoved ? '선택 취소' : '기본 이미지 사용';
```

문구를 그대로 뒀더니 기존 `onboardingForm.test.tsx`가 손대지 않고 통과했다 — 온보딩의 동작이
바뀌지 않았다는 증거이기도 하다.

**교훈**: 컴포넌트를 재사용할 때 **props보다 문구가 먼저 깨진다.** "무엇을 하는 버튼인가"는 같아도
"무엇으로 돌아가는가"가 화면마다 다르면 같은 이름을 쓸 수 없다.

---

## 앱 껍데기 — 하단 탭바 · 다크모드 (2026-08-04)

### 1. `.dark`를 켰더니 흰 바탕에 흰 글씨가 될 뻔했다

**증상**: 다크모드 스위치를 붙이기 직전에 발견했다. `<html>`에 `.dark`를 붙이면 65개 파일의
`dark:` 클래스가 한꺼번에 살아나는데, **바탕색을 칠하는 곳이 아무 데도 없었다.**

**원인**: 화면들은 카드·버튼에만 배경을 준다(`dark:bg-gray-950`). 페이지의 바탕은 지금까지
브라우저 기본값(흰색)이었고, 라이트모드에서는 그게 맞아 보여서 아무도 몰랐다.
`.dark`를 켜는 순간 **바탕은 흰색 그대로인데 글자만 `dark:text-gray-50`(거의 흰색)** 이 된다.

**해결**: 바탕은 화면이 아니라 `index.css`에서 한 번만 정한다.

```css
@layer base {
  body {
    @apply bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-50;
  }
}
```

페이지마다 배경을 칠하는 방법도 있지만, 그러면 어느 한 곳을 빠뜨렸을 때 다크모드에서 흰 판이 튀어나온다.
빌드된 CSS에서 두 줄로 나오는 것까지 확인했다(`body{…}` / `body:where(.dark,.dark *){…}`).

**교훈**: `dark:` 클래스를 아무리 성실히 붙여도 **아무 클래스도 없는 자리(바탕)** 는 커버되지 않는다.
다크모드는 "색을 뒤집는 것"이 아니라 "두 벌을 다 칠하는 것"이다.

### 2. 테스트는 통과하는데 스크린리더에는 안 들리는 배지

**증상**: 탭바의 안 읽은 배지를 아이콘 안에 넣었다.

```tsx
<span aria-hidden="true">
  {tab.icon}
  <UnreadBadge count={unreadCount} />   {/* aria-label="안 읽은 메시지 3개" */}
</span>
```

`getByLabelText('안 읽은 메시지 3개')`가 **통과한다.** 그런데 실제로는 들리지 않는다.

**원인**: `aria-hidden`은 **하위 전체**를 접근성 트리에서 지운다. 배지에 붙인 `aria-label`도 함께 묻힌다.
반면 Testing Library의 `getByLabelText`는 접근성 트리가 아니라 **DOM의 속성**을 본다
(`getByRole`과 달리 `aria-hidden`을 걸러내지 않는다). 그래서 초록불이 거짓말을 한다.

**해결**: 숨길 것은 그림뿐이다. 배지를 `aria-hidden` 밖으로 꺼낸다.

```tsx
<span className="relative">
  <span aria-hidden="true">{tab.icon}</span>
  <UnreadBadge count={unreadCount} />
</span>
```

**교훈**: `aria-hidden`은 그 태그가 아니라 **그 아래 전부**에 걸린다. 그리고 접근성은
`getByLabelText`로 검증되지 않는다 — 그 쿼리는 DOM을 볼 뿐이다.

## 게시물 수정 · 삭제 · 끌어올리기 (2026-08-04)

### 1. 서버가 정성껏 써 보낸 거절 사유가 "권한이 없습니다"로 뭉개졌다

**증상**: `bump_post`가 남의 글 끌올을 거절하면서 `42501`과 함께 문구를 돌려주는데,
화면에는 엉뚱한 말이 떴다.

```
서버: { code: '42501', message: '내가 올린 글만 끌어올릴 수 있습니다.' }
화면: 권한이 없습니다. 다시 로그인해 주세요.
```

로그인은 멀쩡한데 다시 로그인하라고 한다. 쿨다운 거절(`23514`)은 아예 기본 문구
("게시물을 저장하지 못했습니다")로 떨어져 **왜 안 되는지 알 길이 없었다.**

**원인**: `toPostErrorMessage`는 `code + message`를 한 문자열로 이어 패턴에 태운다.
0005~0009의 오류는 전부 Postgres·Storage가 영어로 뱉는 것이라 이 방식이 맞았다.
그런데 0010의 `raise exception`은 **우리가 한국어로 직접 쓴 문구**다. 사용자에게 보여줄 말이
이미 서버에 있는데, 그걸 errcode로 되돌려 뭉뚱그리고 있었다.

```ts
[/row-level security|permission denied|42501|.../, '권한이 없습니다. 다시 로그인해 주세요.'],
```

**해결**: 서버가 한국어로 말했으면 그 말을 그대로 쓴다. 아니면 지금까지처럼 패턴에 태운다.

```ts
export function toPostActionErrorMessage(error: unknown): string {
  const raw = toRawMessage(error).trim();     // code는 붙이지 않는다
  if (/[가-힣]/.test(raw)) {
    return raw;
  }
  return toPostErrorMessage(error);
}
```

`code`를 떼고 `message`만 날것으로 읽는 것이 핵심이다. `extractErrorText`를 그대로 쓰면
`"p0001 끌어올리기는 24시간에…"`처럼 사용자에게 보일 수 없는 문자열이 된다.

**교훈**: 오류 문구를 서버에 둘지 클라이언트에 둘지는 **오류마다** 다르다.
DB가 뱉는 것(23503, 42501)은 클라이언트가 번역해야 하지만, 우리가 `raise exception`으로 쓴 것은
이미 번역된 결과다. 후자를 전자와 같은 길로 흘려보내면 애써 구분한 사유가 도로 하나가 된다.

### 2. "20시간 뒤"를 기대했는데 "19시간 뒤"가 나왔다

**증상**: 끌올 쿨다운 문구 테스트가 1시간씩 어긋났다.

```tsx
// bumped_at = 지금으로부터 4시간 전 → 남은 시간 20시간
renderMenu(makePost({ bumpedAt: new Date(NOW - 4 * HOUR_MS).toISOString() }));
expect(screen.getByText('20시간 뒤에 다시 끌어올릴 수 있어요'));
// → Unable to find text. 화면에는 "19시간 뒤에 다시 끌어올릴 수 있어요"
```

**원인**: 테스트의 `NOW`는 **모듈이 로드될 때** 찍히고, 컴포넌트는 **렌더될 때** `new Date()`를
부른다. 그 사이 몇 ms가 흐르므로 남은 시간은 정확히 20시간이 아니라 `19시간 59분 59.9초`다.
`Math.floor(remaining / HOUR_MS)`가 19를 돌려준다 — 코드도 테스트도 맞는데 결과만 어긋난다.

**해결**: 경계에 딱 붙이지 않는다. 반 시간을 걸쳐 두면 몇 ms의 드리프트로는 단위가 바뀌지 않는다.

```tsx
renderMenu(makePost({ bumpedAt: new Date(NOW - 3.5 * HOUR_MS).toISOString() }));  // 남은 20.5시간
```

경계 자체(24시간 정각, 1분 미만)는 시각을 인자로 받는 순수 함수(`postBumpCooldown.ts`)에서
고정된 `NOW`로 따로 검증한다. 렌더 시각이 끼어들지 않으니 거기서는 정확히 잴 수 있다.

**교훈**: 실제 시계를 쓰는 컴포넌트 테스트에서 **버림(floor)이 걸린 값을 경계에 붙이면** 깨진다.
경계는 순수 함수에서, 컴포넌트에서는 경계에서 떨어진 값으로.

## 탐색 — 정렬 · 홈 무한 스크롤 (2026-08-04)

이번 단계는 **막혀서 되돌린 곳이 없었다.** 코드가 한 번에 돌았다는 뜻이 아니라, 밟으면 크게
아팠을 함정 둘을 밟기 전에 확인하고 지나갔다는 뜻이다. 증상이 없으니 "증상 → 원인 → 해결"
대신 "무엇이 터졌을 것인가 → 왜 → 어떻게 비켰나"로 남긴다.

### 1. `create or replace function`이 함수를 **하나 더** 만든다

**터졌을 것**: 0011은 `search_posts`에 `p_sort`를 더하고 `p_cursor_bumped_at`(timestamptz)을
`p_cursor_value`(text)로 바꾼다. 이름이 같으니 `create or replace`면 교체될 것 같지만,
**Postgres는 인자 목록이 다르면 다른 함수로 본다.** 옛 함수가 그대로 남아 `search_posts`가
두 개가 된다.

여기까지는 조용하다. 터지는 곳은 PostgREST다. supabase-js가 보내는 것은 JSON 키 묶음이고,
서버는 그 키로 함수를 고른다. 두 함수가 모두 받아들일 수 있는 요청(예: `p_region_code`만)이
오는 순간 `PGRST203 Could not choose the best candidate function`으로 거절한다.
**앱이 아니라 스키마가 고장 난 상태라, 프론트를 아무리 들여다봐도 원인이 안 보인다.**

**어떻게 비켰나**: 옛 시그니처를 이름이 아니라 **인자 목록으로** 지목해 먼저 지운다.

```sql
drop function if exists search_posts(
  text, text, bigint, integer, integer, boolean, timestamptz, bigint, integer
);
```

`drop function search_posts(...)`에 인자를 안 적으면(오버로드가 여럿일 때) 그것도 거절당한다.
**교훈**: RPC의 인자를 고치는 마이그레이션은 언제나 `drop` + `create` 짝이다.
`create or replace` 한 줄로 끝나는 것은 본문만 바꿀 때뿐이다.

### 2. `format()` 안에서 `%`는 더 이상 LIKE 와일드카드가 아니다

**터졌을 것**: 정렬 컬럼을 쿼리 문자열에 박으려고 본문을 `format()` + `execute`로 옮겼는데,
0007에서 가져온 검색 조건에는 `%`가 들어 있다.

```sql
p.title ilike '%' || escape_like_pattern(btrim($2)) || '%'
```

`format()`은 `%`를 **자기 자리표시자**(`%s`, `%1$s`)로 읽는다. 그대로 옮기면 `'%'`가
`' || escape…`를 잡아먹어 `unrecognized format() type specifier`로 죽거나, 운이 나쁘면
엉뚱한 인자가 끼워진 쿼리가 만들어진다. 0007이 애써 만든 와일드카드 이스케이프가
**한 겹 위에서** 무너지는 자리다.

**어떻게 비켰나**: 쿼리 문자열 안의 LIKE 와일드카드를 전부 `'%%'`로 적었다.
그리고 그게 실제로 살아 있는지는 문법이 아니라 **결과로** 확인했다 —
`%`로 검색했을 때 동네 글 전체가 아니라 `100% 새제품 텀블러` 한 건만,
`_`로 검색했을 때 0건이 나오면 이스케이프가 두 겹 모두 제자리에 있다는 뜻이다.

```
p_keyword => '%'  → 1건 (100% 새제품 텀블러)
p_keyword => '_'  → 0건
p_keyword => null → 20건 (한 페이지)
```

**교훈**: 정적 SQL을 동적 SQL로 옮길 때는 문자열이 **두 번 해석된다.** 옮기기 전에 잘 돌던
쿼리라도 `%`·`''`·`\`가 들어 있으면 그 자리를 하나씩 짚어야 하고, 통과 여부는 파싱이 아니라
"이스케이프가 필요한 입력"으로 재 봐야 한다.

## 채팅 가격 제안 (2026-08-05)

### 1. 잠긴 버튼이 이유를 삼켰다 — 그리고 테스트가 먼저 알려 줬다

**증상**: 제안 금액에 `4만원`이라고 치고 제안 버튼을 눌러도 아무 일도 일어나지 않았다.
검증 함수(`validateOfferAmount`)는 `'금액은 숫자만 입력할 수 있습니다.'`를 잘 돌려주는데
**그 문구가 화면에 뜨는 순간이 오지 않는다.**

먼저 걸린 것은 테스트였다. 입력에 `'4만원{Enter}'`를 쳐서 폼을 제출시키려 했는데 제출이
일어나지 않아 `getByRole('alert')`가 아무것도 못 찾았다.

**원인**: 대화 입력줄의 전송 버튼을 그대로 흉내 내 `disabled={!canSendOfferAmount(amount)}`로
잠갔던 것이다. 형식이 틀리면 버튼이 잠기고, **잠긴 버튼은 왜 잠겼는지 말하지 않는다.**
검증 문구는 제출 핸들러 안에 있는데 제출이 영영 일어나지 않으니 죽은 코드였다.

Enter가 안 먹은 것도 같은 뿌리다. HTML의 암묵적 제출(implicit submission)은 폼의 기본 submit
버튼을 누르는 것과 같은데, **그 버튼이 disabled면 아무 일도 일어나지 않는다.** 버튼을 잠근 순간
Enter까지 같이 잠긴 것이다.

**해결**: 잠그는 조건을 "보낼 수 없는 값"에서 **"보낼 값이 없음"**으로 좁혔다.

```tsx
// before — 형식이 틀려도 잠긴다. 이유를 볼 길이 없다.
disabled={props.isSending || !canSendOfferAmount(amount)}
// after — 비었을 때만 잠근다. 나머지는 눌러서 문구를 본다.
disabled={props.isSending || amount.trim().length === 0}
```

쓰이지 않게 된 `canSendOfferAmount`는 지웠다.

같은 이유로 "대기 중인 제안이 있음"도 버튼을 잠그는 대신 **열어서 이유를 적는 쪽**으로 만들었다.
`₩` 버튼은 언제나 눌리고, 열린 자리에 "먼저 보낸 제안의 답을 기다리는 중입니다"가 뜬다.

**교훈**: 잠긴 버튼은 "지금은 안 된다"까지만 말하고 "왜"를 말하지 못한다. **비어 있어서**
잠그는 것(사용자가 이유를 안다)과 **틀려서** 잠그는 것(모른다)은 다르게 다뤄야 한다.
그리고 `disabled`인 제출 버튼은 Enter 키까지 함께 막는다 — 테스트에서 폼 제출이 안 되면
버튼의 `disabled`부터 의심할 것.

### 2. 대화 입력줄 안에 폼을 하나 더 넣을 뻔했다

**터졌을 것**: 제안 입력을 `chatComposer` 안에 넣는 것이 자연스러워 보였는데,
`chatComposer`의 뿌리가 이미 `<form>`이다. 그 안에 `<form>`을 또 두면 HTML이 금지하는 중첩이고,
브라우저는 안쪽 폼을 조용히 버린다 — 제안 버튼이 바깥 폼을 제출해 **금액 대신 빈 메시지가
나가는** 그림이 된다.

문법 문제만도 아니다. 대화 입력에서 Enter는 전송으로 이미 쓰이고 있다(`handleKeyDown`).
한 폼이면 금액 칸에서 Enter를 눌렀을 때 어느 제출이 나갈지가 DOM 순서에 달린다.

**어떻게 비켰나**: 뿌리를 `<div>`로 바꾸고 제안 폼과 메시지 폼을 **형제**로 뒀다.
테두리·배경 클래스도 그 `<div>`로 옮겼다.

```tsx
<div className="flex flex-col gap-2 border-t …">
  {props.canOfferPrice && isOfferOpen ? <PriceOfferForm … /> : null}
  <form onSubmit={handleSubmit} className="flex flex-col gap-1">…</form>
</div>
```

**교훈**: 입력이 둘 이상인 화면에서 "폼 하나에 다 넣기"는 Enter의 주인을 흐린다.
제출 단위가 다르면 폼도 나누고, 나눌 수 없으면 형제로 둔다.

---

## 신뢰 — 프로필 · 거래후기 (2026-08-05)

이번에는 터진 것보다 **밟기 전에 확인한 것**이 많다. 후기는 남의 신뢰 점수를 건드리는 기능이라
"돌아가는가"보다 "새는 데가 없는가"를 먼저 봤다.

### 1. 아무나 아무에게나 −99점을 줄 수 있었다

**터졌을 것**: 0001의 후기 정책은 이것 한 줄이다.

```sql
create policy reviews_insert on reviews for insert with check (auth.uid() = reviewer_id);
```

"내 이름으로 쓰는 후기인가"만 본다. 화면을 붙이고 나면 다음이 전부 통과한다.

- 거래한 적 없는 이웃에게 후기 남기기 (`post_id`는 아무 글이나 된다)
- `score` 칸에 `-99` 넣기 → 상대 매너온도가 **한 번에 바닥(0°)**
- 판매중인 글, 상대를 안 고르고 끝낸 거래에도 후기 남기기

화면에서 버튼을 안 그리는 것으로는 아무것도 막지 못한다. `supabase-js`가 손에 있는 사용자는
테이블에 바로 insert할 수 있고, 그게 RLS가 있는 이유다.

**어떻게 비켰나**: 두 겹으로 나눠 막았다. 어느 쪽도 혼자서는 부족했다.

```sql
-- ① 정책 — 다른 테이블(posts)을 봐야 하는 조건. check 제약으로는 못 쓴다
create policy reviews_insert on reviews for insert with check (
  auth.uid() = reviewer_id and reviewer_id <> reviewee_id
  and exists (select 1 from posts p
               where p.id = reviews.post_id and p.status = 'sold' and p.buyer_id is not null
                 and ((p.seller_id = reviews.reviewer_id and p.buyer_id  = reviews.reviewee_id)
                   or (p.buyer_id  = reviews.reviewer_id and p.seller_id = reviews.reviewee_id)))
);

-- ② 제약 — 같은 행 안에서 끝나는 조건. 정책을 통과한 뒤에도 점수는 셋 중 하나뿐이다
alter table reviews add constraint reviews_score_allowed check (score in (-0.5, 0.1, 0.5));
```

정책만 두면 **진짜 거래 상대가** 온도를 −99만큼 깎는 길이 남고, 제약만 두면 아무나 −0.5씩
깎는 길이 남는다. "누가 쓸 수 있는가"와 "무엇을 쓸 수 있는가"는 다른 질문이라 막는 자리도 다르다.

**교훈**: 스키마가 미리 깔려 있다고 정책까지 완성돼 있는 것은 아니다. **화면이 없어서 아무도
안 쓰던 테이블**은 정책이 검증된 적도 없다는 뜻이다 — 첫 화면을 붙이는 사람이 정책을 먼저 읽어야 한다.

### 2. `MyPostList`에 다섯 번째 목록을 붙일 수 없었다

**터졌을 것**: 남의 프로필에 판매 목록을 그리려는데, 0012가 0009와 같은 열 벌을 돌려주므로
`MyPostList`를 그대로 쓰면 될 것 같았다. 그런데 그 컴포넌트의 `kind`는 화면 문구용 이름이
아니라 **RPC를 고르는 열쇠**다.

```ts
const RPC_BY_KIND: Record<MyListKind, string> = {
  likes: 'fetch_liked_posts', recent: 'fetch_recently_viewed_posts',
  purchases: 'fetch_purchased_posts', sales: 'fetch_selling_posts',
};
```

`MyListKind`에 `'user'`를 더하면 `Record`가 값을 요구한다. 넣을 이름이 없다 —
`fetch_user_posts`는 `p_user_id`를 받는 다른 모양이고, 나머지 넷은 "누구의 것"인지 아예 묻지
않는 함수들이다. 억지로 넣으면 마이페이지 목록에 남의 id를 넘기는 길이 열린다.

**어떻게 비켰나**: 목록의 껍데기를 `MyPostList`가 아니라 `PostList`(홈·검색)에서 가져왔다.
차이는 0건 문구뿐이라 `emptyMessage` 한 칸을 optional로 열었다.

**교훈**: 같은 데이터를 그린다고 같은 컴포넌트를 써야 하는 것은 아니다. 재사용의 경계는
**모양이 아니라 그 컴포넌트가 쥐고 있는 권한**이다 — `MyPostList`는 "내 것만 본다"는 보장을
함께 들고 있고, 그 보장이 필요 없는 화면에 그것을 끌어오면 보장이 헐거워진다.

### 3. check 제약 안에는 서브쿼리를 쓸 수 없다

**터졌을 것**: 매너 태그(`text[]`)에 원소마다 길이 제한을 걸려고 이렇게 썼다.

```sql
check ((select bool_and(char_length(t) <= 30) from unnest(manner_tags) t))
-- ERROR: cannot use subquery in check constraint
```

`unnest`가 집합을 돌려주므로 서브쿼리가 되고, check 제약은 **같은 행 안에서 끝나는 식**만 받는다.
(0008에서 "다른 테이블을 봐야 하는 조건은 check가 아니라 RLS"라고 적어 둔 것과 같은 벽인데,
이번에는 다른 테이블이 아니라 **같은 컬럼 안의 여러 값**이 걸렸다.)

**어떻게 비켰나**: 원소별 길이를 포기하고 **이어 붙인 전체 길이**를 봤다. 스칼라 식이라 통과한다.

```sql
check (coalesce(array_length(manner_tags, 1), 0) <= 5
       and char_length(array_to_string(manner_tags, ',')) <= 200)
```

막으려던 것이 애초에 "이상한 태그"가 아니라 **분량**이었으므로 이걸로 충분하다. 내용까지
화이트리스트로 묶지 않은 이유는 `comment`가 어차피 자유 문구라서다 — 태그만 잠가 봐야
막는 것이 없다.

**교훈**: 배열 컬럼에 "원소마다"를 걸고 싶으면 제약이 아니라 트리거이거나, 애초에 별도 테이블이다.
제약으로 끝내려면 질문을 **행 하나로 답할 수 있는 형태**로 바꿔야 한다.

## 안전 — 차단 · 신고 (2026-08-05)

### 1. `insert ... returning`이 RLS에 막혔다 — 넣는 건 되는데 넣고 나서 죽는다

**증상**: `create_report`를 0013의 `create_review`와 같은 모양으로 썼다.

```sql
returns bigint ...
  insert into reports (reporter_id, target_type, target_id, reason, detail)
  values (...) returning id into v_id;
  return v_id;
```

실제 사용자(`role authenticated` + jwt)로 부르니 이렇게 돌아왔다.

```
42501: new row violates row-level security policy for table "reports"
```

`reports_insert`는 `auth.uid() = reporter_id`뿐이고 `reporter_id`에는 `auth.uid()`를 넣었다.
정책은 분명히 통과해야 하는 값이다.

**원인**: 막힌 것은 insert가 아니라 **RETURNING**이다. RETURNING은 방금 넣은 행을 **다시
읽는** 일이라 SELECT 정책을 함께 탄다. 그런데 `reports`에는 select 정책이 **아예 없다**
(0001이 "조회 불가 = 관리자 전용"으로 일부러 그렇게 뒀다). 정책이 없으면 아무 행도 보이지
않으므로 RETURNING이 실패하고, 오류 문구는 insert 쪽 것으로 나온다.

RETURNING을 떼고 넣어 보면 같은 자리에서 성공한다.

```
[returning없음:성공] [returning있음:42501 new row violates row-level security policy]
```

**해결**: `returns void`로 바꿨다. 돌려줄 id도 신고자가 두 번 다시 쓸 수 없는 값이라
아쉬울 것이 없다(`reports`를 조회할 길이 없으므로).

같은 이유로 **중복 검사도 통하지 않았다.** 미리 `exists (select 1 from reports ...)`로 보려
했는데, 조회가 언제나 0건이라 검사가 있으나 마나였다. 사전 검사를 지우고 unique 인덱스에
맡긴 뒤 그 `23505`를 받아 한국어로 바꿨다.

```sql
create unique index reports_reporter_target_idx on reports (reporter_id, target_type, target_id);
...
exception
  when unique_violation then
    raise exception '이미 신고한 대상입니다.' using errcode = 'unique_violation';
```

**교훈**: **select 정책이 없는 테이블은 "쓰기 전용"이 아니라 "읽는 순간 전부 막히는" 테이블이다.**
insert 자체와 insert의 결과를 읽는 일은 다른 권한이고, RETURNING·`exists` 사전검사·
`.select()` 체이닝은 전부 뒤쪽에 속한다. 0013의 `create_review`를 그대로 베낄 수 없었던 것은
`reviews`가 `select using (true)`라 그 차이가 드러나지 않았기 때문이다.

### 2. 차단은 양방향인데 `blocks`는 한 방향만 보여준다 — 정책을 더하면 차단이 드러난다

**밟기 전에 확인한 것**: "차단한 사람의 글을 목록에서 뺀다"를 이렇게 쓰려 했다.

```sql
and not exists (select 1 from blocks b
                 where (b.blocker_id = auth.uid() and b.blocked_id = p.seller_id)
                    or (b.blocker_id = p.seller_id and b.blocked_id = auth.uid()))
```

돌려 보면 **아랫줄이 아무 일도 하지 않는다.** `blocks_select`(0001)가
`auth.uid() = blocker_id`라 내가 건 차단만 읽히기 때문이다. RLS 정책 안이든 `security invoker`
함수 안이든 다른 테이블을 조회하면 그 테이블의 정책이 그대로 걸린다 — 이 규칙이 여기서 물었다.

그렇다고 `auth.uid() = blocked_id` 정책을 더할 수는 없었다. 그 순간 **누가 나를 차단했는지
목록으로 조회할 수 있게 된다.** 차단은 상대가 모르는 것이 요건이라, 기능을 고치려다 기능을
망가뜨리는 수정이다.

**어떻게 비켰나**: `security definer` 함수를 두되 **PostgREST가 라우팅하지 않는 스키마**에
넣었다.

```sql
create schema if not exists private;
create function private.blocked_user_ids() returns uuid[] ... security definer ...
grant usage on schema private to anon, authenticated, service_role;
```

`security definer`라 정책을 넘어 양방향을 보고, `private`이라 클라이언트가 직접 부를 수 없다.
anon 키로 실제 확인했다.

```
POST /rest/v1/rpc/is_blocked                      -> 404
POST /rest/v1/rpc/blocked_user_ids  (Accept-Profile: private)
-> PGRST106 Only the following schemas are exposed: public, graphql_public
```

`grant usage on schema private`이 필요한 이유는 함수를 **부르는 쪽**이 여전히 로그인 사용자이기
때문이다(`search_posts`도 정책도 `security invoker`다). 권한을 열어도 REST로는 닿지 않는다 —
두 가지가 서로 다른 문이다.

**교훈**: Supabase에서 "정책을 넘어서 봐야 하는 판단"은 정책을 넓히는 것이 아니라
`security definer` + 비노출 스키마로 옮긴다. 정책을 넓히면 그 판단에 쓰인 **데이터까지 함께
열린다** — 여기서는 그 데이터가 곧 감춰야 할 것이었다.

### 3. 목록에서 지우기만 하면 차단당한 쪽이 계속 말할 수 있다

**밟기 전에 확인한 것**: `search_posts`와 `fetch_chat_rooms`에 필터를 넣고 "6-1 끝"이라고 볼
뻔했다. 그런데 차단은 대개 **대화를 나눈 뒤에** 누른다. 즉 방은 이미 있다.

- 차단한 쪽: 방이 목록에서 사라진다 (`fetch_chat_rooms`) ✔
- 차단당한 쪽: **자기 화면에는 방이 그대로 있다.** 계속 쓸 수 있다 ✘

이러면 상대의 말이 차단한 사람에게는 안 보이는 채로 쌓이고, 차단을 풀면 그동안의 말이 한꺼번에
나타난다. "차단했는데 왜 이 사람 메시지가 300개 와 있나"가 된다.

**어떻게 비켰나**: 막을 자리를 네 곳으로 세었다 — 목록 둘(`search_posts`·`fetch_chat_rooms`),
새 대화(`open_chat_room`), **이미 열린 방으로 넣기(`messages_insert` 정책)**.
마지막 것만 정책이고 나머지는 RPC다. 조회는 RPC가, 쓰기는 정책이 막는다.

거절 문구는 어느 쪽이 걸었는지 말하지 않는다. `open_chat_room`은 내가 걸었든 상대가 걸었든
`차단한 사용자와는 대화할 수 없습니다.` 하나고, 메시지 쪽은 정책이라 문구를 고를 수 없어
화면에서 받아 바꿨다.

```ts
// 아래 42501 문구("다시 로그인")로 뭉뚱그리면 엉뚱한 곳을 고치게 된다.
[/row-level security policy for table "messages"/, '지금은 이 대화에 메시지를 보낼 수 없습니다.'],
```

**교훈**: "안 보이게 한다"는 기능은 **보는 길**과 **넣는 길**을 따로 세어야 한다.
목록에서 지우는 것은 보는 길 하나를 막은 것뿐이고, 데이터는 여전히 들어온다.

### 4. `props.post`를 콜백 안에서 좁힌 줄 알았는데 풀려 있었다

**증상**: `SafetyMenu`에서 게시물이 있을 때만 "게시물 신고"를 그리려고 이렇게 썼다.

```tsx
{props.post === undefined ? null : (
  <button onClick={function reportPost() {
    openReport({ type: 'post', id: String(props.post.id), label: props.post.title });
  }}>
```

`props.post`가 `Object is possibly 'undefined'`로 잡힌다. 바깥에서 분명히 걸렀는데도.

**원인**: TypeScript의 좁힘은 **콜백 안으로 따라 들어가지 않는다.** `props`는 재할당될 수 있는
객체라, 콜백이 실제로 실행되는 시점에 `props.post`가 그대로라는 보장이 없기 때문이다.
`?.`와 `?? ''`로 달래면 컴파일은 통과하지만, 그건 "있을 리 없는 경우"에 빈 문자열을 신고
대상으로 보내는 코드다.

**해결**: 좁힌 값을 **지역 상수**로 받았다. `const`는 재할당되지 않으므로 좁힘이 콜백까지 간다.

```tsx
const post = props.post ?? null;
...
{post === null ? null : (<button onClick={function reportPost() {
  openReport({ type: 'post', id: String(post.id), label: post.title });
}}>)}
```

`viewerId`도 같은 이유로 지역 상수로 받아 뒀다(early return으로 이미 걸렀는데도
`BlockToggleButton`의 `string` prop에 넣을 때 다시 걸린다).

**교훈**: props의 필드를 조건부로 쓸 때는 **먼저 지역 상수로 꺼낸다.** `?.`를 덧붙여
컴파일러를 달래는 순간, 타입 오류가 알려 주려던 "정말 없을 때 무슨 값이 나가는가"를 놓친다.

---

## 알림 (2026-08-05)

### 1. 배지는 3인데 목록에는 한 줄 — 차단이 남긴 구멍

**증상**: 코드를 쓰기 전에 설계 단계에서 먼저 걸린 문제다.

6단계(차단)는 차단을 "안 보이게 하는 것"으로 정하고 목록 넷에서 걸러 냈다. 알림도 같은 대상이다 —
차단한 사람이 보낸 채팅 알림이 목록에 그대로 남아 있으면, 눌러서 들어간 방은 이미 사라진 뒤다.

그래서 목록 RPC에 `private.blocked_user_ids()` 필터를 다는 것까지는 자연스러웠다. 그런데
**안 읽은 수를 세는 쪽이 따라오지 못한다.**

```sql
-- 배지: 싸게 세려면 이래야 한다
select count(*) from notifications where user_id = auth.uid() and is_read = false;

-- 목록: 걸러야 하니 actor를 알아야 하고, actor를 알려면 join 다섯이 필요하다
```

배지는 3을 가리키는데 열어 보면 한 줄뿐인 화면이 된다. 숫자와 목록이 어긋나면 사용자는 둘 중
어느 쪽도 믿지 않게 된다.

**원인**: 걸러내기(필터)와 세기(count)의 비용이 다르다. 같은 조건을 양쪽에 걸면 배지 하나를 위해
목록과 같은 join을 매번 돌려야 하고, 한쪽만 걸면 두 숫자가 어긋난다.

**해결**: 거르는 대신 **차단하는 순간 지운다.** `blocks` after insert 트리거다.

```sql
create or replace function purge_blocked_notifications()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from notifications n
   where n.user_id in (new.blocker_id, new.blocked_id)
     and (
       exists (select 1 from messages m
                where m.id = (n.payload ->> 'message_id')::bigint
                  and m.sender_id in (new.blocker_id, new.blocked_id)
                  and m.sender_id <> n.user_id)
       or exists (select 1 from reviews r
                   where r.id = (n.payload ->> 'review_id')::bigint
                     and r.reviewer_id in (new.blocker_id, new.blocked_id)
                     and r.reviewer_id <> n.user_id)
     );
  return new;
end;
$$;
```

지우고 나면 목록에 필터가 필요 없고, 배지도 `count(*)` 한 줄이면 된다. 두 숫자가 **같은 행을
세게 되므로** 어긋날 자리 자체가 없어진다.

`security definer`인 이유는 `notifications`에 delete 정책이 아예 없어서다(0001). 본인 알림을
지우는 길을 클라이언트에 열어 줄 생각이 없어 정책을 더하지 않고 이 트리거 안에서만 지운다.

양쪽(`blocker_id`·`blocked_id`) 모두에서 지운다. 0014의 `fetch_chat_rooms`가 양방향으로 방을
감추므로, 한쪽에만 알림이 남으면 눌러도 갈 곳이 없는 알림이 된다.

**교훈**: **"목록에서 걸러낸다"는 결정은 그 목록을 세는 곳까지 따라간다.** 6단계에서 걸러낼 자리를
넷 찾아 놓고도 알림을 빠뜨렸는데, 그때 빠뜨린 대가가 7단계에서 "필터냐 삭제냐"라는 더 큰 선택으로
돌아왔다. 거르는 비용과 세는 비용이 다른 자리에서는 **아예 없애는 쪽**이 단순할 때가 있다.

---

### 2. 구독은 성공하는데 이벤트가 오지 않는다

**증상**: `subscribeToMyNotifications`를 `useChatRealtime` 패턴 그대로 짜 놓고 보니,
`todo.md`가 시킨 대로 했는데도 새 알림이 화면에 반영될 근거가 없었다.

**원인**: `notifications`가 **publication에 들어 있지 않았다.**

```sql
select tablename from pg_publication_tables where pubname = 'supabase_realtime';
-- chat_rooms, messages   ← notifications 없음
```

0008이 `messages`·`chat_rooms`만 넣었다. 그 파일의 주석은 "대시보드에서 켜면 db reset으로
재현되지 않으므로 여기에 남긴다"고 적어 뒀는데, 정작 그때 없던 테이블은 함께 넣히지 않았다.

무서운 것은 **이것이 오류로 보이지 않는다**는 점이다. `.subscribe()`는 `SUBSCRIBED`를 돌려주고
채널도 살아 있다. 이벤트만 영원히 오지 않는다. "왜 안 오지"를 클라이언트 쪽에서 찾기 시작하면
필터 문법·RLS·채널 이름을 차례로 의심하며 한참 헤맨다.

**해결**: 0008과 같은 모양으로 넣는다(`add table`은 이미 있으면 오류라 존재 확인 후 실행).

```sql
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;
end;
$$;
```

`replica identity full`은 걸지 않았다. 0008이 `messages`에 그것을 건 이유는 update의 **이전 행**이
필요해서였는데(읽음 표시), 알림은 insert만 구독한다.

**교훈**: Realtime이 안 될 때 **먼저 볼 곳은 클라이언트가 아니라 `pg_publication_tables`다.**
조용히 실패하는 설정은 코드를 아무리 들여다봐도 보이지 않는다.

---

### 3. 커서 유틸 테스트가 또 로드 단계에서 죽었다 — 세 번째다

**증상**: `notificationCursor.test.ts`만 스위트째 실패했다.

```
SyntaxError: Cannot use 'import.meta' outside a module
  at src/shared/lib/supabaseClient.ts:5
  at Object.<anonymous> (src/features/notification/api/notificationApi.ts:1:1)
  at Object.<anonymous> (src/features/notification/utils/notificationCursor.ts:1:1)
```

**원인**: 「동네 설정」 5번, 「탐색」 1번과 **글자 하나 다르지 않은 문제**다. 커서 유틸이 페이지 크기
상수 하나(`NOTIFICATIONS_PAGE_SIZE`)를 쓰려고 API 모듈을 import했고, 그것이 `supabaseClient`를
끌고 들어왔다.

**해결**: 같은 처방. 팩토리와 함께 모듈을 mock한다.

```ts
jest.mock('../api/notificationApi', function mockNotificationApi() {
  return { NOTIFICATIONS_PAGE_SIZE: 20 };
});
```

**교훈**: 「탐색」 1번에 "이미 한 번 밟은 함정은 같은 구조를 다시 만들 때 다시 밟는다"고 적어 뒀는데
그대로 다시 밟았다. **세 번 밟았으면 구조를 고칠 때다** — 페이지 크기 상수를 `types.ts`나 별도
상수 파일로 옮기면 커서 유틸이 API를 import할 이유가 사라진다. 이번에는 기존 셋(`chatCursor`,
`postSearchCursor`, `myPostCursor`)과 모양을 맞추는 쪽을 골랐지만, 다음에 네 번째가 생기면
그때는 옮기는 편이 낫다.

## 계정 — 비밀번호 변경 · 회원탈퇴 (2026-08-05)

이 절의 다섯 가지는 모두 **밟기 전에 확인한 함정이다.** 화면이 죽는 종류가 아니라
"동작은 하는데 뜻이 다른" 종류라, 만들고 나서는 눈에 띄지 않았을 것들이다.

### 1. `updateUser({ password })`는 현재 비밀번호를 묻지 않는다

**증상**: 비밀번호 변경 폼에 "현재 비밀번호" 칸을 두고 그 값을 아무 데도 쓰지 않아도
비밀번호가 바뀐다. 칸이 있으니 확인하는 것처럼 보이지만 **검사하는 사람이 없다.**

**원인**: `supabase.auth.updateUser`는 지금 세션이 유효한지만 본다. 카페에 열어 둔 브라우저,
공용 PC의 로그인 상태 하나면 계정을 통째로 가져갈 수 있다는 뜻이다.

Supabase에 "Secure password change"(변경 시 재인증 요구) 설정이 있지만 대시보드 스위치라
코드에는 흔적이 남지 않는다. 개발 편의로 꺼 둔 Confirm email과 같은 종류의 위험이다 —
대시보드 상태에 기대면 배포 때 잊는다.

**해결**: 바꾸기 전에 그 비밀번호로 실제 로그인해 본다.

```ts
const { error: signInError } = await supabase.auth.signInWithPassword({
  email: input.email, password: input.currentPassword,
});
if (signInError !== null) throw signInError;   // → "현재 비밀번호가 올바르지 않습니다."
```

덕분에 오류 매핑에서 `invalid_credentials`의 뜻이 이 화면에서만 달라진다. 로그인 화면에서는
"이메일 또는 비밀번호가 올바르지 않습니다"지만 여기서는 이메일이 세션에서 온 값이라 틀릴 수가
없다 — 그래서 `accountErrorMessage`는 같은 코드를 "현재 비밀번호가 올바르지 않습니다"로 읽는다.

### 2. `app_metadata.provider`로 판단하면 이메일 가입자의 비밀번호 변경이 사라진다

**증상**: 이메일로 가입한 사람이 구글로 한 번 로그인하면, 그 뒤로 계정 설정에서
비밀번호 변경 칸이 통째로 없어진다. 비밀번호는 그대로 살아 있는데 바꿀 길만 없다.

**원인**: `app_metadata.provider`는 계정의 로그인 방법이 아니라 **마지막으로 로그인한 방법**이다.
같은 이메일로 구글을 이어 붙이면 identity가 둘이 되지만 `provider`는 하나만 가리킨다.

**해결**: `user.identities` 배열을 본다. 한 계정에 붙은 로그인 방법 전부가 여기 있다.

```ts
return identities.some(function isPasswordIdentity(identity): boolean {
  return identity.provider === 'email';
});
```

`app_metadata`는 identities가 없는 응답일 때의 차선책으로만 남겼다. 단위 테스트에
"구글로 마지막에 로그인했어도 이메일 identity가 남아 있으면 바꿀 수 있다"를 넣어 둔 이유다.

### 3. 탈퇴 직후의 `signOut()`은 실패하고, 죽은 토큰이 남는다

**증상**: 계정을 지운 뒤 평소처럼 로그아웃하면 401이 돌아온다. 계정이 없으니 당연하다.
문제는 **supabase-js가 서버 응답이 실패하면 저장소의 토큰을 지우지 않는다**는 것이다.
새로고침하면 이미 없는 사람의 세션으로 화면이 다시 서고, 첫 요청에서야 무너진다.

**원인**: 기본 `scope: 'global'`은 서버에 "이 사용자의 세션을 모두 끊어라"라고 말한다.
지울 사용자가 없으면 그 말이 실패하고, 실패한 로그아웃은 로컬 정리까지 건너뛴다.

**해결**: 서버에 알리지 않고 이 기기의 토큰만 지운다.

```ts
// authApi.signOutLocally — 탈퇴 직후 전용
await supabase.auth.signOut({ scope: 'local' });
```

로그아웃(`useSignOutMutation`)은 그대로 `global`을 쓴다. 그쪽은 계정이 살아 있어
다른 기기의 세션까지 끊는 것이 맞다.

### 4. Edge Function이 적어 보낸 이유가 화면까지 오지 않는다

**증상**: 함수가 `{ "error": "로그인이 만료되었습니다. 다시 로그인해 주세요." }`를 401로
돌려줘도 화면에는 `Edge Function returned a non-2xx status code`만 뜬다.

**원인**: `functions.invoke`는 2xx가 아니면 `FunctionsHttpError`를 만들어 주고 **본문은 읽지
않는다.** 응답은 `error.context`(Response)에 그대로 들어 있지만 아무도 열어 보지 않는 상태다.

**해결**: 던지기 전에 본문을 열어 우리가 적어 보낸 문구를 꺼낸다.

```ts
if (error instanceof FunctionsHttpError) {
  const body: unknown = await error.context.json();   // JSON이 아니면 catch로 흘린다
  ...
}
```

꺼내지 못하면 원래 오류를 그대로 던진다. 그때는 `accountErrorMessage`의 `non-2xx` 패턴이
"탈퇴 요청이 서버에 닿지 못했습니다"로 받는다 — **함수를 아직 배포하지 않은 상태**가
정확히 이 경로로 떨어진다.

### 5. 스토리지는 `on delete cascade`를 타지 않는다 — 게다가 채팅 사진만 경로가 다르다

**증상**: 탈퇴하면 DB는 깨끗해지는데(0001의 FK가 전부 cascade다) 버킷에는 사진이 그대로 남는다.
아무 행도 가리키지 않아 다시 찾을 방법도 없는 파일이다.

**원인**: `storage.objects`는 `profiles`를 참조하지 않는다. 파일과 행을 잇는 것은
`posts.thumbnail_url` 같은 문자열뿐이라 FK가 따라갈 길이 없다.

여기까지는 예상한 일이고, 실제로 걸린 것은 **버킷마다 경로 규칙이 다르다**는 쪽이었다.

| 버킷 | 경로 | 사용자 접두사로 훑을 수 있나 |
| --- | --- | --- |
| `avatars` (0002) | `{user_id}/{stamp}.ext` | 된다 |
| `post-images` (0005) | `{user_id}/{stamp}-{i}.ext` | 된다 |
| `chat-images` (0008) | `{room_id}/{user_id}/…` | **안 된다** |

0008이 채팅 사진의 첫 칸을 방으로 둔 것은 storage 정책이 "이 방 사람인가"를 봐야 했기 때문이다.
그 판단은 지금도 옳지만, 덕분에 "이 사람의 파일"을 접두사 하나로 모을 수 없다.

**해결**: 삭제 **전에** `chat_rooms`에서 내 방 번호를 읽어 둔다. 행이 사라진 뒤에는 알 길이 없다.

```ts
const roomIds = await fetchRoomIds(admin, userId);          // 삭제 전
await admin.auth.admin.deleteUser(userId);
await removeUserFiles(admin, userId, roomIds);              // {room_id}/{user_id} 만 지운다
```

방을 통째로 비우지 않는다 — 같은 폴더에 상대가 올린 사진이 함께 들어 있다.
`storage.list`가 기본 100개까지만 주는 것도 여기서 걸린다. 사진 100장을 넘긴 사용자의
나머지가 조용히 남지 않도록 `offset`으로 끝까지 넘긴다.

---

## 후기가 사라질 때의 매너온도 (2026-08-05)

### 1. 더한 값과 뺀 값이 다르다 — 클램프는 가역적이지 않다

**증상**: 지우는 트리거를 0001의 더하기와 짝이 맞게 짜면 된다고 생각했다.

```sql
-- 넣을 때 (0001)
set manner_temp = greatest(0, least(99, manner_temp + new.score))
-- 지울 때 (짝이 맞아 보인다)
set manner_temp = greatest(0, least(99, manner_temp - old.score))
```

대부분의 경우 맞는다. 그런데 온도가 끝에 닿은 적이 있으면 후기를 지운 뒤 **받은 적도 없는
점수를 잃는다.**

```
99.0°에서 +0.5 후기 도착  → 99.0  (least(99, 99.5)로 잘림)
그 후기가 cascade로 삭제  → 98.5  ← 0.5°가 근거 없이 사라진다
```

**원인**: `greatest/least`가 정보를 버린다. 잘린 만큼은 어디에도 남지 않으므로, 뺄 때는 무엇을
잘랐는지 알 방법이 없다. 누적값을 증감으로 관리하는 한 피할 수 없는 문제다 —
0~99 범위를 없애지 않는 이상 더하기와 빼기는 서로의 역함수가 아니다.

바닥에서도 같다. 0°에서 −0.5를 받아 0°로 잘린 뒤 그 후기가 지워지면 0.5°가 생긴다.

**해결**: 증감을 버리고 **매번 다시 계산한다.** 후기가 곧 근거이므로 근거에서 값을 만든다.

```sql
create or replace function sync_manner_temp(p_user uuid) returns void language sql
security definer set search_path = public as $$
  update profiles
     set manner_temp = greatest(0, least(99, 36.5 + coalesce((
           select sum(r.score) from reviews r where r.reviewee_id = p_user
         ), 0)))
   where id = p_user;
$$;
```

넣을 때도 뺄 때도 이것 하나를 부른다. 몇 건이 어떤 순서로 오가든 결과가 같고, **이미 어긋나
있던 값도 다음 한 건에 스스로 맞는다.** 클램프는 남지만 저장된 값이 아니라 표시 직전에만
걸리므로 누적되지 않는다.

`reviews_reviewee_idx`(0001)가 이 합계 조회를 받는다. 사람 하나가 탈퇴하면 그 사람이 쓴 후기
수만큼 도는데, 한 사람이 남기는 후기가 수십 건을 넘지 않아 statement 트리거로 접지 않았다.

### 2. 구멍은 탈퇴가 아니라 **게시물 삭제**가 먼저 열었다

**증상**: 회원탈퇴(8단계)가 cascade로 후기를 지운다는 것만 보고 이 작업을 시작했다.
그런데 `reviews`의 FK는 셋이고, 그중 하나는 `post_id`다.

**원인**: 후기를 지우는 길이 탈퇴보다 하루 먼저 열려 있었다.

```
$ grep -rn "posts_delete" supabase/migrations/*.sql
0001_init.sql:356:create policy posts_delete on posts for delete using (auth.uid() = seller_id);
```

상태 제한이 없다. `postApi.deletePost`도 `status`를 보지 않고 지운다. 즉 **거래완료된 글을
지우면 그 거래의 후기가 함께 사라지는데 온도는 그대로**였고, 이건 2단계(게시물 수정·삭제,
08-04)부터 이미 밟히고 있었다. 판매자가 끝난 거래를 정리하는 것은 드문 일도 아니다.

`troble.md`를 뒤로 미룰 뻔한 이유가 여기 있다 — "탈퇴는 아직 아무도 안 했으니 급하지 않다"고
읽었는데, 실제로는 한 단계 전부터 새고 있었다.

**해결**: 트리거를 후기 삭제 전체에 붙이고(경로를 가리지 않는다), 이미 어긋난 값은
`profiles` 전체를 도는 백필로 한 번 맞췄다. 트리거는 앞으로만 지켜 주기 때문이다.

백필에서 `reviews`에 남아 있는 사람만 훑으면 **가장 어긋난 사람을 놓친다** — 받은 후기가
전부 사라진 사람은 `reviews`에 흔적이 없는데 온도만 옛 값으로 남아 있다.

### 3. 실제 DB에서 확인하되 아무것도 남기지 않는 법

**증상**: 트리거는 화면이 없어 Jest로 잡히지 않는다. 확인하려면 후기를 만들고 지워 봐야
하는데, 그러려면 거래완료된 글과 두 당사자가 필요하고 그 흔적이 실제 DB에 남는다.

**해결**: 만들고 → 확인하고 → **마지막에 일부러 예외를 던진다.** 예외가 트랜잭션을 통째로
되돌리므로 정리할 것이 없고, 확인한 숫자는 예외 메시지에 실려 그대로 올라온다.

```sql
do $$
declare v_log text := '';
begin
  -- … 게시물·후기를 만들고 단계마다 v_log에 온도를 적는다
  raise exception '검증결과(롤백됨):%', v_log;
end;
$$;
```

```
시작        : 36.5
후기 3건    : 37.0
ⓐ 후기 삭제 : 37.5
ⓑ 게시물삭제 : 37.0
ⓒ 작성자탈퇴 : 36.5
```

되돌아온 뒤 프로필 3행·후기 0건·온도 전부 36.5로 그대로였다. `execute_sql`이 호출마다 다른
연결일 수 있어 임시 테이블로는 결과를 넘길 수 없는데, 이 방법은 한 번의 호출로 끝난다.

---

## 게시물 댓글 (2026-08-05)

### 1. 차단이 댓글만 비껴간다 — 0001의 `using (true)`

**증상**: 6단계에서 차단을 만들 때 "목록에서 걸러낼 자리가 넷"이라고 정리했는데, 댓글을
붙이자 다섯 번째가 나타났다. 0001의 정책이 이렇다.

```sql
create policy comments_select on comments for select using (true);
```

차단한 사람의 댓글이 그대로 보인다. 게시물은 목록에서 사라지고 채팅은 막히는데, 그 사람이
남긴 댓글만 눈앞에 남는다.

**원인**: 0001은 테이블을 만드는 파일이라 정책도 "누가 읽고 쓰는가"까지만 적었다.
차단은 6단계에 생겼고, 그때 댓글은 화면이 없어 고칠 자리로 보이지 않았다.
0013(`reviews_insert`가 아무에게나 −99점을 허용)·0014(`reports.reason`이 자유 text)와
같은 자리다 — **0001의 정책은 그 칸을 쓰는 화면이 생길 때 다시 읽어야 한다.**

**해결**: 0014가 만들어 둔 판정 함수를 정책에 건다.

```sql
create policy comments_select on comments
  for select using (author_id <> all (private.blocked_user_ids()));
```

RPC가 아니라 정책에 둔 것이 이번의 판단이다. 0014는 목록 RPC 쪽에서 걸렀지만 그건 그
목록들이 이미 RPC였기 때문이고, 댓글은 임베드로 읽어 걸러낼 자리가 질의문에 없다.
정책에 두면 어느 경로로 읽든 걸리고, 나중에 목록 RPC를 만들어도 다시 적을 필요가 없다.

행마다 `blocks`를 뒤지는 것 아닌가가 마지막 걱정이었는데, `private.blocked_user_ids()`는
**인자가 없는 stable 함수라 질의당 한 번만 계산된다.** 0014가 배열로 만들어 둔 이유가
목록 RPC만을 위한 것이 아니었다.

### 2. 근거로 삼은 것 두 개가 틀렸다 — FK와 `posts_select`

**증상**: `comments_insert`를 조이면서 "0001은 `auth.uid() = author_id` 하나뿐이라
**지워진 글에도 댓글이 들어간다**"고 적고 정책에 존재 검사를 넣었다.

```sql
and exists (select 1 from posts p where p.id = comments.post_id ...)   -- ①
```

그리고 그 검사에 "`posts_select`가 걸리므로 볼 수 있는 글인지도 함께 본다"는 주석을 달았다.

**원인**: 둘 다 확인하지 않고 쓴 말이었다.

```
$ grep -rn "policy posts_select" supabase/migrations/*.sql
0001_init.sql:353:create policy posts_select on posts for select using (true);
```

- `post_id`는 `references posts (id)`다. 없는 글을 가리키면 **FK가 insert 자체를 막는다.**
  정책이 할 일이 아니었다.
- `posts_select`가 `using (true)`라 "볼 수 있는 글"이라는 구분 자체가 없다. 게시물은
  누구에게나 공개다.

정책은 그대로 둬도 동작에 문제가 없지만, **주석이 사실과 다르면 다음 사람이 그 말을 근거로
다른 결정을 한다.** 여기서는 `exists`가 존재를 보장하는 줄 알고 FK를 떼는 식이 된다.

**해결**: 이유를 정확히 다시 적고, `exists`는 차단 검사만 하는 것으로 남겼다.
남길 값이 있는 조건은 하나뿐이었다.

```sql
and exists (
  select 1 from posts p
   where p.id = comments.post_id
     and not private.is_blocked(auth.uid(), p.seller_id)
)
```

### 3. RLS는 화면으로도 Jest로도 확인되지 않는다

**증상**: 정책 넷을 고쳤는데 확인할 방법이 없었다. Jest는 `commentApi`를 통째로 mock하므로
정책까지 닿지 않고, MCP `execute_sql`은 `postgres`로 도는데 그 역할은 **BYPASSRLS라
정책이 아예 걸리지 않는다.** 그대로 두면 "정책을 썼다"까지만 하고 끝난다.

**해결**: 트랜잭션 안에서 역할과 JWT를 갈아 끼운다.

```sql
execute format('set local role authenticated');
execute format('set local request.jwt.claims = %L', json_build_object('sub', v_b)::text);
select count(*) from comments where post_id = v_post;   -- 이제 B로서 읽는다
```

`auth.uid()`가 `request.jwt.claims ->> 'sub'`를 읽으므로 사용자를 바꿔 가며 같은 질의를
돌릴 수 있다. 막히는 쪽은 `begin … exception when others then` 으로 감싸 `sqlstate`를
기록하면 "막혔다"까지 확인된다. 준비가 필요한 단계(글·차단 만들기)는 `set local role postgres`로
돌아가 처리하고, 마지막에 예외를 던져 통째로 롤백한다(0016 검증과 같은 방법).

여덟 가지를 한 번에 밟았다 — 차단 전/후 양방향, 판매자 차단 후 쓰기(42501), 판매자의
남의 댓글 삭제(1행), 제3자의 삭제(0행), 공백 댓글(23514). **⑦의 "0행"이 특히 이 방법이라야
잡힌다** — RLS로 막힌 delete는 오류가 아니라 조용히 0행이라, 예외만 보고 있으면 통과한 줄 안다.

## 채널 이름이 겹쳐 화면이 죽는다 (2026-08-05)

### 1. `supabase.channel(이름)`은 새 채널을 만들어 주지 않는다

**증상**: 채팅 목록으로 가면 화면이 통째로 죽었다.

```
cannot add `postgres_changes` callbacks for realtime:chat-rooms after `subscribe()`.
  at subscribeToMyChatRooms (chatApi.ts)
  at subscribeToRooms (useChatRealtime.ts)
```

**원인**: 이름을 보고 "새 채널"이라고 읽었는데 아니었다. `RealtimeClient.channel(topic)`은
같은 이름이 이미 있으면 **그것을 그대로 돌려준다.**

```js
const exists = this.getChannels().find((c) => c.topic === realtimeTopic);
if (!exists) { … return chan; } else { return exists; }
```

그래서 둘째로 부른 쪽은 남이 이미 `subscribe()`까지 마친 채널을 받아 들고, 거기에 `.on()`을
건다. `RealtimeChannel.on`은 채널이 joined/joining이면 예외를 던진다 — 이미 서버와 맞춰 둔
구독 조건에 뒤늦게 하나 더 얹을 수 없기 때문이다.

**해결**: 이름 뒤에 일련번호를 붙여 매번 새 채널을 받는다(`uniqueChannelTopic`).
topic은 클라이언트가 채널을 구분하려고 쓰는 이름일 뿐이고, 서버가 무엇을 보낼지는
`.on()`에 넘긴 조건이 정한다 — 이름이 달라도 받는 것은 같다.

### 2. 겹친 것은 사고가 아니라 설계였다

**증상**: "어디서 두 번 부르지" 하고 중복 호출을 찾았는데 없었다. 부르는 곳은 각자 한 번씩이다.

**원인**: `useChatRoomsRealtime`을 거는 곳이 **둘 다 맞다.**

- `useUnreadChatCount` — 탭바 배지. 늘 떠 있다.
- `chatRoomListPage` — 채팅 목록 화면.

같은 방 목록을 보므로 같은 구독을 거는 것이 당연하고, 한쪽이 늘 떠 있으므로 다른 쪽으로
이동하는 순간 **반드시** 부딪힌다. 우연히 겹치는 게 아니라 그 화면에 들어가면 100% 죽는다.

**해결**: 같은 짝이 알림에도 있었다 — `notificationBellLink`(헤더)와 `notificationPage`다.
증상은 채팅에서만 봤지만 알림 화면도 같은 이유로 죽는 상태였다. 세 곳을 한꺼번에 고쳤다.

`notifications-${viewerId}`처럼 이름에 id를 넣어 둔 것이 방어가 되어 주지 않는다 —
갈라지는 것은 **사용자**인데 겹치는 것은 **같은 사용자의 두 화면**이다.

### 3. 테스트가 넉넉히 통과하는데도 죽어 있었다

**증상**: 84 스위트 581건이 다 통과하는 상태에서 화면은 열리지 않았다.

**원인**: 화면 테스트는 `chatApi`·`notificationApi`를 통째로 mock한다(troble.md #5의 `import.meta`
때문이다). mock한 함수는 채널을 열지 않으므로 이 충돌이 일어날 자리가 없다.
Realtime 구독은 **api를 mock하는 순간 시험 범위 밖으로 나간다.**

**해결**: 이번 것은 `uniqueChannelTopic`을 순수 함수로 떼어 내 그 부분만 단위 시험으로 묶었다.
다만 "두 화면이 같은 구독을 건다"는 조합 자체는 여전히 시험이 잡지 못한다 —
같은 훅을 두 곳에서 거는 것을 새로 만들 때는 화면을 직접 열어 봐야 한다.

## 댓글 · 찜 알림 (2026-08-05)

### 1. 미리 만들어 둔 자리가 절반만 채워져 있었다

**증상**: 0015가 "댓글·찜도 함께 풀어 두었다"고 적어 두었기에 트리거 둘만 쓰면 끝날 줄 알았다.
그런데 만들고 보니 알림이 전부 "**알 수 없는 이웃**님이 댓글을 남겼어요"가 될 상태였다.

**원인**: 풀려 있던 것은 게시물과 미리보기 **자리**까지였고, 사람은 아니었다.

```sql
left join profiles actor on actor.id = coalesce(m.sender_id, rv.reviewer_id)
```

댓글·찜에는 메시지도 후기도 없다. 나쁜 것은 **이것이 버그로 보이지 않는다**는 점이다 —
프로필이 지워졌을 때 쓰라고 만들어 둔 폴백(`UNKNOWN_ACTOR`)이 정상 동작인 척 덮는다.
화면은 멀쩡히 그려지고 문장도 완성된다.

**해결**: payload에 `actor_id`를 직접 넣고 coalesce의 마지막 갈래로 더했다. 같은 이유로
미리보기 `case`와 `purge_blocked_notifications`도 함께 손봤다 — 셋 다 "사람을 어떻게
찾아가는가"에 걸린 문제였다.

**"자리를 미리 만들어 뒀다"는 "그 자리가 채워진다"와 다르다.** 미리 만든 쪽을 믿지 말고
붙이는 쪽이 경로를 끝까지 밟아 봐야 한다.

### 2. 찜에는 가리킬 id가 없다

**증상**: 댓글은 `comment_id`를 payload에 넣으면 되는데 찜은 넣을 것이 없었다.

**원인**: `likes`의 기본키가 `(user_id, post_id)`다. 0001이 찜을 "행 하나"가 아니라
"관계"로 만들어 놓았기 때문에 대리키가 없다. `post_id`만 넣으면 누가 눌렀는지가 사라진다.

**해결**: 두 타입 모두 `actor_id`를 payload에 넣었다. 덤으로 차단 청소가 **타입을 묻지 않는
갈래 하나**로 줄었다 — 0015가 message_id·review_id를 각각 join해야 했던 것은 사람이
payload에 없었기 때문이지, 그렇게 하는 편이 나아서가 아니었다.

### 3. 찜만 차단 방어선이 없었다

**증상**: 차단 관계에서 찜을 넣어 보니 **그냥 들어갔다.** 0014가 넷을, 0017이 다섯 번째를
막았는데 찜은 어디에도 없었다.

**원인**: 0006의 `likes_insert`는 자기 글인지만 본다. 0014는 "보이는 것"을 막는 데 집중해
목록 넷을 골랐고, 찜은 목록이 아니라 행위라 그 그물에 걸리지 않았다.

**해결**: 정책을 고쳐 찜 자체를 막지 않고 트리거에서 알림만 막았다.
찜은 **상대에게 닿지 않는 행위**다 — 개수가 `like_count`로 합쳐져 있어 누가 눌렀는지
판매자가 볼 길이 없다. 막을 것은 알림이지 찜이 아니다.

### 4. 트리거의 차단 가드는 정책 시험으로 확인되지 않는다

**증상**: 차단 상태에서 댓글을 쓰면 42501로 막힌다. 여기까지만 보고 "차단 처리 확인"으로
넘어가려 했는데, 그러면 **트리거 안에 쓴 `is_blocked` 두 줄은 한 번도 안 밟힌다.**
정책이 앞에서 막아 트리거까지 오지 않기 때문이다.

**원인**: 0017의 `comments_insert`가 먼저 걸린다. 그리고 그 정책은 **판매자만 본다** —
부모 댓글 작성자와의 차단 관계는 보지 않는다. 정책 시험만으로는 그 갈래가 통째로 빈다.

**해결**: `set local role postgres`로 정책을 우회해 직접 넣고, 그때 알림이 0건인지 확인했다.
`security definer` 트리거는 시드·관리 작업에서도 도는데 그 경로에는 정책이 없으므로
이 확인이 실제 상황이기도 하다.

### 5. "합계 0건"을 기대했다가 1건이 나왔다

**증상**: 검증 마지막 줄 `select count(*) from notifications`이 1건을 냈다. 롤백 안에서
만든 알림은 전부 확인했는데 어디서 하나가 더 나오는지 한참 찾았다.

**원인**: 내 검증 데이터가 아니라 **실제 사용 중에 쌓인 `chat` 알림 한 건**이었다.
테이블 전체를 세는 조건을 써 놓고 "이번에 만든 것"의 기댓값을 적었다.

**해결**: 기댓값이 아니라 조건이 틀렸다. 앞의 항목들은 `user_id`·`type`으로 좁혀 세고 있어
멀쩡했고, 마지막 한 줄만 조건을 잃었다. **롤백 검증은 빈 DB에서 도는 것이 아니다** —
"전체"를 세는 순간 남의 데이터가 섞인다.

## 롤백 테스트가 "통과"라고 거짓말한다 (2026-08-06)

### 증상

0027(가격 제안 취소)의 전이 규칙을 확인하려고 시나리오 열 개를 한 트랜잭션에서 밟았다.
아홉 개는 예상대로였는데 하나가 이상했다.

```
받은쪽이 남의 제안을 대신 취소   →  통과
```

트리거에는 분명히 막는 갈래가 있다.

```sql
elsif new.offer_status not in ('accepted', 'rejected') then
  raise exception '받은 제안은 수락하거나 거절할 수 있습니다.'
```

`'cancelled'`는 저 목록에 없으니 걸려야 하는데 통과했다. 트리거가 안 도는 것처럼 보였다.

### 원인

**트리거는 멀쩡했고 테스트가 틀렸다.**

시나리오들이 **같은 행 하나를 이어 쓰고 있었다.** 그 행은 첫 시나리오("보낸쪽 pending →
cancelled")에서 이미 `cancelled`가 된 상태였다. 그래서 문제의 시나리오는 실제로는
`cancelled → cancelled`를 시도했고, 트리거의 첫 줄에서 이렇게 걸러졌다.

```sql
if new.offer_status is distinct from old.offer_status then   -- ← 여기가 false
```

같은 값을 다시 쓰는 것은 **바뀐 것이 없으므로** 전이 검사 블록에 아예 들어가지 않는다.
update 자체는 한 행에 성공했으므로 `row_count = 1`이고, 내 판정 함수는 그것을 "통과"로 읽었다.

즉 **막혀야 할 것이 통과한 것이 아니라, 애초에 막을 일이 없는 no-op이었다.**
검사식이 `is distinct from`인 것은 맞다 — 안 바뀐 값을 굳이 검사하면 읽음 표시만 찍는 update가
제안 상태 규칙에 걸린다.

### 해결

판정 함수가 **시나리오마다 제안을 새로 심게** 고쳤다. 시작 상태를 인자로 받는다.

```sql
create function pg_temp.probe(p_uid uuid, p_from text, p_set text) returns text ...
  insert into messages (...) values (..., nullif(p_from,'null')::offer_status)
  returning id into v_id;
  -- 그 행에만 update를 건다
```

다시 밟으니 `받은쪽이 pending인 남의 제안을 대신 취소 → 거절: 받은 제안은 수락하거나
거절할 수 있습니다`가 나왔다. 나머지 여덟도 그대로 유지됐다.

### 남는 교훈

**한 트랜잭션에서 시나리오를 이어 밟으면 앞 단계의 결과가 뒤 단계의 시작 상태가 된다.**
상태 전이를 검사하는 규칙일수록 이게 치명적이다 — 시작 상태가 달라지면 **다른 갈래를 재고
있으면서 같은 것을 잰 줄 안다.**

그리고 이 실패는 **"막혀야 하는데 통과"**로 보였기 때문에 위험했다. 반대 방향
(통과해야 하는데 거절)이었으면 곧바로 코드를 고치러 갔을 텐데, 이쪽은 "정책이 헐겁구나" 하고
**트리거를 잘못 조이는 쪽으로 갈 뻔했다.** 테스트가 틀렸을 가능성을 코드보다 먼저 의심할
자리가 있다 — 다른 아홉 개가 전부 맞을 때다.
