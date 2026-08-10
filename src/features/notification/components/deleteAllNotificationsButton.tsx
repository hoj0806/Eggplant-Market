import { useState } from 'react';
import { useDeleteAllNotificationsMutation } from '../hooks/useNotificationMutations';

type DeleteAllNotificationsButtonProps = {
  viewerId: string;
};

const ACTION_CLASS =
  'rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700' +
  ' transition hover:bg-gray-50 disabled:opacity-50' +
  ' dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800';

/**
 * 알림 목록의 "모두 삭제". **머리말에 서는 유일한 버튼이다** — 옆에 있던 "모두 읽음"은
 * 2026-08-10에 걷어냈다.
 *
 * **한 줄 삭제와 달리 한 번 더 묻는다.** 0019는 한 줄에는 확인을 두지 않았는데, 그 판단의
 * 근거가 "잘못 눌러도 잃는 것이 알림 한 줄뿐"이었다. 여기서는 그 근거가 그대로 뒤집힌다 —
 * 한 번의 실수로 **전부** 사라지고, 되돌릴 방법이 아예 없다(트리거는 사건이 일어난 순간에만
 * 도므로 지나간 알림을 다시 만들어 낼 수 없다).
 *
 * 확인의 모양은 채팅방 나가기·차단과 같다(제자리에서 문구 + 실행/취소 두 버튼).
 * 탈퇴처럼 문구를 받아 적게 하지는 않았다 — 사라지는 것이 **알림뿐**이고 그것이 가리키던
 * 대화·글·후기는 그대로 남기 때문이다. 확인의 무게는 잃는 것의 무게를 따라간다.
 */
function DeleteAllNotificationsButton(props: DeleteAllNotificationsButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const deleteAllMutation = useDeleteAllNotificationsMutation(props.viewerId);

  function handleDeleteAll(): void {
    deleteAllMutation.mutate(undefined, {
      onSuccess: function closeConfirm(): void {
        setIsConfirming(false);
      },
    });
  }

  if (!isConfirming) {
    return (
      <button
        type="button"
        onClick={function askDeleteAll(): void {
          setIsConfirming(true);
        }}
        className={ACTION_CLASS}
      >
        모두 삭제
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">
        받은 알림을 <b>모두</b> 지울까요? 안 읽은 알림까지 함께 사라지고 되돌릴 수 없어요.
        알림이 가리키던 대화와 글은 그대로 남아요.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={deleteAllMutation.isPending}
          onClick={handleDeleteAll}
          className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-semibold text-white
                     transition hover:bg-gray-800 disabled:opacity-60"
        >
          {deleteAllMutation.isPending ? '지우는 중…' : '지우기'}
        </button>
        <button
          type="button"
          onClick={function cancelDeleteAll(): void {
            setIsConfirming(false);
          }}
          className="rounded-lg px-3 py-1.5 text-xs text-gray-600 transition
                     hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
        >
          취소
        </button>
      </div>

      {deleteAllMutation.isError ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          알림을 지우지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      ) : null}
    </div>
  );
}

export default DeleteAllNotificationsButton;
