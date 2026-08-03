import type { InfiniteData } from '@tanstack/react-query';
import { withInsertedMessage, withUpdatedMessage } from './chatMessageCache';
import type { ChatMessage } from '../types';

function toMessage(id: number, readAt: string | null = null): ChatMessage {
  return {
    id,
    roomId: 1,
    senderId: 'me',
    type: 'text',
    content: `메시지 ${id}`,
    offerAmount: null,
    offerStatus: null,
    readAt,
    createdAt: '2026-08-03T01:00:00.000Z',
  };
}

function toCache(pages: ChatMessage[][]): InfiniteData<ChatMessage[]> {
  return { pages, pageParams: pages.map(function toParam(): null {
    return null;
  }) };
}

describe('withInsertedMessage', function withInsertedMessageSuite() {
  it('첫 페이지 맨 앞에 새 메시지를 붙인다', function prepends() {
    const next = withInsertedMessage(toCache([[toMessage(2), toMessage(1)]]), toMessage(3));

    expect(next?.pages[0].map(function toId(m): number {
      return m.id;
    })).toEqual([3, 2, 1]);
  });

  it('이미 있는 메시지는 두 번 넣지 않는다', function dedupes() {
    const cache = toCache([[toMessage(2), toMessage(1)]]);

    expect(withInsertedMessage(cache, toMessage(2))).toBe(cache);
  });

  it('다른 페이지에 있는 메시지도 중복으로 보고 넘긴다', function dedupesAcrossPages() {
    const cache = toCache([[toMessage(4)], [toMessage(1)]]);

    expect(withInsertedMessage(cache, toMessage(1))).toBe(cache);
  });

  it('아직 아무 페이지도 받지 못했으면 손대지 않는다', function noPages() {
    expect(withInsertedMessage(undefined, toMessage(1))).toBeUndefined();
    expect(withInsertedMessage(toCache([]), toMessage(1))?.pages).toEqual([]);
  });
});

describe('withUpdatedMessage', function withUpdatedMessageSuite() {
  it('같은 id의 메시지를 갈아 끼운다', function replaces() {
    const cache = toCache([[toMessage(2), toMessage(1)]]);
    const read = toMessage(1, '2026-08-03T02:00:00.000Z');

    expect(withUpdatedMessage(cache, read)?.pages[0][1].readAt).toBe(
      '2026-08-03T02:00:00.000Z',
    );
  });

  it('모르는 메시지면 아무것도 바꾸지 않는다', function unknownMessage() {
    const cache = toCache([[toMessage(2)]]);

    expect(withUpdatedMessage(cache, toMessage(99))?.pages[0]).toEqual([toMessage(2)]);
  });

  it('캐시가 없으면 그대로 둔다', function noCache() {
    expect(withUpdatedMessage(undefined, toMessage(1))).toBeUndefined();
  });
});
