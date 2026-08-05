// 채팅·거래 상태 실패를 사용자에게 보여줄 한국어 문구로 바꾼다.

import { matchErrorMessage } from '../../../shared/utils/errorText';

const DEFAULT_CHAT_ERROR_MESSAGE = '메시지를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.';

// 순서가 곧 우선순위다. 구체적인 원인을 위에 둔다.
// 0008이 raise exception으로 남긴 한국어 문구가 그대로 message에 실려 오므로 그것부터 잡는다.
const MESSAGE_BY_PATTERN: ReadonlyArray<readonly [RegExp, string]> = [
  [/내 게시물에는 채팅/, '내가 올린 상품에는 채팅을 걸 수 없습니다.'],
  [/거래완료된 게시물/, '거래완료된 상품의 상태는 되돌릴 수 없습니다.'],
  [/읽음 표시만/, '이미 보낸 메시지는 고칠 수 없습니다.'],
  // respondToOffer가 0행을 받았을 때다. 상대가 먼저 답했거나 이미 답한 제안이다.
  [/이미 답한 제안/, '이미 답변이 끝난 제안입니다.'],
  [/게시물을 찾을 수 없/, '게시물을 찾을 수 없습니다. 삭제되었을 수 있습니다.'],
  // 0014의 open_chat_room. 내가 차단했든 상대가 차단했든 같은 문구다 —
  // 어느 쪽인지 알려 주면 상대가 나를 차단했다는 사실이 드러난다.
  [/차단한 사용자와는/, '차단한 이웃과는 대화할 수 없습니다.'],
  // 0014가 messages_insert에 얹은 차단 조건에 걸린 경우. 차단이 걸린 뒤에도 방을 열어 둔
  // 상대가 여기 온다. 아래 42501 문구("다시 로그인")로 뭉뚱그리면 엉뚱한 곳을 고치게 된다.
  [/row-level security policy for table "messages"/, '지금은 이 대화에 메시지를 보낼 수 없습니다.'],
  [/payload too large|maximum allowed size|entity too large/, '사진 용량이 너무 큽니다. 5MB 이하로 보내 주세요.'],
  [/mime type|invalid_mime_type/, '지원하지 않는 사진 형식입니다.'],
  // 거래 상대를 채팅 상대 중에서만 고를 수 있게 한 posts_update 정책에 걸린 경우다.
  [/row-level security|permission denied|42501|unauthorized|jwt/, '권한이 없습니다. 다시 로그인해 주세요.'],
  [/failed to fetch|network|networkerror/, '네트워크 연결을 확인해 주세요.'],
];

export function toChatErrorMessage(error: unknown): string {
  return matchErrorMessage(error, MESSAGE_BY_PATTERN, DEFAULT_CHAT_ERROR_MESSAGE);
}
