import {
  MAX_MANNER_TAGS,
  REVIEW_RATING_LABEL,
  REVIEW_RATING_ORDER,
  toMannerTagOptions,
  toggleMannerTag,
} from './reviewRating';

describe('toMannerTagOptions', function tagOptionsSuite() {
  it('좋음·보통은 같은(좋은 쪽) 목록을 쓴다', function positiveShared() {
    expect(toMannerTagOptions('normal')).toEqual(toMannerTagOptions('good'));
  });

  it('별로예요는 다른 목록을 쓴다', function negativeDiffers() {
    const negative = toMannerTagOptions('bad');

    expect(negative).not.toEqual(toMannerTagOptions('good'));
    // 좋은 태그가 섞여 들어오면 "별로예요 + 친절해요" 같은 후기가 만들어진다.
    for (const tag of toMannerTagOptions('good')) {
      expect(negative).not.toContain(tag);
    }
  });

  it('세 평가 모두 고를 태그가 있다', function everyRatingHasTags() {
    for (const rating of REVIEW_RATING_ORDER) {
      expect(toMannerTagOptions(rating).length).toBeGreaterThan(0);
      expect(REVIEW_RATING_LABEL[rating].length).toBeGreaterThan(0);
    }
  });
});

describe('toggleMannerTag', function toggleSuite() {
  it('안 고른 태그는 뒤에 붙는다', function adds() {
    expect(toggleMannerTag(['가'], '나')).toEqual(['가', '나']);
  });

  it('이미 고른 태그는 빠진다', function removes() {
    expect(toggleMannerTag(['가', '나', '다'], '나')).toEqual(['가', '다']);
  });

  it('원본을 건드리지 않는다', function keepsInputIntact() {
    const tags = ['가'];

    toggleMannerTag(tags, '나');

    expect(tags).toEqual(['가']);
  });

  it('개수가 찼으면 아무 일도 일어나지 않는다', function respectsMax() {
    const full = Array.from({ length: MAX_MANNER_TAGS }, function toTag(_unused, index: number) {
      return `태그${index}`;
    });

    expect(toggleMannerTag(full, '하나 더')).toEqual(full);
  });

  it('개수가 찼어도 이미 고른 것은 뺄 수 있다', function removesWhenFull() {
    const full = Array.from({ length: MAX_MANNER_TAGS }, function toTag(_unused, index: number) {
      return `태그${index}`;
    });

    expect(toggleMannerTag(full, '태그0')).toHaveLength(MAX_MANNER_TAGS - 1);
  });
});
