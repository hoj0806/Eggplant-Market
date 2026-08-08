import type { PostStatus } from '../post/types';

/** 0001의 message_type enum과 같은 값이다. */
export type MessageType = 'text' | 'image' | 'price_offer';

/** 0001의 offer_status enum과 같은 값이다(`cancelled`는 0026이 더했다). */
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

/**
 * **받은 쪽**이 할 수 있는 답.
 *
 * `cancelled`가 여기 없는 것이 핵심이다 — 그것은 **보낸 쪽**이 자기 제안을 무르는 값이라,
 * 남의 제안을 대신 취소하는 길은 없다(0027의 트리거도 같은 선을 긋는다).
 * `pending`으로 되돌리는 길도 없다. 한 번 답한 제안은 그 자리에서 끝나고,
 * 마음이 바뀌면 새 제안을 주고받는다.
 */
export type OfferResponse = Exclude<OfferStatus, 'pending' | 'cancelled'>;

/** 채팅 목록 한 줄. 0008의 fetch_chat_rooms가 이 모양 그대로 돌려준다. */
export type ChatRoomSummary = {
  id: number;
  postId: number;
  postTitle: string;
  postThumbnailUrl: string | null;
  postStatus: PostStatus;
  postPrice: number;
  /** 이 방의 게시물 판매자. 내가 판매자인지 판단하는 기준이다. */
  sellerId: string;
  /** 내가 구매자면 판매자, 내가 판매자면 구매자. */
  partner: ChatPartner;
  lastMessage: string | null;
  lastMessageAt: string | null;
  /** 내가 아직 읽지 않은 메시지 수. */
  unreadCount: number;
};

export type ChatPartner = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
};

/** 예약자·구매자를 고르는 후보 한 명. */
export type PostChatPartner = ChatPartner & {
  roomId: number;
  lastMessageAt: string | null;
};

export type ChatMessage = {
  id: number;
  roomId: number;
  senderId: string;
  type: MessageType;
  /**
   * text면 대화 내용, image면 **스토리지 경로**다.
   * chat-images는 비공개 버킷이라 공개 URL이 없어 볼 때마다 서명 URL을 만든다.
   */
  content: string | null;
  offerAmount: number | null;
  offerStatus: OfferStatus | null;
  /** 상대가 읽은 시각. 내가 보낸 메시지의 "안읽음" 표시 기준이다. */
  readAt: string | null;
  /**
   * 보낸 사람이 지운 시각. 값이 있으면 `content`는 비어 있다 —
   * 행은 남고 내용만 사라진다(0029). 되돌아오는 값이 아니다.
   */
  deletedAt: string | null;
  createdAt: string;
};

export type SendMessageInput = {
  roomId: number;
  senderId: string;
  text: string;
};

export type SendImageMessageInput = {
  roomId: number;
  senderId: string;
  files: File[];
};

/** 가격 제안 한 건. content는 비우고 금액만 싣는다 — 문구는 화면이 만든다. */
export type SendPriceOfferInput = {
  roomId: number;
  senderId: string;
  amount: number;
};

export type RespondToOfferInput = {
  messageId: number;
  status: OfferResponse;
};
