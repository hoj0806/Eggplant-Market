import { supabase } from '../../../shared/lib/supabaseClient';
import type { CommentAuthor, PostComment } from '../types';

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
  'id, post_id, parent_id, content, created_at, ' +
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
    author: toCommentAuthor(row.author),
  };
}

/**
 * 한 게시물의 댓글 전부. 오래된 것이 위다 — 물음이 답보다 먼저 보여야 대화로 읽힌다.
 *
 * 페이징하지 않는다. 중고 거래 글의 댓글은 "아직 있나요" 몇 줄이라 나눌 만큼 쌓이지 않고,
 * 나누면 "댓글 3"이라는 개수를 따로 세어 와야 한다. 실제로 길어지는 글이 생기면 그때
 * 커서를 붙인다 — 0017의 인덱스가 (post_id, created_at)이라 그대로 받는다.
 *
 * 차단한 사람의 댓글은 여기 오지 않는다. 거르는 일은 정책이 한다(0017).
 */
export async function fetchPostComments(postId: number): Promise<PostComment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(COMMENT_COLUMNS)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error !== null) {
    throw error;
  }

  return (data as unknown as CommentRow[]).map(toPostComment);
}

export type CreateCommentInput = {
  postId: number;
  authorId: string;
  content: string;
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
 */
export async function createComment(input: CreateCommentInput): Promise<PostComment> {
  const { data, error } = await supabase
    .from('comments')
    .insert({
      post_id: input.postId,
      author_id: input.authorId,
      content: input.content,
    })
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
 */
export async function deleteComment(commentId: number): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', commentId);

  if (error !== null) {
    throw error;
  }
}
