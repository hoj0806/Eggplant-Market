import type { ChatRoomSummary } from '../types';

/**
 * 채팅 목록의 네 갈래.
 *
 * 하나만 고를 수 있다 — unread는 sales/purchases와 조합되지 않는 독립 갈래다.
 * "안 읽은 판매 채팅"은 판매 탭에서 뱃지 붙은 줄을 보면 되므로 조합을 만들 이유가 없다.
 */
export type ChatRoomFilter = 'all' | 'sales' | 'purchases' | 'unread';

/** 화면에 그리는 순서. 컴포넌트가 이 순서를 그대로 돈다. */
export const CHAT_ROOM_FILTER_ORDER: ReadonlyArray<ChatRoomFilter> = [
  'all',
  'sales',
  'purchases',
  'unread',
];

export const CHAT_ROOM_FILTER_LABEL: Record<ChatRoomFilter, string> = {
  all: '전체',
  sales: '판매',
  purchases: '구매',
  unread: '안읽음',
};

/** URL에 남기지 않는 기본값. 이 값일 때는 ?tab= 자체를 붙이지 않는다. */
export const DEFAULT_CHAT_ROOM_FILTER: ChatRoomFilter = 'all';

/**
 * 내가 이 방 게시물의 판매자인가. 판매 채팅의 정의 그 자체다.
 *
 * 판매 채팅 = 남이 내 물건을 사겠다고 걸어 온 방,
 * 구매 채팅 = 내가 남의 물건을 사겠다고 건 방.
 *
 * fetch_chat_rooms(0008)가 seller_id를 같이 주기 때문에 서버에 다시 묻지 않아도 된다.
 */
export function isSaleRoom(room: ChatRoomSummary, viewerId: string): boolean {
  return room.sellerId === viewerId;
}

/** 이 방에 내가 아직 안 읽은 메시지가 남아 있는가. */
export function isUnreadRoom(room: ChatRoomSummary): boolean {
  return room.unreadCount > 0;
}

/**
 * 고른 갈래만 남긴다.
 *
 * 목록은 fetchChatRooms가 한 번에 다 주므로(페이지네이션이 없다) 여기서 걸러도 서버 왕복이 없다.
 * 정렬은 손대지 않는다 — 어느 탭에서든 마지막 메시지가 최근인 방이 위다.
 */
export function filterChatRooms(
  rooms: ChatRoomSummary[],
  filter: ChatRoomFilter,
  viewerId: string,
): ChatRoomSummary[] {
  if (filter === 'all') {
    return rooms;
  }

  return rooms.filter(function matchesFilter(room: ChatRoomSummary): boolean {
    if (filter === 'unread') {
      return isUnreadRoom(room);
    }
    if (filter === 'sales') {
      return isSaleRoom(room, viewerId);
    }
    return !isSaleRoom(room, viewerId);
  });
}

/**
 * 안읽음 탭에 붙는 숫자. 메시지 수가 아니라 **방 수**다.
 *
 * 홈 입구(chatEntryLink)는 안 읽은 메시지 총합을 센다. 두 숫자는 다를 수 있다(홈 5 / 여기 2).
 * 세는 대상이 다르기 때문이고, 그게 맞다 — 이 탭은 방을 거르는 장치라
 * 눌렀을 때 나오는 줄 수와 뱃지 숫자가 같아야 한다.
 */
export function countUnreadRooms(rooms: ChatRoomSummary[]): number {
  return rooms.filter(isUnreadRoom).length;
}

/**
 * URL의 ?tab= 값을 갈래로 바꾼다.
 *
 * 모르는 값과 빈 값은 조용히 '전체'로 떨어진다. 손으로 고친 주소나 오래된 링크로 들어와도
 * 화면이 깨지지 않아서 라우터 가드가 따로 필요 없다.
 */
export function toChatRoomFilter(raw: string | null): ChatRoomFilter {
  const found = CHAT_ROOM_FILTER_ORDER.find(function matchesRaw(filter: ChatRoomFilter): boolean {
    return filter === raw;
  });

  return found ?? DEFAULT_CHAT_ROOM_FILTER;
}
