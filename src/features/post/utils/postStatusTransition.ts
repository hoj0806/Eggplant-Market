import type { PostStatus } from '../types';

export const POST_STATUS_LABEL: Record<PostStatus, string> = {
  selling: '판매중',
  reserved: '예약중',
  sold: '거래완료',
};

/** 화면에 버튼을 그리는 순서. 당근과 같다. */
export const POST_STATUS_ORDER: ReadonlyArray<PostStatus> = ['selling', 'reserved', 'sold'];

/**
 * 이 상태에서 저 상태로 갈 수 있는가.
 *
 * 0008의 enforce_post_status_transition 트리거와 **같은 규칙**이다.
 * 한쪽만 고치면 화면에서는 눌리는데 서버가 거부하는 버튼이 생긴다.
 *
 * 판매중 ↔ 예약중은 자유롭다 — 거래가 틀어지는 일은 흔하다.
 * 거래완료는 종착점이다. 후기·매너온도가 여기 매달려서 되돌리면 앞뒤가 맞지 않는다.
 */
export function canChangePostStatus(from: PostStatus, to: PostStatus): boolean {
  if (from === to) {
    return false;
  }

  return from !== 'sold';
}

/** 이 상태로 바꿀 때 거래 상대를 물어봐야 하는가. */
export function needsTradePartner(to: PostStatus): boolean {
  return to !== 'selling';
}

/** 상대를 고르는 화면의 제목. 예약과 거래완료는 묻는 것이 다르다. */
export function toTradePartnerPrompt(to: PostStatus): string {
  return to === 'sold' ? '누구와 거래하셨나요?' : '예약자를 선택해 주세요';
}

/** 상대를 못 고르겠을 때 누르는 버튼의 문구. */
export function toTradePartnerSkipLabel(to: PostStatus): string {
  return to === 'sold' ? '거래한 이웃을 찾을 수 없어요' : '아직 정하지 않았어요';
}
