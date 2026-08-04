import { toReviewEligibility } from './reviewTarget';
import type { PostDetail, PostStatus } from '../../post/types';

const SELLER = { id: 'seller-1', nickname: '판매자', avatarUrl: null, mannerTemp: 36.5 };
const BUYER = { id: 'buyer-1', nickname: '구매자', avatarUrl: null };

function toPost(overrides: Partial<PostDetail> = {}): PostDetail {
  return {
    id: 7,
    title: '자전거',
    description: '잘 굴러갑니다',
    price: 50000,
    status: 'sold' as PostStatus,
    categoryId: null,
    categoryName: null,
    dongName: '서울특별시 강북구 수유동',
    tradePlace: null,
    images: [],
    viewCount: 0,
    likeCount: 0,
    isLiked: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    bumpedAt: '2026-08-01T00:00:00.000Z',
    soldAt: '2026-08-04T00:00:00.000Z',
    seller: SELLER,
    buyer: BUYER,
    ...overrides,
  };
}

describe('toReviewEligibility', function eligibilitySuite() {
  it('판매자에게는 구매자가 후기 대상이다', function sellerReviewsBuyer() {
    const result = toReviewEligibility(toPost(), SELLER.id);

    expect(result).toEqual({
      kind: 'writable',
      target: { id: BUYER.id, nickname: BUYER.nickname, avatarUrl: null },
    });
  });

  it('구매자에게는 판매자가 후기 대상이다', function buyerReviewsSeller() {
    const result = toReviewEligibility(toPost(), BUYER.id);

    expect(result).toEqual({
      kind: 'writable',
      target: { id: SELLER.id, nickname: SELLER.nickname, avatarUrl: null },
    });
  });

  it('거래완료가 아니면 막는다', function blocksUnfinishedTrade() {
    const result = toReviewEligibility(toPost({ status: 'reserved' }), SELLER.id);

    expect(result.kind).toBe('blocked');
  });

  it('거래 상대가 없으면 막는다 — 후기를 받을 사람이 없다', function blocksWithoutPartner() {
    const result = toReviewEligibility(toPost({ buyer: null }), SELLER.id);

    expect(result.kind).toBe('blocked');
  });

  it('당사자가 아니면 막는다', function blocksOutsider() {
    const result = toReviewEligibility(toPost(), 'someone-else');

    expect(result.kind).toBe('blocked');
  });

  it('비로그인은 막는다', function blocksGuest() {
    const result = toReviewEligibility(toPost(), null);

    expect(result.kind).toBe('blocked');
  });
});
