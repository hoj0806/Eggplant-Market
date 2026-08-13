import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, type InfiniteData } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useClearNotificationsAt } from './useClearNotificationsAt';
import { notificationCountQueryKey, notificationsQueryKey } from './useNotificationQueries';
import type { AppNotification } from '../types';

// notificationApi는 supabaseClient를 거쳐 import.meta.env에 닿는다. 실제 모듈은 로드하지 않는다
// (troble.md 「탐색」 1번 — 이 저장소의 표준 처방이다).
const mockDeleteNotificationsAt = jest.fn();

jest.mock('../api/notificationApi', function mockNotificationApi() {
  return {
    NOTIFICATIONS_PAGE_SIZE: 20,
    deleteNotificationsAt: function deleteNotificationsAt(place: unknown) {
      return mockDeleteNotificationsAt(place);
    },
  };
});

const VIEWER_ID = 'viewer-1';

function makeNotification(id: number): AppNotification {
  return {
    id,
    type: 'chat',
    createdAt: '2026-08-13T00:00:00.000Z',
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

function renderClear(place: Parameters<typeof useClearNotificationsAt>[0], viewerId: string | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  queryClient.setQueryData<InfiniteData<AppNotification[]>>(notificationsQueryKey(viewerId), {
    pages: [[makeNotification(1), makeNotification(2), makeNotification(3)]],
    pageParams: [null],
  });
  queryClient.setQueryData<number>(notificationCountQueryKey(viewerId), 3);

  const view = renderHook(
    function useClear() {
      return useClearNotificationsAt(place, viewerId);
    },
    {
      wrapper: function Wrapper(props: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>;
      },
    },
  );

  return { queryClient, view };
}

describe('useClearNotificationsAt', function useClearNotificationsAtSuite() {
  beforeEach(function resetMocks() {
    mockDeleteNotificationsAt.mockReset();
    mockDeleteNotificationsAt.mockResolvedValue([]);
  });

  it('방에 도착하면 그 방의 알림을 지운다', function clearsAtRoom() {
    renderClear({ kind: 'room', roomId: 9 }, VIEWER_ID);

    expect(mockDeleteNotificationsAt).toHaveBeenCalledWith({ kind: 'room', roomId: 9 });
  });

  it('글에 도착하면 그 글의 알림을 지운다', function clearsAtPost() {
    renderClear({ kind: 'post', postId: 41598 }, VIEWER_ID);

    expect(mockDeleteNotificationsAt).toHaveBeenCalledWith({ kind: 'post', postId: 41598 });
  });

  /** 로그인하지 않았으면 지울 내 알림이 없다. 보내 봐야 0건 삭제로 끝난다. */
  it('로그인하지 않았으면 부르지 않는다', function skipsGuest() {
    renderClear({ kind: 'room', roomId: 9 }, null);

    expect(mockDeleteNotificationsAt).not.toHaveBeenCalled();
  });

  it('갈 곳이 정해지지 않았으면 부르지 않는다', function skipsNullPlace() {
    renderClear(null, VIEWER_ID);

    expect(mockDeleteNotificationsAt).not.toHaveBeenCalled();
  });

  /**
   * 부르는 쪽은 `{ kind: 'room', roomId }`를 그 자리에서 만든다 — 렌더마다 새 객체다.
   * 그것으로 effect가 다시 돌면 방을 보고 있는 동안 삭제 요청이 꼬리를 문다.
   */
  it('같은 곳에 머무르는 동안 두 번 부르지 않는다', function callsOncePerPlace() {
    const { view } = renderClear({ kind: 'room', roomId: 9 }, VIEWER_ID);

    view.rerender();
    view.rerender();

    expect(mockDeleteNotificationsAt).toHaveBeenCalledTimes(1);
  });

  it('지워진 줄을 목록에서 빼고 배지를 그만큼 깎는다', async function updatesCache() {
    mockDeleteNotificationsAt.mockResolvedValue([1, 3]);

    const { queryClient } = renderClear({ kind: 'room', roomId: 9 }, VIEWER_ID);

    await waitFor(function badgeReduced(): void {
      expect(queryClient.getQueryData<number>(notificationCountQueryKey(VIEWER_ID))).toBe(1);
    });

    const list = queryClient.getQueryData<InfiniteData<AppNotification[]>>(
      notificationsQueryKey(VIEWER_ID),
    );

    expect(list?.pages[0].map(function toId(row) {
      return row.id;
    })).toEqual([2]);
  });

  /** 도착한 곳에 내 알림이 없을 수 있다. 그때 배지를 건드리면 있지도 않은 줄을 깎는다. */
  it('지운 것이 없으면 배지를 건드리지 않는다', async function keepsBadgeWhenNothingRemoved() {
    const { queryClient } = renderClear({ kind: 'post', postId: 1 }, VIEWER_ID);

    await waitFor(function called(): void {
      expect(mockDeleteNotificationsAt).toHaveBeenCalled();
    });

    expect(queryClient.getQueryData<number>(notificationCountQueryKey(VIEWER_ID))).toBe(3);
  });

  /** 곁가지다. 방과 글은 이미 열렸고, 실패를 사용자에게 알리지 않는다. */
  it('실패해도 조용히 넘어간다', async function swallowsFailure() {
    mockDeleteNotificationsAt.mockRejectedValue(new Error('네트워크가 끊겼습니다'));

    const { queryClient } = renderClear({ kind: 'room', roomId: 9 }, VIEWER_ID);

    await waitFor(function called(): void {
      expect(mockDeleteNotificationsAt).toHaveBeenCalled();
    });

    expect(queryClient.getQueryData<number>(notificationCountQueryKey(VIEWER_ID))).toBe(3);
  });
});
