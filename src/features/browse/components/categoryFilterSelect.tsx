import { type ChangeEvent } from 'react';
import { useCategoriesQuery } from '../../category/hooks/useCategoriesQuery';
import { findParentCategoryId } from '../../category/utils/toCategoryTree';
import type { Category, CategoryTree } from '../../category/types';

type CategoryFilterSelectProps = {
  /** 고른 카테고리 id. 대분류일 수도, 소분류일 수도 있다. */
  value: number | null;
  onChange(categoryId: number | null): void;
};

const PARENT_ID = 'filterCategoryParent';
const CHILD_ID = 'filterCategoryChild';
const NONE_VALUE = '';

const SELECT_CLASS =
  'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition ' +
  'bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 ' +
  'border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50';

function toCategoryId(value: string): number | null {
  return value === NONE_VALUE ? null : Number(value);
}

function toSelectValue(id: number | null): string {
  return id === null ? NONE_VALUE : String(id);
}

/**
 * 고른 값이 대분류인지 소분류인지 되짚는다.
 * 값 하나만 들고 두 select를 그리므로 별도 상태가 필요 없다.
 */
function toParentId(trees: ReadonlyArray<CategoryTree>, value: number | null): number | null {
  if (value === null) {
    return null;
  }

  const isParent = trees.some(function hasId(tree: CategoryTree): boolean {
    return tree.id === value;
  });

  return isParent ? value : findParentCategoryId(trees, value);
}

/**
 * 목록 필터용 카테고리 선택.
 *
 * 글쓰기 폼의 CategorySelect와 규칙이 다르다. 글은 반드시 소분류에 붙지만,
 * **필터는 대분류만 골라도 유효하다** — "디지털/가전 전체"로 넓게 보고 싶은 쪽이 흔하다.
 * 대분류를 그대로 넘기면 그 아래 소분류 글이 모두 걸리는 것은 search_posts가 처리한다(0007).
 */
function CategoryFilterSelect(props: CategoryFilterSelectProps) {
  const categoriesQuery = useCategoriesQuery();

  const trees = categoriesQuery.data ?? [];
  const parentId = toParentId(trees, props.value);

  const selectedTree = trees.find(function isSelectedParent(tree: CategoryTree): boolean {
    return tree.id === parentId;
  });
  const children = selectedTree?.children ?? [];

  // 값이 대분류 자체면 소분류는 "전체"다.
  const childId = props.value === parentId ? null : props.value;

  function handleParentChange(event: ChangeEvent<HTMLSelectElement>): void {
    // 대분류를 바꾸면 이전 소분류는 그 아래에 없다. 새 대분류 전체가 조건이 된다.
    props.onChange(toCategoryId(event.target.value));
  }

  function handleChildChange(event: ChangeEvent<HTMLSelectElement>): void {
    // 소분류를 "전체"로 되돌리면 대분류 조건으로 물러선다.
    props.onChange(toCategoryId(event.target.value) ?? parentId);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">카테고리</span>

      <div className="grid grid-cols-2 gap-2">
        <select
          id={PARENT_ID}
          name={PARENT_ID}
          aria-label="대분류"
          value={toSelectValue(parentId)}
          disabled={categoriesQuery.isLoading}
          onChange={handleParentChange}
          className={SELECT_CLASS}
        >
          <option value={NONE_VALUE}>전체</option>
          {trees.map(function toParentOption(tree: CategoryTree) {
            return (
              <option key={tree.id} value={tree.id}>
                {tree.name}
              </option>
            );
          })}
        </select>

        <select
          id={CHILD_ID}
          name={CHILD_ID}
          aria-label="소분류"
          value={toSelectValue(childId)}
          disabled={categoriesQuery.isLoading || parentId === null}
          onChange={handleChildChange}
          className={SELECT_CLASS}
        >
          <option value={NONE_VALUE}>전체</option>
          {children.map(function toChildOption(child: Category) {
            return (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            );
          })}
        </select>
      </div>

      {categoriesQuery.isError ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          카테고리를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      ) : null}
    </div>
  );
}

export default CategoryFilterSelect;
