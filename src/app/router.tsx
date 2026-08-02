import { createBrowserRouter } from 'react-router-dom';
import AuthCallbackPage from '../features/auth/components/authCallbackPage';
import SignInPage from '../features/auth/components/signInPage';
import SignUpPage from '../features/auth/components/signUpPage';
import HomePage from '../features/browse/components/homePage';
import NewPostPage from '../features/post/components/newPostPage';
import PostDetailPage from '../features/post/components/postDetailPage';
import OnboardingPage from '../features/profile/components/onboardingPage';
import RegionSettingsPage from '../features/profile/components/regionSettingsPage';
import RequireOnboarding from '../features/profile/components/requireOnboarding';

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <RequireOnboarding>
        <HomePage />
      </RequireOnboarding>
    ),
  },
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
    // 글쓰기는 동네가 있어야 가능하므로 온보딩 가드 안에 둔다.
    path: '/posts/new',
    element: (
      <RequireOnboarding>
        <NewPostPage />
      </RequireOnboarding>
    ),
  },
  {
    // 상세는 비로그인도 볼 수 있다. 찜만 로그인을 요구한다.
    path: '/posts/:postId',
    element: <PostDetailPage />,
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
