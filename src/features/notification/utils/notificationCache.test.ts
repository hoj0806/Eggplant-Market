import type { InfiniteData } from '@tanstack/react-query';
import {
  withDecrementedCount,
  withoutAllNotifications,
  withoutNotification,
} from './notificationCache';
import { toNextNotificationCursor } from './notificationCursor';
import type { AppNotification } from '../types';

// 커서 유틸이 페이지 크기 상수 하나 때문에 notificationApi를 import하고, 그쪽은
// supabaseClient를 거쳐 import.meta.env에 닿는다(troble.md 「탐색」 1번).
// notificationCursor.test.ts와 같은 처방이다.
jest.mock('../api/notificationApi', function mockNotificationApi() {
  return { NOTIFICATIONS_PAGE_SIZE: 20 };
});

function makeNotification(id: number): AppNotification {
  return {
    id,
    type: 'chat',
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
    commentCount: 1,
  };
}

function makeCache(pages: AppNotification[][]): InfiniteData<AppNotification[]> {
  return { pages, pageParams: pages.map(function toParam() {
    return null;
  }) };
}

// 0036에서 읽음 상태를 없앴다. withReadNotification·withAllNotificationsRead도 함께 사라져
// 여기 남은 것은 전부 "빼는" 함수다.

describe('withoutNotification', function withoutNotificationSuite() {
  it('지운 알림만 목록에서 뺀다', function removeOneCase() {
    const cache = makeCache([[makeNotification(1), makeNotification(2)]]);

    const next = withoutNotification(cache, 1);

    expect(next?.pages[0].map(function toId(n: AppNotification) {
      return n.id;
    })).toEqual([2]);
  });

  it('나중에 받은 페이지에 있어도 찾아서 뺀다', function laterPageCase() {
    const cache = makeCache([[makeNotification(1)], [makeNotification(2)]]);

    const next = withoutNotification(cache, 2);

    expect(next?.pages[1]).toEqual([]);
  });

  // 페이지 개수가 줄면 getNextPageParam이 보는 마지막 페이지가 달라진다.
  it('페이지가 통째로 비어도 페이지 자체는 남긴다', function keepEmptyPageCase() {
    const cache = makeCache([[makeNotification(1)], [makeNotification(2)]]);

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
    const cache = makeCache([[makeNotification(1)], [makeNotification(2)]]);

    const next = withoutAllNotifications(cache);

    expect(next?.pages.flat()).toEqual([]);
  });

  // withoutNotification과 같은 이유다. 페이지 개수와 pageParams 개수가 어긋나면 안 된다.
  it('페이지 배열 자체는 남긴다', function keepsPagesCase() {
    const cache = makeCache([[makeNotification(1)], [makeNotification(2)]]);

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
    const cache = makeCache([[makeNotification(1)]]);

    const next = withoutAllNotifications(cache);
    const lastPage = next?.pages[next.pages.length - 1] ?? [];

    expect(toNextNotificationCursor(lastPage)).toBeUndefined();
  });

  it('아직 아무 페이지도 없으면 아무것도 하지 않는다', function emptyCase() {
    expect(withoutAllNotifications(undefined)).toBeUndefined();
  });
});

describe('withDecrementedCount', function withDecrementedCountSuite() {
  it('한 줄이 사라지면 하나 줄어든다', function decrementCase() {
    expect(withDecrementedCount(3)).toBe(2);
  });

  /**
   * 조건이 없어진 자리다. 배지가 "안 읽은 수"일 때는 **이미 읽은 줄을 지워도 그대로**여야
   * 했는데(그 줄은 애초에 안 세어졌으니까), 이제 남은 줄을 세므로 사라지면 언제나 준다.
   */
  it('어떤 줄이든 사라지면 준다', function anyRowCase() {
    expect(withDecrementedCount(1)).toBe(0);
  });

  it('0 아래로는 내려가지 않는다', function floorCase() {
    expect(withDecrementedCount(0)).toBe(0);
  });

  it('아직 숫자를 받지 못했으면 0으로 둔다', function undefinedCase() {
    expect(withDecrementedCount(undefined)).toBe(0);
  });
});
