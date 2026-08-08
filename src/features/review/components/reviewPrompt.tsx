import { Link } from 'react-router-dom';
import { usePendingReviewsQuery } from '../hooks/useReviewQueries';
import { findPendingReview } from '../utils/pendingReview';

type ReviewPromptProps = {
  postId: number;
  viewerId: string | null;
};

/**
 * 게시물 상세에서 "이 거래, 후기 남기시겠어요?"를 묻는 자리.
 *
 * 거래완료 직후에 보이는 안내다. 판매자는 방금 거래완료를 누른 그 화면에서,
 * 구매자는 다시 들어와 본 그 화면에서 같은 문구를 만난다 — 양쪽 모두 후기를 남길 수 있고
 * 서로를 평가해야 매너온도가 한쪽으로만 쏠리지 않는다.
 *
 * 보일지 말지는 서버가 정한다. 남은 거래 목록(`fetch_pending_reviews`)에 이 게시물이 있을
 * 때만 그린다 — 이미 남겼거나, 거래 상대가 없거나, 내 거래가 아니면 아무것도 그리지 않는다.
 * 조건을 화면에서 다시 따지면 서버와 어긋날 자리가 하나 더 생긴다.
 */
function ReviewPrompt(props: ReviewPromptProps) {
  const pendingReviewsQuery = usePendingReviewsQuery(props.viewerId);
  const pending = findPendingReview(pendingReviewsQuery.data, props.postId);

  if (pending === null) {
    return null;
  }

  return (
    <div
      className="flex w-full flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3
                 dark:border-emerald-900 dark:bg-emerald-950"
    >
      <p className="text-sm text-emerald-900 dark:text-emerald-100">
        {pending.partnerNickname}님과의 거래는 어떠셨나요? 후기가 이웃의 매너온도가 됩니다.
      </p>
      <Link
        to={`/posts/${props.postId}/review`}
        className="self-start rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white
                   transition hover:bg-emerald-700"
      >
        후기 남기기
      </Link>
    </div>
  );
}

export default ReviewPrompt;
