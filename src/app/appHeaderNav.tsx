import BrandMark from '../shared/ui/brandMark';
import { Link, useLocation } from 'react-router-dom';
import { APP_TABS, isTabActive, type AppTab } from './appTabs';
import { selectAuthUser, useAuthStore } from '../features/auth/store/authStore';
import { useUnreadChatCount } from '../features/chat/hooks/useUnreadChatCount';
import NotificationBellLink from '../features/notification/components/notificationBellLink';

const ACTIVE_CLASS = 'text-emerald-600 dark:text-emerald-400';
const INACTIVE_CLASS =
  'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-50';

/** 999를 넘으면 숫자보다 "많다"는 사실이 중요해진다(탭바와 같은 기준). */
const MAX_UNREAD_LABEL = 999;

function toUnreadLabel(count: number): string {
  return count > MAX_UNREAD_LABEL ? `${MAX_UNREAD_LABEL}+` : String(count);
}

/**
 * 데스크탑 상단 내비게이션. **`md`부터만 나온다**(그 아래는 하단 탭바가 맡는다).
 *
 * 같은 다섯 자리를 쓰지만 모양이 다르다. 하단 탭바는 엄지가 닿는 곳에 아이콘을 크게
 * 늘어놓는 물건이고, 데스크탑에서는 **화면 아래가 눈에서 가장 먼 곳**이라 같은 것을
 * 그대로 올려 두면 마우스가 매번 화면 끝까지 내려가야 한다.
 *
 * 자리 배분도 달라진다.
 *
 *   왼쪽   로고 — 데스크탑에서는 "여기가 어디인가"를 늘 보여 주는 자리가 있다
 *   가운데 보러 가는 넷. 아이콘 + 글자다 — 이모지를 쓰던 시절에는 확대하면 거칠어져
 *          글자만 두었는데, SVG로 바뀌면서 작은 크기(16px)로 곁들일 수 있게 됐다
 *   오른쪽 알림 종과 글쓰기. **하는 일**이라 보러 가는 넷과 갈라 둔다
 *
 * 글쓰기는 탭바에서 떠 있는 원(`isPrimary`)인데 여기서는 **채워진 버튼**이다.
 * 같은 값이 두 모양을 만든다 — "이것만 성격이 다르다"는 사실은 하나고, 그 사실을
 * 어떻게 그리느냐가 화면마다 다를 뿐이다.
 *
 * 알림 종을 여기 둔 덕에 **데스크탑에서는 어느 화면에서든 알림으로 갈 수 있다.**
 * 모바일에서는 홈에만 있다(탭바가 다섯 칸으로 이미 좁다) — 그래서 홈의 종은
 * `md:hidden`으로 감춘다. 같은 배지가 한 화면에 둘이면 어느 쪽이 맞는지 알 수 없다.
 */
function AppHeaderNav() {
  const location = useLocation();
  const user = useAuthStore(selectAuthUser);
  const unreadCount = useUnreadChatCount(user?.id ?? null);

  const browseTabs = APP_TABS.filter(function isBrowse(tab: AppTab): boolean {
    return tab.isPrimary !== true;
  });
  const primaryTab = APP_TABS.find(function isPrimary(tab: AppTab): boolean {
    return tab.isPrimary === true;
  });

  return (
    <header
      className="sticky top-0 z-40 hidden border-b border-gray-200 bg-white/90 backdrop-blur
                 md:block dark:border-gray-800 dark:bg-gray-950/90"
    >
      <div className="page-wide flex items-center gap-6 px-6 py-3">
        <Link
          to="/"
          className="shrink-0 text-lg font-bold text-emerald-600 dark:text-emerald-400"
        >
          <span className="flex items-center gap-1.5">
            <BrandMark size={22} />
            가지마켓
          </span>
        </Link>

        <nav aria-label="주요 메뉴" className="min-w-0 flex-1">
          <ul className="flex items-center gap-1">
            {browseTabs.map(function renderTab(tab: AppTab) {
              const isActive = isTabActive(tab.to, location.pathname);

              return (
                <li key={tab.to}>
                  <Link
                    to={tab.to}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium
                                transition hover:bg-gray-50 dark:hover:bg-gray-900
                                ${isActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
                  >
                    <tab.Icon size={16} />
                    {tab.label}
                    {/*
                      배지는 링크 이름 밖에 둘 수 없다 — 여기서는 글자 옆에 붙는 작은 알약이라
                      aria-label로 뜻을 따로 적는다(탭바의 UnreadBadge와 같은 이유).
                    */}
                    {tab.to === '/chats' && unreadCount > 0 ? (
                      <span
                        aria-label={`안 읽은 메시지 ${unreadCount}개`}
                        className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px]
                                   font-semibold leading-none text-white"
                      >
                        {toUnreadLabel(unreadCount)}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          {user === null ? null : <NotificationBellLink viewerId={user.id} />}

          {primaryTab === undefined ? null : (
            <Link
              to={primaryTab.to}
              aria-current={isTabActive(primaryTab.to, location.pathname) ? 'page' : undefined}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white
                         transition hover:bg-emerald-700"
            >
              {primaryTab.label}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export default AppHeaderNav;
