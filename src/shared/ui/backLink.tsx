import { Link } from 'react-router-dom';

type BackLinkProps = {
  to: string;
  /**
   * 어디로 돌아가는지. 화살표는 이 컴포넌트가 붙이므로 목적지만 적는다.
   *
   * `isLabelHidden`이어도 사라지지 않는다 — 보조기기에는 그대로 읽힌다.
   */
  label: string;
  /**
   * 글자를 감추고 화살표만 보인다. 채팅방처럼 헤더 한 줄에 아바타·이름·메뉴가 함께 있어
   * 자리가 없는 곳에서만 쓴다.
   *
   * 감추더라도 **이름 없는 링크로 만들지는 않는다.** 그것이 이 컴포넌트를 만든 이유 중 하나다 —
   * 지금까지 채팅방의 뒤로가기는 `←` 한 글자뿐이라 스크린리더에 "왼쪽 화살표 링크"로 읽혔다.
   */
  isLabelHidden?: boolean;
};

const LINK_CLASS =
  'text-sm text-gray-500 transition hover:text-gray-700 ' +
  'dark:text-gray-400 dark:hover:text-gray-200';

/**
 * 탭바 밖 화면에서 돌아가는 길.
 *
 * 탭바가 없는 화면(상세·채팅방·설정·후기)은 이것 하나로 나가야 해서 열 곳에 흩어져 있었는데,
 * 모양이 제각각이었다 — `←`·`← 홈으로`·`← 마이페이지`·`← 게시물로 돌아가기`.
 * 색과 크기까지 각자 적고 있어 한 곳을 고치면 나머지 아홉이 어긋났다.
 *
 * **목적지는 통일하지 않는다.** 화면마다 돌아갈 곳이 실제로 다르기 때문이다
 * (설정은 마이페이지로, 상세는 홈으로, 후기는 그 거래의 게시물로).
 * 통일하는 것은 생김새와 **말하는 방식**이다.
 */
function BackLink(props: BackLinkProps) {
  return (
    <Link
      to={props.to}
      // 글자를 감추면 링크에 이름이 없어진다. 그때만 이름을 따로 적어 준다.
      aria-label={props.isLabelHidden === true ? props.label : undefined}
      className={LINK_CLASS}
    >
      <span aria-hidden="true">←</span>
      {props.isLabelHidden === true ? null : ` ${props.label}`}
    </Link>
  );
}

export default BackLink;
