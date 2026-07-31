// Supabase Auth 오류(영문 message/code)를 사용자에게 보여줄 한국어 문구로 바꾼다.

const DEFAULT_AUTH_ERROR_MESSAGE = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';

// 순서가 곧 우선순위다. 구체적인 원인을 위에 둔다.
// (예: 구글 미활성화 응답은 code=validation_failed + msg="provider is not enabled"이므로
//  provider 패턴이 validation_failed보다 먼저 와야 한다.)
const MESSAGE_BY_PATTERN: ReadonlyArray<readonly [RegExp, string]> = [
  [/invalid_credentials|invalid login credentials/, '이메일 또는 비밀번호가 올바르지 않습니다.'],
  [/user_already_exists|already registered|already been registered/, '이미 가입된 이메일입니다.'],
  [/email_not_confirmed|email not confirmed/, '이메일 인증이 완료되지 않았습니다. 받은 편지함을 확인해 주세요.'],
  [/weak_password|password should be at least/, '비밀번호가 너무 단순합니다. 더 복잡하게 설정해 주세요.'],
  [/email_address_invalid|email address .* is invalid/, '사용할 수 없는 이메일 주소입니다. 다른 이메일로 시도해 주세요.'],
  [/rate limit|too many requests/, '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'],
  [/provider is not enabled|unsupported provider|oauth/, '해당 소셜 로그인이 아직 활성화되지 않았습니다.'],
  [/refresh_token_not_found|bad_jwt|session_not_found/, '로그인이 만료되었습니다. 다시 로그인해 주세요.'],
  [/validation_failed|invalid email/, '입력값을 다시 확인해 주세요.'],
  [/failed to fetch|network|networkerror/, '네트워크 연결을 확인해 주세요.'],
];

type ErrorLike = {
  message?: unknown;
  code?: unknown;
};

/** Error 인스턴스가 아닐 수도 있으므로(직렬화된 응답 등) code·message를 모아 문자열로 만든다. */
function extractErrorText(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error === null || typeof error !== 'object') {
    return '';
  }

  const candidate = error as ErrorLike;
  const parts: string[] = [];
  if (typeof candidate.code === 'string') {
    parts.push(candidate.code);
  }
  if (typeof candidate.message === 'string') {
    parts.push(candidate.message);
  }
  return parts.join(' ');
}

export function toAuthErrorMessage(error: unknown): string {
  const text = extractErrorText(error).toLowerCase();
  if (text.length === 0) {
    return DEFAULT_AUTH_ERROR_MESSAGE;
  }

  for (const [pattern, message] of MESSAGE_BY_PATTERN) {
    if (pattern.test(text)) {
      return message;
    }
  }

  return DEFAULT_AUTH_ERROR_MESSAGE;
}
