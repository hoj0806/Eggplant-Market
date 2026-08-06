import type { ChatMessage } from '../types';

/** 지운 자리에 남는 말. 0029의 방 요약(`chat_rooms.last_message`)과 같은 문구다. */
export const DELETED_MESSAGE_TEXT = '지운 메시지입니다';

/**
 * 이 메시지를 지울 수 있는가.
 *
 * 셋 다 서버가 같은 선을 긋는다(0029) — 화면은 눌러도 소용없는 버튼을 감출 뿐이다.
 *
 *   ① 내가 보낸 것만    남의 말을 지우는 것은 기록을 고치는 일이다.
 *   ② 한 번만           지운 메시지는 되돌아오지 않으므로 다시 누를 일도 없다.
 *   ③ 가격 제안은 빼고  그 자리는 `canCancelOffer`(0027)가 이미 맡고 있다. 열어 두면
 *                       수락된 제안을 지워 합의를 없앨 수 있다.
 */
export function canDeleteMessage(message: ChatMessage, isMine: boolean): boolean {
  return isMine && message.deletedAt === null && message.type !== 'price_offer';
}

/**
 * 지운 메시지인가.
 *
 * `content`가 비었는지로 판단하지 않는다. 가격 제안은 원래 `content`가 비어 있고(금액은
 * 다른 칸에 있다), 그러면 답변 대기 중인 제안이 지운 말로 보인다. 판단 기준은 `deleted_at` 하나다.
 */
export function isDeletedMessage(message: ChatMessage): boolean {
  return message.deletedAt !== null;
}
