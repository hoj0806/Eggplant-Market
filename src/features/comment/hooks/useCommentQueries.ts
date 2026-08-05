import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchPostComments } from '../api/commentApi';
import type { PostComment } from '../types';

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

/**
 * 한 게시물의 댓글.
 *
 * 비로그인도 부른다 — 댓글은 공개다(0001의 comments_select부터 그랬고 0017도 차단만 걷어낸다).
 * 로그인해야 보이는 것으로 만들면 글만 보러 온 사람에게 빈 자리가 남는다.
 */
export function usePostCommentsQuery(postId: number | null): UseQueryResult<PostComment[], Error> {
  return useQuery<PostComment[], Error>({
    queryKey: postCommentsQueryKey(postId ?? 0),
    queryFn: function loadComments(): Promise<PostComment[]> {
      if (postId === null) {
        return Promise.reject(new Error('게시물을 찾을 수 없습니다.'));
      }
      return fetchPostComments(postId);
    },
    enabled: postId !== null,
  });
}
