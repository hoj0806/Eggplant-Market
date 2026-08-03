import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PostOwnerMenu from './postOwnerMenu';
import type { PostDetail, PostStatus } from '../types';

// postApi는 supabaseClient(import.meta)에 닿는다. ts-jest가 CommonJS로 옮기면서
// import.meta를 그대로 뱉으므로 실제 모듈을 로드하면 죽는다(troble.md 참고).
const mockBumpPost = jest.fn();
const mockDeletePost = jest.fn();

jest.mock('../api/postApi', function mockPostApi() {
  return {
    bumpPost: function bumpPost(postId: number) {
      return mockBumpPost(postId);
    },
    deletePost: function deletePost(postId: number) {
      return mockDeletePost(postId);
    },
  };
});

const mockNavigate = jest.fn();

jest.mock('react-router-dom', function mockRouter() {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: function useNavigate() {
      return mockNavigate;
    },
  };
});

const VIEWER_ID = 'seller-1';
const NOW = Date.now();
const HOUR_MS = 60 * 60 * 1000;

function makePost(overrides: { status?: PostStatus; bumpedAt?: string } = {}): PostDetail {
  return {
    id: 42,
    title: '맥북 에어 M2',
    description: '2년 사용했습니다.',
    price: 850000,
    status: overrides.status ?? 'selling',
    categoryId: 14,
    categoryName: '노트북',
    dongName: '서울특별시 강북구 수유동',
    tradePlace: null,
    images: ['https://example.test/1.jpg'],
    viewCount: 3,
    likeCount: 2,
    isLiked: false,
    createdAt: new Date(NOW - 72 * HOUR_MS).toISOString(),
    bumpedAt: overrides.bumpedAt ?? new Date(NOW - 30 * HOUR_MS).toISOString(),
    soldAt: null,
    seller: {
      id: VIEWER_ID,
      nickname: '가지팔이',
      avatarUrl: null,
      mannerTemp: 36.5,
    },
    buyer: null,
  };
}

function renderMenu(post: PostDetail) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PostOwnerMenu post={post} viewerId={VIEWER_ID} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openMenu(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: '게시물 관리' }));
}

describe('PostOwnerMenu', function ownerMenuSuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    mockBumpPost.mockResolvedValue(new Date().toISOString());
    mockDeletePost.mockResolvedValue(undefined);
  });

  it('열기 전에는 메뉴가 보이지 않는다', function closedCase() {
    renderMenu(makePost());

    expect(screen.queryByRole('link', { name: '게시물 수정' })).not.toBeInTheDocument();
  });

  it('수정 링크는 수정 화면을 가리킨다', async function editLinkCase() {
    renderMenu(makePost());
    await openMenu();

    expect(screen.getByRole('link', { name: '게시물 수정' })).toHaveAttribute(
      'href',
      '/posts/42/edit',
    );
  });

  it('24시간이 지난 판매중 글은 끌어올릴 수 있다', async function bumpCase() {
    renderMenu(makePost());
    await openMenu();

    await userEvent.click(screen.getByRole('button', { name: '끌어올리기' }));

    await waitFor(function assertBumped() {
      expect(mockBumpPost).toHaveBeenCalledWith(42);
    });
  });

  it('쿨다운 중에는 버튼을 잠그고 남은 시간을 적는다', async function cooldownCase() {
    // 반 시간을 걸쳐 둔다. 컴포넌트는 렌더 시각을 기준으로 재므로 딱 떨어지는 값을 쓰면
    // 테스트가 도는 몇 ms 사이에 시간 단위가 하나 내려간다.
    renderMenu(makePost({ bumpedAt: new Date(NOW - 3.5 * HOUR_MS).toISOString() }));
    await openMenu();

    expect(screen.getByRole('button', { name: '끌어올리기' })).toBeDisabled();
    expect(screen.getByText('20시간 뒤에 다시 끌어올릴 수 있어요')).toBeInTheDocument();
  });

  it('판매중이 아니면 왜 못 하는지 적는다', function notSellingCase() {
    renderMenu(makePost({ status: 'sold' }));

    return openMenu().then(function assertReason() {
      expect(screen.getByRole('button', { name: '끌어올리기' })).toBeDisabled();
      expect(screen.getByText('판매중인 글만 끌어올릴 수 있어요')).toBeInTheDocument();
    });
  });

  // 삭제는 되돌릴 수 없다. 한 번의 오조작으로 글이 사라지면 안 된다.
  it('삭제는 한 번 더 확인해야 실행된다', async function deleteConfirmCase() {
    renderMenu(makePost());
    await openMenu();

    await userEvent.click(screen.getByRole('button', { name: '게시물 삭제' }));
    expect(mockDeletePost).not.toHaveBeenCalled();
    expect(
      screen.getByText('삭제하면 되돌릴 수 없어요. 이 글의 채팅과 찜도 함께 사라집니다.'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '삭제하기' }));

    await waitFor(function assertDeleted() {
      expect(mockDeletePost).toHaveBeenCalledWith(42);
    });
    // 지워진 글의 주소에 남아 있으면 곧바로 "게시물을 찾을 수 없습니다"를 보게 된다.
    expect(mockNavigate).toHaveBeenCalledWith('/my/sales', { replace: true });
  });

  it('서버가 거절한 이유를 그대로 보여준다', async function bumpErrorCase() {
    mockBumpPost.mockRejectedValue({
      code: 'P0001',
      message: '끌어올리기는 24시간에 한 번만 할 수 있습니다.',
    });

    renderMenu(makePost());
    await openMenu();
    await userEvent.click(screen.getByRole('button', { name: '끌어올리기' }));

    expect(
      await screen.findByText('끌어올리기는 24시간에 한 번만 할 수 있습니다.'),
    ).toBeInTheDocument();
  });
});
