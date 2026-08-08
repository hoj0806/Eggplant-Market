import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { postDetailQueryKey } from './usePostQueries';
import { updatePost, type UpdatePostInput } from '../api/postApi';

export type UpdatePostVariables = Omit<UpdatePostInput, 'postId'>;

/**
 * 게시물 수정.
 *
 * 제목·가격·썸네일은 상세뿐 아니라 목록 카드에도 그대로 박혀 있어서, 캐시를 그냥 두면
 * 수정하고 뒤로 갔을 때 예전 제목이 남는다. 상세와 목록 넷을 함께 버린다.
 * 채팅방 헤더도 게시물 요약을 들고 있다(0008 fetch_chat_rooms).
 */
export function useUpdatePostMutation(
  postId: number,
  viewerId: string | null,
): UseMutationResult<void, Error, UpdatePostVariables> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, UpdatePostVariables>({
    mutationFn: function savePost(variables: UpdatePostVariables): Promise<void> {
      return updatePost({ ...variables, postId });
    },
    onSuccess: function refreshEverywhere(): void {
      queryClient.invalidateQueries({ queryKey: postDetailQueryKey(postId, viewerId) });
      queryClient.invalidateQueries({ queryKey: ['posts', 'neighborhood'] });
      queryClient.invalidateQueries({ queryKey: ['posts', 'search'] });
      queryClient.invalidateQueries({ queryKey: ['my'] });
      queryClient.invalidateQueries({ queryKey: ['chatRooms'] });
      queryClient.invalidateQueries({ queryKey: ['chatRoom'] });
    },
  });
}
