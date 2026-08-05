/** 이 페이지가 열린 뒤 만들어진 채널 수. 새로고침하면 0부터 다시 센다. */
let channelSequence = 0;

/**
 * 겹치지 않는 Realtime 채널 이름을 만든다.
 *
 * supabase-js의 `supabase.channel(topic)`은 **같은 이름의 채널이 이미 있으면 그것을 그대로
 * 돌려준다**(RealtimeClient.channel). 새로 만들어 주는 것이 아니다. 그래서 이름을 고정해 두면
 * 두 번째로 부른 쪽이 남이 이미 `subscribe()`까지 마친 채널을 받아 들고,
 * 거기에 `.on('postgres_changes', …)`를 걸다가 예외로 죽는다.
 *
 *   cannot add `postgres_changes` callbacks for realtime:chat-rooms after `subscribe()`.
 *
 * 이름이 겹치는 것은 사고가 아니라 설계였다 — 탭바 배지(useUnreadChatCount)와 채팅 목록
 * 화면이 같은 방 목록을 보므로 둘 다 같은 구독을 건다. 헤더의 알림 종과 알림 화면도 같다.
 * 한쪽이 늘 떠 있는 것들이라 다른 쪽으로 이동하는 순간 반드시 부딪힌다.
 *
 * 이름 뒤에 번호를 붙여 매번 새 채널을 받게 한다. topic은 클라이언트가 채널을 구분하려고
 * 쓰는 이름일 뿐이고, 서버가 무엇을 보내 줄지는 `.on()`에 넘긴 조건이 정한다 —
 * 이름이 달라도 받는 것은 같다.
 *
 * 앞부분(prefix)은 그대로 남긴다. 개발자 도구에서 채널 목록을 볼 때 어느 구독인지 읽히게 하려는 것이다.
 */
export function uniqueChannelTopic(prefix: string): string {
  channelSequence += 1;
  return `${prefix}#${channelSequence}`;
}
