import type { ChatMessage, ChatRoomSummary, OfferStatus } from '../types';
import { isSaleRoom } from './chatRoomFilter';

/** 답이 끝난 제안 옆에 붙는 글자. 대기 중인 제안은 보는 쪽에 따라 문구가 달라 여기 없다. */
export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  pending: '답변 대기 중',
  accepted: '수락됨',
  rejected: '거절됨',
  // "삭제됨"이 아니다. 말풍선은 그대로 남고 상태만 바뀐다 — 0008이 "대화 기록이 사후에
  // 바뀌면 채팅을 신뢰할 수 없다"고 정한 자리라, 취소는 없던 일이 아니라 취소했다는 기록이다.
  cancelled: '취소됨',
};

/**
 * 가격 제안은 **사는 쪽만** 건다.
 *
 * 판매자가 값을 내리고 싶으면 게시물 가격을 고치면 되므로(2단계) 제안이 필요 없다.
 * 서버는 이 방향을 강제하지 않는다 — messages_insert는 방 참여자면 통과시킨다.
 * 그래도 화면을 한쪽으로만 여는 이유는, 반대 방향이 열리면 "누가 누구에게 답하는가"가
 * 방마다 달라져 수락·거절 버튼의 자리가 흔들리기 때문이다.
 *
 * 판매중이 아닐 때도 닫는다. 예약·거래완료된 물건에 값을 부르는 것은 대화가 아니라 소음이다.
 */
export function canSendPriceOffer(room: ChatRoomSummary, viewerId: string): boolean {
  return !isSaleRoom(room, viewerId) && room.postStatus === 'selling';
}

/**
 * 이 제안에 답할 수 있는가.
 *
 * 받은 쪽(`isMine === false`)이고 아직 대기 중일 때만이다.
 * 0008의 messages_update 정책이 "발신자가 아닌 참여자"만 허용하므로 서버도 같은 선을 긋는다 —
 * 화면은 눌러도 소용없는 버튼을 감출 뿐이다.
 */
export function canRespondToOffer(message: ChatMessage, isMine: boolean): boolean {
  return message.type === 'price_offer' && message.offerStatus === 'pending' && !isMine;
}

/**
 * 이 제안을 무를 수 있는가.
 *
 * `canRespondToOffer`와 정확히 반대쪽이다 — 보낸 쪽(`isMine`)이고 아직 답이 안 왔을 때만이다.
 * 답이 끝난 제안은 열지 않는다. **상대가 이미 답한 것**이라 한쪽이 혼자 되돌리면 합의가 깨진다.
 *
 * 이 길이 필요한 이유는 `hasPendingOfferFrom`과 겹쳐 생기는 막다른 골목 때문이다 —
 * 50,000원을 5,000원으로 잘못 보내면 무를 수도 없고 새로 보낼 수도 없어서, 판매자가
 * 답할 때까지 아무것도 못 한다. 취소하면 대기 중인 제안이 없어져 새 제안이 다시 열린다.
 *
 * 서버도 같은 선을 긋는다(0027) — 화면은 눌러도 소용없는 버튼을 감출 뿐이다.
 */
export function canCancelOffer(message: ChatMessage, isMine: boolean): boolean {
  return message.type === 'price_offer' && message.offerStatus === 'pending' && isMine;
}

/**
 * 내가 보내 놓고 아직 답을 못 받은 제안이 있는가.
 *
 * 있으면 새 제안을 막는다. 대기 중인 제안이 여럿 쌓이면 판매자 화면에 수락 버튼이 여러 개
 * 남고, 그중 어느 것을 눌러도 "합의된 금액"이 되어 버린다.
 */
export function hasPendingOfferFrom(messages: ChatMessage[], viewerId: string): boolean {
  return messages.some(function isMyPendingOffer(message: ChatMessage): boolean {
    return (
      message.type === 'price_offer' &&
      message.offerStatus === 'pending' &&
      message.senderId === viewerId
    );
  });
}
