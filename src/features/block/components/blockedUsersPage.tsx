import BlockedUserListItem from './blockedUserListItem';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import MyListLayout from '../../profile/components/myListLayout';
import { useBlockedUsersQuery } from '../hooks/useBlockQueries';
import type { BlockedUser } from '../types';

/**
 * 마이페이지 → 차단 목록.
 *
 * 마이페이지의 네 목록(찜·최근·구매·판매)과 같은 틀을 쓰지만 무한 스크롤이 아니다.
 * 차단은 수십 명을 넘기 어렵고, 넘겨도 관리 화면이라 한 번에 보는 편이 낫다
 * (서버도 페이징 없이 한 번에 준다 — 0014의 fetch_blocked_users).
 *
 * 여기 보이는 것은 **내가 건 차단뿐**이다. 나를 차단한 사람은 목록에도 없고 알 방법도 없다.
 *
 * 로그인 가드는 라우터의 RequireMember가 이미 걸었다.
 */
function BlockedUsersPage() {
  const user = useAuthStore(selectAuthUser);
  const viewerId = user?.id ?? null;
  const blockedQuery = useBlockedUsersQuery(viewerId);

  if (viewerId === null || blockedQuery.isLoading) {
    return <PageSpinner message="차단 목록을 불러오는 중입니다…" />;
  }

  const blockedUsers = blockedQuery.data ?? [];

  return (
    <MyListLayout title="차단 목록">
      {blockedQuery.isError ? (
        <p role="alert" className="py-10 text-center text-sm text-red-600 dark:text-red-400">
          차단 목록을 불러오지 못했습니다.
        </p>
      ) : blockedUsers.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
          차단한 이웃이 없어요.
        </p>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            차단한 이웃의 게시물과 채팅은 서로에게 보이지 않아요. 해제하면 다시 보이고, 그동안
            오간 대화도 그대로 남아 있어요.
          </p>

          <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {blockedUsers.map(function renderBlockedUser(blocked: BlockedUser) {
              return (
                <BlockedUserListItem key={blocked.id} viewerId={viewerId} user={blocked} />
              );
            })}
          </ul>
        </>
      )}
    </MyListLayout>
  );
}

export default BlockedUsersPage;
