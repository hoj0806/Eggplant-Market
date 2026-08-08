import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import NotificationListItem from './notificationListItem';
import type { AppNotification, NotificationType } from '../types';

const VIEWER_ID = 'viewer-1';
const NOW = new Date('2026-08-05T00:10:00.000Z');

function makeNotification(
  overrides: Partial<AppNotification> & { type: NotificationType },
): AppNotification {
  return {
    id: 1,
    isRead: false,
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
    ...overrides,
  };
}

function renderItem(
  notification: AppNotification,
  onSelect = jest.fn(),
  onDelete = jest.fn(),
  isDeleting = false,
) {
  render(
    <MemoryRouter>
      <ul>
        <NotificationListItem
          notification={notification}
          viewerId={VIEWER_ID}
          now={NOW}
          isDeleting={isDeleting}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      </ul>
    </MemoryRouter>,
  );

  return onSelect;
}

describe('NotificationListItem', function notificationListItemSuite() {
  it('알림을 누르면 읽음 처리를 맡기고 그 방으로 가는 링크가 된다', function selectCase() {
    const onSelect = renderItem(
      makeNotification({ type: 'chat', roomId: 9, preview: '아직 있나요?' }),
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/chats/9');

    return userEvent.click(link).then(function assertSelected() {
      expect(onSelect).toHaveBeenCalledTimes(1);
    });
  });

  // 색만으로는 색을 구분하지 못하는 사람에게 아무것도 전해지지 않는다.
  it('안 읽은 알림은 색 말고 글자로도 표시한다', function unreadCase() {
    renderItem(makeNotification({ type: 'chat', isRead: false }));

    expect(screen.getByText('안 읽음')).toBeInTheDocument();
  });

  it('읽은 알림에는 그 표시가 없다', function readCase() {
    renderItem(makeNotification({ type: 'chat', isRead: true }));

    expect(screen.queryByText('안 읽음')).not.toBeInTheDocument();
  });

  // 눌러도 아무 일이 없는 링크를 남겨 두면 "눌렀는데 왜 안 가지"가 된다.
  it('가리키던 방이 사라졌으면 링크로 그리지 않는다', function missingTargetCase() {
    renderItem(makeNotification({ type: 'chat', roomId: null }));

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('가지팔이님이 메시지를 보냈어요')).toBeInTheDocument();
  });

  // 스무 줄의 버튼 이름이 전부 "삭제"면 스크린리더로 훑을 때 어느 줄인지 알 수 없다.
  it('삭제 버튼 이름에 어느 알림인지 담는다', function deleteLabelCase() {
    const onDelete = jest.fn();
    renderItem(makeNotification({ type: 'chat' }), jest.fn(), onDelete);

    const button = screen.getByRole('button', { name: '가지팔이님이 메시지를 보냈어요 알림 삭제' });

    return userEvent.click(button).then(function assertDeleted() {
      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });

  // 링크 안에 버튼을 넣으면 지우려다 화면이 넘어간다.
  it('삭제를 눌러도 이동하지 않는다', function deleteDoesNotNavigateCase() {
    const onSelect = jest.fn();
    renderItem(makeNotification({ type: 'chat' }), onSelect);

    return userEvent.click(screen.getByRole('button')).then(function assertNotSelected() {
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  it('지우는 중에는 그 줄의 버튼을 잠근다', function deletingCase() {
    renderItem(makeNotification({ type: 'chat' }), jest.fn(), jest.fn(), true);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  // 갈 곳이 없는 알림이야말로 치우고 싶은 줄이다.
  it('링크가 아닌 줄에도 삭제 버튼이 있다', function missingTargetDeleteCase() {
    renderItem(makeNotification({ type: 'chat', roomId: null }));

    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
