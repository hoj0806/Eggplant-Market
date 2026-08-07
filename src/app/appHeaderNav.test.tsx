import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppHeaderNav from './appHeaderNav';
import { useUnreadChatCount } from '../features/chat/hooks/useUnreadChatCount';
import { AUTH_INITIAL_STATE, useAuthStore } from '../features/auth/store/authStore';
import type { AuthSession } from '../features/auth/types';

// 배지 숫자만 이 화면의 몫이다(appTabBar.test와 같은 이유).
jest.mock('../features/chat/hooks/useUnreadChatCount', function mockUnreadChatCount() {
  return { useUnreadChatCount: jest.fn() };
});

// 알림 종은 자기 자리에서 자기 숫자를 센다. 여기서는 "붙어 있나"만 본다.
jest.mock(
  '../features/notification/components/notificationBellLink',
  function mockBellLink() {
    return {
      __esModule: true,
      default: function NotificationBellLink() {
        return <span data-testid="notification-bell" />;
      },
    };
  },
);

const mockUseUnreadChatCount = useUnreadChatCount as jest.MockedFunction<
  typeof useUnreadChatCount
>;

function createSession(): AuthSession {
  return {
    access_token: 'access-1',
    refresh_token: 'refresh-1',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'user-1',
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: { provider: 'google' },
      user_metadata: {},
      created_at: '2026-08-01T00:00:00.000Z',
    },
  };
}

function renderHeader(pathname: string, options: { unread?: number; signedIn?: boolean } = {}) {
  mockUseUnreadChatCount.mockReturnValue(options.unread ?? 0);
  useAuthStore.setState(
    options.signedIn === true
      ? { session: createSession(), user: createSession().user, status: 'authenticated' }
      : { ...AUTH_INITIAL_STATE, status: 'unauthenticated' },
  );

  render(
    <MemoryRouter initialEntries={[pathname]}>
      <AppHeaderNav />
    </MemoryRouter>,
  );
}

describe('AppHeaderNav', function appHeaderNavSuite() {
  beforeEach(function resetAll() {
    jest.clearAllMocks();
  });

  // 탭바와 **같은 APP_TABS**를 읽는다. 자리를 더하면 양쪽에 함께 생겨야 한다.
  it('탭바와 같은 다섯 자리를 준다', function showsAllTabs() {
    renderHeader('/');

    expect(screen.getByRole('link', { name: '홈' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '검색' })).toHaveAttribute('href', '/search');
    expect(screen.getByRole('link', { name: '채팅' })).toHaveAttribute('href', '/chats');
    expect(screen.getByRole('link', { name: '나의 가지마켓' })).toHaveAttribute('href', '/my');
    expect(screen.getByRole('link', { name: '글쓰기' })).toHaveAttribute('href', '/posts/new');
  });

  it('지금 보고 있는 화면을 현재 위치로 알린다', function marksCurrentTab() {
    renderHeader('/search');

    expect(screen.getByRole('link', { name: '검색' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '홈' })).not.toHaveAttribute('aria-current');
  });

  it('하위 화면에서도 그 자리가 켜져 있다', function marksParentTab() {
    renderHeader('/my/likes');

    expect(screen.getByRole('link', { name: '나의 가지마켓' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('안 읽은 메시지가 있으면 채팅 옆에 숫자를 붙인다', function showsUnread() {
    renderHeader('/', { unread: 3, signedIn: true });

    expect(screen.getByLabelText('안 읽은 메시지 3개')).toHaveTextContent('3');
  });

  it('안 읽은 메시지가 없으면 숫자를 붙이지 않는다', function hidesUnread() {
    renderHeader('/', { unread: 0, signedIn: true });

    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  // 데스크탑에서는 어느 화면에서든 알림으로 갈 수 있어야 한다(모바일은 홈에만 있다).
  it('로그인했으면 알림 종이 붙는다', function showsBellWhenSignedIn() {
    renderHeader('/search', { signedIn: true });

    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
  });

  it('비로그인에게는 알림 종이 없다', function hidesBellForGuest() {
    renderHeader('/search');

    expect(screen.queryByTestId('notification-bell')).not.toBeInTheDocument();
  });
});
