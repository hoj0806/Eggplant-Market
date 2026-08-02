import { readViewedPostIds, rememberViewedPost, shouldCountView } from './viewedPosts';

const SELLER_ID = 'seller-1';
const VIEWER_ID = 'viewer-2';

describe('shouldCountView', function shouldCountViewSuite() {
  it('처음 보는 글은 센다', function firstVisitCase() {
    expect(
      shouldCountView({ postId: 1, sellerId: SELLER_ID, viewerId: VIEWER_ID, viewedIds: [] }),
    ).toBe(true);
  });

  it('이미 본 글은 다시 세지 않는다', function repeatVisitCase() {
    expect(
      shouldCountView({ postId: 1, sellerId: SELLER_ID, viewerId: VIEWER_ID, viewedIds: [1] }),
    ).toBe(false);
  });

  it('판매자 본인이 보면 세지 않는다', function ownPostCase() {
    expect(
      shouldCountView({ postId: 1, sellerId: SELLER_ID, viewerId: SELLER_ID, viewedIds: [] }),
    ).toBe(false);
  });

  it('비로그인 사용자도 센다', function anonymousCase() {
    expect(
      shouldCountView({ postId: 1, sellerId: SELLER_ID, viewerId: null, viewedIds: [] }),
    ).toBe(true);
  });
});

describe('viewedPosts 저장', function storageSuite() {
  beforeEach(function clearStorage() {
    sessionStorage.clear();
  });

  it('기록한 글 번호를 다시 읽어 온다', function roundTripCase() {
    rememberViewedPost(7);
    rememberViewedPost(9);

    expect(readViewedPostIds()).toEqual([7, 9]);
  });

  it('같은 글을 두 번 기록해도 한 번만 남는다', function dedupeCase() {
    rememberViewedPost(7);
    rememberViewedPost(7);

    expect(readViewedPostIds()).toEqual([7]);
  });

  it('저장된 값이 깨져 있으면 빈 목록으로 본다', function brokenValueCase() {
    sessionStorage.setItem('viewedPostIds', '{저장이 아니라 낙서}');

    expect(readViewedPostIds()).toEqual([]);
  });

  it('숫자가 아닌 항목은 걸러낸다', function wrongItemCase() {
    sessionStorage.setItem('viewedPostIds', JSON.stringify([1, 'two', null, 3]));

    expect(readViewedPostIds()).toEqual([1, 3]);
  });
});
