import {
  countUnreadRooms,
  filterChatRooms,
  isSaleRoom,
  toChatRoomFilter,
} from './chatRoomFilter';
import type { ChatRoomSummary } from '../types';

const VIEWER_ID = 'me';

function makeRoom(overrides: Partial<ChatRoomSummary>): ChatRoomSummary {
  return {
    id: 1,
    postId: 10,
    postTitle: '맥북 에어 M2',
    postThumbnailUrl: null,
    postStatus: 'selling',
    postPrice: 850000,
    sellerId: 'someone-else',
    partner: { id: 'partner-1', nickname: '가지이웃', avatarUrl: null },
    lastMessage: '아직 있나요?',
    lastMessageAt: '2026-08-03T01:58:00.000Z',
    unreadCount: 0,
    ...overrides,
  };
}

/** 내가 판 방 하나, 내가 산 방 하나, 안 읽은 것이 남은 구매 방 하나. */
const SALE_ROOM = makeRoom({ id: 1, sellerId: VIEWER_ID });
const PURCHASE_ROOM = makeRoom({ id: 2, sellerId: 'other-seller' });
const UNREAD_PURCHASE_ROOM = makeRoom({ id: 3, sellerId: 'other-seller', unreadCount: 2 });
const ROOMS = [SALE_ROOM, PURCHASE_ROOM, UNREAD_PURCHASE_ROOM];

describe('isSaleRoom', function isSaleRoomSuite() {
  it('내가 판매자인 방이 판매 채팅이다', function detectsSale() {
    expect(isSaleRoom(SALE_ROOM, VIEWER_ID)).toBe(true);
  });

  it('상대가 판매자인 방은 구매 채팅이다', function detectsPurchase() {
    expect(isSaleRoom(PURCHASE_ROOM, VIEWER_ID)).toBe(false);
  });
});

describe('filterChatRooms', function filterChatRoomsSuite() {
  it('전체는 목록을 그대로 둔다', function keepsAll() {
    expect(filterChatRooms(ROOMS, 'all', VIEWER_ID)).toEqual(ROOMS);
  });

  it('판매는 내가 판매자인 방만 남긴다', function keepsSales() {
    expect(filterChatRooms(ROOMS, 'sales', VIEWER_ID)).toEqual([SALE_ROOM]);
  });

  it('구매는 상대가 판매자인 방만 남긴다', function keepsPurchases() {
    expect(filterChatRooms(ROOMS, 'purchases', VIEWER_ID)).toEqual([
      PURCHASE_ROOM,
      UNREAD_PURCHASE_ROOM,
    ]);
  });

  it('안읽음은 판매·구매를 가리지 않고 안 읽은 방만 남긴다', function keepsUnread() {
    const unreadSaleRoom = makeRoom({ id: 4, sellerId: VIEWER_ID, unreadCount: 1 });

    expect(filterChatRooms([...ROOMS, unreadSaleRoom], 'unread', VIEWER_ID)).toEqual([
      UNREAD_PURCHASE_ROOM,
      unreadSaleRoom,
    ]);
  });

  it('걸러 낸 뒤에도 원래 순서를 지킨다', function keepsOrder() {
    const filtered = filterChatRooms(ROOMS, 'purchases', VIEWER_ID);

    expect(filtered.map(function toId(room: ChatRoomSummary): number {
      return room.id;
    })).toEqual([2, 3]);
  });
});

describe('countUnreadRooms', function countUnreadRoomsSuite() {
  it('메시지 수가 아니라 방 수를 센다', function countsRooms() {
    // 안 읽은 메시지는 2개지만 방은 하나다.
    expect(countUnreadRooms(ROOMS)).toBe(1);
  });

  it('다 읽었으면 0이다', function countsZero() {
    expect(countUnreadRooms([SALE_ROOM, PURCHASE_ROOM])).toBe(0);
  });
});

describe('toChatRoomFilter', function toChatRoomFilterSuite() {
  it('아는 값은 그대로 읽는다', function readsKnown() {
    expect(toChatRoomFilter('sales')).toBe('sales');
    expect(toChatRoomFilter('purchases')).toBe('purchases');
    expect(toChatRoomFilter('unread')).toBe('unread');
  });

  it('값이 없으면 전체다', function fallsBackWhenMissing() {
    expect(toChatRoomFilter(null)).toBe('all');
  });

  it('모르는 값도 전체로 떨어뜨린다', function fallsBackWhenUnknown() {
    expect(toChatRoomFilter('zzz')).toBe('all');
    expect(toChatRoomFilter('')).toBe('all');
  });
});
