import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatMessageList from './chatMessageList';
import type { ChatMessage } from '../types';

// chatApi는 supabaseClient를 거쳐 import.meta.env에 닿는다. 실제 모듈은 로드하지 않는다.
const mockCreateChatImageSignedUrl = jest.fn();

jest.mock('../api/chatApi', function mockChatApi() {
  return {
    CHAT_MESSAGE_PAGE_SIZE: 30,
    CHAT_IMAGE_SIGNED_URL_TTL_SECONDS: 3600,
    createChatImageSignedUrl: function createChatImageSignedUrl(path: string) {
      return mockCreateChatImageSignedUrl(path);
    },
    fetchChatRooms: jest.fn(),
    fetchChatRoom: jest.fn(),
    fetchMessages: jest.fn(),
    fetchPostChatPartners: jest.fn(),
  };
});

const VIEWER_ID = 'me';

function toMessage(overrides: Partial<ChatMessage> & { id: number }): ChatMessage {
  return {
    roomId: 1,
    senderId: VIEWER_ID,
    type: 'text',
    content: `메시지 ${overrides.id}`,
    offerAmount: null,
    offerStatus: null,
    readAt: null,
    deletedAt: null,
    createdAt: '2026-08-03T01:00:00.000Z',
    ...overrides,
  };
}

type ListOverrides = {
  isLoading?: boolean;
  isError?: boolean;
  isRespondingToOffer?: boolean;
  isCancellingOffer?: boolean;
  isDeletingMessage?: boolean;
  onRespondToOffer?: jest.Mock;
  onCancelOffer?: jest.Mock;
  onDeleteMessage?: jest.Mock;
};

function renderList(messages: ChatMessage[], overrides: ListOverrides = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      <ChatMessageList
        messages={messages}
        viewerId={VIEWER_ID}
        isLoading={overrides.isLoading ?? false}
        isError={overrides.isError ?? false}
        hasNextPage={false}
        isFetchingNextPage={false}
        isRespondingToOffer={overrides.isRespondingToOffer ?? false}
        isCancellingOffer={overrides.isCancellingOffer ?? false}
        isDeletingMessage={overrides.isDeletingMessage ?? false}
        onLoadMore={jest.fn()}
        onRespondToOffer={overrides.onRespondToOffer ?? jest.fn()}
        onCancelOffer={overrides.onCancelOffer ?? jest.fn()}
        onDeleteMessage={overrides.onDeleteMessage ?? jest.fn()}
      />
    </QueryClientProvider>,
  );
}

function toOffer(overrides: Partial<ChatMessage> & { id: number }): ChatMessage {
  return toMessage({
    type: 'price_offer',
    content: null,
    offerAmount: 40000,
    offerStatus: 'pending',
    ...overrides,
  });
}

describe('ChatMessageList', function chatMessageListSuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    mockCreateChatImageSignedUrl.mockResolvedValue('https://example.test/signed.jpg');
  });

  it('대화가 없으면 먼저 말을 걸도록 안내한다', function emptyRoom() {
    renderList([]);

    expect(screen.getByText('먼저 인사를 건네 보세요.')).toBeInTheDocument();
  });

  it('불러오는 중에는 그 사실만 보여준다', function loading() {
    renderList([], { isLoading: true });

    expect(screen.getByText('대화를 불러오는 중입니다…')).toBeInTheDocument();
  });

  it('실패하면 알림으로 알려 준다', function failed() {
    renderList([], { isError: true });

    expect(screen.getByRole('alert')).toHaveTextContent('대화를 불러오지 못했습니다');
  });

  it('상대가 아직 안 읽은 내 메시지에만 안읽음을 표시한다', function unreadMark() {
    renderList([
      toMessage({ id: 1, readAt: '2026-08-03T01:05:00.000Z' }),
      toMessage({ id: 2, readAt: null }),
      toMessage({ id: 3, senderId: 'partner', readAt: null }),
    ]);

    expect(screen.getAllByText('안읽음')).toHaveLength(1);
  });

  it('사진 메시지는 경로로 서명 URL을 만든다', function imageMessage() {
    renderList([toMessage({ id: 1, type: 'image', content: '7/me/1754-0.jpg' })]);

    expect(mockCreateChatImageSignedUrl).toHaveBeenCalledWith('7/me/1754-0.jpg');
  });

  it('받은 순서대로 그린다', function keepsOrder() {
    renderList([toMessage({ id: 1 }), toMessage({ id: 2 }), toMessage({ id: 3 })]);

    const texts = screen.getAllByText(/^메시지 /).map(function toText(node): string {
      return node.textContent ?? '';
    });

    expect(texts).toEqual(['메시지 1', '메시지 2', '메시지 3']);
  });

  it('받은 제안에는 수락·거절 버튼이 붙는다', function offerButtons() {
    renderList([toOffer({ id: 1, senderId: 'partner' })]);

    expect(screen.getByText('40,000원')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '수락' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '거절' })).toBeInTheDocument();
  });

  it('내가 보낸 제안에는 답변 버튼 대신 기다린다는 표시가 붙는다', function myOffer() {
    renderList([toOffer({ id: 1 })]);

    expect(screen.queryByRole('button', { name: '수락' })).not.toBeInTheDocument();
    expect(screen.getByText('답변 대기 중')).toBeInTheDocument();
  });

  it('답이 끝난 제안은 양쪽 모두 결과만 본다', function answeredOffer() {
    renderList([
      toOffer({ id: 1, senderId: 'partner', offerStatus: 'accepted' }),
      toOffer({ id: 2, offerStatus: 'rejected' }),
    ]);

    expect(screen.queryByRole('button', { name: '수락' })).not.toBeInTheDocument();
    expect(screen.getByText('수락됨')).toBeInTheDocument();
    expect(screen.getByText('거절됨')).toBeInTheDocument();
  });

  it('수락·거절을 누르면 메시지 번호와 함께 알려 준다', async function respondsToOffer() {
    const onRespondToOffer = jest.fn();
    renderList([toOffer({ id: 42, senderId: 'partner' })], { onRespondToOffer });

    await userEvent.click(screen.getByRole('button', { name: '수락' }));
    expect(onRespondToOffer).toHaveBeenCalledWith(42, 'accepted');

    await userEvent.click(screen.getByRole('button', { name: '거절' }));
    expect(onRespondToOffer).toHaveBeenCalledWith(42, 'rejected');
  });

  it('답변이 도는 중에는 두 버튼을 함께 잠근다', function locksWhileResponding() {
    renderList([toOffer({ id: 1, senderId: 'partner' })], { isRespondingToOffer: true });

    expect(screen.getByRole('button', { name: '수락' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '거절' })).toBeDisabled();
  });

  it('내가 보낸 대기 중인 제안에는 취소 버튼이 붙는다', function myPendingOfferHasCancel() {
    renderList([toOffer({ id: 1 })]);

    expect(screen.getByText('답변 대기 중')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '제안 취소' })).toBeInTheDocument();
  });

  it('받은 제안에는 취소 버튼이 없다', function receivedOfferHasNoCancel() {
    renderList([toOffer({ id: 1, senderId: 'partner' })]);

    expect(screen.queryByRole('button', { name: '제안 취소' })).not.toBeInTheDocument();
  });

  it('답이 끝난 내 제안에는 취소 버튼이 없다', function answeredOfferHasNoCancel() {
    renderList([toOffer({ id: 1, offerStatus: 'accepted' })]);

    expect(screen.queryByRole('button', { name: '제안 취소' })).not.toBeInTheDocument();
  });

  it('취소한 제안은 말풍선이 남고 상태만 바뀐다', function cancelledOfferStays() {
    // 지우지 않는다 — 0008이 "대화 기록이 사후에 바뀌면 채팅을 신뢰할 수 없다"고 정한 자리다.
    renderList([toOffer({ id: 1, offerStatus: 'cancelled' })]);

    expect(screen.getByText('40,000원')).toBeInTheDocument();
    expect(screen.getByText('취소됨')).toBeInTheDocument();
  });

  it('취소를 누르면 메시지 번호를 알려 준다', async function cancelsOffer() {
    const onCancelOffer = jest.fn();
    renderList([toOffer({ id: 42 })], { onCancelOffer });

    await userEvent.click(screen.getByRole('button', { name: '제안 취소' }));

    expect(onCancelOffer).toHaveBeenCalledWith(42);
  });

  it('취소가 도는 중에는 취소 버튼만 잠근다', function locksOnlyCancel() {
    // 수락·거절과 누르는 사람이 달라, 한쪽이 도는 동안 다른 쪽까지 잠그면 안 된다.
    renderList([toOffer({ id: 1 }), toOffer({ id: 2, senderId: 'partner' })], {
      isCancellingOffer: true,
    });

    expect(screen.getByRole('button', { name: '제안 취소' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '수락' })).toBeEnabled();
  });

  it('내 말풍선에만 삭제 버튼이 붙는다', function onlyMineHasDelete() {
    renderList([toMessage({ id: 1 }), toMessage({ id: 2, senderId: 'partner' })]);

    expect(screen.getAllByRole('button', { name: '삭제' })).toHaveLength(1);
  });

  it('가격 제안에는 삭제 버튼이 없다', function offerHasNoDelete() {
    // 그 자리는 "제안 취소"가 맡는다. 둘 다 있으면 같은 버튼 두 개가 된다.
    renderList([toOffer({ id: 1 })]);

    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '제안 취소' })).toBeInTheDocument();
  });

  it('삭제는 한 번 더 물은 뒤에 알린다', async function confirmsBeforeDelete() {
    const onDeleteMessage = jest.fn();
    renderList([toMessage({ id: 42 })], { onDeleteMessage });

    await userEvent.click(screen.getByRole('button', { name: '삭제' }));
    expect(onDeleteMessage).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: '지울까요?' }));
    expect(onDeleteMessage).toHaveBeenCalledWith(42, undefined);
  });

  it('사진을 지울 때는 스토리지 경로를 함께 넘긴다', async function passesImagePath() {
    // 서버가 content를 비우고 나면 경로를 알 길이 없어, 지우기 전 값을 화면이 들고 간다.
    const onDeleteMessage = jest.fn();
    renderList([toMessage({ id: 7, type: 'image', content: '9/me/1754-0.jpg' })], {
      onDeleteMessage,
    });

    await userEvent.click(screen.getByRole('button', { name: '삭제' }));
    await userEvent.click(screen.getByRole('button', { name: '지울까요?' }));

    expect(onDeleteMessage).toHaveBeenCalledWith(7, '9/me/1754-0.jpg');
  });

  it('지운 메시지는 양쪽 모두 자리에 남는다', function deletedStaysOnBothSides() {
    renderList([
      toMessage({ id: 1, content: null, deletedAt: '2026-08-06T02:00:00.000Z' }),
      toMessage({ id: 2, senderId: 'partner', content: null, deletedAt: '2026-08-06T02:00:00.000Z' }),
    ]);

    expect(screen.getAllByText('지운 메시지입니다')).toHaveLength(2);
    // 지운 뒤에는 다시 지울 수 없고, 읽을 것도 없다.
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
    expect(screen.queryByText('안읽음')).not.toBeInTheDocument();
  });
});
