import { Link } from 'react-router-dom';
import { formatTimeAgo } from '../../../shared/utils/formatTimeAgo';
import ProfileAvatar from '../../profile/components/profileAvatar';
import { useUnblockUserMutation } from '../hooks/useBlockMutations';
import { toBlockErrorMessage } from '../utils/blockErrorMessage';
import type { BlockedUser } from '../types';

type BlockedUserListItemProps = {
  viewerId: string;
  user: BlockedUser;
};

/**
 * 차단 목록 한 줄.
 *
 * 해제는 한 번에 끝난다 — 되돌리는 쪽은 잃는 것이 없어 확인을 묻지 않는다
 * (BlockToggleButton과 같은 판단). 여기서는 상태를 다시 묻지도 않는다.
 * 이 목록에 있다는 것이 곧 "차단했다"이기 때문에, 줄마다 조회를 한 번씩 더 보낼 이유가 없다.
 *
 * 닉네임은 프로필로 가는 링크다. 차단한 사람의 프로필은 여전히 열린다 —
 * 왜 차단했는지 확인하고 해제를 판단하는 자리라 막을 이유가 없다.
 */
function BlockedUserListItem(props: BlockedUserListItemProps) {
  const unblockMutation = useUnblockUserMutation(props.viewerId, props.user.id);

  return (
    <li className="flex flex-col gap-1 py-3">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={`/users/${props.user.id}`}
          className="flex min-w-0 items-center gap-3 rounded-lg p-1 transition hover:bg-gray-50
                     dark:hover:bg-gray-900"
        >
          <ProfileAvatar
            nickname={props.user.nickname}
            avatarUrl={props.user.avatarUrl}
            size="sm"
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-50">
              {props.user.nickname}
            </span>
            <span className="truncate text-xs text-gray-500 dark:text-gray-400">
              {formatTimeAgo(props.user.blockedAt)} 차단
            </span>
          </span>
        </Link>

        <button
          type="button"
          disabled={unblockMutation.isPending}
          onClick={function unblock(): void {
            unblockMutation.mutate();
          }}
          className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium
                     text-gray-700 transition hover:bg-gray-50 disabled:opacity-60
                     dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {unblockMutation.isPending ? '해제 중…' : '차단 해제'}
        </button>
      </div>

      {unblockMutation.error === null ? null : (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {toBlockErrorMessage(unblockMutation.error)}
        </p>
      )}
    </li>
  );
}

export default BlockedUserListItem;
