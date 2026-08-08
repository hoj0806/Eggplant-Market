// Supabase Auth 오류(영문 message/code)를 사용자에게 보여줄 한국어 문구로 바꾼다.

import { matchErrorMessage } from '../../../shared/utils/errorText';

const DEFAULT_AUTH_ERROR_MESSAGE = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';

// 순서가 곧 우선순위다. 구체적인 원인을 위에 둔다.
//
// **이메일·비밀번호 갈래는 전부 걷어냈다.** 로그인이 소셜뿐이라 잘못된 비밀번호도,
// 이미 가입된 이메일도, 확인 안 된 메일도 이 앱에서는 일어나지 않는다.
// 남은 것은 소셜 로그인이 실제로 내는 오류들이다.
const MESSAGE_BY_PATTERN: ReadonlyArray<readonly [RegExp, string]> = [
  // 카카오처럼 아직 Supabase에서 켜지 않은 프로바이더를 누르면 여기로 온다.
  // code=validation_failed + msg="provider is not enabled"라 아래 validation_failed보다 위에 있어야 한다.
  [/provider is not enabled|unsupported provider/, '해당 소셜 로그인이 아직 활성화되지 않았습니다.'],
  // 동의 화면에서 취소하고 돌아온 경우. 오류로 붉게 띄울 일이 아니라 문구를 부드럽게 둔다.
  [/access_denied|user denied|cancelled/, '로그인을 취소했습니다.'],
  [/refresh_token_not_found|bad_jwt|session_not_found/, '로그인이 만료되었습니다. 다시 로그인해 주세요.'],
  [/rate limit|too many requests/, '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'],
  [/validation_failed/, '입력값을 다시 확인해 주세요.'],
  [/failed to fetch|network|networkerror/, '네트워크 연결을 확인해 주세요.'],
];

export function toAuthErrorMessage(error: unknown): string {
  return matchErrorMessage(error, MESSAGE_BY_PATTERN, DEFAULT_AUTH_ERROR_MESSAGE);
}
