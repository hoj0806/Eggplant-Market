import { supabase } from '../../../shared/lib/supabaseClient';
import { uniqueChannelTopic } from '../../../shared/utils/uniqueChannelTopic';
import type { AppNotification, NotificationCursor, NotificationType } from '../types';

/** 알림 한 페이지 크기. 서버(0015)가 50으로 한 번 더 막는다. */
export const NOTIFICATIONS_PAGE_SIZE = 20;

type NotificationRow = {
  id: number;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
  actor_id: string | null;
  actor_nickname: string | null;
  actor_avatar_url: string | null;
  room_id: number | null;
  post_id: number | null;
  post_title: string | null;
  preview: string | null;
  offer_amount: number | null;
  is_first: boolean;
};

function toAppNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    type: row.type,
    isRead: row.is_read,
    createdAt: row.created_at,
    actorId: row.actor_id,
    actorNickname: row.actor_nickname,
    actorAvatarUrl: row.actor_avatar_url,
    roomId: row.room_id,
    postId: row.post_id,
    postTitle: row.post_title,
    preview: row.preview,
    offerAmount: row.offer_amount,
    isFirst: row.is_first,
  };
}

/**
 * 내 알림 한 페이지.
 *
 * 누구의 것인지 보내지 않는다 — 서버가 `auth.uid()`로 판단한다(마이페이지 목록·후기와 같다).
 */
export async function fetchNotifications(
  cursor: NotificationCursor | null,
): Promise<AppNotification[]> {
  const { data, error } = await supabase.rpc('fetch_notifications', {
    p_cursor_at: cursor?.createdAt ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: NOTIFICATIONS_PAGE_SIZE,
  });

  if (error !== null) {
    throw error;
  }

  return (data as NotificationRow[]).map(toAppNotification);
}

/** 안 읽은 알림 수. 홈 헤더 배지가 쓴다. */
export async function fetchUnreadNotificationCount(): Promise<number> {
  const { data, error } = await supabase.rpc('count_unread_notifications');

  if (error !== null) {
    throw error;
  }

  return data as number;
}

/**
 * 알림 하나를 읽음으로 표시한다.
 *
 * RPC가 필요 없다 — `notifications_update`(0001)가 본인 것만 허용하고
 * `guard_notification_update`(0015)가 `is_read` 말고는 못 바꾸게 막는다.
 * 채팅의 `markRoomRead`와 같은 이유로 평범한 update로 충분하다.
 *
 * `is_read = false` 조건은 이미 읽은 알림을 헛되이 다시 쓰지 않기 위한 것이다.
 * 걸려서 한 행도 안 바뀌어도 오류가 아니다 — 이미 원하는 상태이기 때문이다.
 */
export async function markNotificationRead(notificationId: number): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('is_read', false);

  if (error !== null) {
    throw error;
  }

  return undefined;
}

/**
 * 안 읽은 알림을 모두 읽음으로 표시한다.
 *
 * 범위를 `user_id`로 좁히지 않는다 — RLS가 이미 내 행 말고는 손대지 못하게 한다.
 * 여기서 한 번 더 좁히면 "정책이 규칙의 주인"이라는 약속이 흐려지고,
 * 화면이 들고 있는 사용자 id가 낡았을 때 조용히 아무것도 안 하는 길이 생긴다.
 */
export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false);

  if (error !== null) {
    throw error;
  }

  return undefined;
}

/**
 * 알림 하나를 지운다.
 *
 * 읽음 표시와 같은 이유로 RPC가 필요 없다 — `notifications_delete`(0019)가 본인 것만 허용한다.
 * 범위를 `user_id`로 좁히지 않는 것도 `markAllNotificationsRead`와 같다. 정책이 규칙의 주인이다.
 *
 * 남의 알림 id를 보내도 오류가 나지 않는다. RLS는 지울 수 없는 행을 **조용히 건너뛴다** —
 * 0건 삭제는 성공이다. 그래서 화면은 "지웠다"는 응답만으로 무엇이 지워졌는지 알 수 없고,
 * 자기 목록에 있는 줄의 버튼만 누를 수 있다는 사실에 기댄다. 남의 것을 지우는 길은 없다.
 */
export async function deleteNotification(notificationId: number): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', notificationId);

  if (error !== null) {
    throw error;
  }

  return undefined;
}

/**
 * 내게 오는 새 알림을 구독한다.
 *
 * insert만 본다. update(읽음)는 누른 본인의 화면에서 일어나므로 뮤테이션이 그 자리에서
 * 캐시를 고치면 되고, 서버가 되돌려 줄 이유가 없다 — 그래서 0015는 `replica identity full`도
 * 걸지 않았다.
 *
 * 필터를 걸 수 있다. 채팅방 목록(`subscribeToMyChatRooms`)은 "내가 참여한 방"이 컬럼 하나로
 * 표현되지 않아 필터 없이 열고 RLS에 맡겼지만, 알림은 `user_id`가 곧 나다. 필터를 걸어 두면
 * 남의 알림이 서버에서 걸러져 소켓으로 아예 오지 않는다.
 *
 * supabase를 아는 자리를 api/ 한 곳에 가둬 두는 규칙은 여기도 같다 — 훅이 직접 채널을 열면
 * 화면 테스트가 import.meta에 닿아 로드 단계에서 죽는다(troble.md #5).
 *
 * 이름에 번호를 붙이는 이유는 채팅방 목록과 같다 — 헤더의 알림 종과 알림 화면이 함께 뜨는
 * 순간 둘이 같은 채널을 집게 된다(uniqueChannelTopic). viewerId만으로는 갈리지 않는다.
 */
export function subscribeToMyNotifications(viewerId: string, onInsert: () => void): () => void {
  const channel = supabase
    .channel(uniqueChannelTopic(`notifications-${viewerId}`))
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${viewerId}`,
      },
      function handleInsert(): void {
        onInsert();
      },
    )
    .subscribe();

  return function unsubscribe(): void {
    void supabase.removeChannel(channel);
  };
}
