import {
  clearFilters,
  EMPTY_POST_SEARCH_FILTERS,
  fromSearchParams,
  hasActiveFilter,
  scopeFromSearchParams,
  sortFromSearchParams,
  toNonNegativeInteger,
  toSearchParams,
  validatePriceRange,
} from './postSearchFilters';
import type { PostSearchFilters } from '../types';

describe('toNonNegativeInteger', function toNonNegativeIntegerSuite() {
  it('0 이상의 정수만 통과시킨다', function validCases() {
    expect(toNonNegativeInteger('0')).toBe(0);
    expect(toNonNegativeInteger('30000')).toBe(30000);
  });

  it('숫자가 아니거나 음수·소수면 null이다', function invalidCases() {
    expect(toNonNegativeInteger('abc')).toBeNull();
    expect(toNonNegativeInteger('-1')).toBeNull();
    expect(toNonNegativeInteger('1.5')).toBeNull();
    expect(toNonNegativeInteger('')).toBeNull();
    expect(toNonNegativeInteger(null)).toBeNull();
  });
});

describe('fromSearchParams', function fromSearchParamsSuite() {
  it('빈 쿼리는 아무 조건도 걸지 않은 상태다', function emptyQuery() {
    expect(fromSearchParams(new URLSearchParams(''))).toEqual(EMPTY_POST_SEARCH_FILTERS);
  });

  it('모든 필터를 읽는다', function fullQuery() {
    const params = new URLSearchParams(
      'q=노트북&category=15&minPrice=1000&maxPrice=50000&available=1',
    );

    expect(fromSearchParams(params)).toEqual({
      keyword: '노트북',
      categoryId: 15,
      minPrice: 1000,
      maxPrice: 50000,
      availableOnly: true,
    });
  });

  it('주소창을 고쳐 넣은 값이 깨져 있어도 그 필터만 버린다', function brokenQuery() {
    const params = new URLSearchParams(
      'q=의자&category=abc&minPrice=-500&maxPrice=1.5&available=yes',
    );

    expect(fromSearchParams(params)).toEqual({
      keyword: '의자',
      categoryId: null,
      minPrice: null,
      maxPrice: null,
      availableOnly: false,
    });
  });

  it('카테고리 0은 "선택 안 함"과 구분되지 않아 버린다', function zeroCategory() {
    expect(fromSearchParams(new URLSearchParams('category=0')).categoryId).toBeNull();
  });

  it('검색어 앞뒤 공백은 지운다', function trimsKeyword() {
    expect(fromSearchParams(new URLSearchParams('q=%20%20노트북%20%20')).keyword).toBe('노트북');
  });
});

describe('toSearchParams', function toSearchParamsSuite() {
  it('기본값인 항목은 키를 넣지 않는다', function omitsDefaults() {
    expect(toSearchParams(EMPTY_POST_SEARCH_FILTERS).toString()).toBe('');
  });

  it('0원 하한은 기본값이 아니므로 남긴다', function keepsZeroMin() {
    const filters: PostSearchFilters = { ...EMPTY_POST_SEARCH_FILTERS, minPrice: 0 };

    expect(toSearchParams(filters).get('minPrice')).toBe('0');
  });

  it('직렬화한 뒤 다시 읽으면 원래 값이 나온다', function roundTrip() {
    const filters: PostSearchFilters = {
      keyword: '캠핑 의자',
      categoryId: 23,
      minPrice: 0,
      maxPrice: 90000,
      availableOnly: true,
    };

    const params = toSearchParams(filters, 'price_asc');

    expect(fromSearchParams(params)).toEqual(filters);
    expect(sortFromSearchParams(params)).toBe('price_asc');
  });

  it('기본 정렬은 주소창에 남기지 않는다', function omitsDefaultSort() {
    expect(toSearchParams(EMPTY_POST_SEARCH_FILTERS, 'latest').toString()).toBe('');
    expect(toSearchParams(EMPTY_POST_SEARCH_FILTERS, 'likes').get('sort')).toBe('likes');
  });
});

describe('sortFromSearchParams', function sortFromSearchParamsSuite() {
  it('쿼리에 없거나 모르는 값이면 최신순이다', function fallsBackToDefault() {
    expect(sortFromSearchParams(new URLSearchParams(''))).toBe('latest');
    expect(sortFromSearchParams(new URLSearchParams('sort=cheapest'))).toBe('latest');
  });

  it('필터와 정렬이 섞여 있어도 각자 읽는다', function readsAlongsideFilters() {
    const params = new URLSearchParams('q=의자&available=1&sort=price_desc');

    expect(sortFromSearchParams(params)).toBe('price_desc');
    expect(fromSearchParams(params).keyword).toBe('의자');
  });

  it('거리순은 반경 기준이 함께 적혀 있을 때만 읽는다', function distanceNeedsRadiusScope() {
    expect(sortFromSearchParams(new URLSearchParams('sort=distance&scope=radius'))).toBe(
      'distance',
    );
    // 주소창을 직접 고쳐 만든 조합이다. 그대로 보내면 서버가 거절해 목록이 죽는다(0024).
    expect(sortFromSearchParams(new URLSearchParams('sort=distance'))).toBe('latest');
  });
});

describe('scopeFromSearchParams', function scopeFromSearchParamsSuite() {
  it('쿼리에 없거나 모르는 값이면 법정동 기준이다', function fallsBackToRegion() {
    expect(scopeFromSearchParams(new URLSearchParams(''))).toBe('region');
    expect(scopeFromSearchParams(new URLSearchParams('scope=everywhere'))).toBe('region');
    expect(scopeFromSearchParams(new URLSearchParams('scope=region'))).toBe('region');
  });

  it('반경 기준은 그대로 읽는다', function readsRadius() {
    expect(scopeFromSearchParams(new URLSearchParams('scope=radius'))).toBe('radius');
  });

  it('기본 기준은 주소창에 남기지 않는다', function omitsDefaultScope() {
    expect(toSearchParams(EMPTY_POST_SEARCH_FILTERS, 'latest', 'region').toString()).toBe('');
    expect(toSearchParams(EMPTY_POST_SEARCH_FILTERS, 'latest', 'radius').get('scope')).toBe(
      'radius',
    );
  });

  it('기준을 적어도 필터·정렬은 그대로 오간다', function roundTripsWithOthers() {
    const filters: PostSearchFilters = { ...EMPTY_POST_SEARCH_FILTERS, keyword: '의자' };
    const params = toSearchParams(filters, 'distance', 'radius');

    expect(scopeFromSearchParams(params)).toBe('radius');
    expect(sortFromSearchParams(params)).toBe('distance');
    expect(fromSearchParams(params).keyword).toBe('의자');
  });
});

describe('hasActiveFilter', function hasActiveFilterSuite() {
  it('검색어만으로는 필터가 걸린 것으로 보지 않는다', function keywordOnly() {
    expect(hasActiveFilter({ ...EMPTY_POST_SEARCH_FILTERS, keyword: '노트북' })).toBe(false);
  });

  it('필터가 하나라도 있으면 true다', function anyFilter() {
    expect(hasActiveFilter({ ...EMPTY_POST_SEARCH_FILTERS, availableOnly: true })).toBe(true);
    expect(hasActiveFilter({ ...EMPTY_POST_SEARCH_FILTERS, minPrice: 0 })).toBe(true);
    expect(hasActiveFilter({ ...EMPTY_POST_SEARCH_FILTERS, categoryId: 1 })).toBe(true);
  });
});

describe('clearFilters', function clearFiltersSuite() {
  it('필터만 지우고 검색어는 남긴다', function keepsKeyword() {
    const filters: PostSearchFilters = {
      keyword: '노트북',
      categoryId: 15,
      minPrice: 1000,
      maxPrice: 2000,
      availableOnly: true,
    };

    expect(clearFilters(filters)).toEqual({ ...EMPTY_POST_SEARCH_FILTERS, keyword: '노트북' });
  });
});

describe('validatePriceRange', function validatePriceRangeSuite() {
  it('한쪽만 비어 있으면 검증할 것이 없다', function halfOpen() {
    expect(validatePriceRange(null, 1000)).toBeNull();
    expect(validatePriceRange(1000, null)).toBeNull();
  });

  it('최소와 최대가 같으면 유효하다', function sameValue() {
    expect(validatePriceRange(1000, 1000)).toBeNull();
  });

  it('최소가 최대보다 크면 이유를 알려 준다', function reversed() {
    expect(validatePriceRange(2000, 1000)).toBe('최소 가격이 최대 가격보다 큽니다.');
  });
});
