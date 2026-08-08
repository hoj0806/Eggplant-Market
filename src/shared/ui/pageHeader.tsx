import BackLink from './backLink';
import type { ReactNode } from 'react';

type PageHeaderProps = {
  backTo: string;
  backLabel: string;
  /**
   * 화면 제목. 없는 화면이 있다 — 게시물 상세·남의 프로필은 제목 자리에 글이나 사람이
   * 곧바로 오므로 헤더가 돌아가는 길만 맡는다.
   */
  title?: string;
  /** 제목 아래 한 줄. 제목 없이 이것만 넣는 화면은 없다. */
  description?: ReactNode;
  /** 돌아가는 링크와 같은 줄 오른쪽 끝(⋯ 메뉴·"프로필 수정"). */
  action?: ReactNode;
};

/**
 * 탭바 밖 화면의 머리.
 *
 * 열 곳이 각자 적고 있던 것을 하나로 모았다. 모양이 두 갈래였는데 **한 틀로 덮인다.**
 *
 *   · 설정·수정 화면: 돌아가는 링크 아래에 제목 — `action`이 없어 첫 줄에 링크만 남는다.
 *   · 상세·남의 프로필: 돌아가는 링크와 메뉴가 한 줄 — `title`이 없어 아래가 비어 있다.
 *
 * 두 경우 모두 지금 화면과 **똑같이 그려진다.** 틀을 맞추려고 생김새를 바꾸지는 않았다.
 *
 * 채팅방만 이 틀을 쓰지 않는다. 그쪽 헤더는 한 줄에 아바타·상대 이름·신고 메뉴가 함께 있어
 * "링크와 action" 두 칸으로 나뉘지 않는다 — 억지로 맞추면 이 컴포넌트가 채팅방 전용 인자를
 * 이고 다니게 된다. 대신 `BackLink`를 같이 쓴다.
 */
function PageHeader(props: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-2">
      {/*
        action이 없어도 이 줄은 남는다. justify-between이라 링크만 있으면 왼쪽에 붙어,
        지금까지의 세로형 화면과 결과가 같다.
      */}
      <div className="flex items-center justify-between gap-2">
        <BackLink to={props.backTo} label={props.backLabel} />
        {props.action}
      </div>

      {props.title === undefined ? null : (
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">{props.title}</h1>
      )}

      {props.description === undefined ? null : (
        <p className="text-sm text-gray-600 dark:text-gray-400">{props.description}</p>
      )}
    </header>
  );
}

export default PageHeader;
