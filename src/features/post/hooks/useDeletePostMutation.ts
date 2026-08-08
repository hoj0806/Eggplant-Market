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
 * 마이페이지 목록과 채팅 목록까지 다시 받는다. **알림도 함께 다시 받는다** — 0032가
 * 이 글을 가리키던 알림을 서버에서 걷어내므로, 안 받으면 배지 숫자가 지운 글을 계속 센다.
 *
 * `viewerId`는 캐시 키만이 아니라 **삭제 자체에도 쓰인다.** 채팅 사진 폴더가
 * `{room_id}/{user_id}/…`라(0008) 판매자 자신의 폴더를 짚으려면 그 id가 있어야 한다.
 * 지울 수 있는 사람은 판매자뿐이므로(0001의 posts_delete) 여기서는 둘이 같은 값이다.
 * 없으면 서버가 어차피 거절하지만, 그 전에 여기서 뜻을 붙여 준다.
 */
export function useDeletePostMutation(
  postId: number,
  viewerId: string | null,
): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: function removePost(): Promise<void> {
      if (viewerId === null) {
        return Promise.reject(new Error('로그인이 필요합니다.'));
      }
      return deletePost(postId, viewerId);
    },
    onSuccess: function forgetPost(): void {
      queryClient.removeQueries({ queryKey: postDetailQueryKey(postId, viewerId) });
      queryClient.invalidateQueries({ queryKey: ['posts', 'neighborhood'] });
      queryClient.invalidateQueries({ queryKey: ['posts', 'search'] });
      queryClient.invalidateQueries({ queryKey: ['my'] });
      queryClient.invalidateQueries({ queryKey: ['chatRooms'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
