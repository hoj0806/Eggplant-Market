import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type UseMutationResult,
} from '@tanstack/react-query';
import { chatMessagesQueryKey, chatRoomQueryKey, chatRoomsQueryKey } from './useChatQueries';
import {
  cancelOffer,
  deleteMessage,
  leaveChatRoom,
  openChatRoom,
  purgeChatRoom,
  removeChatImage,
  removeChatRoomImages,
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

/** 취소는 갈 곳이 하나뿐이라 status를 받지 않는다. 무엇을 무를지만 정하면 된다. */
export type CancelOfferVariables = {
  messageId: number;
};

/**
 * 삭제도 무엇을 지울지만 정하면 된다.
 *
 * `imagePath`가 딸려 오는 것은 **서버가 `content`를 비우기 때문**이다(0029). 응답이 온
 * 뒤에는 경로를 알 방법이 없어, 지우기 전 캐시에 있던 값을 화면이 함께 넘긴다.
 * 글 메시지에는 없다.
 */
export type DeleteMessageVariables = {
  messageId: number;
  imagePath?: string;
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

/**
 * 보낸 제안 무르기.
 *
 * 캐시를 다루는 방식은 수락·거절과 똑같다 — 있던 행의 offer_status만 바뀌므로 갈아 끼운다.
 * 방 요약도 마찬가지로 건드리지 않는다(last_message 트리거는 insert에만 붙어 있다).
 *
 * 훅을 따로 두는 이유는 **버튼을 따로 잠가야 하기 때문**이다. 하나로 묶으면 상대가 수락을
 * 누르는 동안 내 취소 버튼도 함께 잠긴다 — 서로 다른 사람이 서로 다른 버튼을 누르는 자리다.
 */
export function useCancelOfferMutation(
  roomId: number,
): UseMutationResult<ChatMessage, Error, CancelOfferVariables> {
  const queryClient = useQueryClient();

  return useMutation<ChatMessage, Error, CancelOfferVariables>({
    mutationFn: function cancel(variables: CancelOfferVariables): Promise<ChatMessage> {
      return cancelOffer(variables.messageId);
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

/**
 * 보낸 메시지 지우기.
 *
 * 소프트 삭제라 캐시에서 **빼지 않고 갈아 끼운다** — 제안 취소와 같은 길이다. 목록에서
 * 빼려면 `withRemovedMessage` 같은 것이 새로 필요했을 텐데, 지운 말풍선은 자리에 남는다.
 * 상대 화면도 Realtime UPDATE가 같은 자리를 갈아 끼워 따라온다(0008의 replica identity full).
 *
 * 방 요약은 다시 받아 온다. 제안 답변과 다른 점이 여기다 — 마지막 메시지를 지우면
 * 0029의 트리거가 `chat_rooms.last_message`를 고치므로, 안 부르면 채팅 목록에 지운 문장이
 * 그대로 남는다.
 *
 * 사진 파일은 메시지가 지워진 **뒤에** 걷어낸다. 순서를 뒤집으면 메시지 update가 실패했을 때
 * 사진만 사라진 말풍선이 남는다. 파일 삭제가 실패해도 이 훅은 성공이다 — 아무도 부를 수 없는
 * 파일이 남을 뿐이고, 사용자가 할 수 있는 일이 없다.
 */
export function useDeleteMessageMutation(
  roomId: number,
): UseMutationResult<ChatMessage, Error, DeleteMessageVariables> {
  const queryClient = useQueryClient();

  return useMutation<ChatMessage, Error, DeleteMessageVariables>({
    mutationFn: async function remove(variables: DeleteMessageVariables): Promise<ChatMessage> {
      const message = await deleteMessage(variables.messageId);

      if (variables.imagePath !== undefined) {
        await removeChatImage(variables.imagePath);
      }

      return message;
    },
    onSuccess: function replaceInCache(message: ChatMessage): void {
      queryClient.setQueryData<ChatMessageCache>(
        chatMessagesQueryKey(roomId),
        function replace(current) {
          return withUpdatedMessage(current, message);
        },
      );
      queryClient.invalidateQueries({ queryKey: chatRoomsQueryKey() });
      queryClient.invalidateQueries({ queryKey: chatRoomQueryKey(roomId) });
    },
  });
}

/**
 * 채팅방 나가기 — 그리고 양쪽이 다 나갔으면 완전 삭제.
 *
 * 세 걸음이 한 동작이다(0031).
 *
 *   ① leave_chat_room     나가고, 내가 마지막 한 사람인지 답을 받는다
 *   ② 사진 지우기          방이 살아 있는 동안에만 목록을 읽을 수 있다
 *   ③ purge_chat_room     알림 정리 + 방 삭제(메시지는 cascade)
 *
 * **②③이 실패해도 이 훅은 성공이다.** 사용자가 누른 것은 "나가기"이고 그것은 ①에서 이미
 * 끝났다. 여기서 오류를 올리면 나가졌는데 실패했다고 뜨고 화면도 안 넘어간다.
 * 남는 것은 양쪽 누구에게도 안 보이는 방 하나뿐이라, 사용자가 할 수 있는 일이 없다 —
 * `removeChatImage`(사진 딸린 메시지 삭제)와 같은 취급이다.
 *
 * 돌려주는 값은 "완전히 지워졌는가"다. 방 하나(`chatRoomQueryKey`)는 건드리지 않는다 —
 * 나간 방도 주소로는 열리고(0030), 지워진 방은 어차피 화면이 곧 목록으로 옮겨 간다.
 */
export function useLeaveChatRoomMutation(
  roomId: number,
  participantIds: string[],
): UseMutationResult<boolean, Error, void> {
  const queryClient = useQueryClient();

  return useMutation<boolean, Error, void>({
    mutationFn: async function leave(): Promise<boolean> {
      const isPurgeable = await leaveChatRoom(roomId);

      if (!isPurgeable) {
        return false;
      }

      try {
        await removeChatRoomImages(roomId, participantIds);
        return await purgeChatRoom(roomId);
      } catch {
        return false;
      }
    },
    onSuccess: function refreshRooms(): void {
      queryClient.invalidateQueries({ queryKey: chatRoomsQueryKey() });
    },
  });
}

