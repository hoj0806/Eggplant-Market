export type AppTab = {
  to: string;
  label: string;
  icon: string;
};

/**
 * 하단 탭바에 놓는 다섯 자리. 순서는 당근과 같은 이유로 정했다 —
 * 왼쪽 둘은 "보러 오는" 자리, 가운데는 "올리는" 자리, 오른쪽 둘은 "내 것"이다.
 */
export const APP_TABS: ReadonlyArray<AppTab> = [
  { to: '/', label: '홈', icon: '🏠' },
  { to: '/search', label: '검색', icon: '🔍' },
  { to: '/posts/new', label: '글쓰기', icon: '✏️' },
  { to: '/chats', label: '채팅', icon: '💬' },
  { to: '/my', label: '나의 가지마켓', icon: '👤' },
];

/**
 * 지금 보고 있는 주소가 이 탭에 속하는지.
 *
 * 하위 화면도 그 탭으로 본다 — `/my/likes`를 보는 중에 '나의 가지마켓'이 꺼져 있으면
 * 어디에 있는지 알 수 없다. 다만 홈은 예외다. 모든 주소가 `/`로 시작하므로
 * 하위까지 포함하면 홈이 늘 켜져 있게 된다.
 */
export function isTabActive(tabTo: string, pathname: string): boolean {
  if (tabTo === '/') {
    return pathname === '/';
  }

  return pathname === tabTo || pathname.startsWith(`${tabTo}/`);
}
