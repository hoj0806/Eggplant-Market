import { useState } from 'react';
import AvailableOnlyToggle from './availableOnlyToggle';
import CategoryFilterSelect from './categoryFilterSelect';
import PriceRangeFields from './priceRangeFields';
import { toNonNegativeInteger, validatePriceRange } from '../utils/postSearchFilters';
import type { PostSearchFilters } from '../types';

type PostFilterPanelProps = {
  /** 지금 적용돼 있는 필터. 패널을 열 때의 시작값이다. */
  filters: PostSearchFilters;
  onApply(filters: PostSearchFilters): void;
  onClose(): void;
};

/** 입력 중인 값. 가격은 아직 문자열이다 — 사용자가 칸을 비운 상태를 숫자로는 표현할 수 없다. */
type FilterDraft = {
  categoryId: number | null;
  minPriceText: string;
  maxPriceText: string;
  availableOnly: boolean;
};

const INVALID_PRICE_MESSAGE = '가격은 0 이상의 숫자로 입력해 주세요.';

function toPriceText(price: number | null): string {
  return price === null ? '' : String(price);
}

function toDraft(filters: PostSearchFilters): FilterDraft {
  return {
    categoryId: filters.categoryId,
    minPriceText: toPriceText(filters.minPrice),
    maxPriceText: toPriceText(filters.maxPrice),
    availableOnly: filters.availableOnly,
  };
}

/** 비어 있으면 조건 없음, 값이 있는데 숫자가 아니면 잘못된 입력이다. 둘을 구분해야 한다. */
function isInvalidPriceText(text: string): boolean {
  return text.trim() !== '' && toNonNegativeInteger(text) === null;
}

function toDraftError(draft: FilterDraft): string | null {
  if (isInvalidPriceText(draft.minPriceText) || isInvalidPriceText(draft.maxPriceText)) {
    return INVALID_PRICE_MESSAGE;
  }

  return validatePriceRange(
    toNonNegativeInteger(draft.minPriceText),
    toNonNegativeInteger(draft.maxPriceText),
  );
}

/**
 * 필터 편집 시트.
 *
 * 값을 고칠 때마다 URL을 바꾸지 않고 **자기 안에 draft로 들고 있다가 "적용하기"에서 한 번에 넘긴다.**
 * 가격을 한 글자씩 칠 때마다 요청이 나가면 "1", "10", "100"까지 세 번 헛돈다.
 * 검색어는 반대로 즉시 반영한다 — 그쪽은 결과가 바로 보여야 검색하는 맛이 난다.
 */
function PostFilterPanel(props: PostFilterPanelProps) {
  const [draft, setDraft] = useState<FilterDraft>(function initDraft(): FilterDraft {
    return toDraft(props.filters);
  });

  const errorMessage = toDraftError(draft);

  function handleCategoryChange(categoryId: number | null): void {
    setDraft(function withCategory(current: FilterDraft): FilterDraft {
      return { ...current, categoryId };
    });
  }

  function handleMinPriceChange(minPriceText: string): void {
    setDraft(function withMinPrice(current: FilterDraft): FilterDraft {
      return { ...current, minPriceText };
    });
  }

  function handleMaxPriceChange(maxPriceText: string): void {
    setDraft(function withMaxPrice(current: FilterDraft): FilterDraft {
      return { ...current, maxPriceText };
    });
  }

  function handleAvailableChange(availableOnly: boolean): void {
    setDraft(function withAvailable(current: FilterDraft): FilterDraft {
      return { ...current, availableOnly };
    });
  }

  function handleApply(): void {
    if (errorMessage !== null) {
      return;
    }

    props.onApply({
      // 검색어는 이 패널이 건드리지 않는다. 검색창이 원본이다.
      keyword: props.filters.keyword,
      categoryId: draft.categoryId,
      minPrice: toNonNegativeInteger(draft.minPriceText),
      maxPrice: toNonNegativeInteger(draft.maxPriceText),
      availableOnly: draft.availableOnly,
    });
  }

  return (
    <section
      aria-label="필터"
      className="flex flex-col gap-5 rounded-xl border border-gray-200 bg-white p-4
                 dark:border-gray-800 dark:bg-gray-900"
    >
      <CategoryFilterSelect value={draft.categoryId} onChange={handleCategoryChange} />

      <PriceRangeFields
        minPriceText={draft.minPriceText}
        maxPriceText={draft.maxPriceText}
        errorMessage={errorMessage}
        onMinPriceChange={handleMinPriceChange}
        onMaxPriceChange={handleMaxPriceChange}
      />

      <AvailableOnlyToggle checked={draft.availableOnly} onChange={handleAvailableChange} />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={props.onClose}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold
                     text-gray-700 transition hover:bg-gray-50
                     dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          닫기
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={errorMessage !== null}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white
                     transition hover:bg-emerald-700 disabled:opacity-60"
        >
          적용하기
        </button>
      </div>
    </section>
  );
}

export default PostFilterPanel;
