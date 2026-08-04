import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { postDetailQueryKey } from './usePostQueries';
import { deletePost } from '../api/postApi';

/**
 * 게시물 삭제.
 *
 * 성공하면 상세 캐시를 아예 지운다(무효화가 아니라 removeQueries) — 삭제된 글을 다시 받아 봐야
 * 404뿐이고, 화면은 어차피 목록으로 떠난 뒤다.
 *
 * 이 글에 걸려 있던 채팅방·찜·최근 본 글도 서버에서 함께 사라지므로(FK cascade)
 * 마이페이지 목록과 채팅 목록까지 다시 받는다.
 */
export function useDeletePostMutation(
  postId: number,
  viewerId: string | null,
): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: function removePost(): Promise<void> {
      return deletePost(postId);
    },
    onSuccess: function forgetPost(): void {
      queryClient.removeQueries({ queryKey: postDetailQueryKey(postId, viewerId) });
      queryClient.invalidateQueries({ queryKey: ['posts', 'neighborhood'] });
      queryClient.invalidateQueries({ queryKey: ['posts', 'search'] });
      queryClient.invalidateQueries({ queryKey: ['my'] });
      queryClient.invalidateQueries({ queryKey: ['chatRooms'] });
    },
  });
}
