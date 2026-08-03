import { CHAT_MESSAGE_PAGE_SIZE } from '../api/chatApi';
import type { ChatMessage } from '../types';

/**
 * 방금 받은 페이지를 보고 "더 위(이전)"를 가리키는 커서를 정한다.
 *
 * 메시지는 최신부터 내려 읽으므로 커서는 그 페이지에서 **가장 작은 id**다.
 * 한 페이지가 다 차지 않았으면 그 위로는 없다.
 *
 * TanStack Query의 getNextPageParam은 undefined를 "다음 없음"으로 읽는다.
 */
export function toNextMessageCursor(lastPage: ChatMessage[]): number | undefined {
  if (lastPage.length < CHAT_MESSAGE_PAGE_SIZE) {
    return undefined;
  }

  return lastPage[lastPage.length - 1].id;
}

/**
 * 여러 페이지를 화면에 그릴 하나의 목록으로 편다.
 *
 * 각 페이지는 최신순(내림차순)이고 페이지 자체도 최신 페이지가 먼저다.
 * 대화는 위에서 아래로 흘러야 하므로 통째로 뒤집는다.
 *
 * Realtime으로 들어온 메시지가 첫 페이지에 이미 얹혀 있고, 그 사이 재조회가 겹치면
 * 같은 id가 두 번 나올 수 있어 여기서 한 번 더 거른다.
 */
export function toMessageTimeline(pages: ReadonlyArray<ChatMessage[]>): ChatMessage[] {
  const seen = new Set<number>();
  const timeline: ChatMessage[] = [];

  for (const page of pages) {
    for (const message of page) {
      if (seen.has(message.id)) {
        continue;
      }
      seen.add(message.id);
      timeline.push(message);
    }
  }

  return timeline.reverse();
}
