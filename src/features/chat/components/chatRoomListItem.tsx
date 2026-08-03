import { Link } from 'react-router-dom';
import { formatTimeAgo } from '../../../shared/utils/formatTimeAgo';
import ProfileAvatar from '../../profile/components/profileAvatar';
import { isSaleRoom } from '../utils/chatRoomFilter';
import type { ChatRoomSummary } from '../types';

type ChatRoomListItemProps = {
  room: ChatRoomSummary;
  /** 판매/구매를 가르는 기준. 내가 이 방 게시물의 판매자인지 보려면 필요하다. */
  viewerId: string;
  /** 목록 전체가 같은 기준으로 "n분 전"을 계산하도록 부모가 넘긴다. */
  now: Date;
};

/** 999를 넘으면 숫자보다 "많다"는 사실이 중요해진다. */
const MAX_UNREAD_LABEL = 999;

const KIND_BADGE_CLASS = 'shrink-0 rounded px-1 py-px text-[10px] font-semibold';
const SALE_BADGE_CLASS =
  'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
const PURCHASE_BADGE_CLASS = 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300';

function toUnreadLabel(count: number): string {
  return count > MAX_UNREAD_LABEL ? `${MAX_UNREAD_LABEL}+` : String(count);
}

function ChatRoomListItem(props: ChatRoomListItemProps) {
  const room = props.room;
  // 전체 탭에서는 판매·구매가 섞여 나오므로 줄마다 어느 쪽인지 보여 준다.
  const isSale = isSaleRoom(room, props.viewerId);

  return (
    <li>
      <Link
        to={`/chats/${room.id}`}
        className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-gray-50 dark:hover:bg-gray-900"
      >
        <ProfileAvatar
          nickname={room.partner.nickname}
          avatarUrl={room.partner.avatarUrl}
          size="md"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-baseline gap-2">
            <span className="truncate font-medium text-gray-900 dark:text-gray-50">
              {room.partner.nickname}
            </span>
            {room.lastMessageAt === null ? null : (
              <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                {formatTimeAgo(room.lastMessageAt, props.now)}
              </span>
            )}
          </div>

          <span className="truncate text-sm text-gray-600 dark:text-gray-300">
            {room.lastMessage ?? '아직 대화가 없어요'}
          </span>

          <span className="flex min-w-0 items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
            <span
              className={`${KIND_BADGE_CLASS} ${isSale ? SALE_BADGE_CLASS : PURCHASE_BADGE_CLASS}`}
            >
              {isSale ? '판매' : '구매'}
            </span>
            <span className="truncate">{room.postTitle}</span>
          </span>
        </div>

        {room.unreadCount > 0 ? (
          <span
            aria-label={`안 읽은 메시지 ${room.unreadCount}개`}
            className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white"
          >
            {toUnreadLabel(room.unreadCount)}
          </span>
        ) : null}

        {room.postThumbnailUrl === null ? null : (
          <img
            src={room.postThumbnailUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg bg-gray-100 object-cover dark:bg-gray-800"
          />
        )}
      </Link>
    </li>
  );
}

export default ChatRoomListItem;
