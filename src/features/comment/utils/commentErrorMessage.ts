// 댓글 작성·삭제가 실패했을 때 사용자에게 보여줄 문구.

import { matchErrorMessage } from '../../../shared/utils/errorText';

const DEFAULT_COMMENT_ERROR_MESSAGE = '댓글을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';

/**
 * 순서가 곧 우선순위다.
 *
 * 42501(정책 위반)이 두 가지 뜻을 갖는 것이 이 목록의 어려운 점이다 — 차단한 사람의 글에
 * 쓰려 했거나(0017 comments_insert), 남의 댓글을 지우려 했거나(comments_delete)다.
 * 화면이 이미 두 경우 모두 버튼을 감추므로 여기 오는 것은 그 사이에 상황이 바뀐 때뿐이다.
 * 그래서 원인을 단정하지 않고 "다시 불러와 보라"는 쪽으로 안내한다.
 *
 * 제약 이름(comments_content_bounded)은 화면 검사가 먼저 잡으므로 실제로는 거의 오지 않는다.
 * 그래도 남겨 둔다 — 오면 사용자가 고칠 수 있는 유일한 오류다.
 */
const MESSAGE_BY_PATTERN: ReadonlyArray<readonly [RegExp, string]> = [
  [/comments_content_bounded/, '댓글은 1자 이상 1000자 이하여야 합니다.'],
  [/23503|foreign key/, '게시물을 찾을 수 없습니다. 삭제되었을 수 있어요.'],
  [/42501|row-level security|violates row-level/, '지금은 댓글을 남길 수 없어요. 새로고침 후 다시 시도해 주세요.'],
  [/jwt|not authenticated|session/, '로그인이 만료되었습니다. 다시 로그인해 주세요.'],
  [/failed to fetch|network|networkerror/, '네트워크 연결을 확인해 주세요.'],
];

export function toCommentErrorMessage(error: unknown): string {
  return matchErrorMessage(error, MESSAGE_BY_PATTERN, DEFAULT_COMMENT_ERROR_MESSAGE);
}
