import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import NotificationSettingsPage from './notificationSettingsPage';
import type { NotificationPrefs } from '../types';

// notificationPrefsApi는 supabaseClient(import.meta)에 닿는다. ts-jest가 CommonJS로 옮기면서
// import.meta를 그대로 뱉으므로 실제 모듈을 로드하면 죽는다(troble.md #5).
const mockFetchPrefs = jest.fn();
const mockUpdatePref = jest.fn();

jest.mock('../api/notificationPrefsApi', function mockPrefsApi() {
  return {
    fetchNotificationPrefs: function fetchNotificationPrefs(userId: unknown) {
      return mockFetchPrefs(userId);
    },
    updateNotificationPref: function updateNotificationPref(input: unknown) {
      return mockUpdatePref(input);
    },
  };
});

const VIEWER_ID = 'viewer-1';

jest.mock('../../auth/store/authStore', function mockAuthStore() {
  return {
    selectAuthUser: function selectAuthUser(state: unknown) {
      return state;
    },
    useAuthStore: function useAuthStore() {
      return { id: VIEWER_ID };
    },
  };
});

const ALL_ON: NotificationPrefs = { comment: true, like: true, review: true };

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NotificationSettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NotificationSettingsPage', function notificationSettingsSuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    mockFetchPrefs.mockResolvedValue(ALL_ON);
    mockUpdatePref.mockResolvedValue({ ...ALL_ON, like: false });
  });

  // 끌 수 있는 것만 화면에 있다. 채팅·가격 제안은 서버에 칸조차 없다(0022).
  it('끌 수 있는 셋만 스위치로 두고, 못 끄는 둘은 이유를 적는다', async function rowsCase() {
    renderPage();

    expect(await screen.findByRole('switch', { name: '댓글' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '관심' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '거래후기' })).toBeInTheDocument();
    expect(screen.getAllByRole('switch')).toHaveLength(3);

    expect(
      screen.getByText(/채팅과 가격 제안 알림은 끌 수 없어요/),
    ).toBeInTheDocument();
  });

  it('켜져 있으면 켜진 것으로 읽힌다', async function checkedCase() {
    renderPage();

    expect(await screen.findByRole('switch', { name: '관심' })).toBeChecked();
  });

  it('누르면 그 종류만 서버로 보낸다', async function toggleCase() {
    renderPage();

    await userEvent.click(await screen.findByRole('switch', { name: '관심' }));

    await waitFor(function assertSent() {
      expect(mockUpdatePref).toHaveBeenCalledWith({
        userId: VIEWER_ID,
        key: 'like',
        enabled: false,
      });
    });
    expect(screen.getByRole('switch', { name: '댓글' })).toBeChecked();
  });

  // 저장 버튼이 없으므로 누르는 즉시 움직여야 한다. 응답을 기다리면 안 눌린 것처럼 보인다.
  it('응답을 기다리지 않고 그 자리에서 꺼진다', async function optimisticCase() {
    // 응답을 붙잡아 둔다. 그동안 화면이 이미 움직여 있어야 한다.
    let resolveUpdate: (value: NotificationPrefs) => void = function noop(): void {};
    mockUpdatePref.mockReturnValue(
      new Promise<NotificationPrefs>(function capture(resolve) {
        resolveUpdate = resolve;
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('switch', { name: '관심' }));

    expect(screen.getByRole('switch', { name: '관심' })).not.toBeChecked();

    resolveUpdate({ ...ALL_ON, like: false });
    await waitFor(function assertSettled() {
      expect(screen.getByRole('switch', { name: '관심' })).not.toBeChecked();
    });
  });

  // 껐다고 믿은 알림이 계속 오면 설정이 고장 난 것으로 보인다.
  it('실패하면 되돌리고 이유를 보여준다', async function rollbackCase() {
    mockUpdatePref.mockRejectedValue(new Error('network'));
    renderPage();

    await userEvent.click(await screen.findByRole('switch', { name: '관심' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('설정을 저장하지 못했습니다');
    await waitFor(function assertRolledBack() {
      expect(screen.getByRole('switch', { name: '관심' })).toBeChecked();
    });
  });
});
