import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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
    createdAt: '2026-08-03T01:00:00.000Z',
    ...overrides,
  };
}

function renderList(messages: ChatMessage[], isLoading = false, isError = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      <ChatMessageList
        messages={messages}
        viewerId={VIEWER_ID}
        isLoading={isLoading}
        isError={isError}
        hasNextPage={false}
        isFetchingNextPage={false}
        onLoadMore={jest.fn()}
      />
    </QueryClientProvider>,
  );
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
    renderList([], true);

    expect(screen.getByText('대화를 불러오는 중입니다…')).toBeInTheDocument();
  });

  it('실패하면 알림으로 알려 준다', function failed() {
    renderList([], false, true);

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
});
