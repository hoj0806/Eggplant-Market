import PostSortSelect from './postSortSelect';
import { useCategoriesQuery } from '../../category/hooks/useCategoriesQuery';
import { findCategoryName } from '../../category/utils/toCategoryTree';
import { hasActiveFilter } from '../utils/postSearchFilters';
import type { PostSearchFilters, PostSearchScope, PostSortOption } from '../types';

type PostFilterBarProps = {
  filters: PostSearchFilters;
  sort: PostSortOption;
  /** 정렬 목록이 기준에 따라 다르다 — 거리순은 반경 기준에만 있다(0024). */
  scope: PostSearchScope;
  isPanelOpen: boolean;
  onTogglePanel(): void;
  onReset(): void;
  onSortChange(sort: PostSortOption): void;
};

const CHIP_CLASS =
  'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ' +
  'dark:bg-emerald-950 dark:text-emerald-300';

/**
 * 칩에는 shared의 formatPrice를 쓰지 않는다 — 그쪽은 0원을 "나눔"으로 바꾸는데,
 * 여기서는 "나눔 이상"이 되어 뜻이 어긋난다. 필터는 금액 그대로 보여야 한다.
 */
function toWon(price: number): string {
  return `${price.toLocaleString('ko-KR')}원`;
}

/** "10,000원 ~ 50,000원"처럼, 한쪽만 걸었어도 읽히게 만든다. */
function toPriceChipLabel(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) {
    return `${toWon(min)} ~ ${toWon(max)}`;
  }
  if (min !== null) {
    return `${toWon(min)} 이상`;
  }
  if (max !== null) {
    return `${toWon(max)} 이하`;
  }

  return null;
}

/**
 * 지금 무엇이 걸려 있는지 보여주는 줄.
 *
 * 필터를 시트 안에만 두면 닫은 뒤 무엇을 걸었는지 알 수 없어, 결과가 적을 때
 * "물건이 없다"고 오해하게 된다. 걸린 조건을 칩으로 꺼내 두고 초기화를 바로 옆에 붙인다.
 */
function PostFilterBar(props: PostFilterBarProps) {
  const categoriesQuery = useCategoriesQuery();

  const categoryName = findCategoryName(categoriesQuery.data ?? [], props.filters.categoryId);
  const priceLabel = toPriceChipLabel(props.filters.minPrice, props.filters.maxPrice);
  const isResetEnabled = hasActiveFilter(props.filters);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={props.isPanelOpen}
          onClick={props.onTogglePanel}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold
                     text-gray-700 transition hover:bg-gray-50
                     dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          필터 {props.isPanelOpen ? '▲' : '▼'}
        </button>

        <button
          type="button"
          onClick={props.onReset}
          disabled={!isResetEnabled}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-500 transition
                     hover:bg-gray-50 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          필터 초기화
        </button>

        {/* 정렬은 "초기화" 대상이 아니다. 조건을 다 풀어도 보던 순서는 그대로 두는 편이 덜 놀랍다. */}
        <div className="ml-auto">
          <PostSortSelect value={props.sort} scope={props.scope} onChange={props.onSortChange} />
        </div>
      </div>

      {isResetEnabled ? (
        <ul className="flex flex-wrap gap-1.5">
          {categoryName !== null ? (
            <li className={CHIP_CLASS}>{categoryName}</li>
          ) : null}
          {priceLabel !== null ? <li className={CHIP_CLASS}>{priceLabel}</li> : null}
          {props.filters.availableOnly ? <li className={CHIP_CLASS}>거래 가능만</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

export default PostFilterBar;
