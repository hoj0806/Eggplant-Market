import { canDeleteMessage, DELETED_MESSAGE_TEXT, isDeletedMessage } from './messageDelete';
import type { ChatMessage } from '../types';

function toMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 1,
    roomId: 1,
    senderId: 'me',
    type: 'text',
    content: '안녕하세요',
    offerAmount: null,
    offerStatus: null,
    readAt: null,
    deletedAt: null,
    createdAt: '2026-08-06T01:00:00.000Z',
    ...overrides,
  };
}

describe('canDeleteMessage', function canDeleteMessageSuite() {
  it('내가 보낸 글은 지울 수 있다', function mineIsDeletable() {
    expect(canDeleteMessage(toMessage(), true)).toBe(true);
  });

  it('내가 보낸 사진도 지울 수 있다', function myImageIsDeletable() {
    expect(canDeleteMessage(toMessage({ type: 'image', content: '9/me/1.jpg' }), true)).toBe(true);
  });

  it('상대가 보낸 말은 지울 수 없다', function partnerMessageIsNotDeletable() {
    expect(canDeleteMessage(toMessage({ senderId: 'partner' }), false)).toBe(false);
  });

  it('이미 지운 메시지에는 버튼이 다시 뜨지 않는다', function deletedIsNotDeletableAgain() {
    expect(canDeleteMessage(toMessage({ deletedAt: '2026-08-06T02:00:00.000Z' }), true)).toBe(false);
  });

  // 그 자리는 canCancelOffer가 맡는다. 열어 두면 수락된 제안을 지워 합의를 없앨 수 있다.
  it('가격 제안은 지울 수 없다', function offerIsNotDeletable() {
    const offer = toMessage({ type: 'price_offer', content: null, offerAmount: 40000, offerStatus: 'pending' });

    expect(canDeleteMessage(offer, true)).toBe(false);
  });
});

describe('isDeletedMessage', function isDeletedMessageSuite() {
  it('지운 시각이 있으면 지운 메시지다', function deletedAtMarksDeleted() {
    expect(isDeletedMessage(toMessage({ deletedAt: '2026-08-06T02:00:00.000Z', content: null }))).toBe(true);
  });

  // content로 판단하면 답변 대기 중인 제안이 지운 말로 보인다 — 제안은 원래 content가 비어 있다.
  it('내용이 비었을 뿐인 가격 제안은 지운 메시지가 아니다', function emptyOfferIsNotDeleted() {
    const offer = toMessage({ type: 'price_offer', content: null, offerAmount: 40000, offerStatus: 'pending' });

    expect(isDeletedMessage(offer)).toBe(false);
  });
});

describe('DELETED_MESSAGE_TEXT', function deletedTextSuite() {
  // 0029의 refresh_room_summary_on_delete가 chat_rooms.last_message에 적는 값과 같아야
  // 채팅 목록과 말풍선이 같은 말을 한다.
  it('서버가 방 요약에 적는 문구와 같다', function matchesServerSummary() {
    expect(DELETED_MESSAGE_TEXT).toBe('지운 메시지입니다');
  });
});
