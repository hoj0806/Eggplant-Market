import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { addLike, removeLike } from '../api/likeApi';
import { postDetailQueryKey } from '../../post/hooks/usePostQueries';
import type { PostDetail } from '../../post/types';

export type ToggleLikeVariables = {
  /** 누른 시점의 상태. 이 값이 true면 해제, false면 찜한다. */
  isLiked: boolean;
};

type ToggleLikeContext = {
  previous: PostDetail | undefined;
};

/**
 * 찜하기/해제.
 *
 * 하트는 누르는 즉시 바뀌어야 한다. 왕복을 기다리면 눌리지 않은 것처럼 느껴져
 * 사용자가 한 번 더 누르고, 그러면 찜과 해제가 번갈아 나가 상태가 꼬인다.
 * 그래서 캐시를 먼저 뒤집고(onMutate), 실패하면 되돌린다(onError).
 *
 * like_count는 서버에서도 트리거가 관리한다(0005). 여기서 ±1 하는 것은 화면용이며,
 * 다음 조회에서 서버 값으로 덮인다.
 */
export function useToggleLikeMutation(
  postId: number,
  viewerId: string | null,
): UseMutationResult<void, Error, ToggleLikeVariables, ToggleLikeContext> {
  const queryClient = useQueryClient();
  const queryKey = postDetailQueryKey(postId, viewerId);

  return useMutation<void, Error, ToggleLikeVariables, ToggleLikeContext>({
    mutationFn: function toggleLike(variables: ToggleLikeVariables): Promise<void> {
      if (viewerId === null) {
        return Promise.reject(new Error('로그인이 필요합니다.'));
      }

      const input = { postId, userId: viewerId };

      return variables.isLiked ? removeLike(input) : addLike(input);
    },

    onMutate: async function applyOptimisticToggle(
      variables: ToggleLikeVariables,
    ): Promise<ToggleLikeContext> {
      // 진행 중인 조회가 뒤늦게 도착해 낙관적 값을 덮어쓰지 못하게 한다.
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<PostDetail>(queryKey);

      queryClient.setQueryData<PostDetail>(
        queryKey,
        function toggleInCache(current: PostDetail | undefined): PostDetail | undefined {
          if (current === undefined) {
            return current;
          }

          return {
            ...current,
            isLiked: !variables.isLiked,
            likeCount: Math.max(0, current.likeCount + (variables.isLiked ? -1 : 1)),
          };
        },
      );

      return { previous };
    },

    onError: function rollback(
      _error: Error,
      _variables: ToggleLikeVariables,
      context: ToggleLikeContext | undefined,
    ): void {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },

    onSettled: function refreshLists(): void {
      // 목록 카드의 찜 개수도 낡는다. 상세는 낙관적 값이 이미 맞으므로 목록만 다시 받는다.
      queryClient.invalidateQueries({ queryKey: ['posts', 'neighborhood'] });
      // 관심목록은 개수가 아니라 목록 자체가 달라진다 — 방금 푼 글이 남아 있으면 안 된다.
      queryClient.invalidateQueries({ queryKey: ['my', 'likes'] });
    },
  });
}
