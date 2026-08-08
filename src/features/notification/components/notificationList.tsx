import NotificationListItem from './notificationListItem';
import { useInfiniteScroll } from '../../../shared/hooks/useInfiniteScroll';
import type { NotificationsQueryResult } from '../hooks/useNotificationQueries';
import type { AppNotification } from '../types';

type NotificationListProps = {
  query: NotificationsQueryResult;
  viewerId: string;
  /** 지금 지우는 중인 알림. 그 줄의 버튼만 잠근다. */
  deletingId: number | null;
  onSelect(notification: AppNotification): void;
  onDelete(notification: AppNotification): void;
};

const MESSAGE_CLASS = 'py-10 text-center text-sm text-gray-500 dark:text-gray-400';

/**
 * 알림 목록.
 *
 * 로딩·오류·0건·무한스크롤을 다루는 방식은 받은 후기(ReviewList)·게시물 목록(PostList)과 같다.
 */
function NotificationList(props: NotificationListProps) {
  const query = props.query;

  const sentinelRef = useInfiniteScroll({
    hasNextPage: query.hasNextPage,
    isFetching: query.isFetchingNextPage,
    onLoadMore: function loadMore(): void {
      query.fetchNextPage();
    },
  });

  // 항목마다 new Date()를 부르면 같은 목록에서 기준 시각이 어긋난다.
  const now = new Date();

  if (query.isLoading) {
    return <p className={MESSAGE_CLASS}>알림을 불러오는 중입니다…</p>;
  }

  if (query.isError) {
    return (
      <p role="alert" className="py-10 text-center text-sm text-red-600 dark:text-red-400">
        알림을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }

  const notifications = (query.data?.pages ?? []).flat();

  if (notifications.length === 0) {
    return <p className={MESSAGE_CLASS}>아직 받은 알림이 없어요.</p>;
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        {notifications.map(function renderNotification(notification: AppNotification) {
          return (
            <NotificationListItem
              key={notification.id}
              notification={notification}
              viewerId={props.viewerId}
              now={now}
              isDeleting={props.deletingId === notification.id}
              onSelect={props.onSelect}
              onDelete={props.onDelete}
            />
          );
        })}

        {/* 다음 페이지를 부르는 표식. 목록의 일부가 아니라 관찰 대상일 뿐이다. */}
        <li ref={sentinelRef} aria-hidden="true" className="h-px" />
      </ul>

      {query.isFetchingNextPage ? <p className={MESSAGE_CLASS}>더 불러오는 중입니다…</p> : null}
    </>
  );
}

export default NotificationList;
