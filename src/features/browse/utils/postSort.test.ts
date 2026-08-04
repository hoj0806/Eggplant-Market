import {
  DEFAULT_POST_SORT,
  POST_SORT_OPTIONS,
  toPostSortLabel,
  toPostSortOption,
} from './postSort';

describe('toPostSortOption', function toPostSortOptionSuite() {
  it('아는 값은 그대로 통과시킨다', function knownValues() {
    expect(toPostSortOption('latest')).toBe('latest');
    expect(toPostSortOption('popular')).toBe('popular');
    expect(toPostSortOption('likes')).toBe('likes');
    expect(toPostSortOption('price_asc')).toBe('price_asc');
    expect(toPostSortOption('price_desc')).toBe('price_desc');
  });

  it('없는 값·빈 값은 기본 정렬로 되돌린다', function unknownValues() {
    // 주소창을 직접 고쳐 넣을 수 있어, 모르는 값은 오류가 아니라 기본값이다.
    expect(toPostSortOption('cheapest')).toBe(DEFAULT_POST_SORT);
    expect(toPostSortOption('')).toBe(DEFAULT_POST_SORT);
    expect(toPostSortOption(null)).toBe(DEFAULT_POST_SORT);
  });

  it('기본 정렬은 최신순이다', function defaultSort() {
    expect(DEFAULT_POST_SORT).toBe('latest');
  });
});

describe('POST_SORT_OPTIONS', function postSortOptionsSuite() {
  it('기본 정렬이 목록의 맨 앞에 있다', function defaultComesFirst() {
    expect(POST_SORT_OPTIONS[0].value).toBe(DEFAULT_POST_SORT);
  });

  it('값이 겹치지 않는다', function uniqueValues() {
    const values = POST_SORT_OPTIONS.map(function toValue(option) {
      return option.value;
    });

    expect(new Set(values).size).toBe(values.length);
  });

  it('모든 정렬에 화면에 쓸 이름이 있다', function everyOptionHasLabel() {
    for (const option of POST_SORT_OPTIONS) {
      expect(toPostSortLabel(option.value)).toBe(option.label);
      expect(option.label.length).toBeGreaterThan(0);
    }
  });
});
