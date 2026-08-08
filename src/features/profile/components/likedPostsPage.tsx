import MyListLayout from './myListLayout';
import MyPostList from './myPostList';
import { selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import { useMyPostsQuery } from '../hooks/useMyPostsQuery';

const EMPTY_MESSAGE = '아직 찜한 물건이 없어요. 마음에 드는 물건에 하트를 눌러 보세요.';

/** 관심목록 — 내가 찜한 글. 로그인 가드는 라우터의 RequireMember가 이미 걸었다. */
function LikedPostsPage() {
  const user = useAuthStore(selectAuthUser);
  const postsQuery = useMyPostsQuery('likes', user?.id ?? null);

  return (
    <MyListLayout title="관심목록">
      <MyPostList kind="likes" query={postsQuery} emptyMessage={EMPTY_MESSAGE} />
    </MyListLayout>
  );
}

export default LikedPostsPage;
