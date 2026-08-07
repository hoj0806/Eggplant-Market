import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type AuthLayoutProps = {
  title: string;
  description: string;
  children: ReactNode;
  /**
   * 없을 수 있다. 로그인·회원가입은 서로를 가리키지만, 새 비밀번호를 정하는 화면처럼
   * **그 자리에서 끝나는** 화면은 보낼 곳이 없다 — 빈 줄만 남기느니 아예 안 그린다.
   */
  footer?: ReactNode;
};

/** 로그인·회원가입 화면의 공통 껍데기(로고, 카드, 하단 안내). */
function AuthLayout(props: AuthLayoutProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-screen-sm flex-col justify-center gap-6 p-6">
      <header className="flex flex-col items-center gap-2 text-center">
        <Link to="/" className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
          🍆 가지마켓
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">{props.title}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">{props.description}</p>
      </header>

      <section className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6
                          shadow-sm dark:border-gray-800 dark:bg-gray-950">
        {props.children}
      </section>

      {props.footer === undefined ? null : (
        <footer className="text-center text-sm text-gray-600 dark:text-gray-400">
          {props.footer}
        </footer>
      )}
    </main>
  );
}

export default AuthLayout;
