import {
  DEFAULT_POST_SORT,
  POST_SORT_OPTIONS,
  postSortOptions,
  toPostSortLabel,
  toPostSortOption,
} from './postSort';

describe('toPostSortOption', function toPostSortOptionSuite() {
  it('아는 값은 그대로 통과시킨다', function knownValues() {
    expect(toPostSortOption('latest', 'region')).toBe('latest');
    expect(toPostSortOption('popular', 'region')).toBe('popular');
    expect(toPostSortOption('likes', 'region')).toBe('likes');
    expect(toPostSortOption('price_asc', 'region')).toBe('price_asc');
    expect(toPostSortOption('price_desc', 'region')).toBe('price_desc');
  });

  it('없는 값·빈 값은 기본 정렬로 되돌린다', function unknownValues() {
    // 주소창을 직접 고쳐 넣을 수 있어, 모르는 값은 오류가 아니라 기본값이다.
    expect(toPostSortOption('cheapest', 'region')).toBe(DEFAULT_POST_SORT);
    expect(toPostSortOption('', 'region')).toBe(DEFAULT_POST_SORT);
    expect(toPostSortOption(null, 'region')).toBe(DEFAULT_POST_SORT);
  });

  it('거리순은 반경 기준에서만 통과한다', function distanceNeedsRadius() {
    expect(toPostSortOption('distance', 'radius')).toBe('distance');
    // 법정동 기준에는 거리를 잴 중심이 없다. 그대로 보내면 서버가 거절한다(0024).
    // `?sort=distance`를 손으로 칠 수 있으므로 화면에서 안 보이는 것만으로는 모자라다.
    expect(toPostSortOption('distance', 'region')).toBe(DEFAULT_POST_SORT);
  });

  it('기준을 가리지 않는 정렬은 반경 기준에서도 그대로다', function scopeFreeSorts() {
    expect(toPostSortOption('price_asc', 'radius')).toBe('price_asc');
    expect(toPostSortOption('likes', 'radius')).toBe('likes');
  });

  it('기본 정렬은 최신순이다', function defaultSort() {
    expect(DEFAULT_POST_SORT).toBe('latest');
  });
});

describe('postSortOptions', function postSortOptionsByScopeSuite() {
  it('법정동 기준에서는 거리순을 빼고 보여준다', function regionHidesDistance() {
    const values = postSortOptions('region').map(function toValue(option) {
      return option.value;
    });

    expect(values).not.toContain('distance');
    expect(values).toHaveLength(POST_SORT_OPTIONS.length - 1);
  });

  it('반경 기준에서는 거리순까지 모두 보여준다', function radiusShowsAll() {
    const values = postSortOptions('radius').map(function toValue(option) {
      return option.value;
    });

    expect(values).toContain('distance');
    expect(values).toHaveLength(POST_SORT_OPTIONS.length);
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
