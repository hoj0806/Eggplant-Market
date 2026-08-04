import type { PendingReview } from '../types';

/**
 * 이 게시물이 아직 후기를 기다리는 거래인가.
 *
 * 목록(구매내역·판매관리)은 카드마다 이것을 물어 "후기 남기기" 버튼을 붙일지 정한다.
 * 없으면 이미 남겼거나(unique 제약) 거래 상대가 없는 거래이거나 내 거래가 아니다 —
 * 셋 다 버튼을 그리지 않는다는 답은 같으므로 구분하지 않는다.
 *
 * 목록을 아직 못 받았을 때(undefined)도 "없다"로 본다. 잠깐 안 보이던 버튼이 나중에
 * 나타나는 편이, 눌렀더니 서버가 거절하는 것보다 낫다.
 */
export function findPendingReview(
  pendingReviews: PendingReview[] | undefined,
  postId: number,
): PendingReview | null {
  if (pendingReviews === undefined) {
    return null;
  }

  const found = pendingReviews.find(function byPostId(pending: PendingReview): boolean {
    return pending.postId === postId;
  });

  return found ?? null;
}
