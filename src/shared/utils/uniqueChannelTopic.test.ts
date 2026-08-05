import { uniqueChannelTopic } from './uniqueChannelTopic';

describe('uniqueChannelTopic', function uniqueChannelTopicSuite() {
  it('같은 앞부분으로 불러도 매번 다른 이름이 나온다', function neverRepeatsCase() {
    const first = uniqueChannelTopic('chat-rooms');
    const second = uniqueChannelTopic('chat-rooms');

    expect(first).not.toBe(second);
  });

  // 앞부분을 남기는 것이 이 함수의 목적 절반이다. 개발자 도구에서 어느 구독인지 읽혀야 한다.
  it('앞부분은 그대로 남는다', function keepsPrefixCase() {
    expect(uniqueChannelTopic('notifications-abc')).toMatch(/^notifications-abc#/);
  });

  // 앞부분이 달라도 번호는 하나의 흐름에서 나온다 — 서로 다른 구독끼리도 겹치지 않는다.
  it('앞부분이 달라도 서로 겹치지 않는다', function acrossPrefixesCase() {
    const room = uniqueChannelTopic('chat-room-1');
    const rooms = uniqueChannelTopic('chat-room-1');

    expect(new Set([room, rooms]).size).toBe(2);
  });
});
