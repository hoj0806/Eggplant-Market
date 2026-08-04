import { Link } from 'react-router-dom';
import type { PendingReview } from '../types';

type WriteReviewButtonProps = {
  pending: PendingReview;
};

/**
 * 거래 목록 카드에 붙는 "후기 남기기".
 *
 * 남길 수 있는 거래에만 붙는다 — 이미 남겼거나 거래 상대가 없는 거래에는 아무것도 그리지 않는다
 * (판단은 부모가 `findPendingReview`로 한다). 눌러 봐야 거절당하는 버튼을 놓지 않는 것이
 * 끌어올리기 버튼을 판매중에만 그리는 것과 같은 판단이다.
 *
 * 상대 이름을 적는다. 목록에는 같은 날 끝난 거래가 여럿 있을 수 있어서
 * "누구에게 남기는 후기인지"가 버튼에 보여야 한다.
 */
function WriteReviewButton(props: WriteReviewButtonProps) {
  return (
    <div className="px-2 pb-2">
      <Link
        to={`/posts/${props.pending.postId}/review`}
        className="inline-block rounded-lg border border-emerald-600 px-3 py-1 text-xs font-medium
                   text-emerald-700 transition hover:bg-emerald-50
                   dark:text-emerald-400 dark:hover:bg-emerald-950"
      >
        {props.pending.partnerNickname}님에게 후기 남기기
      </Link>
    </div>
  );
}

export default WriteReviewButton;
