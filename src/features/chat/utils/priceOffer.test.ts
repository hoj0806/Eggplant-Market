import { canRespondToOffer, canSendPriceOffer, hasPendingOfferFrom } from './priceOffer';
import type { ChatMessage, ChatRoomSummary } from '../types';

const VIEWER_ID = 'me';
const SELLER_ID = 'seller';

function toRoom(overrides: Partial<ChatRoomSummary> = {}): ChatRoomSummary {
  return {
    id: 1,
    postId: 7,
    postTitle: '가죽 소파',
    postThumbnailUrl: null,
    postStatus: 'selling',
    postPrice: 50000,
    sellerId: SELLER_ID,
    partner: { id: SELLER_ID, nickname: '판매자', avatarUrl: null },
    lastMessage: null,
    lastMessageAt: null,
    unreadCount: 0,
    ...overrides,
  };
}

function toOffer(overrides: Partial<ChatMessage> & { id: number }): ChatMessage {
  return {
    roomId: 1,
    senderId: VIEWER_ID,
    type: 'price_offer',
    content: null,
    offerAmount: 40000,
    offerStatus: 'pending',
    readAt: null,
    createdAt: '2026-08-05T01:00:00.000Z',
    ...overrides,
  };
}

describe('canSendPriceOffer', function canSendPriceOfferSuite() {
  it('사는 쪽은 제안할 수 있다', function buyerCanOffer() {
    expect(canSendPriceOffer(toRoom(), VIEWER_ID)).toBe(true);
  });

  it('파는 쪽에게는 제안할 길이 없다', function sellerCannotOffer() {
    expect(canSendPriceOffer(toRoom(), SELLER_ID)).toBe(false);
  });

  it('예약중이면 제안하지 않는다', function reserved() {
    expect(canSendPriceOffer(toRoom({ postStatus: 'reserved' }), VIEWER_ID)).toBe(false);
  });

  it('거래완료된 물건에도 제안하지 않는다', function sold() {
    expect(canSendPriceOffer(toRoom({ postStatus: 'sold' }), VIEWER_ID)).toBe(false);
  });
});

describe('canRespondToOffer', function canRespondToOfferSuite() {
  it('받은 제안이 대기 중이면 답할 수 있다', function received() {
    expect(canRespondToOffer(toOffer({ id: 1, senderId: 'buyer' }), false)).toBe(true);
  });

  it('내가 보낸 제안에는 스스로 답하지 못한다', function ownOffer() {
    expect(canRespondToOffer(toOffer({ id: 1 }), true)).toBe(false);
  });

  it('이미 답이 끝난 제안에는 다시 답하지 못한다', function alreadyAnswered() {
    expect(canRespondToOffer(toOffer({ id: 1, offerStatus: 'accepted' }), false)).toBe(false);
    expect(canRespondToOffer(toOffer({ id: 1, offerStatus: 'rejected' }), false)).toBe(false);
  });

  it('가격 제안이 아닌 메시지는 답할 대상이 아니다', function plainText() {
    const text = toOffer({ id: 1, type: 'text', offerStatus: null, offerAmount: null });

    expect(canRespondToOffer(text, false)).toBe(false);
  });
});

describe('hasPendingOfferFrom', function hasPendingOfferFromSuite() {
  it('내가 보낸 제안이 대기 중이면 참이다', function myPending() {
    expect(hasPendingOfferFrom([toOffer({ id: 1 })], VIEWER_ID)).toBe(true);
  });

  it('상대가 보낸 대기 중인 제안은 내 발목을 잡지 않는다', function partnerPending() {
    expect(hasPendingOfferFrom([toOffer({ id: 1, senderId: 'partner' })], VIEWER_ID)).toBe(false);
  });

  it('답이 끝났으면 다시 제안할 수 있다', function answered() {
    const messages = [
      toOffer({ id: 1, offerStatus: 'rejected' }),
      toOffer({ id: 2, offerStatus: 'accepted' }),
    ];

    expect(hasPendingOfferFrom(messages, VIEWER_ID)).toBe(false);
  });

  it('대화가 비어 있으면 거짓이다', function empty() {
    expect(hasPendingOfferFrom([], VIEWER_ID)).toBe(false);
  });
});
