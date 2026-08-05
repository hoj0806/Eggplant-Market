import { formatPrice } from '../../../shared/utils/formatPrice';
import type { AppNotification, NotificationView } from '../types';

/**
 * 알림을 일으킨 사람이 지워졌을 때 쓰는 이름.
 *
 * 알림 행은 남고(payload에 id만 있다) 프로필은 cascade로 사라질 수 있다. "님이"로 이어지는
 * 문장이라 빈 문자열을 넣으면 "님이 메시지를 보냈어요"가 된다.
 */
const UNKNOWN_ACTOR = '알 수 없는 이웃';

function toActorName(notification: AppNotification): string {
  return notification.actorNickname ?? UNKNOWN_ACTOR;
}

/** 채팅 알림이 가리키는 방. 방이 지워졌으면 갈 곳이 없다. */
function toRoomPath(notification: AppNotification): string | null {
  return notification.roomId === null ? null : `/chats/${notification.roomId}`;
}

function toPostPath(notification: AppNotification): string | null {
  return notification.postId === null ? null : `/posts/${notification.postId}`;
}

/**
 * 알림 한 건을 화면에 그릴 문구와 이동 경로로 바꾼다.
 *
 * 순수 함수인 이유는 테스트만이 아니다. 알림은 종류마다 문장이 다르고 갈 곳도 다른데,
 * 그 분기를 컴포넌트 안에 두면 "어떤 알림이 어디로 가는가"를 확인하려고 화면을 그려야 한다.
 * payload를 푸는 일은 서버(0015)가 하고, 그것을 사람의 말로 바꾸는 일은 여기서 한다.
 *
 * `viewerId`를 받는 이유는 후기 하나 때문이다 — 받은 후기는 **내 프로필**에 붙으므로
 * 알림 행만 봐서는 갈 곳을 알 수 없다.
 *
 * `comment`·`like`도 이제 실제로 온다(0018). 트리거가 생기기 전에 미리 다뤄 둔 갈래라
 * 문장은 그대로 두고 아무것도 고치지 않았다 — 서버가 `preview`·`postTitle`을 채워 주는 순간
 * 그대로 굴러갔다.
 */
export function toNotificationView(
  notification: AppNotification,
  viewerId: string,
): NotificationView {
  const actor = toActorName(notification);

  switch (notification.type) {
    case 'chat':
      return {
        title: `${actor}님이 메시지를 보냈어요`,
        body: notification.preview,
        to: toRoomPath(notification),
      };

    case 'price_offer':
      return {
        title:
          notification.offerAmount === null
            ? `${actor}님이 가격을 제안했어요`
            : `${actor}님이 ${formatPrice(notification.offerAmount)}을 제안했어요`,
        // 금액이 제목에 있으므로 아래는 "무엇에 대한 제안인가"를 맡는다.
        body: notification.postTitle,
        to: toRoomPath(notification),
      };

    case 'review':
      return {
        title: `${actor}님이 거래후기를 남겼어요`,
        // 한 줄 후기는 선택이라 없을 수 있다. 그때는 어떤 거래였는지라도 보인다.
        body: notification.preview ?? notification.postTitle,
        // 받은 후기는 내 프로필에 쌓인다. 후기 한 건만 여는 화면은 없다.
        to: `/users/${viewerId}`,
      };

    case 'comment':
      return {
        title: `${actor}님이 댓글을 남겼어요`,
        body: notification.preview ?? notification.postTitle,
        to: toPostPath(notification),
      };

    case 'like':
      return {
        title: `${actor}님이 관심을 표시했어요`,
        body: notification.postTitle,
        to: toPostPath(notification),
      };
  }
}
