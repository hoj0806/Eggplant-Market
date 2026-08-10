import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNotificationCountQuery } from '../hooks/useNotificationQueries';
import { useNotificationsRealtime } from '../hooks/useNotificationRealtime';

/** 999를 넘으면 숫자보다 "많다"는 사실이 중요해진다(탭바 배지와 같은 기준). */
const MAX_COUNT_LABEL = 999;

function toCountLabel(count: number): string {
  return count > MAX_COUNT_LABEL ? `${MAX_COUNT_LABEL}+` : String(count);
}

type NotificationBellLinkProps = {
  viewerId: string;
};

/**
 * 알림으로 가는 종. 홈 헤더에 놓는다.
 *
 * 탭바에 여섯 번째 자리를 만들지 않았다. 다섯 칸도 좁고, 알림은 "하러 가는 곳"이 아니라
 * "왔을 때 가는 곳"이라 늘 자리를 차지할 이유가 적다.
 *
 * 배지를 한 곳에만 두는 것은 채팅과 같은 이유다 — 같은 숫자를 두 곳에 그리면 한쪽만 늦게
 * 갱신될 때 어느 쪽이 맞는지 알 수 없다(homePage의 MemberGreeting 주석 참고).
 *
 * 구독은 여기서 건다. 홈은 앱을 켜면 처음 닿는 화면이라, 알림 화면을 열지 않아도
 * 새 알림이 오면 숫자가 곧바로 바뀐다.
 *
 * **숫자는 아직 안 치운 알림 수다**(0036). 읽음 상태가 없어져서 셀 것이 이것뿐이고,
 * 그래서 배지는 **지워야 준다** — 눌러서 확인한 줄은 그 순간 사라지므로 함께 줄어든다.
 */
function NotificationBellLink(props: NotificationBellLinkProps) {
  const countQuery = useNotificationCountQuery(props.viewerId);
  useNotificationsRealtime(props.viewerId);

  const count = countQuery.data ?? 0;

  return (
    <Link
      to="/notifications"
      aria-label={count === 0 ? '알림' : `알림 ${count}개`}
      className="relative shrink-0 rounded-full p-2 leading-none transition
                 hover:bg-gray-100 dark:hover:bg-gray-800"
    >
      {/* 이름은 위의 aria-label이 맡는다. lucide는 스스로 aria-hidden을 붙인다. */}
      <Bell size={20} />

      {count === 0 ? null : (
        <span
          aria-hidden="true"
          className="absolute right-0 top-0 rounded-full bg-emerald-600 px-1.5 py-0.5
                     text-[10px] font-semibold leading-none text-white"
        >
          {toCountLabel(count)}
        </span>
      )}
    </Link>
  );
}

export default NotificationBellLink;
