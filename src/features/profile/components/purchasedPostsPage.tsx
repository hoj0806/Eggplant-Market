import MyListLayout from './myListLayout';
import MyPostList from './myPostList';
import { selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import { useMyPostsQuery } from '../hooks/useMyPostsQuery';

const EMPTY_MESSAGE =
  '아직 구매한 물건이 없어요. 거래가 끝나면 판매자가 거래완료로 바꿔 줘야 여기에 남습니다.';

/** 구매내역 — 판매자가 나를 구매자로 지정하고 거래완료로 바꾼 글만 들어온다. */
function PurchasedPostsPage() {
  const user = useAuthStore(selectAuthUser);
  const postsQuery = useMyPostsQuery('purchases', user?.id ?? null);

  return (
    <MyListLayout title="구매내역">
      <MyPostList kind="purchases" query={postsQuery} emptyMessage={EMPTY_MESSAGE} />
    </MyListLayout>
  );
}

export default PurchasedPostsPage;
