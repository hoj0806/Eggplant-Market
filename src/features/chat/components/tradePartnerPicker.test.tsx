import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TradePartnerPicker from './tradePartnerPicker';
import type { PostStatus } from '../../post/types';
import type { PostChatPartner } from '../types';

// chatApi는 supabaseClient를 거쳐 import.meta.env에 닿는다. 실제 모듈은 로드하지 않는다.
const mockFetchPostChatPartners = jest.fn();

jest.mock('../api/chatApi', function mockChatApi() {
  return {
    CHAT_MESSAGE_PAGE_SIZE: 30,
    CHAT_IMAGE_SIGNED_URL_TTL_SECONDS: 3600,
    fetchPostChatPartners: function fetchPostChatPartners(postId: number) {
      return mockFetchPostChatPartners(postId);
    },
    fetchChatRooms: jest.fn(),
    fetchChatRoom: jest.fn(),
    fetchMessages: jest.fn(),
    createChatImageSignedUrl: jest.fn(),
  };
});

const PARTNERS: PostChatPartner[] = [
  { roomId: 7, id: 'buyer-1', nickname: '가지이웃', avatarUrl: null, lastMessageAt: null },
  { roomId: 8, id: 'buyer-2', nickname: '호박이웃', avatarUrl: null, lastMessageAt: null },
];

function renderPicker(targetStatus: PostStatus, onSelect: jest.Mock, onCancel = jest.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      <TradePartnerPicker
        postId={42}
        targetStatus={targetStatus}
        defaultPartnerId={null}
        isPending={false}
        onSelect={onSelect}
        onCancel={onCancel}
      />
    </QueryClientProvider>,
  );
}

describe('TradePartnerPicker', function tradePartnerPickerSuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    mockFetchPostChatPartners.mockResolvedValue(PARTNERS);
  });

  it('거래완료로 바꿀 때는 누구와 거래했는지 묻는다', async function soldPrompt() {
    renderPicker('sold', jest.fn());

    expect(await screen.findByText('누구와 거래하셨나요?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '거래한 이웃을 찾을 수 없어요' })).toBeInTheDocument();
  });

  it('예약중으로 바꿀 때는 예약자를 묻는다', async function reservedPrompt() {
    renderPicker('reserved', jest.fn());

    expect(await screen.findByText('예약자를 선택해 주세요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '아직 정하지 않았어요' })).toBeInTheDocument();
  });

  it('채팅한 이웃을 고르면 그 사람을 통째로 넘긴다', async function selectsPartner() {
    const onSelect = jest.fn();
    renderPicker('sold', onSelect);

    await userEvent.click(await screen.findByRole('button', { name: '호박이웃' }));

    expect(onSelect).toHaveBeenCalledWith(PARTNERS[1]);
  });

  it('건너뛰면 상대 없이 넘긴다', async function skipsPartner() {
    const onSelect = jest.fn();
    renderPicker('sold', onSelect);

    await userEvent.click(
      await screen.findByRole('button', { name: '거래한 이웃을 찾을 수 없어요' }),
    );

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('채팅한 이웃이 없으면 그 사실을 알려 주고 건너뛰기만 남긴다', async function noPartners() {
    mockFetchPostChatPartners.mockResolvedValue([]);
    renderPicker('sold', jest.fn());

    expect(await screen.findByText('아직 이 상품으로 채팅한 이웃이 없어요.')).toBeInTheDocument();
  });

  it('취소하면 부모에게 알린다', async function cancels() {
    const onCancel = jest.fn();
    renderPicker('reserved', jest.fn(), onCancel);

    await userEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(onCancel).toHaveBeenCalled();
  });
});
