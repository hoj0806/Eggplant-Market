import { useState, type ChangeEvent } from 'react';
import { useCategoriesQuery } from '../hooks/useCategoriesQuery';
import { findParentCategoryId } from '../utils/toCategoryTree';
import type { CategoryTree } from '../types';

type CategorySelectProps = {
  /** 고른 **소분류** id. 게시물은 언제나 소분류에 붙는다. */
  value: number | null;
  disabled?: boolean;
  errorMessage?: string;
  onChange(categoryId: number | null): void;
};

const PARENT_ID = 'categoryParent';
const CHILD_ID = 'categoryChild';
const ERROR_ID = 'category-error';
const NONE_VALUE = '';

const SELECT_CLASS =
  'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition ' +
  'bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 ' +
  'dark:bg-gray-900 dark:text-gray-50';

function toCategoryId(value: string): number | null {
  return value === NONE_VALUE ? null : Number(value);
}

function toSelectValue(id: number | null): string {
  return id === null ? NONE_VALUE : String(id);
}

/**
 * 대분류 → 소분류 2단 선택.
 *
 * 고른 값은 소분류 id 하나뿐이다. 부모까지 부모 컴포넌트가 들고 있을 이유가 없어서
 * 대분류는 이 컴포넌트의 내부 상태다. 값만 받은 수정 화면에서도 부모를 역으로 찾아
 * (`findParentCategoryId`) 올바른 대분류를 펼쳐 준다.
 */
function CategorySelect(props: CategorySelectProps) {
  const categoriesQuery = useCategoriesQuery();
  const [pickedParentId, setPickedParentId] = useState<number | null>(null);

  const trees = categoriesQuery.data ?? [];
  const isDisabled = props.disabled === true || categoriesQuery.isLoading;
  const hasError = props.errorMessage !== undefined;

  // 아직 대분류를 직접 고르지 않았으면 현재 소분류가 속한 대분류를 펼쳐 둔다.
  const parentId = pickedParentId ?? findParentCategoryId(trees, props.value);

  const selectedTree = trees.find(function isSelectedParent(tree: CategoryTree): boolean {
    return tree.id === parentId;
  });
  const children = selectedTree?.children ?? [];

  function handleParentChange(event: ChangeEvent<HTMLSelectElement>): void {
    setPickedParentId(toCategoryId(event.target.value));
    // 대분류가 바뀌면 이전 소분류는 더 이상 그 아래에 없다. 반드시 비운다.
    props.onChange(null);
  }

  function handleChildChange(event: ChangeEvent<HTMLSelectElement>): void {
    props.onChange(toCategoryId(event.target.value));
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
          disabled={isDisabled}
          onChange={handleParentChange}
          className={`${SELECT_CLASS} ${
            hasError ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
          }`}
        >
          <option value={NONE_VALUE}>대분류 선택</option>
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
          aria-invalid={hasError}
          aria-describedby={hasError ? ERROR_ID : undefined}
          value={toSelectValue(props.value)}
          disabled={isDisabled || parentId === null}
          onChange={handleChildChange}
          className={`${SELECT_CLASS} ${
            hasError ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
          }`}
        >
          <option value={NONE_VALUE}>소분류 선택</option>
          {children.map(function toChildOption(child) {
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

      {hasError ? (
        <p id={ERROR_ID} role="alert" className="text-xs text-red-600 dark:text-red-400">
          {props.errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export default CategorySelect;
