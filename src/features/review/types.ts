/**
 * 매너 평가. 0013의 `create_review`가 이 셋만 받아 매너온도 가감치로 바꾼다.
 * 점수(±0.5·+0.1)는 서버에만 있다 — 화면은 몇 도가 오르는지 알 이유가 없고,
 * 알면 "몇 도 줄까"를 고르는 화면이 되어 버린다.
 */
export type ReviewRating = 'good' | 'normal' | 'bad';

/** 프로필에 걸리는 받은 후기 한 건. */
export type ReceivedReview = {
  id: number;
  postId: number;
  postTitle: string;
  reviewerId: string;
  reviewerNickname: string;
  reviewerAvatarUrl: string | null;
  rating: ReviewRating;
  mannerTags: string[];
  /** 한 줄 후기는 선택이라 안 쓰면 null. */
  comment: string | null;
  createdAt: string;
};

/** 아직 후기를 남기지 않은 내 거래. 구매·판매 어느 쪽인지는 구분하지 않는다. */
export type PendingReview = {
  postId: number;
  postTitle: string;
  postThumbnailUrl: string | null;
  partnerId: string;
  partnerNickname: string;
  soldAt: string;
};

/** 후기 작성 폼이 들고 있는 값. */
export type ReviewFormValues = {
  rating: ReviewRating;
  mannerTags: string[];
  comment: string;
};

export type ReviewFieldName = 'mannerTags' | 'comment';

export type ReviewFieldErrors = Partial<Record<ReviewFieldName, string>>;

/** 받은 후기 목록의 다음 페이지 시작점. 같은 시각 후기를 가르려고 id까지 들고 간다. */
export type ReviewCursor = {
  createdAt: string;
  id: number;
};
