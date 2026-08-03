import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type MyListLayoutProps = {
  title: string;
  children: ReactNode;
};

/** 마이페이지 하위 목록 네 화면이 함께 쓰는 틀. 제목과 돌아가는 길만 다르지 않다. */
function MyListLayout(props: MyListLayoutProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-screen-sm flex-col gap-4 p-6">
      <header className="flex flex-col gap-2">
        <Link
          to="/my"
          className="text-sm text-gray-500 transition hover:text-gray-700
                     dark:text-gray-400 dark:hover:text-gray-200"
        >
          ← 마이페이지
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">{props.title}</h1>
      </header>

      {props.children}
    </main>
  );
}

export default MyListLayout;
