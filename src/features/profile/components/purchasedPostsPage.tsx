import MyListLayout from './myListLayout';
import MyPostList from './myPostList';
import { selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import WriteReviewButton from '../../review/components/writeReviewButton';
import { usePendingReviewsQuery } from '../../review/hooks/useReviewQueries';
import { findPendingReview } from '../../review/utils/pendingReview';
import { useMyPostsQuery } from '../hooks/useMyPostsQuery';
import type { ReactNode } from 'react';
import type { MyPostSummary } from '../types';

const EMPTY_MESSAGE =
  '아직 구매한 물건이 없어요. 거래가 끝나면 판매자가 거래완료로 바꿔 줘야 여기에 남습니다.';

/**
 * 구매내역 — 판매자가 나를 구매자로 지정하고 거래완료로 바꾼 글만 들어온다.
 *
 * 후기를 남기는 두 자리 중 하나다. 거래가 끝나고 시간이 지나서야 후기를 쓰는 일이 흔해서
 * (거래 직후 안내는 그 자리에서 닫히면 다시 열 길이 없다) 목록에 버튼이 있어야 한다.
 */
function PurchasedPostsPage() {
  const user = useAuthStore(selectAuthUser);
  const viewerId = user?.id ?? null;

  const postsQuery = useMyPostsQuery('purchases', viewerId);
  const pendingReviewsQuery = usePendingReviewsQuery(viewerId);

  function renderReviewButton(post: MyPostSummary): ReactNode {
    const pending = findPendingReview(pendingReviewsQuery.data, post.id);

    return pending === null ? null : <WriteReviewButton pending={pending} />;
  }

  return (
    <MyListLayout title="구매내역">
      <MyPostList
        kind="purchases"
        query={postsQuery}
        emptyMessage={EMPTY_MESSAGE}
        renderAction={renderReviewButton}
      />
    </MyListLayout>
  );
}

export default PurchasedPostsPage;
