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

  // 문구를 좁혔다. 예전에는 일반 rate limit과 한 문구를 썼는데, 비밀번호 재설정 화면이
  // 생기면서 **이 오류를 사용자가 실제로 보게 됐다** — 거기서 "요청이 너무 잦습니다"는
  // 무엇을 기다려야 하는지 안 알려 준다. 기다릴 것은 메일 발송 한도다.
  it('메일 발송 rate limit은 메일 기준으로 안내한다', function emailRateLimitCase() {
    expect(
      toAuthErrorMessage({
        code: 'over_email_send_rate_limit',
        message: 'email rate limit exceeded',
      }),
    ).toBe('메일을 너무 자주 요청했습니다. 잠시 후 다시 시도해 주세요.');
  });

  // 일반 rate limit(로그인 시도 등)은 그대로다.
  it('그 밖의 rate limit은 지금까지 문구를 쓴다', function generalRateLimitCase() {
    expect(toAuthErrorMessage({ message: 'Request rate limit reached' })).toBe(
      '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.',
    );
  });

  // 재설정 링크는 한 번 쓰면 끝이고 유효 시간도 짧다.
  it('만료된 재설정 링크를 안내한다', function expiredLinkCase() {
    expect(
      toAuthErrorMessage({
        code: 'otp_expired',
        message: 'Email link is invalid or has expired',
      }),
    ).toBe('링크가 만료되었거나 이미 사용되었습니다. 재설정 링크를 다시 받아 주세요.');
  });

  // 잊어버려서 온 사람에게 화면이 미리 물을 수 없는 값이라 서버 문구를 받는다.
  it('예전과 같은 비밀번호를 안내한다', function samePasswordCase() {
    expect(
      toAuthErrorMessage({
        code: 'same_password',
        message: 'New password should be different from the old password.',
      }),
    ).toBe('지금 쓰고 있는 비밀번호와 다른 비밀번호를 입력해 주세요.');
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
