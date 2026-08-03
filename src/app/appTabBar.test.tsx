import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppTabBar from './appTabBar';
import { useUnreadChatCount } from '../features/chat/hooks/useUnreadChatCount';

// 배지 숫자만 이 화면의 몫이다. 그 숫자를 어떻게 세는지는 훅이 이미 자기 자리에서 책임진다.
jest.mock('../features/chat/hooks/useUnreadChatCount', function mockUnreadChatCount() {
  return { useUnreadChatCount: jest.fn() };
});

const mockUseUnreadChatCount = useUnreadChatCount as jest.MockedFunction<typeof useUnreadChatCount>;

function renderTabBar(pathname: string, unreadCount = 0) {
  mockUseUnreadChatCount.mockReturnValue(unreadCount);

  render(
    <MemoryRouter initialEntries={[pathname]}>
      <AppTabBar />
    </MemoryRouter>,
  );
}

describe('AppTabBar', function appTabBarSuite() {
  it('다섯 자리를 모두 보여준다', function showsAllTabs() {
    renderTabBar('/');

    expect(screen.getByRole('link', { name: '홈' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '검색' })).toHaveAttribute('href', '/search');
    expect(screen.getByRole('link', { name: '글쓰기' })).toHaveAttribute('href', '/posts/new');
    expect(screen.getByRole('link', { name: '채팅' })).toHaveAttribute('href', '/chats');
    expect(screen.getByRole('link', { name: '나의 가지마켓' })).toHaveAttribute('href', '/my');
  });

  it('지금 보고 있는 화면의 탭을 현재 위치로 알린다', function marksCurrentTab() {
    renderTabBar('/search');

    expect(screen.getByRole('link', { name: '검색' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '홈' })).not.toHaveAttribute('aria-current');
  });

  it('하위 화면에서도 그 탭이 켜져 있다', function marksParentTab() {
    renderTabBar('/my/likes');

    expect(screen.getByRole('link', { name: '나의 가지마켓' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('안 읽은 메시지가 있으면 채팅 자리에 개수를 붙인다', function showsUnreadBadge() {
    renderTabBar('/', 3);

    expect(screen.getByLabelText('안 읽은 메시지 3개')).toHaveTextContent('3');
  });

  it('다 읽었으면 개수를 그리지 않는다', function hidesUnreadBadge() {
    renderTabBar('/', 0);

    expect(screen.queryByLabelText(/안 읽은 메시지/)).not.toBeInTheDocument();
  });

  it('안 읽은 메시지가 아주 많으면 999+로 줄인다', function clampsUnreadBadge() {
    renderTabBar('/', 1200);

    expect(screen.getByLabelText('안 읽은 메시지 1200개')).toHaveTextContent('999+');
  });
});
