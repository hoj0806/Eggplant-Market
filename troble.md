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
