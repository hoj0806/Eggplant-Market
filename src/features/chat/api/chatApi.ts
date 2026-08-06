import { supabase } from '../../../shared/lib/supabaseClient';
import { uniqueChannelTopic } from '../../../shared/utils/uniqueChannelTopic';
import type { PostStatus } from '../../post/types';
import type {
  ChatMessage,
  ChatRoomSummary,
  MessageType,
  OfferStatus,
  PostChatPartner,
  RespondToOfferInput,
  SendImageMessageInput,
  SendMessageInput,
  SendPriceOfferInput,
} from '../types';

const CHAT_IMAGE_BUCKET = 'chat-images';

// 한 줄 리터럴이어야 한다. 문자열을 +로 이으면 리터럴 타입을 잃어
// supabase-js가 select 결과를 GenericStringError로 추론한다.
const MESSAGE_COLUMNS =
  'id, room_id, sender_id, type, content, offer_amount, offer_status, read_at, created_at';

const DEFAULT_IMAGE_EXTENSION = 'jpg';
const SAFE_EXTENSION_PATTERN = /^[a-zA-Z0-9]{1,5}$/;

/** 메시지 한 페이지 크기. 최신 쪽부터 이만큼 읽고 위로 거슬러 올라간다. */
export const CHAT_MESSAGE_PAGE_SIZE = 30;

/**
 * 서명 URL 유효 시간. 화면에 붙어 있는 동안 끊기지 않을 만큼 길되,
 * 새어 나가도 오래 쓰이지 않을 만큼 짧게 둔다.
 */
export const CHAT_IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 60;

type ChatRoomRow = {
  id: number;
  post_id: number;
  post_title: string;
  post_thumbnail_url: string | null;
  post_status: PostStatus;
  post_price: number;
  seller_id: string;
  partner_id: string;
  partner_nickname: string;
  partner_avatar_url: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
};

type MessageRow = {
  id: number;
  room_id: number;
  sender_id: string;
  type: MessageType;
  content: string | null;
  offer_amount: number | null;
  offer_status: OfferStatus | null;
  read_at: string | null;
  created_at: string;
};

type PostChatPartnerRow = {
  room_id: number;
  buyer_id: string;
  nickname: string;
  avatar_url: string | null;
  last_message_at: string | null;
};

function toChatRoomSummary(row: ChatRoomRow): ChatRoomSummary {
  return {
    id: row.id,
    postId: row.post_id,
    postTitle: row.post_title,
    postThumbnailUrl: row.post_thumbnail_url,
    postStatus: row.post_status,
    postPrice: row.post_price,
    sellerId: row.seller_id,
    partner: {
      id: row.partner_id,
      nickname: row.partner_nickname,
      avatarUrl: row.partner_avatar_url,
    },
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at,
    unreadCount: row.unread_count,
  };
}

/** Realtime이 주는 payload도 같은 모양이라 이 변환을 그대로 쓴다. */
export function toChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    roomId: row.room_id,
    senderId: row.sender_id,
    type: row.type,
    content: row.content,
    offerAmount: row.offer_amount,
    offerStatus: row.offer_status,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

function toPostChatPartner(row: PostChatPartnerRow): PostChatPartner {
  return {
    roomId: row.room_id,
    id: row.buyer_id,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    lastMessageAt: row.last_message_at,
  };
}

function toFileExtension(file: File): string {
  const candidate = file.name.split('.').pop();
  if (candidate !== undefined && SAFE_EXTENSION_PATTERN.test(candidate)) {
    return candidate.toLowerCase();
  }
  return DEFAULT_IMAGE_EXTENSION;
}

/**
 * 채팅방을 연다. 이미 있으면 그 방, 없으면 만들어서 그 방이다.
 *
 * 판매자가 누구인지는 서버가 posts에서 직접 읽는다(0008의 open_chat_room).
 * 자기 게시물인지도 서버가 판단한다 — 화면에서 버튼을 숨기는 것과 별개로 규칙의 주인은 서버다.
 */
export async function openChatRoom(postId: number): Promise<number> {
  const { data, error } = await supabase.rpc('open_chat_room', { p_post_id: postId });

  if (error !== null) {
    throw error;
  }

  return data as number;
}

export async function fetchChatRooms(): Promise<ChatRoomSummary[]> {
  const { data, error } = await supabase.rpc('fetch_chat_rooms');

  if (error !== null) {
    throw error;
  }

  return (data as ChatRoomRow[]).map(toChatRoomSummary);
}

export async function fetchChatRoom(roomId: number): Promise<ChatRoomSummary> {
  const { data, error } = await supabase.rpc('fetch_chat_room', { p_room_id: roomId });

  if (error !== null) {
    throw error;
  }

  const rows = data as ChatRoomRow[];
  if (rows.length === 0) {
    throw new Error('채팅방을 찾을 수 없습니다.');
  }

  return toChatRoomSummary(rows[0]);
}

/**
 * 메시지 한 페이지.
 *
 * 최신부터 내려 읽고 화면에서 뒤집는다. id는 identity라 단조 증가해서
 * 게시물 검색(bumped_at)과 달리 tie-breaker가 필요 없다.
 */
export async function fetchMessages(roomId: number, cursor: number | null): Promise<ChatMessage[]> {
  let query = supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('room_id', roomId)
    .order('id', { ascending: false })
    .limit(CHAT_MESSAGE_PAGE_SIZE);

  if (cursor !== null) {
    query = query.lt('id', cursor);
  }

  const { data, error } = await query;

  if (error !== null) {
    throw error;
  }

  return (data as MessageRow[]).map(toChatMessage);
}

export async function sendTextMessage(input: SendMessageInput): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      room_id: input.roomId,
      sender_id: input.senderId,
      type: 'text',
      content: input.text.trim(),
    })
    .select(MESSAGE_COLUMNS)
    .single();

  if (error !== null) {
    throw error;
  }

  return toChatMessage(data as unknown as MessageRow);
}

/**
 * 사진을 올리고 메시지 행을 만든다.
 *
 * 경로는 `{room_id}/{user_id}/…`다. 첫 칸이 방이라 storage 정책이 "이 방 사람인가"를 볼 수 있고,
 * 둘째 칸이 올린 사람이라 "본인이 올린 것인가"를 볼 수 있다(0008).
 *
 * 스토리지는 트랜잭션에 묶이지 않으므로 메시지 insert가 실패하면 방금 올린 파일을 직접 지운다.
 * postApi.createPost와 같은 보상이다 — 지우지 않으면 아무도 못 보는 파일이 남는다.
 */
async function sendOneImageMessage(
  roomId: number,
  senderId: string,
  file: File,
  index: number,
): Promise<ChatMessage> {
  const path = `${roomId}/${senderId}/${Date.now()}-${index}.${toFileExtension(file)}`;

  const uploadResult = await supabase.storage
    .from(CHAT_IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadResult.error !== null) {
    throw uploadResult.error;
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({ room_id: roomId, sender_id: senderId, type: 'image', content: path })
    .select(MESSAGE_COLUMNS)
    .single();

  if (error !== null) {
    // 뒷정리다. 여기서 또 실패해도 원래 오류를 덮지 않도록 결과를 보지 않는다.
    await supabase.storage.from(CHAT_IMAGE_BUCKET).remove([path]);
    throw error;
  }

  return toChatMessage(data as unknown as MessageRow);
}

/** 여러 장을 고르면 사진 한 장이 메시지 한 건이다. 보낸 순서를 지키려고 순차로 올린다. */
export async function sendImageMessages(input: SendImageMessageInput): Promise<ChatMessage[]> {
  const sent: ChatMessage[] = [];

  for (const [index, file] of input.files.entries()) {
    sent.push(await sendOneImageMessage(input.roomId, input.senderId, file, index));
  }

  return sent;
}

/**
 * 가격 제안을 보낸다.
 *
 * content는 비운다 — 금액은 offer_amount 칸에 있고, 화면 문구는 볼 때 만든다.
 * 채팅 목록에 뜰 요약(`35000원 제안`)은 0008의 on_message_insert가 만들어 준다.
 */
export async function sendPriceOfferMessage(input: SendPriceOfferInput): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      room_id: input.roomId,
      sender_id: input.senderId,
      type: 'price_offer',
      offer_amount: input.amount,
      offer_status: 'pending',
    })
    .select(MESSAGE_COLUMNS)
    .single();

  if (error !== null) {
    throw error;
  }

  return toChatMessage(data as unknown as MessageRow);
}

/**
 * 제안의 상태를 옮긴다. 받은 쪽의 수락·거절과 보낸 쪽의 취소가 같은 모양이다.
 *
 * 누가 어디로 옮길 수 있는지는 서버가 정한다(0027) — 정책이 "누가"를, 트리거가
 * "pending에서만, 보낸 쪽은 cancelled로, 받은 쪽은 accepted·rejected로"를 지킨다.
 * 그래서 여기서는 평범한 update로 충분하고 RPC가 필요 없다.
 *
 * `offer_status = 'pending'` 조건이 핵심이다. 이미 답이 끝난 제안을 두 번째 요청이 덮어쓰지
 * 못하게 한다 — 상대 화면이 조금 낡았거나 버튼을 두 번 눌렀을 때 마지막 클릭이 이기는 일이 없다.
 * 조건에 걸려 한 행도 안 바뀌면 update는 오류가 아니라 빈 결과이므로 여기서 뜻을 붙여 준다.
 * (서버도 같은 것을 막지만 그쪽은 예외를 던진다. 여기서 먼저 걸러야 문구를 고를 수 있다.)
 */
async function moveOfferStatus(
  messageId: number,
  status: OfferStatus,
  conflictMessage: string,
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('messages')
    .update({ offer_status: status })
    .eq('id', messageId)
    .eq('type', 'price_offer')
    .eq('offer_status', 'pending')
    .select(MESSAGE_COLUMNS)
    .maybeSingle();

  if (error !== null) {
    throw error;
  }
  if (data === null) {
    throw new Error(conflictMessage);
  }

  return toChatMessage(data as unknown as MessageRow);
}

/** 받은 제안에 답한다. */
export async function respondToOffer(input: RespondToOfferInput): Promise<ChatMessage> {
  return moveOfferStatus(input.messageId, input.status, '이미 답한 제안입니다.');
}

/**
 * 보낸 제안을 무른다.
 *
 * 문구가 다른 이유는 **부딪히는 상황이 다르기 때문**이다. 취소가 실패하는 흔한 경우는
 * 내가 무르려는 사이에 상대가 답해 버린 것이라, "이미 답한 제안입니다"가 아니라
 * 상대가 먼저 움직였다는 것을 말해 줘야 다음에 무엇을 할지 알 수 있다.
 */
export async function cancelOffer(messageId: number): Promise<ChatMessage> {
  return moveOfferStatus(messageId, 'cancelled', '상대가 먼저 답해 취소할 수 없습니다.');
}

/**
 * 이 방에서 내가 받은 메시지를 모두 읽음으로 표시한다.
 *
 * 0008의 messages_update 정책이 "발신자가 아닌 방 참여자"만 허용하고,
 * guard_message_update 트리거가 read_at 말고는 못 바꾸게 막는다.
 * 그래서 평범한 update로 충분하고 RPC가 필요 없다.
 */
export async function markRoomRead(roomId: number, viewerId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('room_id', roomId)
    .neq('sender_id', viewerId)
    .is('read_at', null);

  if (error !== null) {
    throw error;
  }
}

/** 내 게시물에 채팅을 건 이웃들. 예약자·구매자를 고르는 후보다. */
export async function fetchPostChatPartners(postId: number): Promise<PostChatPartner[]> {
  const { data, error } = await supabase.rpc('fetch_post_chat_partners', { p_post_id: postId });

  if (error !== null) {
    throw error;
  }

  return (data as PostChatPartnerRow[]).map(toPostChatPartner);
}

/**
 * 이 방의 메시지 변화를 구독한다.
 *
 * supabase를 아는 자리를 api/ 한 곳에 가둬 두는 규칙이 여기에도 적용된다.
 * 훅이 직접 채널을 열면 화면 테스트가 import.meta에 닿아 로드 단계에서 죽는다(troble.md #5).
 *
 * insert  : 새 메시지 — 캐시 맨 앞에 붙인다
 * update  : read_at이 채워진 것 — 내 말풍선의 "안읽음"이 사라진다
 * ready   : 구독이 자리 잡은 시점 — 그 전에 오간 메시지를 놓쳤을 수 있어 한 번 다시 읽는다
 *
 * `ready`가 필요한 이유: 첫 조회와 구독이 자리 잡는 사이에 도착한 메시지는 어느 쪽에도 안 잡힌다.
 * 실제로 방을 만들자마자 보낸 첫 메시지가 이 틈으로 새는 것을 확인했다.
 *
 * 돌려주는 함수를 부르면 구독이 끊긴다.
 */
export function subscribeToRoomMessages(
  roomId: number,
  onInsert: (message: ChatMessage) => void,
  onUpdate: (message: ChatMessage) => void,
  onReady: () => void,
): () => void {
  const channel = supabase
    .channel(uniqueChannelTopic(`chat-room-${roomId}`))
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
      function handleInsert(payload): void {
        onInsert(toChatMessage(payload.new as MessageRow));
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
      function handleUpdate(payload): void {
        onUpdate(toChatMessage(payload.new as MessageRow));
      },
    )
    .subscribe(function handleStatus(status): void {
      if (status === 'SUBSCRIBED') {
        onReady();
      }
    });

  return function unsubscribe(): void {
    void supabase.removeChannel(channel);
  };
}

/**
 * 내 채팅방 요약이 바뀌면 알려 준다(마지막 메시지·시각).
 *
 * 필터를 걸 수 없다 — "내가 참여한 방"은 컬럼 하나로 표현되지 않는다.
 * 대신 chat_rooms_select 정책이 남의 방을 흘려보내지 않는다. Realtime도 RLS를 그대로 탄다.
 *
 * 이 구독은 두 곳이 동시에 건다 — 늘 떠 있는 탭바 배지(useUnreadChatCount)와 채팅 목록 화면이다.
 * 이름이 고정이면 둘째가 첫째의 채널을 그대로 받아 죽으므로 번호를 붙인다(uniqueChannelTopic).
 */
export function subscribeToMyChatRooms(onChange: () => void): () => void {
  const channel = supabase
    .channel(uniqueChannelTopic('chat-rooms'))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chat_rooms' },
      function handleChange(): void {
        onChange();
      },
    )
    .subscribe();

  return function unsubscribe(): void {
    void supabase.removeChannel(channel);
  };
}

/** 비공개 버킷이라 볼 때마다 서명 URL을 만든다. 만료되기 전에 쿼리가 다시 만든다. */
export async function createChatImageSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CHAT_IMAGE_BUCKET)
    .createSignedUrl(path, CHAT_IMAGE_SIGNED_URL_TTL_SECONDS);

  if (error !== null) {
    throw error;
  }

  return data.signedUrl;
}
