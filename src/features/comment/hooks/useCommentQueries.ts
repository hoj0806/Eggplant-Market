import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from '@tanstack/react-query';
import { fetchPostCommentPage } from '../api/commentApi';
import { toNextCommentCursor } from '../utils/commentCursor';
import type { CommentCursor, PostComment } from '../types';

/**
 * 댓글 목록 키.
 *
 * 보는 사람을 키에 넣지 않는다. 차단 여부에 따라 내용이 달라지지만(0017), 계정이 바뀌면
 * `useSignOutMutation`이 캐시를 통째로 비운다. 게시물마다 키가 갈리는 편이
 * 상세 화면을 오갈 때 더 유용하다.
 */
export function postCommentsQueryKey(postId: number): ReadonlyArray<string | number> {
  return ['comments', postId];
}

export type PostCommentsQueryResult = UseInfiniteQueryResult<
  InfiniteData<PostComment[]>,
  Error
>;

/**
 * 한 게시물의 댓글. **1단 열 개씩** 끊어 받는다.
 *
 * 비로그인도 부른다 — 댓글은 공개다(0001의 comments_select부터 그랬고 0017도 차단만 걷어낸다).
 * 로그인해야 보이는 것으로 만들면 글만 보러 온 사람에게 빈 자리가 남는다.
 *
 * 무한 스크롤이 아니라 **"더 보기" 버튼**으로 넘긴다. 이 목록은 상세 화면 **안**에 있어서,
 * 스크롤로 이어 붙이면 페이지 끝에 닿을 때마다 댓글이 자라 **아래에 있는 것에 영영 못 닿는다.**
 * 홈·검색처럼 목록이 화면의 전부인 자리와 다르다.
 */
export function usePostCommentsQuery(postId: number | null): PostCommentsQueryResult {
  return useInfiniteQuery<PostComment[], Error, InfiniteData<PostComment[]>>({
    queryKey: postCommentsQueryKey(postId ?? 0),
    queryFn: function loadPage({ pageParam }): Promise<PostComment[]> {
      if (postId === null) {
        return Promise.reject(new Error('게시물을 찾을 수 없습니다.'));
      }
      return fetchPostCommentPage(postId, (pageParam as CommentCursor | null) ?? null);
    },
    initialPageParam: null,
    getNextPageParam: toNextCommentCursor,
    enabled: postId !== null,
  });
}
