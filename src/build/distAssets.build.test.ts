import {
  ANON_KEY_PATTERN,
  findKakaoAppKeys,
  KAKAO_SDK_URL_FRAGMENT,
  SECRET_PATTERNS,
  SERVER_ONLY_ENV_NAME,
  SUPABASE_URL_PATTERN,
} from '../shared/testUtils/bundlePatterns';
import { gzipSize, joinText, readAssets } from './distFiles';

/**
 * 번들 안을 들여다본다. **환경변수가 제대로 박혔는가**와 **비밀이 안 섞였는가**가 핵심이다.
 *
 * `import.meta.env`는 빌드 시점에 값이 박힌다. 단위 테스트는 그 모듈을 mock하고, 통합
 * 테스트는 `process.env` 쌍둥이로 갈아끼운다 — **그 경로를 밟는 테스트가 구조적으로 없다.**
 * 2026-08-08에 카카오 앱키가 한 글자 잘린 채 배포됐는데 828개가 전부 초록이었던 이유다.
 *
 * 그래서 **값이 무엇인지는 안 본다**(저장소에 정답이 없다). 형식과 길이만 본다 —
 * 한 글자 잘린 키는 형식에서 걸린다. 규칙은 `shared/testUtils/bundlePatterns.ts`에 있고,
 * **배포된 번들을 검사하는 `smoke` 갈래가 같은 규칙을 쓴다.**
 */

const JS_ASSETS = readAssets('.js');
const BUNDLE = joinText(JS_ASSETS);

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
      expect(findKakaoAppKeys(BUNDLE).length).toBeGreaterThan(0);
    });

    it('카카오 SDK 주소가 실려 있다', function kakaoSdkUrlIsBaked() {
      expect(BUNDLE).toContain(KAKAO_SDK_URL_FRAGMENT);
    });
  });

  describe('비밀이 안 섞였는가', function noSecretsSuite() {
    it.each(SECRET_PATTERNS)('%s가 없다', function secretIsAbsent(_label, pattern) {
      expect(BUNDLE).not.toMatch(pattern);
    });

    it('서버 전용 환경변수 이름 자체가 없다', function serviceRoleNameIsAbsent() {
      expect(BUNDLE).not.toContain(SERVER_ONLY_ENV_NAME);
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
