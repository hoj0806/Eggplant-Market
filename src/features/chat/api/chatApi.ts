import { supabase } from '../../../shared/lib/supabaseClient';
import { downscaleImage } from '../../../shared/utils/downscaleImage';
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
  'id, room_id, sender_id, type, content, offer_amount, offer_status, read_at, deleted_at, created_at';

const DEFAULT_IMAGE_EXTENSION = 'jpg';
const SAFE_EXTENSION_PATTERN = /^[a-zA-Z0-9]{1,5}$/;

/** storage.list의 기본 상한이 100이다. 그 이상은 offset으로 넘긴다(delete-account와 같다). */
const STORAGE_LIST_PAGE_SIZE = 100;

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
  deleted_at: string | null;
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
    deletedAt: row.deleted_at,
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
  // 채팅 사진도 올리기 전에 줄인다. 방을 다시 열 때마다 내려받는 것이라
  // 한 번 줄이면 그 대화가 이어지는 내내 아낀다.
  const prepared = await downscaleImage(file);
  const path = `${roomId}/${senderId}/${Date.now()}-${index}.${toFileExtension(prepared)}`;

  const uploadResult = await supabase.storage
    .from(CHAT_IMAGE_BUCKET)
    .upload(path, prepared, { contentType: prepared.type, upsert: true });

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
 * 보낸 메시지를 지운다.
 *
 * 행을 지우지 않고 `deleted_at`을 찍는 update다(0029). 말이 오갔다는 사실은 남고 내용만
 * 사라진다 — 그래서 상대 화면에는 DELETE가 아니라 **UPDATE**로 도착하고,
 * 실시간 처리도 읽음 표시·제안 답변과 같은 길을 그대로 탄다.
 *
 * `content`를 여기서 비우지 않는다. 서버가 비운다 — 클라이언트에 맡기면 "지웠는데 내용이
 * 남은 행"이 생길 수 있고, 그 행은 밖에서 보면 지워진 것처럼 보여 아무도 눈치채지 못한다.
 * `deleted_at`에 보내는 값도 서버가 `now()`로 덮으므로 자리를 채우는 뜻뿐이다.
 *
 * `.is('deleted_at', null)`이 핵심이다. 두 번 눌렀을 때 두 번째 요청이 서버 예외
 * ("이미 지운 메시지입니다")가 아니라 빈 결과로 돌아오게 해, 여기서 문구를 고를 수 있다.
 * (정책도 같은 것을 막는다. 이쪽은 먼저 거르는 자리다 — respondToOffer와 같은 형태다.)
 */
export async function deleteMessage(messageId: number): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId)
    .is('deleted_at', null)
    .select(MESSAGE_COLUMNS)
    .maybeSingle();

  if (error !== null) {
    throw error;
  }
  if (data === null) {
    throw new Error('이미 지운 메시지입니다.');
  }

  return toChatMessage(data as unknown as MessageRow);
}

/**
 * 지운 사진 파일을 스토리지에서 걷어낸다.
 *
 * 메시지 행에서 경로가 사라지면(서버가 `content`를 비운다) 아무도 부를 수 없는 파일이
 * 남는다. `chat_images_delete` 정책이 **올린 사람 본인**에게 열려 있어 여기서 지울 수 있다(0008).
 *
 * 실패해도 던지지 않는다. 메시지는 이미 지워졌고 사용자가 할 수 있는 일이 없다 —
 * 여기서 오류를 올리면 "지워졌는데 실패했다고 뜨는" 화면이 된다.
 * createPost·sendOneImageMessage의 보상 삭제와 같은 취급이다.
 */
export async function removeChatImage(path: string): Promise<void> {
  await supabase.storage.from(CHAT_IMAGE_BUCKET).remove([path]);
}

/**
 * 이 방을 내 채팅 목록에서 치운다.
 *
 * 대화도 방도 지우지 않고 상대 화면은 그대로다(0030). 나간 뒤에 메시지가 오면 목록에
 * 다시 나타난다. 내가 구매자인지 판매자인지는 서버가 방을 읽어 판단하므로 넘기지 않는다 —
 * open_chat_room이 seller_id를 받지 않는 것과 같은 이유다.
 *
 * **내가 마지막 한 사람이면 참이 온다**(0031). 그때는 사진을 지우고 `purgeChatRoom`을
 * 부른다 — 그 순서인 이유는 방이 사라지면 사진 목록조차 못 읽기 때문이다.
 */
export async function leaveChatRoom(roomId: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('leave_chat_room', { p_room_id: roomId });

  if (error !== null) {
    throw error;
  }

  return data === true;
}

/**
 * 양쪽이 다 나간 방을 완전히 지운다.
 *
 * 메시지는 cascade로, 알림은 서버가 함께 지운다(0031). 조건이 그사이 깨졌으면
 * 거짓만 돌아온다 — 상대가 주소로 들어와 말을 걸었을 수 있고, 그건 오류가 아니다.
 */
export async function purgeChatRoom(roomId: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('purge_chat_room', { p_room_id: roomId });

  if (error !== null) {
    throw error;
  }

  return data === true;
}

/**
 * 방 폴더에 든 사진의 경로를 모은다.
 *
 * **방이 살아 있는 동안에만 부를 수 있다.** `chat_images_select`가 방 행을 요구하므로
 * (0008), 방이 사라진 뒤에는 목록조차 비어 돌아온다. 지우는 쪽과 나눠 둔 것이 그래서다 —
 * 게시물 삭제는 "모으기 → 글 삭제(방도 함께 사라진다) → 치우기" 순서로 밟아야 한다.
 *
 * 경로가 `{room_id}/{user_id}/…`라 사람마다 한 번씩 훑는다(0008). 방 번호만으로 한 번에
 * 훑으면 첫 겹이 폴더라 파일이 안 잡힌다 — 참여자가 둘뿐이라 아는 값을 그냥 쓴다.
 */
export async function listChatRoomImagePaths(
  roomId: number,
  userIds: ReadonlyArray<string>,
): Promise<string[]> {
  const paths: string[] = [];

  for (const userId of userIds) {
    const prefix = `${roomId}/${userId}`;
    let offset = 0;

    for (;;) {
      const { data, error } = await supabase.storage
        .from(CHAT_IMAGE_BUCKET)
        .list(prefix, { limit: STORAGE_LIST_PAGE_SIZE, offset });

      if (error !== null || data === null) {
        break;
      }

      for (const entry of data) {
        // 폴더는 id가 null로 온다. 이 아래로는 한 겹 더 들어가지 않는다.
        if (entry.id !== null) {
          paths.push(`${prefix}/${entry.name}`);
        }
      }

      if (data.length < STORAGE_LIST_PAGE_SIZE) {
        break;
      }
      offset += STORAGE_LIST_PAGE_SIZE;
    }
  }

  return paths;
}

/**
 * 모아 둔 채팅 사진을 스토리지에서 치운다.
 *
 * `storage.objects` 행을 지워도 실제 파일은 남으므로 **DB가 대신해 줄 수 없는 일**이다.
 * 회원탈퇴(`delete-account` Edge Function)가 같은 이유로 같은 모양의 코드를 갖고 있다.
 *
 * 어디까지 지워지는지는 `chat_images_delete`가 정한다 — 내 파일(0008) · 양쪽이 다 나간 방
 * (0031) · **방이 이미 사라진 폴더**(0032) 셋이다. 권한이 없는 파일은 조용히 남는다.
 */
export async function removeChatImages(paths: ReadonlyArray<string>): Promise<void> {
  if (paths.length === 0) {
    return;
  }

  await supabase.storage.from(CHAT_IMAGE_BUCKET).remove([...paths]);
}

/** 방 하나를 통째로 비운다. 방이 아직 살아 있을 때 쓴다(0031의 나가기 뒷정리). */
export async function removeChatRoomImages(
  roomId: number,
  userIds: ReadonlyArray<string>,
): Promise<void> {
  await removeChatImages(await listChatRoomImagePaths(roomId, userIds));
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
