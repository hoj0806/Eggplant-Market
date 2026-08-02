import { createBrowserRouter } from 'react-router-dom';
import AuthCallbackPage from '../features/auth/components/authCallbackPage';
import SignInPage from '../features/auth/components/signInPage';
import SignUpPage from '../features/auth/components/signUpPage';
import HomePage from '../features/browse/components/homePage';
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
