import { toAuthErrorMessage } from './authErrorMessage';

const DEFAULT_MESSAGE = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';

// 이메일·비밀번호 갈래를 잡던 테스트 일곱은 함께 지웠다. 로그인이 소셜뿐이라
// 잘못된 비밀번호도, 중복 가입도, 확인 안 된 메일도 이 앱에서는 일어나지 않는다.
// **일어나지 않는 일을 지키는 테스트는 다음 사람에게 "그 길이 있다"고 거짓말을 한다.**
describe('toAuthErrorMessage', function toAuthErrorMessageSuite() {
  // 실제 Supabase 프로젝트에서 관측한 응답 그대로다. 카카오를 아직 안 켠 지금
  // 그 버튼을 누르면 이 오류가 온다 — 켜기 전까지 사용자가 보는 문구다.
  it('안 켠 프로바이더는 validation_failed보다 provider 문구를 우선한다', function providerDisabledCase() {
    expect(
      toAuthErrorMessage({
        code: 'validation_failed',
        message: 'Unsupported provider: provider is not enabled',
      }),
    ).toBe('해당 소셜 로그인이 아직 활성화되지 않았습니다.');
  });

  // 동의 화면에서 취소하고 돌아온 경우. 사용자가 스스로 한 일이라 사고처럼 말하지 않는다.
  it('동의 화면에서 취소한 것은 오류처럼 말하지 않는다', function accessDeniedCase() {
    expect(
      toAuthErrorMessage({ code: 'access_denied', message: 'User denied the request' }),
    ).toBe('로그인을 취소했습니다.');
  });

  it('만료된 세션은 재로그인을 안내한다', function expiredSessionCase() {
    expect(
      toAuthErrorMessage({
        code: 'refresh_token_not_found',
        message: 'Invalid Refresh Token: Refresh Token Not Found',
      }),
    ).toBe('로그인이 만료되었습니다. 다시 로그인해 주세요.');
  });

  it('message 없이 code만 있어도 매칭한다', function codeOnlyCase() {
    expect(toAuthErrorMessage({ code: 'session_not_found' })).toBe(
      '로그인이 만료되었습니다. 다시 로그인해 주세요.',
    );
  });

  it('rate limit을 안내한다', function rateLimitCase() {
    expect(toAuthErrorMessage({ message: 'Request rate limit reached' })).toBe(
      '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.',
    );
  });

  it('네트워크 오류를 한국어로 바꾼다', function networkCase() {
    expect(toAuthErrorMessage(new TypeError('Failed to fetch'))).toBe(
      '네트워크 연결을 확인해 주세요.',
    );
  });

  it('알 수 없는 오류는 기본 문구를 반환한다', function unknownCase() {
    expect(toAuthErrorMessage(new Error('something exploded'))).toBe(DEFAULT_MESSAGE);
  });

  it('null·undefined도 기본 문구를 반환한다', function nullishCase() {
    expect(toAuthErrorMessage(null)).toBe(DEFAULT_MESSAGE);
    expect(toAuthErrorMessage(undefined)).toBe(DEFAULT_MESSAGE);
  });
});
