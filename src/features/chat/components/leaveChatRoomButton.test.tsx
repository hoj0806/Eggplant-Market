import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeaveChatRoomButton from './leaveChatRoomButton';

// chatApi는 supabaseClient를 거쳐 import.meta.env에 닿는다. 실제 모듈은 로드하지 않는다.
const mockLeaveChatRoom = jest.fn();
const mockPurgeChatRoom = jest.fn();
const mockRemoveChatRoomImages = jest.fn();

jest.mock('../api/chatApi', function mockChatApi() {
  return {
    leaveChatRoom: function leaveChatRoom(roomId: number) {
      return mockLeaveChatRoom(roomId);
    },
    purgeChatRoom: function purgeChatRoom(roomId: number) {
      return mockPurgeChatRoom(roomId);
    },
    removeChatRoomImages: function removeChatRoomImages(roomId: number, userIds: string[]) {
      return mockRemoveChatRoomImages(roomId, userIds);
    },
    // 같은 모듈의 다른 함수들. 훅 파일이 통째로 import하므로 자리만 채운다.
    cancelOffer: jest.fn(),
    deleteMessage: jest.fn(),
    openChatRoom: jest.fn(),
    removeChatImage: jest.fn(),
    respondToOffer: jest.fn(),
    sendImageMessages: jest.fn(),
    sendPriceOfferMessage: jest.fn(),
    sendTextMessage: jest.fn(),
  };
});

const ROOM_ID = 9;
const PARTICIPANTS = ['me', 'partner'];

function renderButton(onLeft: jest.Mock) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <LeaveChatRoomButton roomId={ROOM_ID} participantIds={PARTICIPANTS} onLeft={onLeft} />
    </QueryClientProvider>,
  );
}

async function openConfirmAndLeave() {
  await userEvent.click(screen.getByRole('button', { name: '채팅방 나가기' }));
  await userEvent.click(screen.getByRole('button', { name: '나가기' }));
}

describe('LeaveChatRoomButton', function leaveChatRoomButtonSuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    mockLeaveChatRoom.mockResolvedValue(false);
    mockPurgeChatRoom.mockResolvedValue(true);
    mockRemoveChatRoomImages.mockResolvedValue(undefined);
  });

  it('한 번 더 묻기 전에는 나가지 않는다', async function asksFirst() {
    renderButton(jest.fn());

    await userEvent.click(screen.getByRole('button', { name: '채팅방 나가기' }));

    expect(mockLeaveChatRoom).not.toHaveBeenCalled();
    // 두 갈래를 모두 적는다 — 하나만 적으면 한쪽에서 거짓말이 된다.
    expect(screen.getByText(/둘 다 나간 방은 대화와 사진이 완전히 지워져요/)).toBeInTheDocument();
  });

  it('상대가 아직 있으면 나가기만 하고 지우지 않는다', async function leavesOnly() {
    const onLeft = jest.fn();
    renderButton(onLeft);

    await openConfirmAndLeave();

    await waitFor(function left() {
      expect(onLeft).toHaveBeenCalled();
    });
    expect(mockLeaveChatRoom).toHaveBeenCalledWith(ROOM_ID);
    expect(mockRemoveChatRoomImages).not.toHaveBeenCalled();
    expect(mockPurgeChatRoom).not.toHaveBeenCalled();
  });

  it('내가 마지막이면 사진을 먼저 지우고 방을 지운다', async function purgesAfterImages() {
    // 순서가 규칙이다. 방이 사라지면 chat_images_select가 막혀 사진 목록조차 못 읽는다.
    mockLeaveChatRoom.mockResolvedValue(true);
    const onLeft = jest.fn();
    renderButton(onLeft);

    await openConfirmAndLeave();

    await waitFor(function purged() {
      expect(mockPurgeChatRoom).toHaveBeenCalledWith(ROOM_ID);
    });
    expect(mockRemoveChatRoomImages).toHaveBeenCalledWith(ROOM_ID, PARTICIPANTS);
    expect(mockRemoveChatRoomImages.mock.invocationCallOrder[0]).toBeLessThan(
      mockPurgeChatRoom.mock.invocationCallOrder[0],
    );
    expect(onLeft).toHaveBeenCalled();
  });

  it('뒷정리가 실패해도 나가기는 성공이다', async function cleanupFailureIsNotAnError() {
    // 사용자가 누른 것은 "나가기"이고 그것은 이미 끝났다. 남는 것은 아무에게도 안 보이는 방뿐이다.
    mockLeaveChatRoom.mockResolvedValue(true);
    mockRemoveChatRoomImages.mockRejectedValue(new Error('storage down'));
    const onLeft = jest.fn();
    renderButton(onLeft);

    await openConfirmAndLeave();

    await waitFor(function left() {
      expect(onLeft).toHaveBeenCalled();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('나가기 자체가 실패하면 그 자리에 알린다', async function leaveFailureIsShown() {
    mockLeaveChatRoom.mockRejectedValue({ code: '42501', message: '참여 중인 채팅방이 아닙니다.' });
    const onLeft = jest.fn();
    renderButton(onLeft);

    await openConfirmAndLeave();

    await waitFor(function alerted() {
      expect(screen.getByRole('alert')).toHaveTextContent('참여 중인 채팅방이 아닙니다.');
    });
    expect(onLeft).not.toHaveBeenCalled();
  });
});
