import { toMessageTimeline, toNextMessageCursor } from './chatCursor';
import { CHAT_MESSAGE_PAGE_SIZE } from '../api/chatApi';
import type { ChatMessage } from '../types';

jest.mock('../api/chatApi', function mockChatApi() {
  // chatApi는 supabaseClient를 거쳐 import.meta.env에 닿는다.
  // ts-jest가 CommonJS로 옮기면서 import.meta를 그대로 뱉으므로 실제 모듈은 로드하지 않는다.
  return { CHAT_MESSAGE_PAGE_SIZE: 30 };
});

function toMessage(id: number): ChatMessage {
  return {
    id,
    roomId: 1,
    senderId: 'buyer',
    type: 'text',
    content: `메시지 ${id}`,
    offerAmount: null,
    offerStatus: null,
    readAt: null,
    deletedAt: null,
    createdAt: '2026-08-03T01:00:00.000Z',
  };
}

/** 서버는 최신부터 내려 준다. id가 큰 것이 앞이다. */
function toFullPage(startId: number): ChatMessage[] {
  const messages: ChatMessage[] = [];

  for (let index = 0; index < CHAT_MESSAGE_PAGE_SIZE; index += 1) {
    messages.push(toMessage(startId - index));
  }

  return messages;
}

describe('toNextMessageCursor', function toNextMessageCursorSuite() {
  it('페이지가 다 차지 않았으면 더 거슬러 올라갈 것이 없다', function partialPage() {
    expect(toNextMessageCursor([toMessage(3), toMessage(2)])).toBeUndefined();
  });

  it('빈 페이지도 다음이 없는 것으로 본다', function emptyPage() {
    expect(toNextMessageCursor([])).toBeUndefined();
  });

  it('페이지가 가득 찼으면 그중 가장 작은 id가 커서다', function fullPage() {
    const page = toFullPage(100);

    expect(toNextMessageCursor(page)).toBe(100 - CHAT_MESSAGE_PAGE_SIZE + 1);
  });
});

describe('toMessageTimeline', function toMessageTimelineSuite() {
  it('최신순 페이지들을 오래된 것부터 나오도록 뒤집는다', function reversesOrder() {
    const pages = [
      [toMessage(5), toMessage(4)],
      [toMessage(3), toMessage(2)],
    ];

    expect(
      toMessageTimeline(pages).map(function toId(message): number {
        return message.id;
      }),
    ).toEqual([2, 3, 4, 5]);
  });

  it('같은 메시지가 두 페이지에 걸쳐도 한 번만 그린다', function dedupes() {
    const pages = [
      [toMessage(3), toMessage(2)],
      [toMessage(2), toMessage(1)],
    ];

    expect(
      toMessageTimeline(pages).map(function toId(message): number {
        return message.id;
      }),
    ).toEqual([1, 2, 3]);
  });

  it('페이지가 없으면 빈 목록이다', function emptyPages() {
    expect(toMessageTimeline([])).toEqual([]);
  });
});
