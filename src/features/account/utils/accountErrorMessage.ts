// 비밀번호 변경·회원탈퇴 오류를 사용자에게 보여줄 한국어 문구로 바꾼다.

import { matchErrorMessage } from '../../../shared/utils/errorText';

const DEFAULT_ACCOUNT_ERROR_MESSAGE =
  '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';

// 순서가 곧 우선순위다. 구체적인 원인을 위에 둔다.
//
// invalid_credentials가 여기서는 "로그인 실패"가 아니라 "현재 비밀번호가 틀렸다"는 뜻이다 —
// changePassword가 본인 확인으로 signInWithPassword를 한 번 거치기 때문이다(accountApi).
const MESSAGE_BY_PATTERN: ReadonlyArray<readonly [RegExp, string]> = [
  [/invalid_credentials|invalid login credentials/, '현재 비밀번호가 올바르지 않습니다.'],
  [/same_password|should be different from the old password/, '지금 쓰고 있는 비밀번호와 다른 비밀번호를 입력해 주세요.'],
  [/weak_password|password should be at least/, '비밀번호가 너무 단순합니다. 더 복잡하게 설정해 주세요.'],
  [/reauthentication|session_not_found|refresh_token_not_found|bad_jwt/, '로그인이 만료되었습니다. 다시 로그인해 주세요.'],
  [/rate limit|too many requests/, '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'],
  // Edge Function이 아직 배포되지 않았거나 이름이 다를 때. 사용자가 할 수 있는 일은 없다.
  [/not found|failed to send a request|non-2xx/, '탈퇴 요청이 서버에 닿지 못했습니다. 잠시 후 다시 시도해 주세요.'],
  [/failed to fetch|network|networkerror/, '네트워크 연결을 확인해 주세요.'],
];

export function toAccountErrorMessage(error: unknown): string {
  return matchErrorMessage(error, MESSAGE_BY_PATTERN, DEFAULT_ACCOUNT_ERROR_MESSAGE);
}
