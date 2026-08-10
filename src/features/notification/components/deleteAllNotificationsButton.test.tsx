import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeleteAllNotificationsButton from './deleteAllNotificationsButton';
import { notificationCountQueryKey, notificationsQueryKey } from '../hooks/useNotificationQueries';
import type { AppNotification } from '../types';

// notificationApi는 supabaseClient를 거쳐 import.meta.env에 닿는다. 실제 모듈은 로드하지 않는다.
const mockDeleteAllNotifications = jest.fn();

jest.mock('../api/notificationApi', function mockNotificationApi() {
  return {
    deleteAllNotifications: function deleteAllNotifications() {
      return mockDeleteAllNotifications();
    },
    // 훅 파일이 모듈을 통째로 import하므로 자리만 채운다.
    deleteNotification: jest.fn(),
  };
});

const VIEWER_ID = 'me';

function makeNotification(id: number): AppNotification {
  return {
    id,
    type: 'chat',
    createdAt: '2026-08-10T00:00:00.000Z',
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

function renderButton() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  queryClient.setQueryData(notificationsQueryKey(VIEWER_ID), {
    pages: [[makeNotification(1), makeNotification(2)]],
    pageParams: [null],
  });
  queryClient.setQueryData(notificationCountQueryKey(VIEWER_ID), 2);

  render(
    <QueryClientProvider client={queryClient}>
      <DeleteAllNotificationsButton viewerId={VIEWER_ID} />
    </QueryClientProvider>,
  );

  return queryClient;
}

describe('DeleteAllNotificationsButton', function deleteAllNotificationsButtonSuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    mockDeleteAllNotifications.mockResolvedValue(undefined);
  });

  /**
   * 0019가 한 줄 삭제에 확인을 두지 않은 근거("잃는 것이 한 줄뿐")가 여기서는 뒤집힌다.
   * 이 테스트가 그 판단을 지킨다 — 확인 없이 지우는 구조로 돌아가면 먼저 깨진다.
   */
  it('한 번 더 묻기 전에는 지우지 않는다', async function asksFirst() {
    renderButton();

    await userEvent.click(screen.getByRole('button', { name: '모두 삭제' }));

    expect(mockDeleteAllNotifications).not.toHaveBeenCalled();
    expect(screen.getByText(/되돌릴 수 없어요/)).toBeInTheDocument();
  });

  it('취소하면 아무것도 지우지 않고 버튼으로 돌아간다', async function cancels() {
    renderButton();

    await userEvent.click(screen.getByRole('button', { name: '모두 삭제' }));
    await userEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(mockDeleteAllNotifications).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '모두 삭제' })).toBeInTheDocument();
  });

  it('확인하면 목록을 비우고 배지를 0으로 내린다', async function deletesAll() {
    const queryClient = renderButton();

    await userEvent.click(screen.getByRole('button', { name: '모두 삭제' }));
    await userEvent.click(screen.getByRole('button', { name: '지우기' }));

    await waitFor(function deleted() {
      expect(mockDeleteAllNotifications).toHaveBeenCalled();
    });

    await waitFor(function cacheCleared() {
      const cache = queryClient.getQueryData(notificationsQueryKey(VIEWER_ID)) as {
        pages: AppNotification[][];
      };
      expect(cache.pages.flat()).toEqual([]);
    });
    // 몇 줄이었는지 세지 않는다 — 다 지웠으면 0이다.
    expect(queryClient.getQueryData(notificationCountQueryKey(VIEWER_ID))).toBe(0);
  });

  it('실패하면 그 자리에 알리고 목록을 건드리지 않는다', async function showsError() {
    mockDeleteAllNotifications.mockRejectedValue(new Error('network down'));
    const queryClient = renderButton();

    await userEvent.click(screen.getByRole('button', { name: '모두 삭제' }));
    await userEvent.click(screen.getByRole('button', { name: '지우기' }));

    await waitFor(function alerted() {
      expect(screen.getByRole('alert')).toHaveTextContent('알림을 지우지 못했습니다.');
    });

    const cache = queryClient.getQueryData(notificationsQueryKey(VIEWER_ID)) as {
      pages: AppNotification[][];
    };
    expect(cache.pages.flat()).toHaveLength(2);
    // 다시 누를 수 있어야 하므로 확인 화면에 머무른다.
    expect(screen.getByRole('button', { name: '지우기' })).toBeInTheDocument();
  });
});
