import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { createPost, type CreatePostInput } from '../api/postApi';

/**
 * 등록에 성공하면 동네 목록 캐시를 버린다.
 * 버리지 않으면 방금 올린 글이 홈에 보이지 않아 등록이 안 된 것처럼 느껴진다.
 */
export function useCreatePostMutation(): UseMutationResult<number, Error, CreatePostInput> {
  const queryClient = useQueryClient();

  return useMutation<number, Error, CreatePostInput>({
    mutationFn: createPost,
    onSuccess: function invalidateNeighborhoodPosts(): void {
      queryClient.invalidateQueries({ queryKey: ['posts', 'neighborhood'] });
    },
  });
}
