import { useBumpPostMutation } from '../hooks/useBumpPostMutation';
import { canBumpPost, toBumpRemainingText } from '../utils/postBumpCooldown';
import { toPostActionErrorMessage } from '../utils/postErrorMessage';
import type { PostStatus } from '../types';

type PostBumpButtonProps = {
  postId: number;
  status: PostStatus;
  bumpedAt: string;
  viewerId: string;
  /** 목록 전체가 같은 기준으로 남은 시간을 계산하도록 부모가 넘긴다. */
  now: Date;
};

/**
 * 판매관리 목록에서 카드마다 붙는 끌어올리기 버튼.
 *
 * 상태 변경과 달리 뒤따르는 절차가 없어(거래 상대를 고를 일이 없다) 목록 안에서 끝난다 —
 * 상세까지 들어갔다 나오게 하면 여러 글을 차례로 끌어올릴 때 손이 많이 간다.
 *
 * 판매중이 아니면 아예 그리지 않는다. 예약중·거래완료 카드에 회색 버튼이 줄줄이 붙어 있으면
 * 목록만 어수선해진다(상세 ⋯ 메뉴는 그 자리에서 이유를 적어 준다).
 */
function PostBumpButton(props: PostBumpButtonProps) {
  const bumpMutation = useBumpPostMutation(props.postId, props.viewerId);

  if (props.status !== 'selling') {
    return null;
  }

  const canBump = canBumpPost(props.status, props.bumpedAt, props.now);
  const remainingText = toBumpRemainingText(props.bumpedAt, props.now);

  return (
    <div className="flex items-center gap-2 px-2 pb-2">
      <button
        type="button"
        disabled={!canBump || bumpMutation.isPending}
        onClick={function bump(): void {
          bumpMutation.mutate();
        }}
        className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700
                   transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700
                   dark:text-gray-200 dark:hover:bg-gray-800"
      >
        {bumpMutation.isPending ? '끌어올리는 중…' : '끌어올리기'}
      </button>

      {bumpMutation.isError ? (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {toPostActionErrorMessage(bumpMutation.error)}
        </span>
      ) : canBump ? null : (
        <span className="text-xs text-gray-500 dark:text-gray-400">{remainingText}</span>
      )}
    </div>
  );
}

export default PostBumpButton;
