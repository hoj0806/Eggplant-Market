import {
  CHAT_ROOM_FILTER_LABEL,
  CHAT_ROOM_FILTER_ORDER,
  type ChatRoomFilter,
} from '../utils/chatRoomFilter';

type ChatRoomFilterTabsProps = {
  value: ChatRoomFilter;
  /** 안 읽은 **방** 수. 0이면 뱃지를 그리지 않는다. */
  unreadCount: number;
  onChange(value: ChatRoomFilter): void;
};

const BASE_CLASS =
  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition whitespace-nowrap';
const SELECTED_CLASS = 'border-emerald-600 bg-emerald-600 text-white';
const UNSELECTED_CLASS =
  'border-gray-300 text-gray-700 hover:bg-gray-50 ' +
  'dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800';

const SELECTED_BADGE_CLASS = 'bg-white/25 text-white';
const UNSELECTED_BADGE_CLASS =
  'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-gray-950';

/** 999를 넘으면 숫자보다 "많다"는 사실이 중요해진다(chatRoomListItem과 같은 기준). */
const MAX_UNREAD_LABEL = 999;

function toUnreadLabel(count: number): string {
  return count > MAX_UNREAD_LABEL ? `${MAX_UNREAD_LABEL}+` : String(count);
}

/**
 * 채팅 목록의 전체/판매/구매/안읽음 탭.
 *
 * 판매관리의 SellingStatusFilter와 같은 칩 모양이다 — 같은 일을 하는 장치가 화면마다
 * 다르게 생기면 쓰는 사람이 매번 다시 배워야 한다.
 *
 * 문구와 순서는 chatRoomFilter가 쥐고 있다. 여기에 또 적어 두면 한쪽만 바뀌었을 때
 * 탭 이름과 거르는 규칙이 어긋난다.
 *
 * 쿼리도 스토어도 모른다. 값을 받아 그리고, 눌린 값을 돌려줄 뿐이다.
 */
function ChatRoomFilterTabs(props: ChatRoomFilterTabsProps) {
  function toClassName(filter: ChatRoomFilter): string {
    return `${BASE_CLASS} ${props.value === filter ? SELECTED_CLASS : UNSELECTED_CLASS}`;
  }

  return (
    <div role="group" aria-label="채팅 종류" className="flex flex-wrap gap-2">
      {CHAT_ROOM_FILTER_ORDER.map(function renderFilterButton(filter: ChatRoomFilter) {
        const isSelected = props.value === filter;
        const showsBadge = filter === 'unread' && props.unreadCount > 0;

        return (
          <button
            key={filter}
            type="button"
            // 선택 상태가 색으로만 보이면 스크린리더에는 아무것도 전해지지 않는다.
            aria-pressed={isSelected}
            onClick={function selectFilter(): void {
              props.onChange(filter);
            }}
            className={toClassName(filter)}
          >
            {CHAT_ROOM_FILTER_LABEL[filter]}

            {showsBadge ? (
              <span
                aria-label={`안 읽은 채팅방 ${props.unreadCount}개`}
                className={`rounded-full px-1.5 text-xs font-semibold ${
                  isSelected ? SELECTED_BADGE_CLASS : UNSELECTED_BADGE_CLASS
                }`}
              >
                {toUnreadLabel(props.unreadCount)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default ChatRoomFilterTabs;
