import type { InfiniteData } from '@tanstack/react-query';
import type { AppNotification } from '../types';

/**
 * 읽음 표시를 캐시에 그 자리에서 반영한다.
 *
 * 무효화하고 다시 읽지 않는 이유: 알림을 누르면 곧바로 다른 화면으로 넘어간다. 그 순간
 * 목록을 다시 부르면 이미 떠난 화면을 위한 요청이 되고, 돌아왔을 때는 어차피 stale time이
 * 지나 다시 읽는다. 굵은 글씨 하나 지우자고 왕복할 이유가 없다.
 *
 * 모르는 id면 아무것도 하지 않는다 — 아직 안 받아 온 페이지의 것이다.
 */
export function withReadNotification(
  data: InfiniteData<AppNotification[]> | undefined,
  notificationId: number,
): InfiniteData<AppNotification[]> | undefined {
  if (data === undefined) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map(function markInPage(page: AppNotification[]): AppNotification[] {
      return page.map(function markOne(current: AppNotification): AppNotification {
        return current.id === notificationId ? { ...current, isRead: true } : current;
      });
    }),
  };
}

/** "모두 읽음"이 누른 뒤의 목록. 받아 온 페이지 전부가 읽은 상태가 된다. */
export function withAllNotificationsRead(
  data: InfiniteData<AppNotification[]> | undefined,
): InfiniteData<AppNotification[]> | undefined {
  if (data === undefined) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map(function markPage(page: AppNotification[]): AppNotification[] {
      return page.map(function markOne(current: AppNotification): AppNotification {
        return current.isRead ? current : { ...current, isRead: true };
      });
    }),
  };
}

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
 * 배지 숫자를 하나 줄인다.
 *
 * 이미 읽은 알림을 다시 누르면 줄이지 않는다 — 화면이 그 판단을 하도록 두면 "누를 때마다
 * 하나씩"이라는 규칙이 두 곳에 흩어진다. 0 아래로는 내려가지 않는다.
 */
export function withDecrementedUnread(count: number | undefined, wasRead: boolean): number {
  if (count === undefined || wasRead) {
    return Math.max(count ?? 0, 0);
  }

  return Math.max(count - 1, 0);
}
