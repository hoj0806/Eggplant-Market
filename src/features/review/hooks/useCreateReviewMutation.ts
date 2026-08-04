import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { createReview } from '../api/reviewApi';
import type { ReviewRating } from '../types';

export type CreateReviewVariables = {
  rating: ReviewRating;
  mannerTags: string[];
  comment: string;
};

/**
 * 후기 남기기.
 *
 * 성공하면 세 갈래를 무효화한다.
 *   · 남은 거래 목록  — 방금 쓴 거래가 빠져야 "후기 남기기" 버튼이 사라진다
 *   · 상대 프로필     — 매너온도가 오르내렸다(recalc_manner_temp 트리거)
 *   · 상대 받은 후기  — 방금 쓴 것이 맨 위에 와야 한다
 *
 * 뒤의 둘은 `['user', 상대id]` 앞자락 하나로 함께 걸린다. 게시물 상세는 건드리지 않는다 —
 * 후기는 게시물의 값을 바꾸지 않고, 판매자 매너온도는 다음에 열 때 다시 읽힌다.
 */
export function useCreateReviewMutation(
  postId: number,
  revieweeId: string,
): UseMutationResult<number, Error, CreateReviewVariables> {
  const queryClient = useQueryClient();

  return useMutation<number, Error, CreateReviewVariables>({
    mutationFn: function submit(variables: CreateReviewVariables): Promise<number> {
      return createReview({
        postId,
        rating: variables.rating,
        mannerTags: variables.mannerTags,
        comment: variables.comment,
      });
    },
    onSuccess: function refreshRelated(): void {
      queryClient.invalidateQueries({ queryKey: ['reviews', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['user', revieweeId] });
    },
  });
}
