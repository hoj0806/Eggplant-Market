/**
 * 알림 종류. 0001의 `notification_type` enum 그대로다.
 *
 * `comment`·`like`는 enum에만 있고 **이 값을 넣는 트리거가 아직 없다** — 댓글·찜 알림은
 * 기능 자체가 없어서다. 그래도 타입에 남겨 둔다. 나중에 트리거만 더하면 화면이 그대로
 * 받아 그리고, 빼 두면 그때 여기부터 다시 열어야 한다.
 */
export type NotificationType = 'comment' | 'like' | 'chat' | 'review' | 'price_offer';

/**
 * 알림 한 건. 0015의 `fetch_notifications`가 payload의 id를 풀어 준 뒤의 모양이다.
 *
 * 서버가 풀어 주는 이유는 성능이다 — 풀지 않으면 화면이 알림 한 줄마다 메시지·방·후기를
 * 따로 조회하게 된다. 그래서 여기 있는 값은 대부분 **종류에 따라 비어 있을 수 있다**
 * (후기 알림에 roomId가 없고, 채팅 알림에 offerAmount가 없다).
 */
export type AppNotification = {
  id: number;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  /** 알림을 일으킨 사람. 대상이 지워졌으면 null이다. */
  actorId: string | null;
  actorNickname: string | null;
  actorAvatarUrl: string | null;
  /** 채팅·가격제안이면 채워진다. 누르면 갈 방. */
  roomId: number | null;
  postId: number | null;
  postTitle: string | null;
  /** 메시지 내용 또는 후기 한 줄. 사진 메시지는 경로 대신 문구가 온다. */
  preview: string | null;
  offerAmount: number | null;
  /**
   * 이 후기가 **받은 사람의 첫 후기**였는가(0021). 후기 알림에서만 참이 될 수 있고
   * 나머지 넷은 언제나 false다 — 서버가 `coalesce(..., false)`로 세워 내려준다.
   *
   * 0021 이전에 쌓인 후기 알림에도 false가 온다. 표가 없던 시절의 줄이라
   * 지금까지와 똑같이 보인다.
   */
  isFirst: boolean;
};

/** 알림 목록의 다음 페이지 시작점. 같은 시각 알림을 가르려고 id까지 들고 간다. */
export type NotificationCursor = {
  createdAt: string;
  id: number;
};

/** 알림 한 줄을 화면에 그리기 위해 필요한 것 전부. notificationText가 만든다. */
export type NotificationView = {
  /** 굵게 뜨는 한 줄. "누가 무엇을 했다". */
  title: string;
  /** 그 아래 흐리게 뜨는 한 줄. 없으면 null. */
  body: string | null;
  /** 누르면 갈 곳. 갈 데가 없으면 null이고 그 줄은 누를 수 없다. */
  to: string | null;
};
