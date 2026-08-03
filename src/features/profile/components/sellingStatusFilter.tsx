import { POST_STATUS_LABEL, POST_STATUS_ORDER } from '../../post/utils/postStatusTransition';
import type { PostStatus } from '../../post/types';
import type { SellingStatusFilter as StatusFilter } from '../types';

type SellingStatusFilterProps = {
  value: StatusFilter;
  onChange(value: StatusFilter): void;
};

const BASE_CLASS =
  'rounded-full border px-3 py-1.5 text-sm font-medium transition whitespace-nowrap';
const SELECTED_CLASS = 'border-emerald-600 bg-emerald-600 text-white';
const UNSELECTED_CLASS =
  'border-gray-300 text-gray-700 hover:bg-gray-50 ' +
  'dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800';

/**
 * 판매관리의 상태 필터.
 *
 * 문구와 순서를 게시물 쪽(postStatusTransition)에서 그대로 가져온다.
 * 상태 이름을 두 군데에 적어 두면 한쪽만 바뀌었을 때 같은 상태가 화면마다 다르게 불린다.
 */
function SellingStatusFilter(props: SellingStatusFilterProps) {
  function toClassName(value: StatusFilter): string {
    return `${BASE_CLASS} ${props.value === value ? SELECTED_CLASS : UNSELECTED_CLASS}`;
  }

  function handleSelectAll(): void {
    props.onChange(null);
  }

  return (
    <div role="group" aria-label="판매 상태" className="flex flex-wrap gap-2">
      <button type="button" onClick={handleSelectAll} className={toClassName(null)}>
        전체
      </button>

      {POST_STATUS_ORDER.map(function renderStatusButton(status: PostStatus) {
        return (
          <button
            key={status}
            type="button"
            onClick={function selectStatus(): void {
              props.onChange(status);
            }}
            className={toClassName(status)}
          >
            {POST_STATUS_LABEL[status]}
          </button>
        );
      })}
    </div>
  );
}

export default SellingStatusFilter;
