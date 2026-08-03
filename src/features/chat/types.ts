import type { PostStatus } from '../post/types';

/** 0001의 message_type enum과 같은 값이다. price_offer는 아직 화면이 없다. */
export type MessageType = 'text' | 'image' | 'price_offer';

/** 0001의 offer_status enum과 같은 값이다. */
export type OfferStatus = 'pending' | 'accepted' | 'rejected';

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
