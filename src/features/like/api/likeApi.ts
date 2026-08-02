import { supabase } from '../../../shared/lib/supabaseClient';

export type LikeInput = {
  postId: number;
  userId: string;
};

/**
 * 찜 추가.
 *
 * 이미 찜한 글을 다시 찜하면 기본키(user_id, post_id) 충돌이 난다.
 * 화면이 낙관적으로 먼저 바뀌는 구조라 연타·이중 클릭에서 실제로 일어날 수 있어
 * upsert로 받아넘긴다. 결과는 어느 쪽이든 "찜한 상태"로 같다.
 */
export async function addLike(input: LikeInput): Promise<void> {
  const { error } = await supabase
    .from('likes')
    .upsert({ post_id: input.postId, user_id: input.userId }, { onConflict: 'user_id,post_id' });

  if (error !== null) {
    throw error;
  }
}

/** 찜 해제. 없는 행을 지워도 오류가 아니다. */
export async function removeLike(input: LikeInput): Promise<void> {
  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('post_id', input.postId)
    .eq('user_id', input.userId);

  if (error !== null) {
    throw error;
  }
}
