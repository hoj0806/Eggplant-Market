/**
 * 필터 상태와 URL 쿼리 사이의 변환.
 *
 * 필터의 원본은 컴포넌트 state가 아니라 **URL**이다. 그래야 새로고침·뒤로가기·링크 공유가
 * 공짜로 따라오고, "필터 초기화"가 쿼리를 비우는 한 줄로 끝난다.
 *
 * 대신 URL은 사용자가 직접 고칠 수 있는 값이라 여기서 들어오는 것을 하나도 믿지 않는다.
 * 깨진 값은 오류가 아니라 "그 필터가 없는 것"으로 본다 — 주소를 잘못 붙여넣었다고
 * 화면이 죽는 것보다 낫다.
 */

import type { PostSearchFilters } from '../types';

export const KEYWORD_PARAM = 'q';
export const CATEGORY_PARAM = 'category';
export const MIN_PRICE_PARAM = 'minPrice';
export const MAX_PRICE_PARAM = 'maxPrice';
export const AVAILABLE_PARAM = 'available';

const AVAILABLE_ON = '1';

export const EMPTY_POST_SEARCH_FILTERS: PostSearchFilters = {
  keyword: '',
  categoryId: null,
  minPrice: null,
  maxPrice: null,
  availableOnly: false,
};

/** 0 이상의 정수만 통과시킨다. 소수점·음수·문자·빈 값은 전부 null. */
export function toNonNegativeInteger(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') {
    return null;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

/** 카테고리 id는 1 이상이다. 0은 "선택 안 함"과 구분되지 않으므로 버린다. */
function toCategoryId(raw: string | null): number | null {
  const parsed = toNonNegativeInteger(raw);

  return parsed === null || parsed === 0 ? null : parsed;
}

export function fromSearchParams(params: URLSearchParams): PostSearchFilters {
  return {
    keyword: params.get(KEYWORD_PARAM)?.trim() ?? '',
    categoryId: toCategoryId(params.get(CATEGORY_PARAM)),
    minPrice: toNonNegativeInteger(params.get(MIN_PRICE_PARAM)),
    maxPrice: toNonNegativeInteger(params.get(MAX_PRICE_PARAM)),
    availableOnly: params.get(AVAILABLE_PARAM) === AVAILABLE_ON,
  };
}

/** 기본값인 항목은 키 자체를 넣지 않는다. 주소창이 짧아야 사용자가 무엇을 걸었는지 읽을 수 있다. */
export function toSearchParams(filters: PostSearchFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.keyword !== '') {
    params.set(KEYWORD_PARAM, filters.keyword);
  }
  if (filters.categoryId !== null) {
    params.set(CATEGORY_PARAM, String(filters.categoryId));
  }
  if (filters.minPrice !== null) {
    params.set(MIN_PRICE_PARAM, String(filters.minPrice));
  }
  if (filters.maxPrice !== null) {
    params.set(MAX_PRICE_PARAM, String(filters.maxPrice));
  }
  if (filters.availableOnly) {
    params.set(AVAILABLE_PARAM, AVAILABLE_ON);
  }

  return params;
}

/**
 * 검색어를 뺀 필터가 하나라도 걸려 있는가. "필터 초기화" 버튼을 켤지 정하는 데 쓴다.
 * 검색어를 세지 않는 이유는 `clearFilters`가 검색어를 남기기 때문이다.
 */
export function hasActiveFilter(filters: PostSearchFilters): boolean {
  return (
    filters.categoryId !== null ||
    filters.minPrice !== null ||
    filters.maxPrice !== null ||
    filters.availableOnly
  );
}

/**
 * 필터만 지우고 검색어는 남긴다.
 * "'노트북' 검색 결과에서 조건만 풀어 보고 싶다"가 흔한 요구라, 검색어까지 지우면 처음부터 다시 쳐야 한다.
 */
export function clearFilters(filters: PostSearchFilters): PostSearchFilters {
  return { ...EMPTY_POST_SEARCH_FILTERS, keyword: filters.keyword };
}

/** 최소가 최대보다 크면 결과가 언제나 0건이다. 조용히 0건을 보여주지 말고 이유를 알려 준다. */
export function validatePriceRange(min: number | null, max: number | null): string | null {
  if (min === null || max === null) {
    return null;
  }

  return min > max ? '최소 가격이 최대 가격보다 큽니다.' : null;
}
