// 차단·차단 해제 실패를 사용자에게 보여줄 한국어 문구로 바꾼다.

import { matchErrorMessage } from '../../../shared/utils/errorText';

const DEFAULT_BLOCK_ERROR_MESSAGE = '차단 설정을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.';

// 순서가 곧 우선순위다. 구체적인 원인을 위에 둔다.
const MESSAGE_BY_PATTERN: ReadonlyArray<readonly [RegExp, string]> = [
  // 0001의 blocks_blocker_id_check — 자기 자신은 차단할 수 없다. 화면이 버튼을 감추지만
  // 서버가 막는 자리이기도 해서 문구를 준비해 둔다.
  [/23514|check constraint/, '자기 자신은 차단할 수 없어요.'],
  [/row-level security|permission denied|42501/, '차단은 로그인한 뒤에 할 수 있어요.'],
  [/failed to fetch|network|networkerror/, '네트워크 연결을 확인해 주세요.'],
];

export function toBlockErrorMessage(error: unknown): string {
  return matchErrorMessage(error, MESSAGE_BY_PATTERN, DEFAULT_BLOCK_ERROR_MESSAGE);
}
