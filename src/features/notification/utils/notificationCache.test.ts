import type { InfiniteData } from '@tanstack/react-query';
import {
  withDecrementedUnread,
  withoutAllNotifications,
  withoutNotification,
  withReadNotification,
} from './notificationCache';
import { toNextNotificationCursor } from './notificationCursor';
import type { AppNotification } from '../types';

// 커서 유틸이 페이지 크기 상수 하나 때문에 notificationApi를 import하고, 그쪽은
// supabaseClient를 거쳐 import.meta.env에 닿는다(troble.md 「탐색」 1번).
// notificationCursor.test.ts와 같은 처방이다.
jest.mock('../api/notificationApi', function mockNotificationApi() {
  return { NOTIFICATIONS_PAGE_SIZE: 20 };
});

function makeNotification(id: number, isRead: boolean): AppNotification {
  return {
    id,
    type: 'chat',
    isRead,
    createdAt: '2026-08-05T00:00:00.000Z',
    actorId: 'actor-1',
    actorNickname: '가지팔이',
    actorAvatarUrl: null,
    roomId: 9,
    postId: null,
    postTitle: null,
    preview: null,
    offerAmount: null,
    isFirst: false,
  };
}

function makeCache(pages: AppNotification[][]): InfiniteData<AppNotification[]> {
  return { pages, pageParams: pages.map(function toParam() {
    return null;
  }) };
}

describe('withReadNotification', function withReadNotificationSuite() {
  it('해당 알림만 읽음으로 바꾼다', function marksOneCase() {
    const cache = makeCache([[makeNotification(1, false), makeNotification(2, false)]]);

    const next = withReadNotification(cache, 1);

    expect(next?.pages[0][0].isRead).toBe(true);
    expect(next?.pages[0][1].isRead).toBe(false);
  });

  // 두 번째 페이지까지 내려간 뒤 그 줄을 눌러도 굵은 글씨가 지워져야 한다.
  it('나중에 받은 페이지에 있어도 찾아서 바꾼다', function laterPageCase() {
    const cache = makeCache([[makeNotification(1, false)], [makeNotification(2, false)]]);

    const next = withReadNotification(cache, 2);

    expect(next?.pages[1][0].isRead).toBe(true);
  });

  it('아직 아무 페이지도 없으면 아무것도 하지 않는다', function emptyCase() {
    expect(withReadNotification(undefined, 1)).toBeUndefined();
  });
});

// withAllNotificationsRead는 "모두 읽음"과 함께 걷어냈다(2026-08-10).

describe('withoutNotification', function withoutNotificationSuite() {
  it('지운 알림만 목록에서 뺀다', function removeOneCase() {
    const cache = makeCache([[makeNotification(1, false), makeNotification(2, false)]]);

    const next = withoutNotification(cache, 1);

    expect(next?.pages[0].map(function toId(n: AppNotification) {
      return n.id;
    })).toEqual([2]);
  });

  it('나중에 받은 페이지에 있어도 찾아서 뺀다', function laterPageCase() {
    const cache = makeCache([[makeNotification(1, false)], [makeNotification(2, false)]]);

    const next = withoutNotification(cache, 2);

    expect(next?.pages[1]).toEqual([]);
  });

  // 페이지 개수가 줄면 getNextPageParam이 보는 마지막 페이지가 달라진다.
  it('페이지가 통째로 비어도 페이지 자체는 남긴다', function keepEmptyPageCase() {
    const cache = makeCache([[makeNotification(1, false)], [makeNotification(2, false)]]);

    const next = withoutNotification(cache, 2);

    expect(next?.pages).toHaveLength(2);
    expect(next?.pageParams).toHaveLength(2);
  });

  it('아직 아무 페이지도 없으면 아무것도 하지 않는다', function emptyCase() {
    expect(withoutNotification(undefined, 1)).toBeUndefined();
  });
});

describe('withoutAllNotifications', function withoutAllNotificationsSuite() {
  it('받아 온 페이지를 전부 비운다', function emptiesAllCase() {
    const cache = makeCache([[makeNotification(1, false)], [makeNotification(2, true)]]);

    const next = withoutAllNotifications(cache);

    expect(next?.pages.flat()).toEqual([]);
  });

  // withoutNotification과 같은 이유다. 페이지 개수와 pageParams 개수가 어긋나면 안 된다.
  it('페이지 배열 자체는 남긴다', function keepsPagesCase() {
    const cache = makeCache([[makeNotification(1, false)], [makeNotification(2, true)]]);

    const next = withoutAllNotifications(cache);

    expect(next?.pages).toHaveLength(2);
    expect(next?.pageParams).toHaveLength(2);
  });

  /**
   * 빈 페이지를 남겨도 무한 스크롤이 헛돌지 않는다는 것까지 본다 — 커서 규칙이
   * "마지막 페이지가 덜 찼으면 끝"이라 빈 배열은 저절로 끝으로 읽힌다.
   * 이 두 함수는 서로를 모르지만 **함께 맞아야** 지운 뒤 목록이 조용해진다.
   */
  it('전부 비운 뒤에는 다음 페이지를 부르지 않는다', function stopsPagingCase() {
    const cache = makeCache([[makeNotification(1, false)]]);

    const next = withoutAllNotifications(cache);
    const lastPage = next?.pages[next.pages.length - 1] ?? [];

    expect(toNextNotificationCursor(lastPage)).toBeUndefined();
  });

  it('아직 아무 페이지도 없으면 아무것도 하지 않는다', function emptyCase() {
    expect(withoutAllNotifications(undefined)).toBeUndefined();
  });
});

describe('withDecrementedUnread', function withDecrementedUnreadSuite() {
  it('안 읽은 알림을 누르면 하나 줄어든다', function decrementCase() {
    expect(withDecrementedUnread(3, false)).toBe(2);
  });

  // 이미 읽은 줄을 다시 눌러 배지가 깎이면 목록과 숫자가 어긋난다.
  it('이미 읽은 알림을 다시 눌러도 줄지 않는다', function alreadyReadCase() {
    expect(withDecrementedUnread(3, true)).toBe(3);
  });

  it('0 아래로는 내려가지 않는다', function floorCase() {
    expect(withDecrementedUnread(0, false)).toBe(0);
  });

  it('아직 숫자를 받지 못했으면 0으로 둔다', function undefinedCase() {
    expect(withDecrementedUnread(undefined, false)).toBe(0);
  });
});
