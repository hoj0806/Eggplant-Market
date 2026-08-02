import { useEffect, useRef, type RefObject } from 'react';

/** 목록 끝에서 이만큼 앞서 다음 페이지를 부른다. 바닥에 닿고 나서 부르면 빈 화면이 잠깐 보인다. */
const ROOT_MARGIN = '200px';

type UseInfiniteScrollParams = {
  /** 더 받아올 페이지가 있는가. 없으면 관찰 자체를 걸지 않는다. */
  hasNextPage: boolean;
  /** 이미 받아오는 중인가. 같은 페이지를 두 번 부르지 않기 위한 잠금이다. */
  isFetching: boolean;
  onLoadMore(): void;
};

/**
 * 목록 맨 끝에 둔 표식이 화면에 들어오면 다음 페이지를 부른다.
 *
 * 스크롤 이벤트가 아니라 IntersectionObserver를 쓴다 — 스크롤 이벤트는 초당 수십 번 돌아
 * 직접 throttle을 걸어야 하고, 목록이 짧아 스크롤이 아예 없는 화면에서는 한 번도 뜨지 않는다.
 *
 * 반환한 ref를 목록 마지막 요소에 달아 준다.
 */
export function useInfiniteScroll(params: UseInfiniteScrollParams): RefObject<HTMLLIElement | null> {
  const sentinelRef = useRef<HTMLLIElement | null>(null);

  // 콜백을 최신으로 들고 있는다. 이것 없이 effect 의존성에 넣으면
  // 렌더마다 observer를 떼었다 붙이게 된다.
  const onLoadMoreRef = useRef(params.onLoadMore);
  onLoadMoreRef.current = params.onLoadMore;

  const { hasNextPage, isFetching } = params;

  useEffect(
    function observeSentinel() {
      const sentinel = sentinelRef.current;

      if (sentinel === null || !hasNextPage || isFetching) {
        return;
      }

      const observer = new IntersectionObserver(
        function handleIntersect(entries: IntersectionObserverEntry[]): void {
          if (entries[0].isIntersecting) {
            onLoadMoreRef.current();
          }
        },
        { rootMargin: ROOT_MARGIN },
      );

      observer.observe(sentinel);

      return function stopObserving(): void {
        observer.disconnect();
      };
    },
    [hasNextPage, isFetching],
  );

  return sentinelRef;
}
