import { type ChangeEvent } from 'react';
import { postSortOptions, toPostSortOption } from '../utils/postSort';
import type { PostSearchScope, PostSortOption } from '../types';

type PostSortSelectProps = {
  value: PostSortOption;
  /** 고를 수 있는 정렬이 기준마다 다르다 — 거리순은 반경 기준에만 있다(0024). */
  scope: PostSearchScope;
  onChange(sort: PostSortOption): void;
};

/**
 * 목록 정렬 선택.
 *
 * 필터 시트 안이 아니라 목록 바로 위에 둔다. 필터는 "적용하기"까지 가는 절차지만 정렬은
 * 고르는 즉시 결과가 바뀌는 한 번의 선택이고, 지금 무슨 순서로 보고 있는지가 항상 보여야 한다.
 *
 * select 하나로 끝낸 이유는 모바일이다. 다섯 개를 칩으로 늘어놓으면 좁은 화면에서 줄이 넘치고,
 * 브라우저가 기기에 맞는 목록 UI를 알아서 띄워 준다.
 */
function PostSortSelect(props: PostSortSelectProps) {
  function handleChange(event: ChangeEvent<HTMLSelectElement>): void {
    props.onChange(toPostSortOption(event.target.value, props.scope));
  }

  return (
    <select
      id="postSort"
      name="postSort"
      aria-label="정렬 기준"
      value={props.value}
      onChange={handleChange}
      className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-semibold
                 text-gray-700 outline-none transition focus:ring-2 focus:ring-emerald-500/40
                 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
    >
      {postSortOptions(props.scope).map(function toOption(option) {
        return (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        );
      })}
    </select>
  );
}

export default PostSortSelect;
