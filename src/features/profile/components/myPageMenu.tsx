import { Link } from 'react-router-dom';

type MyPageMenuItem = {
  to: string;
  icon: string;
  label: string;
};

/**
 * 마이페이지에서 갈 수 있는 곳. 순서는 자주 여는 것부터다.
 * 차단 목록·계정 설정이 맨 아래다 — 거래하다 한 번 들를까 말까 한 관리 화면이다.
 * 계정 설정(비밀번호·탈퇴)은 그중에서도 마지막이다. 프로필 수정·동네 설정은
 * 자주 여는 자리라 목록이 아니라 카드(myProfileCard)의 버튼으로 두었다.
 *
 * 알림 설정은 계정 설정 바로 위다. 둘 다 관리 화면이지만 알림 쪽이 더 자주 열린다 —
 * 계정 설정에는 탈퇴가 들어 있어 맨 아래를 지킨다.
 *
 * 알림에는 안 읽은 배지를 달지 않는다. 배지는 홈 헤더의 종 하나뿐이다 —
 * 같은 숫자를 두 곳에 그리면 한쪽만 늦게 갱신될 때 어느 쪽이 맞는지 알 수 없다.
 * 여기 링크는 홈까지 돌아가지 않아도 되는 두 번째 길일 뿐이다.
 */
const MENU_ITEMS: ReadonlyArray<MyPageMenuItem> = [
  { to: '/notifications', icon: '🔔', label: '알림' },
  { to: '/my/likes', icon: '♡', label: '관심목록' },
  { to: '/my/recent', icon: '🕘', label: '최근 본 글' },
  { to: '/my/purchases', icon: '🧾', label: '구매내역' },
  { to: '/my/sales', icon: '📦', label: '판매관리' },
  { to: '/my/blocks', icon: '🚫', label: '차단 목록' },
  { to: '/settings/notifications', icon: '🔕', label: '알림 설정' },
  { to: '/settings/account', icon: '⚙️', label: '계정 설정' },
];

function MyPageMenu() {
  return (
    <nav>
      <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        {MENU_ITEMS.map(function renderMenuItem(item: MyPageMenuItem) {
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className="flex items-center justify-between gap-3 px-2 py-4 text-sm
                           text-gray-900 transition hover:bg-gray-50
                           dark:text-gray-50 dark:hover:bg-gray-900"
              >
                <span className="flex items-center gap-3">
                  <span aria-hidden="true">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </span>
                <span aria-hidden="true" className="text-gray-400">
                  ›
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default MyPageMenu;
