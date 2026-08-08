import { supabase } from '../../../shared/lib/supabaseClient';
import type { BlockedUser } from '../types';

type BlockedUserRow = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  blocked_at: string;
};

export type BlockInput = {
  /** 차단을 거는 사람 = 나. blocks_insert 정책이 auth.uid()와 같은지 본다. */
  blockerId: string;
  blockedId: string;
};

function toBlockedUser(row: BlockedUserRow): BlockedUser {
  return {
    id: row.id,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    blockedAt: row.blocked_at,
  };
}

/**
 * 차단하기.
 *
 * 이미 차단한 사람을 다시 차단하면 기본키(blocker_id, blocked_id)가 충돌한다.
 * 메뉴를 연 채로 다른 탭에서 차단했거나 연타했을 때 실제로 일어나므로 upsert로 받아넘긴다 —
 * 결과는 어느 쪽이든 "차단된 상태"로 같다(likeApi.addLike와 같은 판단).
 *
 * RPC를 두지 않았다. 서버가 대신 정해 줄 것이 없고(대상은 화면이 이미 알고 있다)
 * blocks_insert가 `auth.uid() = blocker_id`를 이미 보기 때문이다.
 */
export async function blockUser(input: BlockInput): Promise<void> {
  const { error } = await supabase
    .from('blocks')
    .upsert(
      { blocker_id: input.blockerId, blocked_id: input.blockedId },
      { onConflict: 'blocker_id,blocked_id' },
    );

  if (error !== null) {
    throw error;
  }
}

/** 차단 해제. 없는 행을 지워도 오류가 아니다. */
export async function unblockUser(input: BlockInput): Promise<void> {
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', input.blockerId)
    .eq('blocked_id', input.blockedId);

  if (error !== null) {
    throw error;
  }
}

/**
 * 이 사람을 내가 차단했나.
 *
 * blocks_select가 내 행만 보여 주므로 조건을 걸어 한 행을 찾으면 그대로 답이 된다.
 * **"이 사람이 나를 차단했나"는 물을 수 없다** — 물을 수 있으면 차단이 상대에게 드러난다.
 * 그래서 차단당한 쪽 화면은 "차단하기"로 남아 있고, 눌러도 문제가 없다(각자 자기 차단을 건다).
 */
export async function fetchIsBlocked(input: BlockInput): Promise<boolean> {
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', input.blockerId)
    .eq('blocked_id', input.blockedId)
    .maybeSingle();

  if (error !== null) {
    throw error;
  }

  return data !== null;
}

/** 내가 차단한 사람 전부. 누구의 것인지 보내지 않는다 — 서버가 auth.uid()로 판단한다. */
export async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  const { data, error } = await supabase.rpc('fetch_blocked_users');

  if (error !== null) {
    throw error;
  }

  return (data as BlockedUserRow[]).map(toBlockedUser);
}
