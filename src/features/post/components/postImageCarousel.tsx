import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

type PostImageCarouselProps = {
  images: ReadonlyArray<string>;
  title: string;
};

/**
 * 상세 화면의 사진 넘김.
 * 사진이 한 장이면 넘김 버튼을 아예 그리지 않는다 — 누를 수 없는 버튼은 없느니만 못하다.
 */
function PostImageCarousel(props: PostImageCarouselProps) {
  const [index, setIndex] = useState(0);

  if (props.images.length === 0) {
    return (
      <div
        className="flex aspect-square w-full items-center justify-center rounded-xl bg-gray-100
                   text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400"
      >
        사진이 없습니다.
      </div>
    );
  }

  const total = props.images.length;
  // 첫 장에서 이전을 누르면 마지막으로 돌아간다. 끝에서 막히면 사진이 없는 줄 안다.
  function goPrevious(): void {
    setIndex(function toPreviousIndex(current: number): number {
      return (current - 1 + total) % total;
    });
  }

  function goNext(): void {
    setIndex(function toNextIndex(current: number): number {
      return (current + 1) % total;
    });
  }

  return (
    <div className="relative">
      <img
        src={props.images[index]}
        alt={`${props.title} 사진 ${index + 1}`}
        className="aspect-square w-full rounded-xl bg-gray-100 object-cover dark:bg-gray-900"
      />

      {total > 1 ? (
        <>
          <button
            type="button"
            onClick={goPrevious}
            aria-label="이전 사진"
            className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center
                       justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="다음 사진"
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center
                       justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
          >
            <ChevronRight size={20} />
          </button>
          <span
            className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2
                       py-0.5 text-xs text-white"
          >
            {index + 1} / {total}
          </span>
        </>
      ) : null}
    </div>
  );
}

export default PostImageCarousel;
