import type { ReactNode } from 'react';
import PageHeader from '../../../shared/ui/pageHeader';

type MyListLayoutProps = {
  title: string;
  children: ReactNode;
};

/** 마이페이지 하위 목록 네 화면이 함께 쓰는 틀. 제목과 돌아가는 길만 다르지 않다. */
function MyListLayout(props: MyListLayoutProps) {
  return (
    <main className="mx-auto flex max-w-screen-sm flex-col gap-4 p-6">
      <PageHeader backTo="/my" backLabel="마이페이지" title={props.title} />

      {props.children}
    </main>
  );
}

export default MyListLayout;
