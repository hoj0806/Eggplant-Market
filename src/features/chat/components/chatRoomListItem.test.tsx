import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChatRoomListItem from './chatRoomListItem';
import type { ChatRoomSummary } from '../types';

const NOW = new Date('2026-08-03T02:00:00.000Z');

const ROOM: ChatRoomSummary = {
  id: 7,
  postId: 42,
  postTitle: '맥북 에어 M2',
  postThumbnailUrl: null,
  postStatus: 'selling',
  postPrice: 850000,
  sellerId: 'seller-1',
  partner: { id: 'buyer-1', nickname: '가지이웃', avatarUrl: null },
  lastMessage: '아직 있나요?',
  lastMessageAt: '2026-08-03T01:58:00.000Z',
  unreadCount: 0,
};

function renderItem(room: ChatRoomSummary) {
  render(
    <MemoryRouter>
      <ul>
        <ChatRoomListItem room={room} now={NOW} />
      </ul>
    </MemoryRouter>,
  );
}

describe('ChatRoomListItem', function chatRoomListItemSuite() {
  it('상대 닉네임과 마지막 메시지, 상품 이름을 보여준다', function showsSummary() {
    renderItem(ROOM);

    expect(screen.getByText('가지이웃')).toBeInTheDocument();
    expect(screen.getByText('아직 있나요?')).toBeInTheDocument();
    expect(screen.getByText('맥북 에어 M2')).toBeInTheDocument();
  });

  it('그 방으로 가는 링크를 건다', function linksToRoom() {
    renderItem(ROOM);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/chats/7');
  });

  it('아직 대화가 없으면 그렇게 알려 준다', function noMessagesYet() {
    renderItem({ ...ROOM, lastMessage: null, lastMessageAt: null });

    expect(screen.getByText('아직 대화가 없어요')).toBeInTheDocument();
  });

  it('안 읽은 메시지가 있으면 개수를 보여준다', function showsUnread() {
    renderItem({ ...ROOM, unreadCount: 3 });

    expect(screen.getByLabelText('안 읽은 메시지 3개')).toHaveTextContent('3');
  });

  it('다 읽었으면 뱃지를 그리지 않는다', function hidesUnread() {
    renderItem(ROOM);

    expect(screen.queryByLabelText(/안 읽은 메시지/)).not.toBeInTheDocument();
  });

  it('안 읽은 메시지가 아주 많으면 999+로 줄인다', function clampsUnread() {
    renderItem({ ...ROOM, unreadCount: 1200 });

    expect(screen.getByLabelText('안 읽은 메시지 1200개')).toHaveTextContent('999+');
  });
});
