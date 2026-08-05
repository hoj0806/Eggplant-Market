import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { postCommentsQueryKey } from './useCommentQueries';
import { createComment, deleteComment, updateComment } from '../api/commentApi';
import type { PostComment } from '../types';

/**
 * 댓글 쓰기의 입력. 답글이면 `parentId`가 찬다.
 *
 * 문자열 하나가 아니라 객체를 받는 이유는 `variables`로 무엇을 썼는지 되짚기 위해서다 —
 * 화면이 "지금 답글을 보내는 중인 댓글"을 이것으로 가린다.
 */
export type SubmitCommentInput = {
  content: string;
  parentId: number | null;
};

/**
 * 댓글 쓰기.
 *
 * 서버가 돌려준 행을 목록 끝에 이어 붙인다. `invalidateQueries`로 다시 부르지 않는 이유는
 * 방금 쓴 댓글이 한 박자 늦게 나타나는 것을 피하려는 것이다 — 쓴 사람은 자기 글이 바로
 * 보이기를 기대한다(chatMessageCache.appendMessage와 같은 판단).
 *
 * 답글도 배열 끝에 붙는다. 캐시는 평평한 채로 두고 트리는 그릴 때 접으므로
 * (`buildCommentTree`), 끝에 붙은 답글이 자기 부모 밑으로 알아서 들어간다.
 *
 * 캐시가 아직 없으면 아무것도 하지 않는다. 목록을 한 번도 안 받아 온 상태에서 배열을
 * 새로 만들면 "방금 쓴 댓글 하나만 있는 목록"이 되고, 그것이 전부인 줄 알게 된다.
 */
export function useCreateCommentMutation(
  postId: number,
  authorId: string,
): UseMutationResult<PostComment, Error, SubmitCommentInput> {
  const queryClient = useQueryClient();

  return useMutation<PostComment, Error, SubmitCommentInput>({
    mutationFn: function submit(input: SubmitCommentInput): Promise<PostComment> {
      return createComment({ postId, authorId, content: input.content, parentId: input.parentId });
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

export type EditCommentInput = {
  id: number;
  content: string;
};

/**
 * 댓글 고치기.
 *
 * 서버가 돌려준 행으로 그 자리만 갈아 끼운다. 목록의 순서·부모 관계는 그대로다 —
 * 0020의 `guard_comment_update`가 `created_at`·`parent_id`를 잠가 두어서
 * **고친 댓글이 목록에서 움직일 수 없다.** 그래서 트리를 다시 접을 필요도 없다.
 *
 * 응답을 받고 나서 고친다. 쓰기·지우기와 달리 "고치는 중"은 화면에 머무는 상태이고,
 * 실패했을 때 되돌릴 원래 내용이 입력칸에 아직 남아 있어야 한다.
 */
export function useEditCommentMutation(
  postId: number,
): UseMutationResult<PostComment, Error, EditCommentInput> {
  const queryClient = useQueryClient();

  return useMutation<PostComment, Error, EditCommentInput>({
    mutationFn: function submit(input: EditCommentInput): Promise<PostComment> {
      return updateComment({ commentId: input.id, content: input.content });
    },
    onSuccess: function replaceInList(updated: PostComment): void {
      queryClient.setQueryData<PostComment[]>(
        postCommentsQueryKey(postId),
        function replace(previous: PostComment[] | undefined): PostComment[] | undefined {
          if (previous === undefined) {
            return previous;
          }
          return previous.map(function swapOne(comment: PostComment): PostComment {
            return comment.id === updated.id ? updated : comment;
          });
        },
      );
    },
  });
}

/**
 * 댓글 지우기.
 *
 * 지운 것과 **거기 딸린 답글**을 함께 빼낸다. 서버에서는 FK가 cascade라 한 번의 delete로
 * 둘 다 사라지는데(0001), 캐시에서 부모만 걷어내면 남은 답글이 부모를 잃는다 —
 * `buildCommentTree`가 그것을 1단으로 올려 그리므로 지워진 대화가 맥락 없이 떠오르고,
 * 다시 불러오기 전까지 "댓글 n"도 실제보다 많다.
 *
 * 지울 수 있는지는 서버가 판단하므로(0017: 작성자 + 게시물 판매자) 실패하면 목록이
 * 그대로 남고 오류 문구만 뜬다.
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
            return comment.id !== commentId && comment.parentId !== commentId;
          });
        },
      );
    },
  });
}
