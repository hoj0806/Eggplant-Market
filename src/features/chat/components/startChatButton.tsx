import { useNavigate } from 'react-router-dom';
import { useOpenChatRoomMutation } from '../hooks/useChatMutations';
import { toChatErrorMessage } from '../utils/chatErrorMessage';

type StartChatButtonProps = {
  postId: number;
};

/**
 * "채팅하기".
 *
 * 자기 게시물에는 이 버튼을 그리지 않지만(부모가 판단한다), 규칙의 주인은 서버다 —
 * open_chat_room이 판매자 본인의 호출을 거부한다(0008). 찜과 같은 방식이다.
 *
 * 이미 대화한 적이 있으면 같은 방으로 들어간다. 게시물마다 방이 하나뿐이라
 * 같은 상품을 두 번 물어도 대화가 이어진다.
 */
function StartChatButton(props: StartChatButtonProps) {
  const navigate = useNavigate();
  const openRoom = useOpenChatRoomMutation();

  function handleClick(): void {
    openRoom.mutate(props.postId, {
      onSuccess: function goToRoom(roomId: number): void {
        void navigate(`/chats/${roomId}`);
      },
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={openRoom.isPending}
        onClick={handleClick}
        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white
                   transition hover:bg-emerald-700 disabled:opacity-60"
      >
        채팅하기
      </button>

      {openRoom.isError ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {toChatErrorMessage(openRoom.error)}
        </p>
      ) : null}
    </div>
  );
}

export default StartChatButton;
