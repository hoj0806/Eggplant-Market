import { Link } from 'react-router-dom';
import LogoutButton from '../../auth/components/logoutButton';
import { selectAuthStatus, selectAuthUser, useAuthStore } from '../../auth/store/authStore';

function GuestActions() {
  return (
    <div className="flex gap-2">
      <Link
        to="/login"
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        로그인
      </Link>
      <Link
        to="/signup"
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700
                   transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        회원가입
      </Link>
    </div>
  );
}

function HomePage() {
  const status = useAuthStore(selectAuthStatus);
  const user = useAuthStore(selectAuthUser);

  return (
    <main className="mx-auto flex min-h-screen max-w-screen-sm flex-col items-center justify-center gap-3 p-6">
      <h1 className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">🍆 가지마켓</h1>

      {status === 'loading' ? (
        <p className="text-gray-600 dark:text-gray-300">세션을 확인하는 중입니다…</p>
      ) : status === 'authenticated' ? (
        <>
          <p className="text-gray-600 dark:text-gray-300">
            <span className="font-semibold">{user?.email ?? '이웃'}</span>님, 반갑습니다.
          </p>
          <LogoutButton />
        </>
      ) : (
        <>
          <p className="text-gray-600 dark:text-gray-300">
            로그인하고 우리 동네 중고거래를 시작해 보세요.
          </p>
          <GuestActions />
        </>
      )}
    </main>
  );
}

export default HomePage;
