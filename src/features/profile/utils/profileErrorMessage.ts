// Postgrest·Storage 오류를 사용자에게 보여줄 한국어 문구로 바꾼다.

import { matchErrorMessage } from '../../../shared/utils/errorText';

const DEFAULT_PROFILE_ERROR_MESSAGE =
  '프로필을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';

// 순서가 곧 우선순위다. 구체적인 원인을 위에 둔다.
const MESSAGE_BY_PATTERN: ReadonlyArray<readonly [RegExp, string]> = [
  // profiles.nickname의 unique 제약 위반(23505)
  [/23505|duplicate key|already exists/, '이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.'],
  [/payload too large|maximum allowed size|entity too large/, '이미지 용량이 너무 큽니다. 2MB 이하로 올려 주세요.'],
  [/mime type|invalid_mime_type/, '지원하지 않는 이미지 형식입니다.'],
  [/row-level security|permission denied|42501|unauthorized|jwt/, '권한이 없습니다. 다시 로그인해 주세요.'],
  [/failed to fetch|network|networkerror/, '네트워크 연결을 확인해 주세요.'],
];

export function toProfileErrorMessage(error: unknown): string {
  return matchErrorMessage(error, MESSAGE_BY_PATTERN, DEFAULT_PROFILE_ERROR_MESSAGE);
}
