import { createBrowserRouter } from 'react-router-dom';
import AppLayout from './appLayout';
import AuthCallbackPage from '../features/auth/components/authCallbackPage';
import SignInPage from '../features/auth/components/signInPage';
import SignUpPage from '../features/auth/components/signUpPage';
import HomePage from '../features/browse/components/homePage';
import SearchPage from '../features/browse/components/searchPage';
import ChatRoomListPage from '../features/chat/components/chatRoomListPage';
import ChatRoomPage from '../features/chat/components/chatRoomPage';
import NewPostPage from '../features/post/components/newPostPage';
import PostDetailPage from '../features/post/components/postDetailPage';
import PostEditPage from '../features/post/components/postEditPage';
import LikedPostsPage from '../features/profile/components/likedPostsPage';
import MyPage from '../features/profile/components/myPage';
import OnboardingPage from '../features/profile/components/onboardingPage';
import ProfileSettingsPage from '../features/profile/components/profileSettingsPage';
import PurchasedPostsPage from '../features/profile/components/purchasedPostsPage';
import RecentlyViewedPage from '../features/profile/components/recentlyViewedPage';
import RegionSettingsPage from '../features/profile/components/regionSettingsPage';
import RequireMember from '../features/profile/components/requireMember';
import RequireOnboarding from '../features/profile/components/requireOnboarding';
import SellingPostsPage from '../features/profile/components/sellingPostsPage';

export const router = createBrowserRouter([
  {
    // 주소 없는 부모다. 탭바를 다는 것 말고는 하는 일이 없어 자기 주소를 가질 이유가 없다.
    // 가드는 여전히 화면마다 다르므로 부모로 끌어올리지 않는다.
    element: <AppLayout />,
    children: [
      {
        path: '/',
        element: (
          <RequireOnboarding>
            <HomePage />
          </RequireOnboarding>
        ),
      },
      {
        // 검색도 비로그인이 쓸 수 있다. 동네는 화면 안에서 직접 고르게 한다.
        path: '/search',
        element: <SearchPage />,
      },
      {
        // 글쓰기는 동네가 있어야 가능하므로 온보딩 가드 안에 둔다.
        path: '/posts/new',
        element: (
          <RequireOnboarding>
            <NewPostPage />
          </RequireOnboarding>
        ),
      },
      {
        // 채팅은 로그인이 있어야 한다. 온보딩 가드는 게스트를 통과시키므로 화면 안에서 한 번 더 막는다.
        path: '/chats',
        element: (
          <RequireOnboarding>
            <ChatRoomListPage />
          </RequireOnboarding>
        ),
      },
      {
        // 마이페이지는 내 것을 보는 자리라 게스트에게 보여줄 것이 없다.
        // RequireOnboarding은 게스트를 통과시키므로 RequireMember를 한 겹 더 두른다.
        path: '/my',
        element: (
          <RequireOnboarding>
            <RequireMember>
              <MyPage />
            </RequireMember>
          </RequireOnboarding>
        ),
      },
      {
        path: '/my/likes',
        element: (
          <RequireOnboarding>
            <RequireMember>
              <LikedPostsPage />
            </RequireMember>
          </RequireOnboarding>
        ),
      },
      {
        path: '/my/recent',
        element: (
          <RequireOnboarding>
            <RequireMember>
              <RecentlyViewedPage />
            </RequireMember>
          </RequireOnboarding>
        ),
      },
      {
        path: '/my/purchases',
        element: (
          <RequireOnboarding>
            <RequireMember>
              <PurchasedPostsPage />
            </RequireMember>
          </RequireOnboarding>
        ),
      },
      {
        path: '/my/sales',
        element: (
          <RequireOnboarding>
            <RequireMember>
              <SellingPostsPage />
            </RequireMember>
          </RequireOnboarding>
        ),
      },
    ],
  },

  // 아래는 탭바 밖이다. 로그인·온보딩은 아직 갈 곳이 없는 사람이 보는 화면이고,
  // 상세·채팅방·설정은 한 가지 일을 끝내고 돌아가는 화면이다.
  {
    path: '/signup',
    element: <SignUpPage />,
  },
  {
    path: '/login',
    element: <SignInPage />,
  },
  {
    path: '/onboarding',
    element: <OnboardingPage />,
  },
  {
    // 상세는 비로그인도 볼 수 있다. 찜만 로그인을 요구한다.
    path: '/posts/:postId',
    element: <PostDetailPage />,
  },
  {
    // 수정은 글쓰기와 같은 조건이다 — 동네가 있어야 하고, 화면 안에서 판매자 본인인지 한 번 더 본다.
    path: '/posts/:postId/edit',
    element: (
      <RequireOnboarding>
        <PostEditPage />
      </RequireOnboarding>
    ),
  },
  {
    path: '/chats/:roomId',
    element: (
      <RequireOnboarding>
        <ChatRoomPage />
      </RequireOnboarding>
    ),
  },
  {
    path: '/settings/profile',
    element: (
      <RequireOnboarding>
        <RequireMember>
          <ProfileSettingsPage />
        </RequireMember>
      </RequireOnboarding>
    ),
  },
  {
    path: '/settings/region',
    element: (
      <RequireOnboarding>
        <RegionSettingsPage />
      </RequireOnboarding>
    ),
  },
  {
    path: '/auth/callback',
    element: <AuthCallbackPage />,
  },
]);
