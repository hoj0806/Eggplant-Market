import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CommentSection from './commentSection';
import type { PostComment } from '../types';

// commentApi는 supabaseClient(import.meta)에 닿는다. ts-jest가 CommonJS로 옮기면서
// import.meta를 그대로 뱉으므로 실제 모듈을 로드하면 죽는다(troble.md 참고).
const mockFetchPostComments = jest.fn();
const mockCreateComment = jest.fn();
const mockDeleteComment = jest.fn();

jest.mock('../api/commentApi', function mockCommentApi() {
  return {
    fetchPostComments: function fetchPostComments(postId: unknown) {
      return mockFetchPostComments(postId);
    },
    createComment: function createComment(input: unknown) {
      return mockCreateComment(input);
    },
    deleteComment: function deleteComment(commentId: unknown) {
      return mockDeleteComment(commentId);
    },
  };
});

const POST_ID = 7;
const SELLER_ID = 'seller-1';
const VIEWER_ID = 'viewer-1';

function buildComment(overrides: Partial<PostComment> = {}): PostComment {
  return {
    id: 1,
    postId: POST_ID,
    parentId: null,
    content: '이거 아직 있나요?',
    createdAt: new Date().toISOString(),
    author: { id: 'other-1', nickname: '가지이웃', avatarUrl: null },
    ...overrides,
  };
}

function renderSection(viewerId: string | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CommentSection postId={POST_ID} viewerId={viewerId} sellerId={SELLER_ID} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CommentSection', function commentSectionSuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    mockFetchPostComments.mockResolvedValue([]);
    mockDeleteComment.mockResolvedValue(undefined);
  });

  it('댓글이 없으면 첫 댓글을 권한다', async function emptyCase() {
    renderSection(VIEWER_ID);

    expect(await screen.findByText('아직 댓글이 없어요. 궁금한 점을 물어보세요.')).toBeInTheDocument();
  });

  // 읽기는 누구에게나 열려 있다(0017 comments_select). 로그인은 쓸 때만 필요하다.
  it('비로그인도 댓글을 읽을 수 있고, 쓰려면 로그인 안내가 나온다', async function guestCase() {
    mockFetchPostComments.mockResolvedValue([buildComment()]);
    renderSection(null);

    expect(await screen.findByText('이거 아직 있나요?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '로그인' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '댓글 등록' })).not.toBeInTheDocument();
  });

  it('빈 댓글은 보내지 않는다', async function emptySubmitCase() {
    renderSection(VIEWER_ID);

    await userEvent.click(await screen.findByRole('button', { name: '댓글 등록' }));

    expect(mockCreateComment).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('댓글을 입력해 주세요.');
  });

  it('댓글을 쓰면 목록 끝에 붙고 입력칸이 비워진다', async function createCase() {
    mockFetchPostComments.mockResolvedValue([buildComment()]);
    mockCreateComment.mockResolvedValue(
      buildComment({ id: 2, content: '네 있습니다', author: { id: SELLER_ID, nickname: '판매자', avatarUrl: null } }),
    );
    renderSection(VIEWER_ID);

    await userEvent.type(await screen.findByLabelText('댓글'), '네 있습니다');
    await userEvent.click(screen.getByRole('button', { name: '댓글 등록' }));

    await waitFor(function assertCreated() {
      expect(mockCreateComment).toHaveBeenCalledWith({
        postId: POST_ID,
        authorId: VIEWER_ID,
        content: '네 있습니다',
        parentId: null,
      });
    });

    // 다시 부르지 않고 캐시에 이어 붙인다 — 방금 쓴 댓글이 한 박자 늦게 나타나면 안 된다.
    expect(await screen.findByText('네 있습니다')).toBeInTheDocument();
    expect(mockFetchPostComments).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText('댓글')).toHaveValue('');
  });

  it('남의 댓글에는 삭제 버튼이 없다', async function otherCommentCase() {
    mockFetchPostComments.mockResolvedValue([buildComment()]);
    renderSection(VIEWER_ID);

    expect(await screen.findByText('이거 아직 있나요?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
  });

  // 0017이 게시물 판매자에게도 삭제를 열어 준다. 내 글에 달린 광고를 지울 길이 신고뿐이면 곤란하다.
  it('게시물 판매자는 남의 댓글도 지울 수 있다', async function sellerDeleteCase() {
    mockFetchPostComments.mockResolvedValue([buildComment()]);
    renderSection(SELLER_ID);

    await userEvent.click(await screen.findByRole('button', { name: '삭제' }));
    expect(mockDeleteComment).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: '삭제' }));

    await waitFor(function assertDeleted() {
      expect(mockDeleteComment).toHaveBeenCalledWith(1);
    });
    await waitFor(function assertRemoved() {
      expect(screen.queryByText('이거 아직 있나요?')).not.toBeInTheDocument();
    });
  });

  // --- 대댓글 -------------------------------------------------------------

  it('답글을 쓰면 부모 id와 함께 보내고 부모 밑에 붙는다', async function replyCase() {
    mockFetchPostComments.mockResolvedValue([buildComment()]);
    mockCreateComment.mockResolvedValue(
      buildComment({ id: 2, parentId: 1, content: '네 있습니다' }),
    );
    renderSection(VIEWER_ID);

    await userEvent.click(await screen.findByRole('button', { name: '답글' }));
    await userEvent.type(screen.getByLabelText('가지이웃님에게 답글'), '네 있습니다');
    await userEvent.click(screen.getByRole('button', { name: '답글 등록' }));

    await waitFor(function assertCreated() {
      expect(mockCreateComment).toHaveBeenCalledWith({
        postId: POST_ID,
        authorId: VIEWER_ID,
        content: '네 있습니다',
        parentId: 1,
      });
    });

    expect(await screen.findByText('네 있습니다')).toBeInTheDocument();
    // 성공하면 입력칸이 닫힌다 — 열어 둔 채로 두면 방금 쓴 답글 밑에 빈 칸이 남는다.
    await waitFor(function assertClosed() {
      expect(screen.queryByLabelText('가지이웃님에게 답글')).not.toBeInTheDocument();
    });
    expect(mockFetchPostComments).toHaveBeenCalledTimes(1);
  });

  // 2단 고정이다. 답글에 또 답글을 열면 0018의 알림이 가리키는 사람과 화면이 어긋난다.
  it('답글에는 답글 버튼이 없다', async function depthCase() {
    mockFetchPostComments.mockResolvedValue([
      buildComment(),
      buildComment({ id: 2, parentId: 1, content: '네 있습니다' }),
    ]);
    renderSection(VIEWER_ID);

    expect(await screen.findByText('네 있습니다')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '답글' })).toHaveLength(1);
  });

  it('비로그인에게는 답글 버튼이 없다', async function guestReplyCase() {
    mockFetchPostComments.mockResolvedValue([buildComment()]);
    renderSection(null);

    expect(await screen.findByText('이거 아직 있나요?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '답글' })).not.toBeInTheDocument();
  });

  // FK가 cascade라(0001) 되돌릴 수 없다. 부모 줄만 보고 누르면 그 사실을 알 길이 없다.
  it('답글이 딸린 댓글을 지울 때 함께 사라지는 수를 알리고, 답글까지 걷어낸다',
    async function cascadeCase() {
      mockFetchPostComments.mockResolvedValue([
        buildComment(),
        buildComment({ id: 2, parentId: 1, content: '네 있습니다' }),
        buildComment({ id: 3, parentId: 1, content: '얼마에 파세요?' }),
      ]);
      renderSection(SELLER_ID);

      await userEvent.click((await screen.findAllByRole('button', { name: '삭제' }))[0]);
      expect(screen.getByText('답글 2개도 함께 지워집니다. 지울까요?')).toBeInTheDocument();

      await userEvent.click(screen.getAllByRole('button', { name: '삭제' })[0]);

      await waitFor(function assertDeleted() {
        expect(mockDeleteComment).toHaveBeenCalledWith(1);
      });
      await waitFor(function assertRepliesGone() {
        expect(screen.queryByText('이거 아직 있나요?')).not.toBeInTheDocument();
      });
      expect(screen.queryByText('네 있습니다')).not.toBeInTheDocument();
      expect(screen.queryByText('얼마에 파세요?')).not.toBeInTheDocument();
    });

  it('실패하면 이유를 보여준다', async function errorCase() {
    mockCreateComment.mockRejectedValue({ code: '42501', message: 'violates row-level security' });
    renderSection(VIEWER_ID);

    await userEvent.type(await screen.findByLabelText('댓글'), '차단당한 뒤에 쓰면');
    await userEvent.click(screen.getByRole('button', { name: '댓글 등록' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '지금은 댓글을 남길 수 없어요. 새로고침 후 다시 시도해 주세요.',
    );
  });
});
