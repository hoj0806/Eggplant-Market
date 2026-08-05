import { toNextNotificationCursor } from './notificationCursor';
import { NOTIFICATIONS_PAGE_SIZE } from '../api/notificationApi';
import type { AppNotification } from '../types';

jest.mock('../api/notificationApi', function mockNotificationApi() {
  // notificationApi는 supabaseClient를 거쳐 import.meta.env에 닿는다. ts-jest가 CommonJS로
  // 옮기면서 import.meta를 그대로 뱉으므로 실제 모듈은 로드하지 않는다(troble.md 「탐색」 1번).
  // 커서 유틸이 페이지 크기 상수 하나 때문에 API를 import하는 구조를 그대로 따랐으므로
  // 그 처방도 함께 따라온다.
  return { NOTIFICATIONS_PAGE_SIZE: 20 };
});

function makeNotification(id: number): AppNotification {
  return {
    id,
    type: 'chat',
    isRead: false,
    createdAt: `2026-08-0${(id % 9) + 1}T00:00:00.000Z`,
    actorId: 'actor-1',
    actorNickname: '가지팔이',
    actorAvatarUrl: null,
    roomId: 9,
    postId: null,
    postTitle: null,
    preview: null,
    offerAmount: null,
  };
}

function makeFullPage(): AppNotification[] {
  return Array.from({ length: NOTIFICATIONS_PAGE_SIZE }, function toNotification(_, index: number) {
    return makeNotification(index + 1);
  });
}

describe('toNextNotificationCursor', function notificationCursorSuite() {
  it('페이지가 다 찼으면 마지막 알림을 커서로 준다', function fullPageCase() {
    const page = makeFullPage();
    const last = page[page.length - 1];

    expect(toNextNotificationCursor(page)).toEqual({ createdAt: last.createdAt, id: last.id });
  });

  it('페이지가 덜 찼으면 다음이 없다', function partialPageCase() {
    expect(toNextNotificationCursor([makeNotification(1)])).toBeUndefined();
  });

  it('빈 페이지도 다음이 없다', function emptyPageCase() {
    expect(toNextNotificationCursor([])).toBeUndefined();
  });
});
