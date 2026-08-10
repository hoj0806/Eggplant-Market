import { formatPrice } from '../../../shared/utils/formatPrice';
import type { KakaoFeedTemplate } from '../../../shared/types/kakaoShare';
import type { PostDetail } from '../types';

/**
 * 게시물 하나를 카카오톡 공유 카드로 바꾼다.
 *
 * ── 왜 이것이 SSR 없이 되는가 ─────────────────────────────────────────
 * `backlog.md`는 **게시물별 공유 카드를 안 만들기로** 했다. 이유는 "수집기가 HTML을 긁어갈 때
 * 이미 값이 박혀 있어야 하는데 SPA는 서버가 HTML을 만들지 않는다"였다.
 *
 * **그것은 링크를 붙여 넣는 경우의 이야기다.** 카카오톡 공유는 다르다 —
 * `sendDefault`는 **내용을 직접 실어 보낸다.** 카카오가 우리 페이지를 긁지 않으므로
 * 글마다 다른 사진·제목·가격을 그대로 담을 수 있다. 안 만들기로 한 판단은
 * **주소만 붙여 넣는 경우에 그대로 유효**하고(그때는 여전히 사이트 공통 카드가 뜬다),
 * 이 길은 그 판단을 비껴간다.
 *
 * ── 사진이 없을 때 ───────────────────────────────────────────────────
 * 사진은 등록할 때 최소 한 장을 받지만(`validatePostImages`), 그 규칙보다 먼저 올라온 글이나
 * 사진이 지워진 글이 있을 수 있다. 그때는 **사이트 공통 카드 그림**으로 물러난다 —
 * 카카오는 `imageUrl`이 비면 카드를 글자만으로 그리는데, 목록에서 유독 초라해 보인다.
 */

/** `public/og-image.png`. 사진이 없는 글이 물러날 자리다(0809의 공유 카드 그림). */
const FALLBACK_IMAGE_PATH = '/og-image.png';

/** 카카오가 자르기 전에 우리가 자른다. 어디서 잘리는지는 우리가 정하는 편이 낫다. */
const MAX_DESCRIPTION_LENGTH = 60;

function toAbsolute(origin: string, path: string): string {
  return `${origin.replace(/\/+$/, '')}${path}`;
}

/** 카드 아래 한 줄. 가격이 먼저다 — 중고거래에서 먼저 보는 값이다. */
export function toShareDescription(post: PostDetail): string {
  const price = formatPrice(post.price);
  const place = post.dongName;
  const head = place === null ? price : `${price} · ${place}`;
  const body = post.description.replace(/\s+/g, ' ').trim();

  if (body.length === 0) {
    return head;
  }

  const room = MAX_DESCRIPTION_LENGTH - head.length - 3;

  if (room <= 0) {
    return head;
  }

  // 자를 때는 말줄임표 한 글자도 상한 안에 든다. 그것을 안 세면 딱 한 글자를 넘긴다.
  const shortened = body.length > room ? `${body.slice(0, room - 1)}…` : body;

  return `${head} · ${shortened}`;
}

/**
 * 공유 카드 하나.
 *
 * 링크는 **카드 전체와 버튼 둘 다**에 건다. 카카오톡에서 카드를 눌러도, 버튼을 눌러도
 * 같은 곳으로 가야 한다 — 한쪽만 걸면 "눌렀는데 아무 일도 없다"가 생긴다.
 */
export function toPostShareTemplate(post: PostDetail, origin: string): KakaoFeedTemplate {
  const url = toAbsolute(origin, `/posts/${post.id}`);
  const link = { mobileWebUrl: url, webUrl: url };

  return {
    objectType: 'feed',
    content: {
      title: post.title,
      description: toShareDescription(post),
      imageUrl: post.images[0] ?? toAbsolute(origin, FALLBACK_IMAGE_PATH),
      link,
    },
    buttons: [{ title: '게시물 보기', link }],
  };
}
