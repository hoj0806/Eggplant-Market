import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import GlobalStyles from "./styles/GlobalStyles";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import HomePage from "./pages/HomePage";
import Signup from "./pages/Signup";
import NewProduct from "./pages/NewProduct";
import Login from "./pages/Login";
import Product from "./pages/Product";
import MainLayout from "./layout/MainLayout";
import OtherUserProfile from "./pages/OtherUserProfile";
import MyProfile from "./pages/MyProfile";
import MyRequests from "./pages/MyRequests";
import MyPosts from "./pages/MyProducts";
import MyHistory from "./pages/MyHistory";

const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "product/new", element: <NewProduct /> },
      { path: "product/:productId", element: <Product /> },
      {
        path: "user/:userId",
        element: <OtherUserProfile />,
      },
      {
        path: "my/posts",
        element: <MyPosts />,
      },
      {
        path: "my/profile",
        element: <MyProfile />,
      },

      {
        path: "my/requests",
        element: <MyRequests />,
      },
      {
        path: "my/history",
        element: <MyHistory />,
      },
    ],
  },

  { path: "/signup", element: <Signup /> },
  { path: "/login", element: <Login /> },
]);

function App() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <ReactQueryDevtools initialIsOpen={false} />
      <GlobalStyles />
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;
