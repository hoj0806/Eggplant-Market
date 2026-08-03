import { countUnreadFromPartner } from './useMarkRoomRead';
import type { ChatMessage } from '../types';

// chatApi는 supabaseClient를 거쳐 import.meta.env에 닿는다. 실제 모듈은 로드하지 않는다.
jest.mock('../api/chatApi', function mockChatApi() {
  return { markRoomRead: jest.fn() };
});

function toMessage(senderId: string, readAt: string | null): ChatMessage {
  return {
    id: Math.random(),
    roomId: 1,
    senderId,
    type: 'text',
    content: '안녕하세요',
    offerAmount: null,
    offerStatus: null,
    readAt,
    createdAt: '2026-08-03T01:00:00.000Z',
  };
}

describe('countUnreadFromPartner', function countUnreadFromPartnerSuite() {
  it('상대가 보냈고 아직 안 읽은 것만 센다', function countsOnlyPartnerUnread() {
    const messages = [
      toMessage('partner', null),
      toMessage('partner', '2026-08-03T01:05:00.000Z'),
      toMessage('me', null),
      toMessage('partner', null),
    ];

    expect(countUnreadFromPartner(messages, 'me')).toBe(2);
  });

  it('내가 보낸 메시지는 안 읽었어도 세지 않는다', function ignoresOwnMessages() {
    expect(countUnreadFromPartner([toMessage('me', null), toMessage('me', null)], 'me')).toBe(0);
  });

  it('다 읽었으면 0이다', function allRead() {
    expect(
      countUnreadFromPartner([toMessage('partner', '2026-08-03T01:05:00.000Z')], 'me'),
    ).toBe(0);
  });

  it('로그인하지 않았으면 셀 것이 없다', function noViewer() {
    expect(countUnreadFromPartner([toMessage('partner', null)], null)).toBe(0);
  });

  it('메시지가 없으면 0이다', function noMessages() {
    expect(countUnreadFromPartner([], 'me')).toBe(0);
  });
});
