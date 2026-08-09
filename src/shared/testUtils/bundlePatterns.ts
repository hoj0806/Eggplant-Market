/**
 * 번들 안을 들여다보는 규칙 한 벌.
 *
 * **두 곳이 같은 규칙을 쓴다.**
 *
 * - `build` 갈래 — 방금 만든 `dist/`를 검사한다.
 * - `smoke` 갈래 — **배포되어 실제로 서비스되는** 번들을 검사한다.
 *
 * 겹쳐 보이지만 다른 질문이다. **빌드가 맞아도 배포가 틀릴 수 있다** — 2026-08-08에
 * 환경변수를 고치고 재배포를 안 해 옛 번들이 계속 나갔다. 그래서 같은 검사를 두 번 한다.
 * 다만 **규칙까지 두 벌이면** 한쪽만 고쳐지는 날이 오므로 여기 한 곳에 둔다.
 */

/** 프로젝트 ref는 소문자·숫자 20자다. `https://` 8 + 20 + `.supabase.co` 12 = 40자. */
export const SUPABASE_URL_PATTERN = /https:\/\/[a-z0-9]{20}\.supabase\.co/;

/** 새 형식의 공개 키. 옛 JWT 키(`eyJ…`)를 쓰면 여기서 걸린다. */
export const ANON_KEY_PATTERN = /sb_publishable_[A-Za-z0-9_-]{20,}/;

/** 앱키가 있어도 로더가 빠지면 지도가 안 뜬다. 둘은 다른 사고라 따로 본다. */
export const KAKAO_SDK_URL_FRAGMENT = 'dapi.kakao.com/v2/maps/sdk.js?appkey=';

/**
 * 서버 전용 키가 새는 것. 하나라도 걸리면 즉시 폐기해야 할 사고다.
 *
 * 정규식이 좁은 데는 이유가 있다. **오탐이 한 번만 나도 사람은 검사를 무시하기 시작하고,
 * 무시하기 시작하면 진짜가 샐 때도 무시한다.**
 */
export const SECRET_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  // `sb_secret_` **문자열 자체**는 supabase-js의 형식 판별 코드에 정상적으로 들어 있다.
  // 접두사만 찾으면 매번 오탐이 난다 — 뒤에 실제 키가 붙은 경우만 잡는다.
  ['sb_secret_ 뒤에 실제 키', /sb_secret_[A-Za-z0-9_-]{10,}/],
  ['service_role', /service_role/],
  // 토막 셋을 요구한다. `eyJ`만 찾으면 base64로 인코딩된 아무 데이터나 걸린다.
  ['JWT', /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/],
];

/** 값이 안 새도 이 이름이 보이면 `VITE_` 접두사를 잘못 붙였다는 신호다. */
export const SERVER_ONLY_ENV_NAME = 'SUPABASE_SERVICE_ROLE_KEY';

function firstMatch(text: string, pattern: RegExp): string | null {
  const found = text.match(pattern);

  return found === null ? null : found[0];
}

export function findSupabaseUrl(text: string): string | null {
  return firstMatch(text, SUPABASE_URL_PATTERN);
}

export function findAnonKey(text: string): string | null {
  return firstMatch(text, ANON_KEY_PATTERN);
}

/**
 * 카카오 JavaScript 앱키(32자 hex)를 찾는다.
 *
 * **`appkey=` 뒤에서는 못 찾는다.** 소스는 템플릿 문자열이지만
 * (`?appkey=${KAKAO_APP_KEY}`) 번들러가 키를 변수로 빼기 때문이다.
 *
 * ```js
 * const ck="82cb…923e";
 * function qU(){return`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${ck}&…`}
 * ```
 *
 * 그래서 **모양으로** 찾는다. 다만 supabase-js에 `"0"`이 32개인 문자열이 들어 있어
 * **같은 글자만 반복되는 것은 뺀다.**
 *
 * 한 글자라도 잘리면 32자가 아니라 매칭 자체가 실패한다 — 2026-08-08 사고를 잡는 자리다.
 */
export function findKakaoAppKeys(text: string): string[] {
  return Array.from(text.matchAll(/["']([0-9a-f]{32})["']/g))
    .map(function pickValue(found: RegExpMatchArray): string {
      return found[1];
    })
    .filter(function isNotRepeated(value: string): boolean {
      return new Set(value).size > 1;
    });
}
