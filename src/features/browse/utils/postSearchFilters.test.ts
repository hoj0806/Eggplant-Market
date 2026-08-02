import {
  clearFilters,
  EMPTY_POST_SEARCH_FILTERS,
  fromSearchParams,
  hasActiveFilter,
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

    expect(fromSearchParams(toSearchParams(filters))).toEqual(filters);
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
