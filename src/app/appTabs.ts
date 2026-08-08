import { Home, MessageCircle, PenLine, Search, User, type LucideIcon } from 'lucide-react';

export type AppTab = {
  to: string;
  label: string;
  /**
   * 이 자리를 나타내는 아이콘. **컴포넌트다**(이모지 문자열이 아니다).
   *
   * 이모지는 폰트가 그리는 글자라 기기마다 모양이 달랐다 — 같은 `🏠`가 안드로이드에서는
   * 파란 지붕, 애플에서는 갈색 지붕으로 나오고, 크기를 키우면 거칠어진다.
   * 색도 못 정해서 켜진 탭과 꺼진 탭이 **같은 색**으로 보였다.
   *
   * lucide는 `currentColor`로 그리는 SVG라 글자색을 그대로 따라간다 — 활성 색을
   * 아이콘에도 쓰려고 따로 적을 것이 없다.
   */
  Icon: LucideIcon;
  /**
   * 가운데에 크게 띄우는 자리인가.
   *
   * 다섯 중 하나뿐이다. 글쓰기만 **하러 오는** 자리이고 나머지 넷은 **보러 오는** 자리라,
   * 같은 크기로 늘어놓으면 이 앱에서 무엇을 할 수 있는지가 드러나지 않는다.
   * 당근·번개장터가 모두 가운데를 띄우는 이유이기도 하다.
   *
   * 배열의 가운데 항목을 골라 계산할 수도 있지만, 그러면 자리를 하나 더하거나 순서를
   * 바꿀 때 **엉뚱한 탭이 떠오른다.** 어느 것이 그 자리인지는 값으로 적어 둔다.
   */
  isPrimary?: boolean;
};

/**
 * 하단 탭바에 놓는 다섯 자리. 순서는 당근과 같은 이유로 정했다 —
 * 왼쪽 둘은 "보러 오는" 자리, 가운데는 "올리는" 자리, 오른쪽 둘은 "내 것"이다.
 */
export const APP_TABS: ReadonlyArray<AppTab> = [
  { to: '/', label: '홈', Icon: Home },
  { to: '/search', label: '검색', Icon: Search },
  // 연필 하나(`PenLine`)다. `Plus`도 후보였는데 그쪽은 "무엇이든 더한다"는 뜻이라
  // 파는 글을 쓰러 가는 자리와 어긋난다.
  { to: '/posts/new', label: '글쓰기', Icon: PenLine, isPrimary: true },
  { to: '/chats', label: '채팅', Icon: MessageCircle },
  { to: '/my', label: '나의 가지마켓', Icon: User },
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
