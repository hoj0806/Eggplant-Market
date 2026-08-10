import type { InfiniteData } from '@tanstack/react-query';
import type { AppNotification } from '../types';

/**
 * 알림 캐시를 고치는 순수 함수들.
 *
 * **읽음 표시가 없다**(0036). 알림에 일어나는 일은 "사라진다" 하나뿐이라, 여기 있는 것도
 * 전부 빼는 함수다 — 한 줄 · 전부 · 배지 숫자.
 */

/**
 * 지운 알림을 목록에서 빼낸다.
 *
 * 무효화하지 않는다. 무한 스크롤은 커서를 이어 붙인 것이라 다시 부르면 **첫 페이지만
 * 남고 아래로 읽어 둔 것이 전부 날아간다**(0015의 keyset 커서). 한 줄 지우자고 그럴 이유가 없다.
 *
 * 페이지 하나가 통째로 비어도 그 페이지를 없애지 않는다. 페이지 배열은 커서의 흔적이라
 * 개수가 줄면 `getNextPageParam`이 보는 마지막 페이지가 달라진다 — 빈 배열은 화면에
 * 아무것도 그리지 않으므로 그대로 두는 편이 안전하다.
 */
export function withoutNotification(
  data: InfiniteData<AppNotification[]> | undefined,
  notificationId: number,
): InfiniteData<AppNotification[]> | undefined {
  if (data === undefined) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map(function removeFromPage(page: AppNotification[]): AppNotification[] {
      return page.filter(function keepOthers(current: AppNotification): boolean {
        return current.id !== notificationId;
      });
    }),
  };
}

/**
 * "모두 삭제"가 누른 뒤의 목록. 받아 온 페이지가 전부 빈 배열이 된다.
 *
 * **페이지 배열 자체는 그대로 둔다.** `withoutNotification`이 빈 페이지를 남기는 것과 같은
 * 이유인데, 여기서는 값을 하나 더 한다 — `toNextNotificationCursor`는 **마지막 페이지가
 * 덜 찼으면 다음이 없다**고 읽으므로, 페이지가 전부 비면 `hasNextPage`가 저절로 꺼진다.
 * 그래서 무한 스크롤이 빈 목록 아래에서 헛되이 다음 장을 부르지 않는다.
 *
 * 무효화(invalidate)로 갈음할 수도 있지만 그러면 **지운 직후에 빈 목록을 한 번 더 받으러
 * 간다.** 결과를 이미 아는 왕복이다.
 */
export function withoutAllNotifications(
  data: InfiniteData<AppNotification[]> | undefined,
): InfiniteData<AppNotification[]> | undefined {
  if (data === undefined) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map(function emptyPage(): AppNotification[] {
      return [];
    }),
  };
}

/**
 * 배지 숫자를 하나 줄인다. 줄 하나가 사라졌을 때만 부른다.
 *
 * 조건이 없다. 배지가 세는 것이 "남아 있는 알림"이라(0036) 사라지면 언제나 하나 준다 —
 * 전에는 "안 읽었던 것이면"이라는 단서가 붙었는데, 그 단서를 만들던 상태가 없어졌다.
 * 0 아래로는 내려가지 않는다.
 */
export function withDecrementedCount(count: number | undefined): number {
  if (count === undefined) {
    return 0;
  }

  return Math.max(count - 1, 0);
}
