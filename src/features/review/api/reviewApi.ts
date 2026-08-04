import { supabase } from '../../../shared/lib/supabaseClient';
import type { PendingReview, ReceivedReview, ReviewCursor, ReviewRating } from '../types';

/** 받은 후기 한 페이지 크기. 서버(0013)가 50으로 한 번 더 막는다. */
export const REVIEWS_PAGE_SIZE = 20;

type ReceivedReviewRow = {
  id: number;
  post_id: number;
  post_title: string;
  reviewer_id: string;
  reviewer_nickname: string;
  reviewer_avatar_url: string | null;
  rating: ReviewRating;
  manner_tags: string[];
  comment: string | null;
  created_at: string;
};

type PendingReviewRow = {
  post_id: number;
  post_title: string;
  post_thumbnail_url: string | null;
  partner_id: string;
  partner_nickname: string;
  sold_at: string;
};

export type CreateReviewInput = {
  postId: number;
  rating: ReviewRating;
  mannerTags: string[];
  /** 안 썼으면 빈 문자열. 서버가 눕혀서 null로 저장한다. */
  comment: string;
};

function toReceivedReview(row: ReceivedReviewRow): ReceivedReview {
  return {
    id: row.id,
    postId: row.post_id,
    postTitle: row.post_title,
    reviewerId: row.reviewer_id,
    reviewerNickname: row.reviewer_nickname,
    reviewerAvatarUrl: row.reviewer_avatar_url,
    rating: row.rating,
    mannerTags: row.manner_tags,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

function toPendingReview(row: PendingReviewRow): PendingReview {
  return {
    postId: row.post_id,
    postTitle: row.post_title,
    postThumbnailUrl: row.post_thumbnail_url,
    partnerId: row.partner_id,
    partnerNickname: row.partner_nickname,
    soldAt: row.sold_at,
  };
}

/**
 * 후기 작성.
 *
 * **누구에게 주는 후기인지는 보내지 않는다** — 서버가 게시물을 보고 반대편 당사자로 정한다
 * (0013). 마이페이지 목록 RPC가 user_id를 받지 않는 것과 같은 이유로, 클라이언트가 남의 id를
 * 실어 보낼 여지를 아예 두지 않는다.
 */
export async function createReview(input: CreateReviewInput): Promise<number> {
  const { data, error } = await supabase.rpc('create_review', {
    p_post_id: input.postId,
    p_rating: input.rating,
    p_manner_tags: input.mannerTags,
    p_comment: input.comment,
  });

  if (error !== null) {
    throw error;
  }

  return data as number;
}

/** 어떤 사용자가 받은 후기 한 페이지. 누가 보든 같은 것이 돌아온다(공개 조회). */
export async function fetchUserReviews(
  userId: string,
  cursor: ReviewCursor | null,
): Promise<ReceivedReview[]> {
  const { data, error } = await supabase.rpc('fetch_user_reviews', {
    p_user_id: userId,
    p_cursor_at: cursor?.createdAt ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: REVIEWS_PAGE_SIZE,
  });

  if (error !== null) {
    throw error;
  }

  return (data as ReceivedReviewRow[]).map(toReceivedReview);
}

/**
 * 내가 아직 후기를 남기지 않은 거래.
 *
 * 누구의 것인지 보내지 않는다 — 서버가 auth.uid()로 판단한다.
 * 구매·판매 양쪽이 한 목록에 섞여 오고, 어느 쪽인지는 화면이 구분할 필요가 없다
 * (양쪽 다 "이 거래 어땠나요?"를 묻는 자리다).
 */
export async function fetchPendingReviews(): Promise<PendingReview[]> {
  const { data, error } = await supabase.rpc('fetch_pending_reviews');

  if (error !== null) {
    throw error;
  }

  return (data as PendingReviewRow[]).map(toPendingReview);
}
