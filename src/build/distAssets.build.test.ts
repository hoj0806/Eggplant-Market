import { gzipSize, joinText, readAssets } from './distFiles';

/**
 * 번들 안을 들여다본다. **환경변수가 제대로 박혔는가**와 **비밀이 안 섞였는가**가 핵심이다.
 *
 * `import.meta.env`는 빌드 시점에 값이 박힌다. 단위 테스트는 그 모듈을 mock하고, 통합
 * 테스트는 `process.env` 쌍둥이로 갈아끼운다 — **그 경로를 밟는 테스트가 구조적으로 없다.**
 * 2026-08-08에 카카오 앱키가 한 글자 잘린 채 배포됐는데 828개가 전부 초록이었던 이유다.
 *
 * 그래서 **값이 무엇인지는 안 본다**(저장소에 정답이 없다). 형식과 길이만 본다 —
 * 한 글자 잘린 키는 형식에서 걸린다.
 */

const JS_ASSETS = readAssets('.js');
const BUNDLE = joinText(JS_ASSETS);

/** 프로젝트 ref는 소문자 20자다. `https://` 8 + 20 + `.supabase.co` 12 = 40자. */
const SUPABASE_URL_PATTERN = /https:\/\/[a-z0-9]{20}\.supabase\.co/;

/** 새 형식의 공개 키. 옛 JWT 키(`eyJ…`)를 쓰면 여기서 걸린다. */
const ANON_KEY_PATTERN = /sb_publishable_[A-Za-z0-9_-]{20,}/;

/** 카카오 JavaScript 앱키는 32자 hex다. 잘리면 길이가 안 맞아 매칭이 통째로 실패한다. */
const KAKAO_KEY_PATTERN = /["']([0-9a-f]{32})["']/g;

/** 서버 전용 키가 새는 것. 하나라도 걸리면 즉시 폐기해야 할 사고다. */
const SECRET_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  // `sb_secret_` **문자열 자체**는 supabase-js의 형식 판별 코드에 정상적으로 들어 있다.
  // 그래서 접두사만 찾으면 매번 오탐이 난다 — 뒤에 실제 키가 붙은 경우만 잡는다.
  ['sb_secret_ 뒤에 실제 키', /sb_secret_[A-Za-z0-9_-]{10,}/],
  ['service_role', /service_role/],
  // 토막 셋을 요구한다. `eyJ`만 찾으면 base64로 인코딩된 아무 데이터나 걸린다.
  ['JWT', /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/],
];

/** 지금 gzip 224 kB. 쪼개기는 안 하기로 했지만, 모르는 새 두 배가 되는 것은 다른 문제다. */
const GZIP_LIMIT_BYTES = 300 * 1024;

describe('dist/assets', function distAssetsSuite() {
  it('자바스크립트 번들이 있다', function bundleExists() {
    expect(JS_ASSETS.length).toBeGreaterThan(0);
  });

  describe('환경변수가 번들에 박혔는가', function bakedEnvSuite() {
    it('Supabase 주소가 형식에 맞는다', function supabaseUrlIsBaked() {
      expect(BUNDLE).toMatch(SUPABASE_URL_PATTERN);
    });

    it('공개 키가 새 형식이다', function anonKeyIsBaked() {
      expect(BUNDLE).toMatch(ANON_KEY_PATTERN);
    });

    it('카카오 앱키가 32자 hex로 온전히 들어 있다', function kakaoKeyIsBaked() {
      // 번들에서 키는 변수에 담긴다(`const ck="…"`). `appkey=` 뒤에서 못 찾으므로
      // 32자 hex 문자열 리터럴을 찾되, 같은 글자만 반복되는 것은 뺀다 —
      // supabase-js에 0이 32개인 문자열이 들어 있어서다.
      const candidates = Array.from(BUNDLE.matchAll(KAKAO_KEY_PATTERN))
        .map(function pickValue(found: RegExpMatchArray): string {
          return found[1];
        })
        .filter(function isNotRepeated(value: string): boolean {
          return new Set(value).size > 1;
        });

      expect(candidates.length).toBeGreaterThan(0);
    });

    it('카카오 SDK 주소가 실려 있다', function kakaoSdkUrlIsBaked() {
      // 앱키가 있어도 로더가 빠지면 지도가 안 뜬다. 둘은 다른 사고다.
      expect(BUNDLE).toContain('dapi.kakao.com/v2/maps/sdk.js?appkey=');
    });
  });

  describe('비밀이 안 섞였는가', function noSecretsSuite() {
    it.each(SECRET_PATTERNS)('%s가 없다', function secretIsAbsent(_label, pattern) {
      expect(BUNDLE).not.toMatch(pattern);
    });

    it('서버 전용 환경변수 이름 자체가 없다', function serviceRoleNameIsAbsent() {
      // 값이 안 새도 이름이 보이면 `VITE_` 접두사를 잘못 붙였다는 신호다.
      expect(BUNDLE).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    });
  });

  describe('배포에 안전한 모양인가', function deployableSuite() {
    it('파일 이름에 내용 해시가 있다', function fileNamesAreHashed() {
      // vercel.json이 /assets에 1년 캐시를 건다. 해시가 없으면 고친 코드가 안 내려간다.
      for (const asset of JS_ASSETS) {
        expect(asset.name).toMatch(/-[A-Za-z0-9_-]{8,}\.js$/);
      }
    });

    it(`gzip 합계가 ${GZIP_LIMIT_BYTES / 1024} kB를 안 넘는다`, function bundleIsNotBloated() {
      // kB로 재서 비교한다. 실패했을 때 "얼마나 넘었나"가 바로 보이라고.
      const sizeKb = Math.round(gzipSize(JS_ASSETS) / 1024);

      expect(sizeKb).toBeLessThan(GZIP_LIMIT_BYTES / 1024);
    });
  });
});
