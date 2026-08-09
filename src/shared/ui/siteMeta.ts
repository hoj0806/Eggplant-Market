/**
 * 서비스가 밖에 내보이는 이름·설명·주소.
 *
 * 카카오톡이나 슬랙에 주소를 붙였을 때 뜨는 카드를 만드는 값들이다. 실제로 그 카드를
 * 그리는 것은 `index.html`의 `<meta>` 태그인데, **정적 HTML이라 이 파일을 import할 수 없다.**
 * `brandMarkShape.ts`와 같은 사정이고, 같은 방법으로 지킨다 — 값을 옮겨 적되
 * `siteMeta.test.ts`가 어긋나는 순간 깨뜨린다.
 *
 * 여기 모아 두는 다른 이유가 하나 더 있다. 배포 주소는 앞으로 **스모크 테스트**도 쓴다
 * (계획 ⑧B). 그때 세 번째 사본을 만들지 않으려고 미리 한 곳에 둔다.
 */

export const SITE_NAME = '가지마켓';

/** 탭 제목. `index.html`의 `<title>`과 같아야 한다. */
export const SITE_TITLE = '가지마켓 (EggPlant Market)';

/**
 * 검색 결과와 공유 카드에 함께 쓴다.
 *
 * 한 문장으로 **무엇을 하는 곳인지**가 끝나야 한다. 카카오톡 카드는 두 줄쯤에서 자르고,
 * 구글도 155자 근처에서 자른다.
 */
export const SITE_DESCRIPTION =
  '우리 동네 이웃과 중고물품을 사고파는 곳. 가까운 거래만 모아 보고, 채팅으로 바로 약속을 잡으세요.';

/** 공유 카드 그림 안에 넣는 짧은 말. 문장이 아니라 이름표다. */
export const SITE_TAGLINE = '동네 이웃과 중고거래';

/** 프로덕션 주소. 끝에 슬래시를 붙이지 않는다 — 뒤에 경로를 이어 붙이기 때문이다. */
export const SITE_URL = 'https://eggplant-market-ga6d-flame.vercel.app';

export const OG_IMAGE_PATH = '/og-image.png';

/**
 * **절대 주소여야 한다.**
 *
 * `og:image`에 `/og-image.png`처럼 상대 경로를 적으면 페이스북은 알아서 붙여 주지만
 * 슬랙·카카오를 포함한 여러 수집기는 그대로 두고 그림을 못 찾는다. Open Graph 명세가
 * 절대 URL을 요구하는 쪽이라, 맞춰 두는 편이 잃을 것이 없다.
 */
export const OG_IMAGE_URL = `${SITE_URL}${OG_IMAGE_PATH}`;

/** 1.91:1. 페이스북·슬랙·카카오가 모두 이 비율로 자른다. */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
