import { useState } from 'react';
import { MENU_ITEM_CLASS } from '../../../shared/ui/menuItem';
import { useLeaveChatRoomMutation } from '../hooks/useChatMutations';
import { toChatErrorMessage } from '../utils/chatErrorMessage';

type LeaveChatRoomButtonProps = {
  roomId: number;
  /** 이 방의 두 사람. 사진 폴더가 `{room_id}/{user_id}/…`라 지울 때 필요하다(0008). */
  participantIds: string[];
  /** 나간 뒤 어디로 갈지는 화면이 정한다. 여기서는 부르기만 한다. */
  onLeft(): void;
};

/**
 * 채팅방 나가기. 채팅방 헤더의 ⋯ 메뉴 맨 아래에 붙는다.
 *
 * **한 번 더 묻는 이유는 되돌릴 수 없어서가 아니다** — 대개는 되돌아온다. 안내할 것이
 * 있어서다. 이 버튼은 결과가 두 갈래인데 누르는 사람은 어느 쪽인지 모른다.
 *
 *   상대가 아직 보고 있으면   목록에서만 빠지고, 상대가 말을 걸면 돌아온다 (0030)
 *   상대도 이미 나갔으면      대화도 사진도 완전히 지워진다 (0031)
 *
 * 문구에 둘 다 적는다. **상대가 나갔는지는 알려 주지 않는다** — 그건 상대의 행동이고,
 * 알려 주지 않아도 "둘 다 나간 방은 지워진다"는 규칙만으로 충분히 정확하다.
 * 하나만 적으면 둘 중 한 갈래에서 거짓말이 된다.
 *
 * 차단(BlockToggleButton)의 확인 문구와 같은 모양·같은 자리다. 둘이 한 메뉴에 이웃해 있어
 * 다르게 생기면 어느 쪽이 더 센 동작인지가 흔들린다.
 */
function LeaveChatRoomButton(props: LeaveChatRoomButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const leaveMutation = useLeaveChatRoomMutation(props.roomId, props.participantIds);

  function handleLeave(): void {
    leaveMutation.mutate(undefined, {
      onSuccess: function goBackToList(): void {
        props.onLeft();
      },
    });
  }

  if (isConfirming) {
    return (
      <div className="flex flex-col gap-2 border-t border-gray-100 p-3 dark:border-gray-800">
        <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">
          이 채팅방을 목록에서 치울까요? 상대에게는 대화가 그대로 보이고, 상대가 다시 말을 걸면
          목록에 돌아와요. 다만 <b>둘 다 나간 방은 대화와 사진이 완전히 지워져요.</b>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={leaveMutation.isPending}
            onClick={handleLeave}
            className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-semibold text-white
                       transition hover:bg-gray-800 disabled:opacity-60"
          >
            {leaveMutation.isPending ? '나가는 중…' : '나가기'}
          </button>
          <button
            type="button"
            onClick={function cancelLeave(): void {
              setIsConfirming(false);
            }}
            className="rounded-lg px-3 py-1.5 text-xs text-gray-600 transition
                       hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
          >
            취소
          </button>
        </div>

        {leaveMutation.error === null ? null : (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {toChatErrorMessage(leaveMutation.error)}
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={function askLeave(): void {
        setIsConfirming(true);
      }}
      className={MENU_ITEM_CLASS + ' text-gray-700 dark:text-gray-200'}
    >
      채팅방 나가기
    </button>
  );
}

export default LeaveChatRoomButton;
