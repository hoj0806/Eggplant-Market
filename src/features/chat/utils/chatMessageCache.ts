import type { InfiniteData } from '@tanstack/react-query';
import type { ChatMessage } from '../types';

/**
 * 캐시의 첫 페이지에 메시지를 얹는다.
 *
 * 페이지는 최신순(id 내림차순)이고 첫 페이지가 가장 최신이라 맨 앞이 새 메시지 자리다.
 *
 * 같은 메시지가 두 번 들어올 수 있다 — 내가 보낸 메시지는 insert 응답으로 한 번,
 * 곧이어 Realtime 에코로 또 한 번 온다. id로 이미 있으면 아무것도 하지 않는다.
 *
 * 아직 아무 페이지도 받지 못했으면 손대지 않는다. 첫 조회가 곧 서버 값을 가져오므로
 * 여기서 페이지를 만들어 두면 그 값과 겹친다.
 */
export function withInsertedMessage(
  data: InfiniteData<ChatMessage[]> | undefined,
  message: ChatMessage,
): InfiniteData<ChatMessage[]> | undefined {
  if (data === undefined || data.pages.length === 0) {
    return data;
  }

  const exists = data.pages.some(function hasMessage(page: ChatMessage[]): boolean {
    return page.some(function isSame(current: ChatMessage): boolean {
      return current.id === message.id;
    });
  });

  if (exists) {
    return data;
  }

  const [firstPage, ...restPages] = data.pages;

  return { ...data, pages: [[message, ...firstPage], ...restPages] };
}

/**
 * 이미 있는 메시지를 갈아 끼운다. 읽음 표시가 들어올 때 쓴다.
 * 모르는 메시지면 아무것도 하지 않는다 — 아직 안 읽어 온 페이지의 것이다.
 */
export function withUpdatedMessage(
  data: InfiniteData<ChatMessage[]> | undefined,
  message: ChatMessage,
): InfiniteData<ChatMessage[]> | undefined {
  if (data === undefined) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map(function replaceInPage(page: ChatMessage[]): ChatMessage[] {
      return page.map(function replace(current: ChatMessage): ChatMessage {
        return current.id === message.id ? message : current;
      });
    }),
  };
}
