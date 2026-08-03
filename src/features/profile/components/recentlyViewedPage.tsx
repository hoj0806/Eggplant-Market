import MyListLayout from './myListLayout';
import MyPostList from './myPostList';
import { selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import { useMyPostsQuery } from '../hooks/useMyPostsQuery';

const EMPTY_MESSAGE = '아직 본 물건이 없어요. 우리 동네에 뭐가 올라왔는지 둘러보세요.';

/** 최근 본 글 — 내 글은 남지 않는다(0009 record_recently_viewed). */
function RecentlyViewedPage() {
  const user = useAuthStore(selectAuthUser);
  const postsQuery = useMyPostsQuery('recent', user?.id ?? null);

  return (
    <MyListLayout title="최근 본 글">
      <MyPostList kind="recent" query={postsQuery} emptyMessage={EMPTY_MESSAGE} />
    </MyListLayout>
  );
}

export default RecentlyViewedPage;
