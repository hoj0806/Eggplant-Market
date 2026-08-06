/**
 * 정렬 기준의 이름·라벨·URL 표기.
 *
 * 필터(`postSearchFilters.ts`)와 파일을 나눠 둔 이유는 성격이 달라서다. 필터는 결과의 범위를
 * 좁히지만 정렬은 순서만 바꾼다 — "필터 초기화"가 정렬까지 되돌리면 안 되고,
 * 걸린 조건을 세는 `hasActiveFilter`도 정렬은 세지 않는다.
 */

import type { PostSearchScope, PostSortOption } from '../types';

export const SORT_PARAM = 'sort';

/** 아무것도 고르지 않았을 때. 홈·검색 모두 이 순서로 시작한다. */
export const DEFAULT_POST_SORT: PostSortOption = 'latest';

type PostSortOptionItem = {
  value: PostSortOption;
  label: string;
  /**
   * 이 정렬을 고를 수 있는 기준. 비워 두면 어느 기준에서든 쓸 수 있다.
   *
   * 거리순만 `radius` 하나다 — 법정동 기준에는 거리를 잴 중심이 없어 서버가 거절한다(0024).
   * 화면에서 못 고르게 하는 것만으로는 모자라다. URL이 원본이라 `?sort=distance`를 손으로
   * 칠 수 있고, 그때 걸러 내지 않으면 요청이 그대로 나가 목록이 오류로 죽는다.
   */
  scope?: PostSearchScope;
};

/**
 * 화면에 그릴 순서 그대로. 라벨은 당근마켓의 표현을 따랐다.
 *
 * 거리순만 "가까운 순"이 아니라 **"가까운 동네순"**이다. `posts.location`이 판매자의
 * 정확한 위치가 아니라 동네 대표 좌표라(0005) 같은 동 글은 거리가 전부 같다.
 * "가까운 순"이라고 적으면 물건 하나하나의 거리를 재 준다는 뜻이 되어 거짓말이 된다.
 */
export const POST_SORT_OPTIONS: ReadonlyArray<PostSortOptionItem> = [
  { value: 'latest', label: '최신순' },
  { value: 'distance', label: '가까운 동네순', scope: 'radius' },
  { value: 'popular', label: '조회 많은 순' },
  { value: 'likes', label: '찜 많은 순' },
  { value: 'price_asc', label: '낮은 가격순' },
  { value: 'price_desc', label: '높은 가격순' },
];

function isAllowedInScope(option: PostSortOptionItem, scope: PostSearchScope): boolean {
  return option.scope === undefined || option.scope === scope;
}

/** 이 기준에서 고를 수 있는 정렬만. select가 그리는 목록이 곧 이것이다. */
export function postSortOptions(scope: PostSearchScope): ReadonlyArray<PostSortOptionItem> {
  return POST_SORT_OPTIONS.filter(function isAllowed(option: PostSortOptionItem): boolean {
    return isAllowedInScope(option, scope);
  });
}

/**
 * URL에서 읽은 값을 정렬 기준으로 옮긴다.
 *
 * 주소창은 사용자가 직접 고칠 수 있어 모르는 값이 들어올 수 있다. 필터와 같은 규칙으로
 * 오류 대신 기본값으로 되돌린다 — 서버도 모르는 값은 거절하므로 여기서 걸러야 요청이 헛돌지 않는다.
 *
 * **기준을 함께 받는다.** 이름을 아는 값이어도 이 기준에서 쓸 수 없으면 모르는 값과 같다.
 * 반경으로 거리순을 보다가 "우리 동네"로 되돌리는 순간이 실제로 그렇다 —
 * 정렬은 URL에 남아 있는데 그 기준에서는 뜻이 없어진다.
 */
export function toPostSortOption(raw: string | null, scope: PostSearchScope): PostSortOption {
  const found = POST_SORT_OPTIONS.find(function hasValue(option: PostSortOptionItem): boolean {
    return option.value === raw && isAllowedInScope(option, scope);
  });

  return found?.value ?? DEFAULT_POST_SORT;
}

export function toPostSortLabel(sort: PostSortOption): string {
  const found = POST_SORT_OPTIONS.find(function hasValue(option: PostSortOptionItem): boolean {
    return option.value === sort;
  });

  return found?.label ?? '';
}
