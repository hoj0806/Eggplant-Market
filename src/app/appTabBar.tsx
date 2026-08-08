import { Link, useLocation } from 'react-router-dom';
import { APP_TABS, isTabActive, type AppTab } from './appTabs';
import { selectAuthUser, useAuthStore } from '../features/auth/store/authStore';
import { useUnreadChatCount } from '../features/chat/hooks/useUnreadChatCount';

const ACTIVE_CLASS = 'text-emerald-600 dark:text-emerald-400';
const INACTIVE_CLASS = 'text-gray-500 dark:text-gray-400';

/** 999를 넘으면 숫자보다 "많다"는 사실이 중요해진다(chatRoomFilterTabs와 같은 기준). */
const MAX_UNREAD_LABEL = 999;

function toUnreadLabel(count: number): string {
  return count > MAX_UNREAD_LABEL ? `${MAX_UNREAD_LABEL}+` : String(count);
}

function UnreadBadge(props: { count: number }) {
  if (props.count === 0) {
    return null;
  }

  return (
    <span
      aria-label={`안 읽은 메시지 ${props.count}개`}
      className="absolute -right-2 -top-1 rounded-full bg-emerald-600 px-1.5 py-0.5
                 text-[10px] font-semibold leading-none text-white"
    >
      {toUnreadLabel(props.count)}
    </span>
  );
}

/**
 * 화면 아래 고정 탭바.
 *
 * 화면마다 `← 홈` 링크로 오가던 것을 대신한다. 어느 화면에 있든 다섯 자리로 바로 갈 수 있고,
 * 지금 어디에 있는지가 늘 보인다.
 *
 * 안 읽은 배지는 로그인한 사람에게만 붙는다 — 게스트는 방이 없어 쿼리 자체가 돌지 않는다.
 *
 * **`md`부터는 사라진다**(`md:hidden`). 그 위에서는 `AppHeaderNav`가 같은 다섯 자리를
 * 화면 위쪽에 놓는다 — 데스크탑에서 화면 아래는 눈에서 가장 먼 곳이라, 엄지를 위해
 * 만든 물건을 그대로 두면 마우스가 매번 끝까지 내려가야 한다.
 */
function AppTabBar() {
  const location = useLocation();
  const user = useAuthStore(selectAuthUser);
  const unreadCount = useUnreadChatCount(user?.id ?? null);

  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white
                 md:hidden dark:border-gray-800 dark:bg-gray-950"
    >
      <ul className="mx-auto flex max-w-screen-sm">
        {APP_TABS.map(function renderTab(tab: AppTab) {
          const isActive = isTabActive(tab.to, location.pathname);

          if (tab.isPrimary === true) {
            return (
              <li key={tab.to} className="flex-1">
                <Link
                  to={tab.to}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition
                              ${isActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
                >
                  {/*
                    탭바 위로 반쯤 올라온 원. `-mt-6`이 그 절반을 끌어올리고, 탭바가 이미
                    `border-t`를 가진 흰 판이라 원이 그 선을 덮어 도드라진다.
                    라벨은 그대로 남긴다 — 아이콘만으로는 무엇을 올리는 자리인지 모른다.
                  */}
                  <span
                    aria-hidden="true"
                    className="-mt-6 flex h-12 w-12 items-center justify-center rounded-full
                               bg-emerald-600 leading-none text-white shadow-lg
                               ring-4 ring-white transition hover:bg-emerald-700
                               dark:ring-gray-950"
                  >
                    <tab.Icon size={22} strokeWidth={2.2} />
                  </span>
                  {tab.label}
                </Link>
              </li>
            );
          }

          return (
            <li key={tab.to} className="flex-1">
              <Link
                to={tab.to}
                // 색만으로는 스크린리더에 아무것도 전해지지 않는다.
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition
                            ${isActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}
              >
                {/* 배지는 아이콘 밖에 둔다 — aria-hidden 안에 넣으면 그 안의 설명도 함께 묻힌다. */}
                <span className="relative">
                  {/*
                    `aria-hidden`은 lucide가 스스로 붙인다(장식용 SVG가 기본이다).
                    바로 아래 글자 라벨이 이름을 맡고 있어 여기서 더 말할 것이 없다.
                  */}
                  <tab.Icon size={20} />
                  {tab.to === '/chats' ? <UnreadBadge count={unreadCount} /> : null}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default AppTabBar;
