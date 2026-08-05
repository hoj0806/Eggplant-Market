import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { postCommentsQueryKey } from './useCommentQueries';
import { createComment, deleteComment } from '../api/commentApi';
import type { PostComment } from '../types';

/**
 * 댓글 쓰기.
 *
 * 서버가 돌려준 행을 목록 끝에 이어 붙인다. `invalidateQueries`로 다시 부르지 않는 이유는
 * 방금 쓴 댓글이 한 박자 늦게 나타나는 것을 피하려는 것이다 — 쓴 사람은 자기 글이 바로
 * 보이기를 기대한다(chatMessageCache.appendMessage와 같은 판단).
 *
 * 캐시가 아직 없으면 아무것도 하지 않는다. 목록을 한 번도 안 받아 온 상태에서 배열을
 * 새로 만들면 "방금 쓴 댓글 하나만 있는 목록"이 되고, 그것이 전부인 줄 알게 된다.
 */
export function useCreateCommentMutation(
  postId: number,
  authorId: string,
): UseMutationResult<PostComment, Error, string> {
  const queryClient = useQueryClient();

  return useMutation<PostComment, Error, string>({
    mutationFn: function submit(content: string): Promise<PostComment> {
      return createComment({ postId, authorId, content });
    },
    onSuccess: function appendToList(created: PostComment): void {
      queryClient.setQueryData<PostComment[]>(
        postCommentsQueryKey(postId),
        function append(previous: PostComment[] | undefined): PostComment[] | undefined {
          if (previous === undefined) {
            return previous;
          }
          return [...previous, created];
        },
      );
    },
  });
}

/**
 * 댓글 지우기.
 *
 * 지운 것만 빼낸다. 지울 수 있는지는 서버가 판단하므로(0017: 작성자 + 게시물 판매자)
 * 실패하면 목록이 그대로 남고 오류 문구만 뜬다.
 */
export function useDeleteCommentMutation(
  postId: number,
): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: function submit(commentId: number): Promise<void> {
      return deleteComment(commentId);
    },
    onSuccess: function removeFromList(_result: void, commentId: number): void {
      queryClient.setQueryData<PostComment[]>(
        postCommentsQueryKey(postId),
        function remove(previous: PostComment[] | undefined): PostComment[] | undefined {
          if (previous === undefined) {
            return previous;
          }
          return previous.filter(function keepOthers(comment: PostComment): boolean {
            return comment.id !== commentId;
          });
        },
      );
    },
  });
}
