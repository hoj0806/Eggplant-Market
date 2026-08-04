/**
 * 정렬 기준의 이름·라벨·URL 표기.
 *
 * 필터(`postSearchFilters.ts`)와 파일을 나눠 둔 이유는 성격이 달라서다. 필터는 결과의 범위를
 * 좁히지만 정렬은 순서만 바꾼다 — "필터 초기화"가 정렬까지 되돌리면 안 되고,
 * 걸린 조건을 세는 `hasActiveFilter`도 정렬은 세지 않는다.
 */

import type { PostSortOption } from '../types';

export const SORT_PARAM = 'sort';

/** 아무것도 고르지 않았을 때. 홈·검색 모두 이 순서로 시작한다. */
export const DEFAULT_POST_SORT: PostSortOption = 'latest';

type PostSortOptionItem = {
  value: PostSortOption;
  label: string;
};

/** 화면에 그릴 순서 그대로. 라벨은 당근마켓의 표현을 따랐다. */
export const POST_SORT_OPTIONS: ReadonlyArray<PostSortOptionItem> = [
  { value: 'latest', label: '최신순' },
  { value: 'popular', label: '조회 많은 순' },
  { value: 'likes', label: '찜 많은 순' },
  { value: 'price_asc', label: '낮은 가격순' },
  { value: 'price_desc', label: '높은 가격순' },
];

/**
 * URL에서 읽은 값을 정렬 기준으로 옮긴다.
 *
 * 주소창은 사용자가 직접 고칠 수 있어 모르는 값이 들어올 수 있다. 필터와 같은 규칙으로
 * 오류 대신 기본값으로 되돌린다 — 서버도 모르는 값은 거절하므로 여기서 걸러야 요청이 헛돌지 않는다.
 */
export function toPostSortOption(raw: string | null): PostSortOption {
  const found = POST_SORT_OPTIONS.find(function hasValue(option: PostSortOptionItem): boolean {
    return option.value === raw;
  });

  return found?.value ?? DEFAULT_POST_SORT;
}

export function toPostSortLabel(sort: PostSortOption): string {
  const found = POST_SORT_OPTIONS.find(function hasValue(option: PostSortOptionItem): boolean {
    return option.value === sort;
  });

  return found?.label ?? '';
}
