/**
 * 조회수를 언제 올릴지 정한다.
 *
 * 규칙은 두 가지다.
 *   1. 한 탭에서 같은 글은 한 번만 센다 — 새로고침이나 뒤로가기로 조회수가 부풀지 않게.
 *   2. 판매자가 자기 글을 봐도 세지 않는다.
 *
 * 2번은 서버(increment_view_count)에서도 막는다. 여기서 한 번 더 보는 것은
 * 어차피 오르지 않을 요청을 아예 보내지 않기 위해서다.
 *
 * 기록을 sessionStorage에 두는 이유: 탭을 닫으면 사라져야 하고(다시 오면 다시 세는 것이 맞다),
 * 비로그인 사용자에게도 똑같이 적용돼야 한다.
 */

const STORAGE_KEY = 'viewedPostIds';

export type ShouldCountViewParams = {
  postId: number;
  /** 판매자 id. 본인 글이면 세지 않는다. */
  sellerId: string;
  /** 보는 사람 id. 비로그인은 null. */
  viewerId: string | null;
  viewedIds: ReadonlyArray<number>;
};

export function shouldCountView(params: ShouldCountViewParams): boolean {
  if (params.viewerId !== null && params.viewerId === params.sellerId) {
    return false;
  }

  return !params.viewedIds.includes(params.postId);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * 사용자가 손댈 수 있는 값이므로 형태를 믿지 않는다.
 * 깨진 값이면 빈 목록으로 보고 넘어간다 — 조회수 때문에 화면이 죽으면 안 된다.
 */
export function readViewedPostIds(): number[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.filter(isNumber) : [];
  } catch {
    return [];
  }
}

export function rememberViewedPost(postId: number): void {
  const viewed = readViewedPostIds();
  if (viewed.includes(postId)) {
    return;
  }

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...viewed, postId]));
  } catch {
    // 시크릿 모드 등에서 저장이 막힐 수 있다. 세지 못할 뿐이라 무시한다.
  }
}
