// 게시물 저장·조회 실패를 사용자에게 보여줄 한국어 문구로 바꾼다.

import { matchErrorMessage } from '../../../shared/utils/errorText';

const DEFAULT_POST_ERROR_MESSAGE = '게시물을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';

// 순서가 곧 우선순위다. 구체적인 원인을 위에 둔다.
const MESSAGE_BY_PATTERN: ReadonlyArray<readonly [RegExp, string]> = [
  [/payload too large|maximum allowed size|entity too large/, '사진 용량이 너무 큽니다. 5MB 이하로 올려 주세요.'],
  [/mime type|invalid_mime_type/, '지원하지 않는 사진 형식입니다.'],
  // posts.category_id → categories FK 위반(23503). 시드가 바뀌었을 때 난다.
  [/23503|foreign key/, '선택한 카테고리를 찾을 수 없습니다. 카테고리를 다시 골라 주세요.'],
  [/23502|not-null|null value/, '필수 항목이 비어 있습니다. 입력값을 확인해 주세요.'],
  [/row-level security|permission denied|42501|unauthorized|jwt/, '권한이 없습니다. 다시 로그인해 주세요.'],
  [/failed to fetch|network|networkerror/, '네트워크 연결을 확인해 주세요.'],
];

export function toPostErrorMessage(error: unknown): string {
  return matchErrorMessage(error, MESSAGE_BY_PATTERN, DEFAULT_POST_ERROR_MESSAGE);
}
