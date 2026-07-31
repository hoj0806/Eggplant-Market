import { createBrowserRouter } from 'react-router-dom';
import AuthCallbackPage from '../features/auth/components/authCallbackPage';
import SignInPage from '../features/auth/components/signInPage';
import SignUpPage from '../features/auth/components/signUpPage';
import HomePage from '../features/browse/components/homePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
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
    path: '/auth/callback',
    element: <AuthCallbackPage />,
  },
]);
