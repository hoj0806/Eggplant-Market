import { createBrowserRouter } from 'react-router-dom';
import HomePage from '../features/browse/components/homePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
]);
