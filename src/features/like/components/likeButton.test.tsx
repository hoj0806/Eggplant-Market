import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LikeButton from './likeButton';
import { postDetailQueryKey } from '../../post/hooks/usePostQueries';
import type { PostDetail } from '../../post/types';

// likeApi는 supabaseClient를, usePostQueries는 postApi를 거쳐 import.meta.env에 닿는다.
const mockAddLike = jest.fn();
const mockRemoveLike = jest.fn();

jest.mock('../api/likeApi', function mockLikeApi() {
  return {
    addLike: function addLike(input: unknown) {
      return mockAddLike(input);
    },
    removeLike: function removeLike(input: unknown) {
      return mockRemoveLike(input);
    },
  };
});

jest.mock('../../post/api/postApi', function mockPostApi() {
  return {
    fetchPostDetail: jest.fn(),
    fetchNeighborhoodPosts: jest.fn(),
    incrementViewCount: jest.fn(),
  };
});

const POST_ID = 42;
const VIEWER_ID = 'viewer-1';

const DETAIL: PostDetail = {
  id: POST_ID,
  title: '맥북 에어 M2',
  description: '2년 사용했습니다.',
  price: 850000,
  status: 'selling',
  categoryId: 14,
  categoryName: '노트북',
  dongName: '서울특별시 강북구 수유동',
  tradePlace: null,
  images: ['https://example.test/1.jpg'],
  viewCount: 3,
  likeCount: 2,
  isLiked: false,
  createdAt: '2026-08-02T00:00:00.000Z',
  seller: { id: 'seller-1', nickname: '가지이웃', avatarUrl: null, mannerTemp: 36.5 },
};

/**
 * 낙관적 갱신은 캐시를 뒤집는 것이므로, 캐시를 읽어 그리는 화면이 있어야 확인할 수 있다.
 * 상세 화면 전체 대신 같은 쿼리 키를 읽는 최소 컴포넌트를 세운다.
 */
function LikeButtonHarness() {
  const query = useQuery<PostDetail>({
    queryKey: postDetailQueryKey(POST_ID, VIEWER_ID),
    queryFn: function neverFetch(): Promise<PostDetail> {
      return Promise.reject(new Error('테스트에서는 조회하지 않는다'));
    },
    enabled: false,
  });

  if (query.data === undefined) {
    return null;
  }

  return (
    <LikeButton
      postId={POST_ID}
      viewerId={VIEWER_ID}
      isLiked={query.data.isLiked}
      likeCount={query.data.likeCount}
    />
  );
}

function renderButton(initial: PostDetail = DETAIL): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(postDetailQueryKey(POST_ID, VIEWER_ID), initial);

  render(
    <QueryClientProvider client={queryClient}>
      <LikeButtonHarness />
    </QueryClientProvider>,
  );

  return queryClient;
}

describe('LikeButton', function likeButtonSuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    mockAddLike.mockResolvedValue(undefined);
    mockRemoveLike.mockResolvedValue(undefined);
  });

  it('찜하면 하트와 개수가 바로 바뀐다', async function optimisticAddCase() {
    renderButton();

    await userEvent.click(screen.getByRole('button', { name: '찜하기' }));

    expect(await screen.findByRole('button', { name: '찜 해제' })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(mockAddLike).toHaveBeenCalledWith({ postId: POST_ID, userId: VIEWER_ID });
  });

  it('찜한 글을 다시 누르면 해제한다', async function optimisticRemoveCase() {
    renderButton({ ...DETAIL, isLiked: true, likeCount: 2 });

    await userEvent.click(screen.getByRole('button', { name: '찜 해제' }));

    expect(await screen.findByRole('button', { name: '찜하기' })).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(mockRemoveLike).toHaveBeenCalledWith({ postId: POST_ID, userId: VIEWER_ID });
  });

  it('저장에 실패하면 원래 상태로 되돌린다', async function rollbackCase() {
    mockAddLike.mockRejectedValue(new Error('network'));
    renderButton();

    await userEvent.click(screen.getByRole('button', { name: '찜하기' }));

    await waitFor(function assertRolledBack() {
      expect(screen.getByRole('button', { name: '찜하기' })).toBeInTheDocument();
    });
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
