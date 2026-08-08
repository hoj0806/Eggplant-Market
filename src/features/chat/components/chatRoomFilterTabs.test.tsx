import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatRoomFilterTabs from './chatRoomFilterTabs';
import type { ChatRoomFilter } from '../utils/chatRoomFilter';

function renderTabs(value: ChatRoomFilter, unreadCount = 0) {
  const handleChange = jest.fn();

  render(<ChatRoomFilterTabs value={value} unreadCount={unreadCount} onChange={handleChange} />);

  return handleChange;
}

describe('ChatRoomFilterTabs', function chatRoomFilterTabsSuite() {
  it('네 갈래를 모두 보여준다', function showsOptions() {
    renderTabs('all');

    expect(screen.getByRole('button', { name: '전체' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '판매' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '구매' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '안읽음' })).toBeInTheDocument();
  });

  it('고른 갈래를 눌린 상태로 알린다', function marksSelected() {
    renderTabs('sales');

    expect(screen.getByRole('button', { name: '판매' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('갈래를 고르면 그 값으로 알려 준다', async function selectsFilter() {
    const handleChange = renderTabs('all');

    await userEvent.click(screen.getByRole('button', { name: '구매' }));

    expect(handleChange).toHaveBeenCalledWith('purchases');
  });

  it('안 읽은 방이 있으면 안읽음 탭에 개수를 붙인다', function showsUnreadBadge() {
    renderTabs('all', 3);

    expect(screen.getByLabelText('안 읽은 채팅방 3개')).toHaveTextContent('3');
  });

  it('다 읽었으면 개수를 그리지 않는다', function hidesUnreadBadge() {
    renderTabs('all', 0);

    expect(screen.queryByLabelText(/안 읽은 채팅방/)).not.toBeInTheDocument();
  });

  it('안 읽은 방이 아주 많으면 999+로 줄인다', function clampsUnreadBadge() {
    renderTabs('all', 1200);

    expect(screen.getByLabelText('안 읽은 채팅방 1200개')).toHaveTextContent('999+');
  });
});
