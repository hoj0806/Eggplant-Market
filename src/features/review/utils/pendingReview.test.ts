import { findPendingReview } from './pendingReview';
import type { PendingReview } from '../types';

const PENDING: PendingReview[] = [
  {
    postId: 7,
    postTitle: '자전거',
    postThumbnailUrl: null,
    partnerId: 'buyer-1',
    partnerNickname: '구매자',
    soldAt: '2026-08-04T00:00:00.000Z',
  },
];

describe('findPendingReview', function findSuite() {
  it('후기를 기다리는 거래면 그 거래를 돌려준다', function findsPending() {
    expect(findPendingReview(PENDING, 7)?.partnerNickname).toBe('구매자');
  });

  it('목록에 없으면 null이다 — 이미 남겼거나 남길 수 없는 거래다', function missing() {
    expect(findPendingReview(PENDING, 99)).toBeNull();
  });

  it('아직 목록을 못 받았으면 null이다', function notLoadedYet() {
    expect(findPendingReview(undefined, 7)).toBeNull();
  });
});
