import {
  BRAND_FRUIT_COLOR,
  BRAND_FRUIT_PATH,
  BRAND_LEAF_COLOR,
  BRAND_LEAF_PATH,
  BRAND_MARK_VIEW_BOX,
  BRAND_STEM_PATH,
  BRAND_STEM_WIDTH,
} from './brandMarkShape';

type BrandMarkProps = {
  size?: number;
};

/**
 * 가지마켓 표식.
 *
 * lucide에는 가지가 없다. 그렇다고 `🍆`를 그대로 둘 수도 없었는데, 이모지는 **폰트가
 * 그리는 글자**라 기기마다 다른 가지가 나오기 때문이다 — 애플은 길고 휜 보라색,
 * 안드로이드는 짧고 통통한 것, 윈도우는 또 다른 것. 서비스 이름 옆에 붙는 표식이
 * 보는 사람마다 다르면 그건 표식이 아니다.
 *
 * 그래서 직접 그렸다. 열몇 줄짜리 SVG라 라이브러리를 하나 더 들일 이유가 없다.
 *
 * **색은 `currentColor`를 안 쓴다.** 다른 아이콘은 글자색을 따라가는 것이 맞지만
 * (켜진 탭은 초록, 꺼진 탭은 회색), 이것은 브랜드라 어디에 놓이든 같은 색이어야 한다 —
 * 가지가 초록이면 가지가 아니다.
 *
 * 좌표와 색은 `brandMarkShape.ts`에 있다. 브라우저 탭의 `public/favicon.svg`가
 * 같은 값을 쓰기 때문이다.
 */
function BrandMark(props: BrandMarkProps) {
  const size = props.size ?? 24;

  return (
    <svg
      viewBox={BRAND_MARK_VIEW_BOX}
      width={size}
      height={size}
      aria-hidden="true"
      className="shrink-0"
    >
      <path fill={BRAND_FRUIT_COLOR} d={BRAND_FRUIT_PATH} />
      <path fill={BRAND_LEAF_COLOR} d={BRAND_LEAF_PATH} />
      <path
        stroke={BRAND_LEAF_COLOR}
        strokeWidth={BRAND_STEM_WIDTH}
        strokeLinecap="round"
        d={BRAND_STEM_PATH}
      />
    </svg>
  );
}

export default BrandMark;
