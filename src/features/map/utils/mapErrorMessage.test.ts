import { toMapErrorCode, toMapErrorMessage } from './mapErrorMessage';

jest.mock('../../../shared/lib/kakaoMapLoader', function mockLoader() {
  // 로더는 import.meta.env에 닿는다. ts-jest가 CommonJS로 옮기면서 import.meta를 그대로
  // 뱉으므로 실제 모듈은 로드하지 않는다(regionApi를 통째로 mock하는 것과 같은 이유).
  return {
    KAKAO_KEY_MISSING_CODE: 'kakao_key_missing',
    KAKAO_LOAD_FAILED_CODE: 'kakao_load_failed',
  };
});

describe('toMapErrorCode', function toMapErrorCodeSuite() {
  it('앱키 없음과 로드 실패를 갈라 읽는다', function splitsKnownCodes() {
    // 조치가 다르다 — 앱키는 개발자가 .env를 고쳐야 하고, 실패는 다시 시도해 볼 수 있다.
    expect(toMapErrorCode(Object.assign(new Error(''), { code: 'kakao_key_missing' }))).toBe(
      'sdk_key_missing',
    );
    expect(toMapErrorCode(Object.assign(new Error(''), { code: 'kakao_load_failed' }))).toBe(
      'sdk_load_failed',
    );
  });

  it('모르는 오류는 다시 시도할 수 있는 쪽으로 본다', function fallsBackToLoadFailed() {
    expect(toMapErrorCode(new Error('무언가 잘못됨'))).toBe('sdk_load_failed');
    expect(toMapErrorCode(null)).toBe('sdk_load_failed');
    expect(toMapErrorCode(undefined)).toBe('sdk_load_failed');
    expect(toMapErrorCode('문자열')).toBe('sdk_load_failed');
  });
});

describe('toMapErrorMessage', function toMapErrorMessageSuite() {
  it('두 실패에 서로 다른 문구를 준다', function distinctMessages() {
    expect(toMapErrorMessage('sdk_key_missing')).not.toBe(toMapErrorMessage('sdk_load_failed'));
  });

  it('사용자가 무엇을 할지 알 수 있게 적는다', function actionableMessages() {
    expect(toMapErrorMessage('sdk_load_failed')).toContain('다시 시도');
    expect(toMapErrorMessage('sdk_key_missing').length).toBeGreaterThan(0);
  });
});
