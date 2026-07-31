import { toAuthErrorMessage } from './authErrorMessage';

const DEFAULT_MESSAGE = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';

describe('toAuthErrorMessage', function toAuthErrorMessageSuite() {
  it('로그인 실패를 한국어로 바꾼다', function invalidCredentialsCase() {
    expect(toAuthErrorMessage(new Error('Invalid login credentials'))).toBe(
      '이메일 또는 비밀번호가 올바르지 않습니다.',
    );
  });

  it('중복 가입을 한국어로 바꾼다', function alreadyRegisteredCase() {
    expect(toAuthErrorMessage(new Error('User already registered'))).toBe(
      '이미 가입된 이메일입니다.',
    );
  });

  it('message 없이 code만 있어도 매칭한다', function codeOnlyCase() {
    expect(toAuthErrorMessage({ code: 'email_not_confirmed' })).toBe(
      '이메일 인증이 완료되지 않았습니다. 받은 편지함을 확인해 주세요.',
    );
  });

  it('네트워크 오류를 한국어로 바꾼다', function networkCase() {
    expect(toAuthErrorMessage(new TypeError('Failed to fetch'))).toBe(
      '네트워크 연결을 확인해 주세요.',
    );
  });

  // 아래 4건은 실제 Supabase 프로젝트에서 관측한 응답 그대로다.
  it('구글 미활성화는 validation_failed보다 provider 문구를 우선한다', function providerDisabledCase() {
    expect(
      toAuthErrorMessage({
        code: 'validation_failed',
        message: 'Unsupported provider: provider is not enabled',
      }),
    ).toBe('해당 소셜 로그인이 아직 활성화되지 않았습니다.');
  });

  it('사용할 수 없는 이메일 도메인을 안내한다', function invalidEmailDomainCase() {
    expect(
      toAuthErrorMessage({
        code: 'email_address_invalid',
        message: 'Email address "verify@example.com" is invalid',
      }),
    ).toBe('사용할 수 없는 이메일 주소입니다. 다른 이메일로 시도해 주세요.');
  });

  it('메일 발송 rate limit을 안내한다', function emailRateLimitCase() {
    expect(
      toAuthErrorMessage({
        code: 'over_email_send_rate_limit',
        message: 'email rate limit exceeded',
      }),
    ).toBe('요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.');
  });

  it('만료된 세션은 재로그인을 안내한다', function expiredSessionCase() {
    expect(
      toAuthErrorMessage({
        code: 'refresh_token_not_found',
        message: 'Invalid Refresh Token: Refresh Token Not Found',
      }),
    ).toBe('로그인이 만료되었습니다. 다시 로그인해 주세요.');
  });

  it('알 수 없는 오류는 기본 문구를 반환한다', function unknownCase() {
    expect(toAuthErrorMessage(new Error('something exploded'))).toBe(DEFAULT_MESSAGE);
  });

  it('null·undefined도 기본 문구를 반환한다', function nullishCase() {
    expect(toAuthErrorMessage(null)).toBe(DEFAULT_MESSAGE);
    expect(toAuthErrorMessage(undefined)).toBe(DEFAULT_MESSAGE);
  });
});
