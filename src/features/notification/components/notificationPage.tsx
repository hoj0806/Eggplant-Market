import DeleteAllNotificationsButton from './deleteAllNotificationsButton';
import NotificationList from './notificationList';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import {
  useDeleteNotificationMutation,
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
  const deleteMutation = useDeleteNotificationMutation(viewerId);

  if (viewerId === null) {
    return <PageSpinner message="알림을 불러오는 중입니다…" />;
  }

  const notifications = (notificationsQuery.data?.pages ?? []).flat();

  return (
    <main className="flex page-wide flex-col gap-4 p-6">
      <header className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">알림</h1>

        {/* 머리말의 버튼은 하나뿐이다. "모두 읽음"은 걷어냈다(2026-08-10) —
            누르고 나도 목록이 그대로라 무엇이 달라졌는지 보이지 않았다.
            한 줄이라도 있으면 낸다. 다 읽은 목록도 치우고 싶을 수 있다. */}
        {notifications.length > 0 ? <DeleteAllNotificationsButton viewerId={viewerId} /> : null}
      </header>

      {deleteMutation.isError ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          알림을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      ) : null}

      <NotificationList
        query={notificationsQuery}
        viewerId={viewerId}
        deletingId={deleteMutation.isPending ? (deleteMutation.variables ?? null) : null}
        onSelect={function markOneRead(notification: AppNotification): void {
          markReadMutation.mutate(notification.id);
        }}
        onDelete={function removeOne(notification: AppNotification): void {
          deleteMutation.mutate(notification.id);
        }}
      />
    </main>
  );
}

export default NotificationPage;
