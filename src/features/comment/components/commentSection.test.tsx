import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CommentSection from './commentSection';
import type { PostComment } from '../types';

// commentApi는 supabaseClient(import.meta)에 닿는다. ts-jest가 CommonJS로 옮기면서
// import.meta를 그대로 뱉으므로 실제 모듈을 로드하면 죽는다(troble.md 참고).
const mockFetchPostCommentPage = jest.fn();
const mockCreateComment = jest.fn();
const mockUpdateComment = jest.fn();
const mockDeleteComment = jest.fn();

jest.mock('../api/commentApi', function mockCommentApi() {
  return {
    fetchPostCommentPage: function fetchPostCommentPage(postId: unknown, cursor: unknown) {
      return mockFetchPostCommentPage(postId, cursor);
    },
    createComment: function createComment(input: unknown) {
      return mockCreateComment(input);
    },
    updateComment: function updateComment(input: unknown) {
      return mockUpdateComment(input);
    },
    deleteComment: function deleteComment(commentId: unknown) {
      return mockDeleteComment(commentId);
    },
  };
});

const POST_ID = 7;
// 화면 머리말이 쓰는 값. 받아 온 줄 수가 아니라 posts.comment_count다(0028).
const COMMENT_COUNT = 2;
const SELLER_ID = 'seller-1';
const VIEWER_ID = 'viewer-1';
const FIXED_CREATED_AT = '2026-08-05T00:00:00.000Z';

function buildComment(overrides: Partial<PostComment> = {}): PostComment {
  return {
    id: 1,
    postId: POST_ID,
    parentId: null,
    content: '이거 아직 있나요?',
    createdAt: FIXED_CREATED_AT,
    // 고치지 않은 댓글은 두 값이 같다(0020).
    updatedAt: FIXED_CREATED_AT,
    isSecret: false,
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
        <CommentSection
          postId={POST_ID}
          commentCount={COMMENT_COUNT}
          viewerId={viewerId}
          sellerId={SELLER_ID}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CommentSection', function commentSectionSuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    mockFetchPostCommentPage.mockResolvedValue([]);
    mockDeleteComment.mockResolvedValue(undefined);
    mockUpdateComment.mockResolvedValue(buildComment());
  });

  it('댓글이 없으면 첫 댓글을 권한다', async function emptyCase() {
    renderSection(VIEWER_ID);

    expect(await screen.findByText('아직 댓글이 없어요. 궁금한 점을 물어보세요.')).toBeInTheDocument();
  });

  // 읽기는 누구에게나 열려 있다(0017 comments_select). 로그인은 쓸 때만 필요하다.
  it('비로그인도 댓글을 읽을 수 있고, 쓰려면 로그인 안내가 나온다', async function guestCase() {
    mockFetchPostCommentPage.mockResolvedValue([buildComment()]);
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
    mockFetchPostCommentPage.mockResolvedValue([buildComment()]);
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
        isSecret: false,
      });
    });

    // 다시 부르지 않고 캐시에 이어 붙인다 — 방금 쓴 댓글이 한 박자 늦게 나타나면 안 된다.
    expect(await screen.findByText('네 있습니다')).toBeInTheDocument();
    expect(mockFetchPostCommentPage).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText('댓글')).toHaveValue('');
  });

  it('남의 댓글에는 삭제 버튼이 없다', async function otherCommentCase() {
    mockFetchPostCommentPage.mockResolvedValue([buildComment()]);
    renderSection(VIEWER_ID);

    expect(await screen.findByText('이거 아직 있나요?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
  });

  // 0017이 게시물 판매자에게도 삭제를 열어 준다. 내 글에 달린 광고를 지울 길이 신고뿐이면 곤란하다.
  it('게시물 판매자는 남의 댓글도 지울 수 있다', async function sellerDeleteCase() {
    mockFetchPostCommentPage.mockResolvedValue([buildComment()]);
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
    mockFetchPostCommentPage.mockResolvedValue([buildComment()]);
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
        isSecret: false,
      });
    });

    expect(await screen.findByText('네 있습니다')).toBeInTheDocument();
    // 성공하면 입력칸이 닫힌다 — 열어 둔 채로 두면 방금 쓴 답글 밑에 빈 칸이 남는다.
    await waitFor(function assertClosed() {
      expect(screen.queryByLabelText('가지이웃님에게 답글')).not.toBeInTheDocument();
    });
    expect(mockFetchPostCommentPage).toHaveBeenCalledTimes(1);
  });

  // 2단 고정이다. 답글에 또 답글을 열면 0018의 알림이 가리키는 사람과 화면이 어긋난다.
  it('답글에는 답글 버튼이 없다', async function depthCase() {
    mockFetchPostCommentPage.mockResolvedValue([
      buildComment(),
      buildComment({ id: 2, parentId: 1, content: '네 있습니다' }),
    ]);
    renderSection(VIEWER_ID);

    expect(await screen.findByText('네 있습니다')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '답글' })).toHaveLength(1);
  });

  it('비로그인에게는 답글 버튼이 없다', async function guestReplyCase() {
    mockFetchPostCommentPage.mockResolvedValue([buildComment()]);
    renderSection(null);

    expect(await screen.findByText('이거 아직 있나요?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '답글' })).not.toBeInTheDocument();
  });

  // FK가 cascade라(0001) 되돌릴 수 없다. 부모 줄만 보고 누르면 그 사실을 알 길이 없다.
  it('답글이 딸린 댓글을 지울 때 함께 사라지는 수를 알리고, 답글까지 걷어낸다',
    async function cascadeCase() {
      mockFetchPostCommentPage.mockResolvedValue([
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

  // --- 수정 -------------------------------------------------------------

  it('내 댓글은 원래 내용이 담긴 칸에서 고치고, 고친 결과가 그 자리에 들어간다',
    async function editCase() {
      mockFetchPostCommentPage.mockResolvedValue([
        buildComment({ author: { id: VIEWER_ID, nickname: '나', avatarUrl: null } }),
      ]);
      mockUpdateComment.mockResolvedValue(
        buildComment({
          content: '아직 있나요? (수정)',
          updatedAt: '2026-08-05T00:05:00.000Z',
          author: { id: VIEWER_ID, nickname: '나', avatarUrl: null },
        }),
      );
      renderSection(VIEWER_ID);

      await userEvent.click(await screen.findByRole('button', { name: '수정' }));

      const field = screen.getByLabelText('댓글 수정');
      expect(field).toHaveValue('이거 아직 있나요?');

      await userEvent.clear(field);
      await userEvent.type(field, '아직 있나요? (수정)');
      await userEvent.click(screen.getByRole('button', { name: '수정 완료' }));

      await waitFor(function assertUpdated() {
        expect(mockUpdateComment).toHaveBeenCalledWith({
          commentId: 1,
          content: '아직 있나요? (수정)',
        });
      });

      expect(await screen.findByText('아직 있나요? (수정)')).toBeInTheDocument();
      // 서버가 찍은 updated_at으로 판단한다 — 화면이 스스로 "고쳤다"고 정하지 않는다.
      expect(screen.getByText(/수정됨/)).toBeInTheDocument();
      expect(screen.queryByLabelText('댓글 수정')).not.toBeInTheDocument();
      expect(mockFetchPostCommentPage).toHaveBeenCalledTimes(1);
    });

  // 판매자는 남의 댓글을 치울 수는 있어도 바꿔 쓸 수는 없다(0001의 comments_update).
  it('남의 댓글은 지울 수 있어도 수정할 수 없다', async function sellerCannotEditCase() {
    mockFetchPostCommentPage.mockResolvedValue([buildComment()]);
    renderSection(SELLER_ID);

    expect(await screen.findByRole('button', { name: '삭제' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '수정' })).not.toBeInTheDocument();
  });

  it('고치는 동안에는 답글·삭제 버튼을 감춘다', async function hideActionsWhileEditingCase() {
    mockFetchPostCommentPage.mockResolvedValue([
      buildComment({ author: { id: VIEWER_ID, nickname: '나', avatarUrl: null } }),
    ]);
    renderSection(VIEWER_ID);

    await userEvent.click(await screen.findByRole('button', { name: '수정' }));

    expect(screen.queryByRole('button', { name: '답글' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.getByRole('button', { name: '답글' })).toBeInTheDocument();
  });

  it('고치지 않은 댓글에는 수정됨이 붙지 않는다', async function notEditedCase() {
    mockFetchPostCommentPage.mockResolvedValue([buildComment()]);
    renderSection(VIEWER_ID);

    expect(await screen.findByText('이거 아직 있나요?')).toBeInTheDocument();
    expect(screen.queryByText(/수정됨/)).not.toBeInTheDocument();
  });

  // --- 비밀 댓글 (0033) ---------------------------------------------------

  it('체크하고 쓰면 비밀 댓글로 보낸다', async function secretCreateCase() {
    mockCreateComment.mockResolvedValue(
      buildComment({ id: 2, content: '얼마까지 되나요?', isSecret: true }),
    );
    renderSection(VIEWER_ID);

    await userEvent.type(await screen.findByLabelText('댓글'), '얼마까지 되나요?');
    await userEvent.click(screen.getByRole('checkbox', { name: /비밀 댓글/ }));
    await userEvent.click(screen.getByRole('button', { name: '댓글 등록' }));

    await waitFor(function assertCreated() {
      expect(mockCreateComment).toHaveBeenCalledWith({
        postId: POST_ID,
        authorId: VIEWER_ID,
        content: '얼마까지 되나요?',
        parentId: null,
        isSecret: true,
      });
    });
  });

  // 목록에 온 비밀 댓글은 **볼 자격이 있다는 뜻**이다(0033의 comments_select).
  // 표를 붙이는 이유는 남에게 알리려는 것이 아니라, 답하는 사람이 자기 답도 비밀임을 알게 하려는 것이다.
  it('비밀 댓글에는 표가 붙고 공개 댓글에는 붙지 않는다', async function secretBadgeCase() {
    mockFetchPostCommentPage.mockResolvedValue([
      buildComment(),
      buildComment({ id: 2, content: '얼마까지 되나요?', isSecret: true }),
    ]);
    renderSection(SELLER_ID);

    expect(await screen.findByText('얼마까지 되나요?')).toBeInTheDocument();
    expect(screen.getAllByText('비밀')).toHaveLength(1);
  });

  // 답글의 공개 범위는 부모를 따라간다. 고를 수 있게 하면 비밀 댓글 밑에 공개 답글이 달려
  // 가린 내용이 답글로 새어 나간다.
  it('답글 폼에는 체크칸이 없고, 비밀 댓글의 답글은 부모 값을 실어 보낸다',
    async function secretReplyCase() {
      mockFetchPostCommentPage.mockResolvedValue([
        buildComment({ content: '얼마까지 되나요?', isSecret: true }),
      ]);
      mockCreateComment.mockResolvedValue(
        buildComment({ id: 2, parentId: 1, content: '5만원까지요', isSecret: true }),
      );
      renderSection(SELLER_ID);

      await userEvent.click(await screen.findByRole('button', { name: '답글' }));

      // 1단 폼의 체크칸 하나만 남는다 — 답글 폼은 자기 것을 붙이지 않는다.
      expect(screen.getAllByRole('checkbox', { name: /비밀 댓글/ })).toHaveLength(1);
      expect(
        screen.getByText('비밀 댓글의 답글도 판매자와 작성자만 볼 수 있어요.'),
      ).toBeInTheDocument();

      await userEvent.type(screen.getByLabelText('가지이웃님에게 답글'), '5만원까지요');
      await userEvent.click(screen.getByRole('button', { name: '답글 등록' }));

      await waitFor(function assertCreated() {
        expect(mockCreateComment).toHaveBeenCalledWith({
          postId: POST_ID,
          authorId: SELLER_ID,
          content: '5만원까지요',
          parentId: 1,
          isSecret: true,
        });
      });
    });

  // 체크칸을 켠 채로 등록하면 폼이 새로 서면서 함께 꺼진다. 안 그러면 다음 댓글이
  // 의도치 않게 비밀로 나간다 — 켠 사실이 화면에서 사라진 뒤에도 남아 있게 된다.
  it('비밀로 한 번 보낸 뒤 체크칸은 꺼진 채로 돌아온다', async function secretResetCase() {
    mockCreateComment.mockResolvedValue(buildComment({ id: 2, isSecret: true }));
    renderSection(VIEWER_ID);

    await userEvent.type(await screen.findByLabelText('댓글'), '얼마까지 되나요?');
    await userEvent.click(screen.getByRole('checkbox', { name: /비밀 댓글/ }));
    await userEvent.click(screen.getByRole('button', { name: '댓글 등록' }));

    await waitFor(function assertReset() {
      expect(screen.getByRole('checkbox', { name: /비밀 댓글/ })).not.toBeChecked();
    });
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
