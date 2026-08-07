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
 */
function BrandMark(props: BrandMarkProps) {
  const size = props.size ?? 24;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      className="shrink-0"
    >
      {/* 열매. 위가 좁고 아래가 부푼 모양이라야 가지로 읽힌다. */}
      <path
        fill="#7C3AED"
        d="M12 6.2c4.1 0 7.1 3.4 7.1 7.7 0 4.2-3.2 7.1-7.1 7.1s-7.1-2.9-7.1-7.1c0-4.3 3-7.7 7.1-7.7z"
      />
      {/* 꼭지. 잎 두 장과 짧은 줄기. */}
      <path
        fill="#16A34A"
        d="M12 7.4c-2.1 0-3.8-1.1-4.6-2.8 1.9-.7 3.6-.2 4.6 1 1-1.2 2.7-1.7 4.6-1-.8 1.7-2.5 2.8-4.6 2.8z"
      />
      <path
        stroke="#16A34A"
        strokeWidth="1.6"
        strokeLinecap="round"
        d="M12 5.6V2.9"
      />
    </svg>
  );
}

export default BrandMark;
