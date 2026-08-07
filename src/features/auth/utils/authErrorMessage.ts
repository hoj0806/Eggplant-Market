// Supabase Auth 오류(영문 message/code)를 사용자에게 보여줄 한국어 문구로 바꾼다.

import { matchErrorMessage } from '../../../shared/utils/errorText';

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
  // 재설정 링크는 한 번 쓰면 끝이고 유효 시간도 짧다. 여기서 걸리면 다시 받는 수밖에 없다.
  [/otp_expired|token has expired|invalid or has expired/, '링크가 만료되었거나 이미 사용되었습니다. 재설정 링크를 다시 받아 주세요.'],
  // 잊어버려서 온 사람에게 "예전 것과 같다"를 화면이 미리 물을 수 없다 — 서버만 안다.
  [/same_password|should be different from the old password/, '지금 쓰고 있는 비밀번호와 다른 비밀번호를 입력해 주세요.'],
  // 메일 발송 한도. 커스텀 SMTP를 붙이기 전에는 내장 SMTP의 낮은 한도에 자주 걸린다.
  [/over_email_send_rate_limit|email rate limit exceeded/, '메일을 너무 자주 요청했습니다. 잠시 후 다시 시도해 주세요.'],
  [/rate limit|too many requests/, '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'],
  [/provider is not enabled|unsupported provider|oauth/, '해당 소셜 로그인이 아직 활성화되지 않았습니다.'],
  [/refresh_token_not_found|bad_jwt|session_not_found/, '로그인이 만료되었습니다. 다시 로그인해 주세요.'],
  [/validation_failed|invalid email/, '입력값을 다시 확인해 주세요.'],
  [/failed to fetch|network|networkerror/, '네트워크 연결을 확인해 주세요.'],
];

export function toAuthErrorMessage(error: unknown): string {
  return matchErrorMessage(error, MESSAGE_BY_PATTERN, DEFAULT_AUTH_ERROR_MESSAGE);
}
