import NotificationList from './notificationList';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import {
  useDeleteNotificationMutation,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from '../hooks/useNotificationMutations';
import { useNotificationsQuery } from '../hooks/useNotificationQueries';
import { useNotificationsRealtime } from '../hooks/useNotificationRealtime';
import type { AppNotification } from '../types';

/**
 * 알림 목록 화면.
 *
 * 탭바 **안**에 둔다. 마이페이지 하위 목록 넷처럼 `← 어디로`를 붙이지 않은 이유는
 * 돌아갈 곳이 하나로 정해지지 않아서다 — 홈 헤더의 종에서도 오고 마이페이지에서도 온다.
 * 탭바가 떠 있으면 어디서 왔든 원하는 곳으로 갈 수 있다.
 *
 * 로그인 가드는 라우터의 RequireMember가 이미 걸었다.
 */
function NotificationPage() {
  const user = useAuthStore(selectAuthUser);
  const viewerId = user?.id ?? null;

  const notificationsQuery = useNotificationsQuery(viewerId);
  // 이 화면을 보는 동안 새 알림이 오면 목록이 따라 움직인다.
  useNotificationsRealtime(viewerId);

  const markReadMutation = useMarkNotificationReadMutation(viewerId);
  const markAllReadMutation = useMarkAllNotificationsReadMutation(viewerId);
  const deleteMutation = useDeleteNotificationMutation(viewerId);

  if (viewerId === null) {
    return <PageSpinner message="알림을 불러오는 중입니다…" />;
  }

  const notifications = (notificationsQuery.data?.pages ?? []).flat();
  const hasUnread = notifications.some(function isUnread(notification: AppNotification): boolean {
    return !notification.isRead;
  });

  return (
    <main className="flex page-wide flex-col gap-4 p-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">알림</h1>

        {/* 받아 온 페이지에 안 읽은 것이 없으면 감춘다. 서버는 안 읽은 것 전부를 읽음 처리하므로
            아래쪽 페이지에 남아 있어도 이 버튼 한 번이면 함께 정리된다. */}
        {hasUnread ? (
          <button
            type="button"
            onClick={function markAll(): void {
              markAllReadMutation.mutate();
            }}
            disabled={markAllReadMutation.isPending}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium
                       text-gray-700 transition hover:bg-gray-50 disabled:opacity-50
                       dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {markAllReadMutation.isPending ? '처리 중…' : '모두 읽음'}
          </button>
        ) : null}
      </header>

      {markAllReadMutation.isError ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          읽음 표시에 실패했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      ) : null}

      {deleteMutation.isError ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          알림을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      ) : null}

      <NotificationList
        query={notificationsQuery}
        viewerId={viewerId}
        deletingId={deleteMutation.isPending ? (deleteMutation.variables?.id ?? null) : null}
        onSelect={function markOneRead(notification: AppNotification): void {
          markReadMutation.mutate({ id: notification.id, wasRead: notification.isRead });
        }}
        onDelete={function removeOne(notification: AppNotification): void {
          deleteMutation.mutate({ id: notification.id, wasRead: notification.isRead });
        }}
      />
    </main>
  );
}

export default NotificationPage;
