import { Link } from 'react-router-dom';

type MyPageMenuItem = {
  to: string;
  icon: string;
  label: string;
};

/**
 * 마이페이지에서 갈 수 있는 곳. 순서는 자주 여는 것부터다.
 * 차단 목록은 맨 아래다 — 거래하다 한 번 들를까 말까 한 관리 화면이다.
 */
const MENU_ITEMS: ReadonlyArray<MyPageMenuItem> = [
  { to: '/my/likes', icon: '♡', label: '관심목록' },
  { to: '/my/recent', icon: '🕘', label: '최근 본 글' },
  { to: '/my/purchases', icon: '🧾', label: '구매내역' },
  { to: '/my/sales', icon: '📦', label: '판매관리' },
  { to: '/my/blocks', icon: '🚫', label: '차단 목록' },
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
