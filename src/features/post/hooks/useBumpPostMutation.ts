import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { postDetailQueryKey } from './usePostQueries';
import { bumpPost } from '../api/postApi';

/**
 * 끌어올리기.
 *
 * 끌올의 결과는 "이 글이 목록 맨 위로 간다"는 것 하나뿐이라, 상세보다 목록을 다시 받는 쪽이
 * 본론이다. 홈·검색·판매관리 모두 bumped_at으로 정렬한다.
 * 상세도 함께 버린다 — 남은 시간 문구의 기준이 방금 바뀌었다.
 */
export function useBumpPostMutation(
  postId: number,
  viewerId: string | null,
): UseMutationResult<string, Error, void> {
  const queryClient = useQueryClient();

  return useMutation<string, Error, void>({
    mutationFn: function bump(): Promise<string> {
      return bumpPost(postId);
    },
    onSuccess: function refreshLists(): void {
      queryClient.invalidateQueries({ queryKey: postDetailQueryKey(postId, viewerId) });
      queryClient.invalidateQueries({ queryKey: ['posts', 'neighborhood'] });
      queryClient.invalidateQueries({ queryKey: ['posts', 'search'] });
      queryClient.invalidateQueries({ queryKey: ['my'] });
    },
  });
}
