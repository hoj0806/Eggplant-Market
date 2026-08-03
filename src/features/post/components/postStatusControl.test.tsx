import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PostStatusControl from './postStatusControl';
import type { PostBuyer, PostStatus } from '../types';
import type { PostChatPartner } from '../../chat/types';

// postApi·chatApi 모두 supabaseClient를 거쳐 import.meta.env에 닿는다.
const mockUpdatePostStatus = jest.fn();
const mockFetchPostChatPartners = jest.fn();

jest.mock('../api/postApi', function mockPostApi() {
  return {
    updatePostStatus: function updatePostStatus(input: unknown) {
      return mockUpdatePostStatus(input);
    },
    fetchPostDetail: jest.fn(),
    fetchNeighborhoodPosts: jest.fn(),
    searchPosts: jest.fn(),
    incrementViewCount: jest.fn(),
  };
});

jest.mock('../../chat/api/chatApi', function mockChatApi() {
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

const POST_ID = 42;
const VIEWER_ID = 'seller-1';

const PARTNERS: PostChatPartner[] = [
  { roomId: 7, id: 'buyer-1', nickname: '가지이웃', avatarUrl: null, lastMessageAt: null },
];

function renderControl(status: PostStatus, buyer: PostBuyer | null = null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function tree(nextStatus: PostStatus, nextBuyer: PostBuyer | null) {
    return (
      <QueryClientProvider client={queryClient}>
        <PostStatusControl
          postId={POST_ID}
          status={nextStatus}
          buyer={nextBuyer}
          viewerId={VIEWER_ID}
        />
      </QueryClientProvider>
    );
  }

  const result = render(tree(status, buyer));

  /** 저장이 끝나면 부모가 상세를 다시 받아 새 상태를 내려 준다. 그 순간을 흉내 낸다. */
  return function reload(nextStatus: PostStatus, nextBuyer: PostBuyer | null = null): void {
    result.rerender(tree(nextStatus, nextBuyer));
  };
}

describe('PostStatusControl', function postStatusControlSuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    mockUpdatePostStatus.mockResolvedValue(undefined);
    mockFetchPostChatPartners.mockResolvedValue(PARTNERS);
  });

  it('지금 상태의 버튼은 눌러도 소용없으므로 잠가 둔다', function currentStatusDisabled() {
    renderControl('selling');

    expect(screen.getByRole('button', { name: '판매중' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '예약중' })).toBeEnabled();
  });

  it('거래완료된 상품은 상태를 바꿀 수 없다', function soldIsFinal() {
    renderControl('sold', { id: 'buyer-1', nickname: '가지이웃', avatarUrl: null });

    expect(screen.getByText('거래완료된 상품이에요')).toBeInTheDocument();
    expect(screen.getByText('가지이웃님과 거래했어요')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '판매중' })).not.toBeInTheDocument();
  });

  it('예약중을 고르면 예약자를 물은 뒤 함께 저장한다', async function reservesWithPartner() {
    renderControl('selling');

    await userEvent.click(screen.getByRole('button', { name: '예약중' }));
    await userEvent.click(await screen.findByRole('button', { name: '가지이웃' }));

    await waitFor(function calledWithBuyer() {
      expect(mockUpdatePostStatus).toHaveBeenCalledWith({
        postId: POST_ID,
        status: 'reserved',
        buyerId: 'buyer-1',
      });
    });
  });

  it('예약자를 건너뛰면 상대 없이 저장한다', async function reservesWithoutPartner() {
    renderControl('selling');

    await userEvent.click(screen.getByRole('button', { name: '예약중' }));
    await userEvent.click(await screen.findByRole('button', { name: '아직 정하지 않았어요' }));

    await waitFor(function calledWithoutBuyer() {
      expect(mockUpdatePostStatus).toHaveBeenCalledWith({
        postId: POST_ID,
        status: 'reserved',
        buyerId: null,
      });
    });
  });

  it('거래완료는 되돌릴 수 없어 한 번 더 확인한다', async function confirmsSold() {
    renderControl('reserved');

    await userEvent.click(screen.getByRole('button', { name: '거래완료' }));

    expect(
      screen.getByText('거래완료로 바꾸면 다시 판매중으로 되돌릴 수 없어요.'),
    ).toBeInTheDocument();
    expect(mockUpdatePostStatus).not.toHaveBeenCalled();
  });

  it('확인한 뒤 구매자를 고르면 거래완료로 저장한다', async function completesTrade() {
    renderControl('reserved');

    await userEvent.click(screen.getByRole('button', { name: '거래완료' }));
    await userEvent.click(screen.getByRole('button', { name: '거래완료로 바꾸기' }));
    await userEvent.click(await screen.findByRole('button', { name: '가지이웃' }));

    await waitFor(function calledWithSold() {
      expect(mockUpdatePostStatus).toHaveBeenCalledWith({
        postId: POST_ID,
        status: 'sold',
        buyerId: 'buyer-1',
      });
    });
  });

  it('부모가 상대를 몰라도 방금 고른 사람을 보여준다', async function showsChosenPartner() {
    // 채팅방에서 열면 부모가 예약자를 모른다(buyer=null). 방금 고른 사람이 유일한 근거다.
    const reload = renderControl('reserved');

    await userEvent.click(screen.getByRole('button', { name: '거래완료' }));
    await userEvent.click(screen.getByRole('button', { name: '거래완료로 바꾸기' }));
    await userEvent.click(await screen.findByRole('button', { name: '가지이웃' }));

    await waitFor(function saved() {
      expect(mockUpdatePostStatus).toHaveBeenCalled();
    });
    reload('sold', null);

    expect(screen.getByText('가지이웃님과 거래했어요')).toBeInTheDocument();
  });

  it('판매중으로 되돌릴 때는 상대를 묻지 않는다', async function backToSelling() {
    renderControl('reserved');

    await userEvent.click(screen.getByRole('button', { name: '판매중' }));

    await waitFor(function calledImmediately() {
      expect(mockUpdatePostStatus).toHaveBeenCalledWith({
        postId: POST_ID,
        status: 'selling',
        buyerId: null,
      });
    });
    expect(screen.queryByText('예약자를 선택해 주세요')).not.toBeInTheDocument();
  });

  it('서버가 거절하면 이유를 보여준다', async function showsError() {
    mockUpdatePostStatus.mockRejectedValue({ code: '42501', message: 'permission denied' });
    renderControl('reserved');

    await userEvent.click(screen.getByRole('button', { name: '판매중' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('권한이 없습니다');
  });
});
