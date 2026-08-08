import type { PostDetail } from '../../post/types';

/** 후기를 받을 사람. 화면에 "누구에게 남기는 후기인지"를 적으려면 이름까지 필요하다. */
export type ReviewTarget = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
};

/**
 * 지금 이 거래에 후기를 남길 수 있는가.
 *
 * `blocked`의 `reason`은 그대로 화면에 적힌다. "안 된다"만 말하고 왜인지 말하지 않으면
 * 사용자는 자기가 뭘 잘못했는지 알 수 없다(가격 제안에서 배운 것과 같다).
 */
export type ReviewEligibility =
  | { kind: 'writable'; target: ReviewTarget }
  | { kind: 'blocked'; reason: string };

/**
 * 규칙은 0013의 `create_review`와 한 글자도 다르지 않다.
 *
 * 서버가 이미 같은 순서로 막고 있는데 여기서 한 번 더 따지는 이유는 **버튼을 누르기 전에**
 * 말해 주기 위해서다. 규칙의 주인은 서버다 — 이 함수를 고치면 0013도 같이 고쳐야 한다.
 *
 * 상대를 고르지 않고 거래완료한 글이 실제로 있다(거래 상대 고르기는 건너뛸 수 있다).
 * 그런 거래는 후기를 받을 사람 자체가 없다.
 */
export function toReviewEligibility(post: PostDetail, viewerId: string | null): ReviewEligibility {
  if (viewerId === null) {
    return { kind: 'blocked', reason: '로그인이 필요해요.' };
  }

  if (post.status !== 'sold') {
    return { kind: 'blocked', reason: '거래완료된 거래에만 후기를 남길 수 있어요.' };
  }

  if (post.buyer === null) {
    return { kind: 'blocked', reason: '거래 상대가 지정되지 않은 거래예요.' };
  }

  if (viewerId === post.seller.id) {
    return {
      kind: 'writable',
      target: {
        id: post.buyer.id,
        nickname: post.buyer.nickname,
        avatarUrl: post.buyer.avatarUrl,
      },
    };
  }

  if (viewerId === post.buyer.id) {
    return {
      kind: 'writable',
      target: {
        id: post.seller.id,
        nickname: post.seller.nickname,
        avatarUrl: post.seller.avatarUrl,
      },
    };
  }

  return { kind: 'blocked', reason: '이 거래의 당사자만 후기를 남길 수 있어요.' };
}
