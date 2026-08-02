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
