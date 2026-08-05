import type { InfiniteData } from '@tanstack/react-query';
import {
  withAllNotificationsRead,
  withDecrementedUnread,
  withoutNotification,
  withReadNotification,
} from './notificationCache';
import type { AppNotification } from '../types';

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

describe('withAllNotificationsRead', function withAllNotificationsReadSuite() {
  it('받아 온 페이지 전부를 읽음으로 바꾼다', function marksAllCase() {
    const cache = makeCache([[makeNotification(1, false)], [makeNotification(2, false)]]);

    const next = withAllNotificationsRead(cache);

    expect(next?.pages.flat().every(function isRead(n: AppNotification) {
      return n.isRead;
    })).toBe(true);
  });
});

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
