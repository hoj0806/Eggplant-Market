/**
 * 내가 차단한 사람 한 줄. 0014의 `fetch_blocked_users`가 이 모양 그대로 돌려준다.
 *
 * "나를 차단한 사람"은 이 타입으로 오지 않는다 — 그 목록은 서버에도 클라이언트에도 없다.
 * 차단은 양방향으로 막히지만(`private.blocked_user_ids`) 볼 수 있는 것은 내가 건 것뿐이다.
 */
export type BlockedUser = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  blockedAt: string;
};
