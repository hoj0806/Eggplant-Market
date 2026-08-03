import { useEffect, useRef } from 'react';
import { recordRecentlyViewed } from '../api/postApi';

/**
 * 상세 화면에 들어왔을 때 "최근 본 글"에 남긴다.
 *
 * useViewCount와 나란히 서지만 규칙이 다르다. 조회수는 한 탭에서 한 번만 세야 해서
 * sessionStorage로 막지만, 최근 본 글은 **다시 볼 때마다 갱신돼야** 목록 순서가 맞는다.
 * 같은 훅에 넣으면 둘 중 하나의 규칙이 틀어진다.
 *
 * ref는 StrictMode의 effect 이중 실행을 막는 자리다(useViewCount와 같은 이유).
 * 비로그인·본인 글 제외는 서버가 판단하므로 여기서 보지 않는다.
 *
 * 실패해도 조용히 넘어간다. 발자취를 못 남겼을 뿐이라 글을 읽는 데는 아무 지장이 없다.
 */
export function useRecordRecentView(postId: number | undefined, viewerId: string | null): void {
  const recordedPostIdRef = useRef<number | null>(null);

  useEffect(
    function recordOnce(): void {
      // 로그인해야 남길 곳이 생긴다. 요청 자체를 보내지 않는다.
      if (postId === undefined || viewerId === null || recordedPostIdRef.current === postId) {
        return;
      }

      recordedPostIdRef.current = postId;

      recordRecentlyViewed(postId).catch(function ignoreFailure(): void {
        // 곁가지다. 실패를 사용자에게 알리지 않는다.
      });
    },
    [postId, viewerId],
  );
}
