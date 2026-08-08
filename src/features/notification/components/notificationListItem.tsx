import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatTimeAgo } from '../../../shared/utils/formatTimeAgo';
import ProfileAvatar from '../../profile/components/profileAvatar';
import { toNotificationView } from '../utils/notificationText';
import type { AppNotification } from '../types';

type NotificationListItemProps = {
  notification: AppNotification;
  /** 받은 후기가 어느 프로필에 붙는지 정하는 데 쓴다(notificationText 참고). */
  viewerId: string;
  /** 목록 전체가 같은 기준으로 "n분 전"을 계산하도록 부모가 넘긴다. */
  now: Date;
  isDeleting: boolean;
  onSelect(notification: AppNotification): void;
  onDelete(notification: AppNotification): void;
};

const ROW_CLASS = 'flex min-w-0 flex-1 items-start gap-3 py-4 pl-2 text-left';

/**
 * 알림 한 줄.
 *
 * 안 읽은 줄은 **배경과 점 둘 다**로 표시한다. 색만으로는 색을 구분하지 못하는 사람에게
 * 아무것도 전해지지 않고, 점만으로는 목록을 훑을 때 눈에 띄지 않는다.
 * 스크린리더에는 제목 앞의 "안 읽음" 글자가 대신 읽힌다.
 *
 * 갈 곳이 없는 알림(가리키던 방·글이 지워진 경우)은 링크가 아니라 그냥 줄로 그린다.
 * 눌러도 아무 일이 없는 링크를 남겨 두면 "눌렀는데 왜 안 가지"가 된다.
 *
 * 삭제 버튼은 **링크 밖**에 둔다. 링크 안에 버튼을 넣으면 유효하지 않은 HTML이고,
 * 무엇보다 지우려다 화면이 넘어간다. 그래서 `<li>`가 링크와 버튼을 나란히 안는다.
 *
 * 지울 때 한 번 더 묻지 않는다. 댓글 삭제와 다른 판단인데, 잘못 눌러도 **잃는 것이 알림
 * 한 줄뿐**이기 때문이다 — 가리키던 방·글·후기는 그대로 있고 채팅 배지처럼 다른 길도 남아
 * 있다. 되돌릴 수 없다는 점은 같지만 되돌릴 만한 것이 아니다.
 */
function NotificationListItem(props: NotificationListItemProps) {
  const notification = props.notification;
  const view = toNotificationView(notification, props.viewerId);

  const unreadClass = notification.isRead ? '' : 'bg-emerald-50/60 dark:bg-emerald-950/30';

  function handleDelete(): void {
    props.onDelete(notification);
  }

  const content: ReactNode = (
    <>
      <ProfileAvatar
        nickname={notification.actorNickname ?? ''}
        avatarUrl={notification.actorAvatarUrl}
        size="sm"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm text-gray-900 dark:text-gray-50">
          {notification.isRead ? null : <span className="sr-only">안 읽음 </span>}
          <span className={notification.isRead ? '' : 'font-semibold'}>{view.title}</span>
        </p>

        {view.body === null ? null : (
          <p className="truncate text-sm text-gray-600 dark:text-gray-300">{view.body}</p>
        )}

        <span className="text-xs text-gray-500 dark:text-gray-400">
          {formatTimeAgo(notification.createdAt, props.now)}
        </span>
      </div>

      {notification.isRead ? null : (
        <span
          aria-hidden="true"
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500 dark:bg-emerald-400"
        />
      )}
    </>
  );

  return (
    <li className={`flex items-start ${unreadClass}`}>
      {view.to === null ? (
        <div className={ROW_CLASS}>{content}</div>
      ) : (
        <Link
          to={view.to}
          onClick={function select(): void {
            props.onSelect(notification);
          }}
          className={`${ROW_CLASS} transition hover:bg-gray-50 dark:hover:bg-gray-900`}
        >
          {content}
        </Link>
      )}

      {/* 이름에 제목을 넣는다. "삭제"만으로는 스무 줄이 전부 같은 이름이 되어
          스크린리더로 훑을 때 어느 줄의 버튼인지 알 수 없다. */}
      <button
        type="button"
        aria-label={`${view.title} 알림 삭제`}
        disabled={props.isDeleting}
        onClick={handleDelete}
        className="mr-1 mt-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full
                   text-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600
                   disabled:opacity-40 dark:text-gray-500 dark:hover:bg-gray-800
                   dark:hover:text-gray-300"
      >
        ×
      </button>
    </li>
  );
}

export default NotificationListItem;
