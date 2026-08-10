import { supabase } from '../../../shared/lib/supabaseClient';
import { COMMENT_PAGE_SIZE } from '../utils/commentCursor';
import type { CommentAuthor, CommentCursor, PostComment } from '../types';

/**
 * RPC를 만들지 않고 임베드로 읽는다.
 *
 * 0013의 후기 목록은 `fetch_user_reviews` RPC였는데 그쪽은 게시물 제목까지 물어 와야 했고
 * 커서 페이징도 있었다. 댓글은 한 글에 딸린 전부를 시간순으로 읽을 뿐이라 조인이 하나다.
 * 차단 걸러내기도 RPC가 아니라 정책에 있으므로(0017) 여기서 할 일이 남지 않는다.
 *
 * 외래키 이름을 적어 주는 것은 postApi가 seller/buyer를 가를 때와 같은 이유다 —
 * comments에서 profiles로 가는 길이 하나뿐이라 없어도 되지만, 나중에 길이 늘면
 * 조용히 모호해지는 자리라 처음부터 적어 둔다.
 */
const COMMENT_COLUMNS =
  'id, post_id, parent_id, content, created_at, updated_at, is_secret, ' +
  'author:profiles!comments_author_id_fkey (id, nickname, avatar_url)';

type CommentAuthorRow = {
  id: string;
  nickname: string;
  avatar_url: string | null;
};

type CommentRow = {
  id: number;
  post_id: number;
  parent_id: number | null;
  content: string;
  created_at: string;
  updated_at: string;
  is_secret: boolean;
  author: CommentAuthorRow;
};

function toCommentAuthor(row: CommentAuthorRow): CommentAuthor {
  return { id: row.id, nickname: row.nickname, avatarUrl: row.avatar_url };
}

function toPostComment(row: CommentRow): PostComment {
  return {
    id: row.id,
    postId: row.post_id,
    parentId: row.parent_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isSecret: row.is_secret,
    author: toCommentAuthor(row.author),
  };
}

/**
 * 한 게시물의 댓글 **한 페이지**. 오래된 것이 위다 — 물음이 답보다 먼저 보여야 대화로 읽힌다.
 *
 * ── 왜 1단만 세어 끊는가 ──────────────────────────────────────────────
 * **자를 곳은 실타래 사이여야 한다.** 평평하게 열 줄씩 끊으면 답글이 부모와 갈라져 다음
 * 페이지로 넘어가고, 그러면 `buildCommentTree`가 부모 없는 답글을 **1단으로 올려** 그린다
 * (그쪽은 차단으로 부모가 사라진 경우를 위해 그렇게 만들어졌다). 답이 물음처럼 보이게 된다.
 *
 * 그래서 질의를 둘로 나눈다.
 *
 *   ① 1단 댓글 열 개   (post_id + parent_id is null, keyset)
 *   ② 그 열 개의 답글   (parent_id in …)
 *
 * 왕복이 둘이지만 한 페이지에 한 번씩이고, **①의 결과를 알아야 ②를 물을 수 있어** 어차피
 * 순서가 있다. 서버 함수로 합칠 수도 있으나 정책만으로 되는 일에 RPC를 만들지 않는다 —
 * 차단·비밀 댓글을 거르는 일은 양쪽 질의에서 `comments_select`가 그대로 한다(0017 · 0033).
 *
 * **답글은 페이지에 안 세어진다.** 그래서 한 번에 오는 줄 수는 열 개보다 많을 수 있다.
 *
 * ── 개수 표시는 어떻게 되나 ───────────────────────────────────────────
 * 전에는 "나누면 댓글 개수를 따로 세어 와야 한다"가 페이징을 미룬 이유였는데,
 * **0028이 `posts.comment_count`를 만들면서 그 이유가 사라졌다.** 화면은 그 값을 쓴다.
 */
export async function fetchPostCommentPage(
  postId: number,
  cursor: CommentCursor | null,
): Promise<PostComment[]> {
  let rootQuery = supabase
    .from('comments')
    .select(COMMENT_COLUMNS)
    .eq('post_id', postId)
    .is('parent_id', null)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(COMMENT_PAGE_SIZE);

  if (cursor !== null) {
    // (created_at, id) keyset. 같은 시각 댓글이 둘이면 id로 가른다.
    rootQuery = rootQuery.or(
      `created_at.gt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`,
    );
  }

  const { data: rootData, error: rootError } = await rootQuery;

  if (rootError !== null) {
    throw rootError;
  }

  const roots = (rootData as unknown as CommentRow[]).map(toPostComment);

  if (roots.length === 0) {
    return roots;
  }

  const { data: replyData, error: replyError } = await supabase
    .from('comments')
    .select(COMMENT_COLUMNS)
    .in(
      'parent_id',
      roots.map(function toId(comment: PostComment): number {
        return comment.id;
      }),
    )
    .order('created_at', { ascending: true });

  if (replyError !== null) {
    throw replyError;
  }

  return [...roots, ...(replyData as unknown as CommentRow[]).map(toPostComment)];
}

export type CreateCommentInput = {
  postId: number;
  authorId: string;
  content: string;
  /** 답글이면 부모 댓글 id, 1단 댓글이면 null. */
  parentId: number | null;
  /**
   * 비밀 댓글로 남길 것인가. **1단 댓글에서만 뜻이 있다.**
   *
   * 답글에 무엇을 보내든 서버가 부모 값으로 덮는다(0033의 `inherit_comment_secret`).
   * 그래도 화면이 부모 값을 실어 보내는 것은 거짓말을 안 하기 위해서다 —
   * 돌려받는 행에는 어차피 서버가 정한 값이 실려 온다.
   */
  isSecret: boolean;
};

/**
 * 댓글 쓰기.
 *
 * 방금 넣은 행을 작성자까지 붙여 돌려받는다. 목록을 다시 부르지 않고 그것만 캐시에 이어
 * 붙일 수 있어서다(chatApi.sendMessage가 가짜 메시지를 그리지 않는 것과 같은 판단 —
 * 서버가 만든 id·created_at이 그대로 실려 온다).
 *
 * `authorId`를 인자로 받지만 서버가 믿는 것은 이 값이 아니다. comments_insert가
 * `auth.uid() = author_id`를 보므로 남의 id를 적어 보내면 정책이 막는다.
 *
 * `parentId`도 마찬가지로 여기서 검사하지 않는다. 없는 댓글을 가리키면 FK가 막고,
 * 다른 글의 댓글을 가리키는 것은 막히지 않지만 그럴 화면이 없다 — 답글 버튼은 언제나
 * 지금 보고 있는 글의 댓글에서만 눌린다. 정책이 보는 것은 글쓴이와 차단뿐이다(0017).
 *
 * `isSecret`도 서버가 마지막 말을 한다. 답글이면 부모 값으로 덮이므로(0033) 여기서
 * 보낸 값이 그대로 들어간다고 믿지 않고, `.select()`로 되받은 행을 캐시에 넣는다.
 */
export async function createComment(input: CreateCommentInput): Promise<PostComment> {
  const { data, error } = await supabase
    .from('comments')
    .insert({
      post_id: input.postId,
      author_id: input.authorId,
      content: input.content,
      parent_id: input.parentId,
      is_secret: input.isSecret,
    })
    .select(COMMENT_COLUMNS)
    .single();

  if (error !== null) {
    throw error;
  }

  return toPostComment(data as unknown as CommentRow);
}

export type UpdateCommentInput = {
  commentId: number;
  content: string;
};

/**
 * 댓글 고치기.
 *
 * 고칠 수 있는 사람은 **작성자 본인뿐**이다(0001의 `comments_update`). 게시물 판매자에게도
 * 열려 있는 삭제와 다른 점이다 — 남의 말을 치울 수는 있어도 바꿔 쓸 수는 없다.
 *
 * 보내는 것은 content 하나다. 0020의 `guard_comment_update`가 나머지 칸을 잠그므로
 * 다른 것을 끼워 보내도 통째로 거절된다.
 *
 * 돌려받은 행을 그대로 캐시에 넣는다. `updated_at`은 서버가 찍으므로(내용이 실제로 달라질
 * 때만 오른다) 화면이 "수정됨"을 스스로 판단하지 않는다.
 */
export async function updateComment(input: UpdateCommentInput): Promise<PostComment> {
  const { data, error } = await supabase
    .from('comments')
    .update({ content: input.content })
    .eq('id', input.commentId)
    .select(COMMENT_COLUMNS)
    .single();

  if (error !== null) {
    throw error;
  }

  return toPostComment(data as unknown as CommentRow);
}

/**
 * 댓글 지우기.
 *
 * 누가 지울 수 있는지는 서버가 정한다 — 댓글 작성자와 **게시물 판매자** 둘이다(0017).
 * 그래서 여기서 보낼 것은 id 하나뿐이고, 화면은 버튼을 그릴지 말지만 판단한다.
 *
 * 답글이 딸린 댓글을 지우면 답글도 함께 사라진다 — `parent_id`의 FK가 cascade다(0001).
 * 한 번 더 부를 것이 없으므로 여기는 그대로고, 몇 개가 함께 지워지는지 미리 알리는 일과
 * 캐시에서 걷어내는 일만 화면 쪽에 붙는다.
 */
export async function deleteComment(commentId: number): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', commentId);

  if (error !== null) {
    throw error;
  }
}
