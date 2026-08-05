import { useState } from 'react';
import { useBlockUserMutation, useUnblockUserMutation } from '../hooks/useBlockMutations';
import { useBlockStatusQuery } from '../hooks/useBlockQueries';
import { toBlockErrorMessage } from '../utils/blockErrorMessage';

type BlockToggleButtonProps = {
  viewerId: string;
  targetId: string;
  targetNickname: string;
  /**
   * `menu`는 ⋯ 메뉴 안의 한 줄, `primary`는 눌러 주기를 바라는 버튼이다.
   * 신고 완료 안내에서는 차단이 그 화면의 다음 행동이라 primary로 온다.
   */
  variant: 'menu' | 'primary';
};

const MENU_ITEM_CLASS =
  'w-full px-4 py-2.5 text-left text-sm transition hover:bg-gray-50 disabled:opacity-40 ' +
  'dark:hover:bg-gray-800';
const PRIMARY_CLASS =
  'w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60';

/**
 * 차단 · 차단 해제 한 버튼.
 *
 * 차단은 한 번 더 묻는다. 되돌릴 수는 있지만(해제) **그 사이 상대와의 채팅방이 목록에서
 * 사라지고 상대가 보낸 말이 도착하지 않는다**(0014). 실수로 눌러 대화가 끊기는 편이
 * 한 번 더 누르는 번거로움보다 나쁘다 — 게시물 삭제(postOwnerMenu)와 같은 판단이다.
 * 해제는 묻지 않는다. 되돌리는 쪽은 잃는 것이 없다.
 *
 * **차단당한 쪽에는 아무 표시도 뜨지 않는다.** 여기 보이는 "차단하기"는 언제나
 * "내가 이 사람을 차단했는가"만 말한다(blocks_select가 내 행만 보여 준다).
 */
function BlockToggleButton(props: BlockToggleButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const statusQuery = useBlockStatusQuery(props.viewerId, props.targetId);
  const blockMutation = useBlockUserMutation(props.viewerId, props.targetId);
  const unblockMutation = useUnblockUserMutation(props.viewerId, props.targetId);

  const isBlocked = statusQuery.data === true;
  const isPending = blockMutation.isPending || unblockMutation.isPending;
  const error = blockMutation.error ?? unblockMutation.error;

  function handleBlock(): void {
    blockMutation.mutate(undefined, {
      onSuccess: function closeConfirm(): void {
        setIsConfirming(false);
      },
    });
  }

  function handleUnblock(): void {
    unblockMutation.mutate();
  }

  // 아직 차단 여부를 모르는 동안에는 무엇을 그릴지 정할 수 없다. 잘못 그리면 "차단 해제"를
  // 눌렀는데 차단이 걸리는 자리가 된다.
  if (statusQuery.isLoading) {
    return (
      <p className="px-4 py-2.5 text-sm text-gray-400 dark:text-gray-500">차단 상태 확인 중…</p>
    );
  }

  if (isBlocked) {
    return (
      <div className="flex flex-col">
        <button
          type="button"
          disabled={isPending}
          onClick={handleUnblock}
          className={
            props.variant === 'menu'
              ? MENU_ITEM_CLASS + ' text-gray-700 dark:text-gray-200'
              : PRIMARY_CLASS + ' bg-gray-600 hover:bg-gray-700'
          }
        >
          {unblockMutation.isPending ? '해제하는 중…' : '차단 해제'}
        </button>

        {error === null ? null : (
          <p role="alert" className="px-4 py-2 text-xs text-red-600 dark:text-red-400">
            {toBlockErrorMessage(error)}
          </p>
        )}
      </div>
    );
  }

  if (isConfirming) {
    return (
      <div className="flex flex-col gap-2 border-t border-gray-100 p-3 dark:border-gray-800">
        <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">
          {props.targetNickname}님을 차단하면 서로의 게시물과 채팅이 보이지 않아요. 언제든 다시
          해제할 수 있어요.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={handleBlock}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white
                       transition hover:bg-red-700 disabled:opacity-60"
          >
            {blockMutation.isPending ? '차단 중…' : '차단하기'}
          </button>
          <button
            type="button"
            onClick={function cancelBlock(): void {
              setIsConfirming(false);
            }}
            className="rounded-lg px-3 py-1.5 text-xs text-gray-600 transition
                       hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
          >
            취소
          </button>
        </div>

        {error === null ? null : (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {toBlockErrorMessage(error)}
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={function askBlock(): void {
        setIsConfirming(true);
      }}
      className={
        props.variant === 'menu'
          ? MENU_ITEM_CLASS + ' text-red-600 dark:text-red-400'
          : PRIMARY_CLASS + ' bg-red-600 hover:bg-red-700'
      }
    >
      {props.targetNickname}님 차단하기
    </button>
  );
}

export default BlockToggleButton;
