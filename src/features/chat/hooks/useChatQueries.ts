import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  CHAT_IMAGE_SIGNED_URL_TTL_SECONDS,
  createChatImageSignedUrl,
  fetchChatRoom,
  fetchChatRooms,
  fetchMessages,
  fetchPostChatPartners,
} from '../api/chatApi';
import { toNextMessageCursor } from '../utils/chatCursor';
import type { ChatMessage, ChatRoomSummary, PostChatPartner } from '../types';

const CHAT_ROOMS_STALE_TIME_MS = 10_000;
const CHAT_MESSAGES_STALE_TIME_MS = 10_000;

/**
 * 서명 URL은 만료보다 넉넉히 앞서 다시 만든다.
 * 만료 직전 값을 캐시가 붙들고 있으면 사진이 갑자기 깨진 아이콘으로 바뀐다.
 */
const CHAT_IMAGE_STALE_TIME_MS = (CHAT_IMAGE_SIGNED_URL_TTL_SECONDS - 600) * 1000;

export type ChatMessagesQueryResult = UseInfiniteQueryResult<InfiniteData<ChatMessage[]>, Error>;

export function chatRoomsQueryKey(): ReadonlyArray<string> {
  return ['chatRooms'];
}

export function chatRoomQueryKey(roomId: number): ReadonlyArray<string | number> {
  return ['chatRoom', roomId];
}

export function chatMessagesQueryKey(roomId: number): ReadonlyArray<string | number> {
  return ['messages', roomId];
}

export function postChatPartnersQueryKey(postId: number): ReadonlyArray<string | number> {
  return ['chatPartners', postId];
}

export function chatImageQueryKey(path: string): ReadonlyArray<string> {
  return ['chatImage', path];
}

/**
 * 내 채팅방 목록.
 *
 * 비로그인은 방이 없으므로 아예 요청하지 않는다 — RLS가 빈 목록을 주긴 하지만
 * 홈 헤더에서도 부르는 쿼리라 게스트에게 헛요청을 보내지 않는 편이 낫다.
 */
export function useChatRoomsQuery(viewerId: string | null): UseQueryResult<ChatRoomSummary[], Error> {
  return useQuery<ChatRoomSummary[], Error>({
    queryKey: chatRoomsQueryKey(),
    queryFn: fetchChatRooms,
    enabled: viewerId !== null,
    staleTime: CHAT_ROOMS_STALE_TIME_MS,
  });
}

export function useChatRoomQuery(roomId: number | null): UseQueryResult<ChatRoomSummary, Error> {
  return useQuery<ChatRoomSummary, Error>({
    queryKey: chatRoomQueryKey(roomId ?? 0),
    queryFn: function loadRoom(): Promise<ChatRoomSummary> {
      if (roomId === null) {
        return Promise.reject(new Error('채팅방 번호가 올바르지 않습니다.'));
      }
      return fetchChatRoom(roomId);
    },
    enabled: roomId !== null,
    staleTime: CHAT_ROOMS_STALE_TIME_MS,
  });
}

/**
 * 대화 내용. 최신 한 페이지를 먼저 받고 위로 거슬러 올라간다.
 *
 * 게시물 검색과 달리 커서가 id 하나다. identity 컬럼이라 같은 값이 두 번 나오지 않아
 * (bumped_at, id) 같은 tie-breaker가 필요 없다.
 */
export function useChatMessagesQuery(roomId: number | null): ChatMessagesQueryResult {
  return useInfiniteQuery<ChatMessage[], Error, InfiniteData<ChatMessage[]>>({
    queryKey: chatMessagesQueryKey(roomId ?? 0),
    queryFn: function loadPage({ pageParam }): Promise<ChatMessage[]> {
      if (roomId === null) {
        return Promise.reject(new Error('채팅방 번호가 올바르지 않습니다.'));
      }
      return fetchMessages(roomId, (pageParam as number | null) ?? null);
    },
    initialPageParam: null,
    getNextPageParam: toNextMessageCursor,
    enabled: roomId !== null,
    staleTime: CHAT_MESSAGES_STALE_TIME_MS,
  });
}

/** 예약자·구매자 후보. 판매자 본인이 열 때만 채워진다(0008의 fetch_post_chat_partners). */
export function usePostChatPartnersQuery(
  postId: number | null,
): UseQueryResult<PostChatPartner[], Error> {
  return useQuery<PostChatPartner[], Error>({
    queryKey: postChatPartnersQueryKey(postId ?? 0),
    queryFn: function loadPartners(): Promise<PostChatPartner[]> {
      if (postId === null) {
        return Promise.reject(new Error('게시물 번호가 올바르지 않습니다.'));
      }
      return fetchPostChatPartners(postId);
    },
    enabled: postId !== null,
  });
}

/** 채팅 사진은 비공개 버킷이라 경로만 저장돼 있다. 볼 때 서명 URL로 바꾼다. */
export function useChatImageUrlQuery(path: string | null): UseQueryResult<string, Error> {
  return useQuery<string, Error>({
    queryKey: chatImageQueryKey(path ?? ''),
    queryFn: function loadUrl(): Promise<string> {
      if (path === null) {
        return Promise.reject(new Error('사진 경로가 없습니다.'));
      }
      return createChatImageSignedUrl(path);
    },
    enabled: path !== null,
    staleTime: CHAT_IMAGE_STALE_TIME_MS,
  });
}
