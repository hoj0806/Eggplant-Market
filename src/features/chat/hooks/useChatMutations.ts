import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type UseMutationResult,
} from '@tanstack/react-query';
import { chatMessagesQueryKey, chatRoomQueryKey, chatRoomsQueryKey } from './useChatQueries';
import {
  openChatRoom,
  respondToOffer,
  sendImageMessages,
  sendPriceOfferMessage,
  sendTextMessage,
} from '../api/chatApi';
import { withInsertedMessage, withUpdatedMessage } from '../utils/chatMessageCache';
import type { ChatMessage, OfferResponse } from '../types';

/** useChatMessagesQuery가 캐시에 넣는 모양. setQueryData에 그대로 넘긴다. */
type ChatMessageCache = InfiniteData<ChatMessage[]>;

export type SendTextVariables = {
  text: string;
};

export type SendImagesVariables = {
  files: File[];
};

export type SendPriceOfferVariables = {
  amount: number;
};

export type RespondToOfferVariables = {
  messageId: number;
  status: OfferResponse;
};

/**
 * "채팅하기". 방이 있으면 그 방, 없으면 새 방의 id를 돌려준다.
 * 어디로 이동할지는 화면이 정한다 — 상세에서 눌렀는지 목록에서 눌렀는지에 따라 다르다.
 */
export function useOpenChatRoomMutation(): UseMutationResult<number, Error, number> {
  const queryClient = useQueryClient();

  return useMutation<number, Error, number>({
    mutationFn: openChatRoom,
    onSuccess: function refreshRooms(): void {
      queryClient.invalidateQueries({ queryKey: chatRoomsQueryKey() });
    },
  });
}

/**
 * 메시지 전송.
 *
 * 가짜 메시지를 먼저 그려 넣지 않는다. insert 응답에 서버가 만든 행이 그대로 실려 오므로
 * 그것을 캐시에 얹는다 — 임시 id를 만들었다가 진짜 id로 갈아 끼우는 단계가 없어진다.
 * 곧이어 Realtime 에코가 같은 행을 한 번 더 들고 오는데, withInsertedMessage가 id로 거른다.
 */
export function useSendTextMessageMutation(
  roomId: number,
  senderId: string | null,
): UseMutationResult<ChatMessage, Error, SendTextVariables> {
  const queryClient = useQueryClient();

  return useMutation<ChatMessage, Error, SendTextVariables>({
    mutationFn: function send(variables: SendTextVariables): Promise<ChatMessage> {
      if (senderId === null) {
        return Promise.reject(new Error('로그인이 필요합니다.'));
      }
      return sendTextMessage({ roomId, senderId, text: variables.text });
    },
    onSuccess: function appendToCache(message: ChatMessage): void {
      queryClient.setQueryData<ChatMessageCache>(chatMessagesQueryKey(roomId), function add(current) {
        return withInsertedMessage(current, message);
      });
      queryClient.invalidateQueries({ queryKey: chatRoomsQueryKey() });
      queryClient.invalidateQueries({ queryKey: chatRoomQueryKey(roomId) });
    },
  });
}

/** 사진 전송. 한 장이 메시지 한 건이라 여러 건이 한 번에 돌아온다. */
export function useSendImageMessagesMutation(
  roomId: number,
  senderId: string | null,
): UseMutationResult<ChatMessage[], Error, SendImagesVariables> {
  const queryClient = useQueryClient();

  return useMutation<ChatMessage[], Error, SendImagesVariables>({
    mutationFn: function send(variables: SendImagesVariables): Promise<ChatMessage[]> {
      if (senderId === null) {
        return Promise.reject(new Error('로그인이 필요합니다.'));
      }
      return sendImageMessages({ roomId, senderId, files: variables.files });
    },
    onSuccess: function appendToCache(messages: ChatMessage[]): void {
      queryClient.setQueryData<ChatMessageCache>(chatMessagesQueryKey(roomId), function add(current) {
        return messages.reduce(function insertOne(data, message) {
          return withInsertedMessage(data, message);
        }, current);
      });
      queryClient.invalidateQueries({ queryKey: chatRoomsQueryKey() });
      queryClient.invalidateQueries({ queryKey: chatRoomQueryKey(roomId) });
    },
  });
}

/** 가격 제안 전송. 메시지 한 건이라 글·사진과 캐시를 다루는 방식이 같다. */
export function useSendPriceOfferMutation(
  roomId: number,
  senderId: string | null,
): UseMutationResult<ChatMessage, Error, SendPriceOfferVariables> {
  const queryClient = useQueryClient();

  return useMutation<ChatMessage, Error, SendPriceOfferVariables>({
    mutationFn: function send(variables: SendPriceOfferVariables): Promise<ChatMessage> {
      if (senderId === null) {
        return Promise.reject(new Error('로그인이 필요합니다.'));
      }
      return sendPriceOfferMessage({ roomId, senderId, amount: variables.amount });
    },
    onSuccess: function appendToCache(message: ChatMessage): void {
      queryClient.setQueryData<ChatMessageCache>(chatMessagesQueryKey(roomId), function add(current) {
        return withInsertedMessage(current, message);
      });
      queryClient.invalidateQueries({ queryKey: chatRoomsQueryKey() });
      queryClient.invalidateQueries({ queryKey: chatRoomQueryKey(roomId) });
    },
  });
}

/**
 * 제안 수락·거절.
 *
 * 메시지를 새로 만드는 것이 아니라 있던 행의 offer_status만 바꾸므로 캐시도 **갈아 끼운다.**
 * 채팅방 요약은 건드리지 않는다 — last_message를 고치는 트리거는 insert에만 붙어 있어서
 * 목록의 마지막 메시지도, 안 읽은 수도 답변으로는 변하지 않는다.
 *
 * 상대 화면은 Realtime UPDATE가 같은 자리를 갈아 끼워 따라온다(messages는 replica identity full).
 */
export function useRespondToOfferMutation(
  roomId: number,
): UseMutationResult<ChatMessage, Error, RespondToOfferVariables> {
  const queryClient = useQueryClient();

  return useMutation<ChatMessage, Error, RespondToOfferVariables>({
    mutationFn: function respond(variables: RespondToOfferVariables): Promise<ChatMessage> {
      return respondToOffer({ messageId: variables.messageId, status: variables.status });
    },
    onSuccess: function replaceInCache(message: ChatMessage): void {
      queryClient.setQueryData<ChatMessageCache>(
        chatMessagesQueryKey(roomId),
        function replace(current) {
          return withUpdatedMessage(current, message);
        },
      );
    },
  });
}

