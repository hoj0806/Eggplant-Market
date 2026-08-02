import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { postDetailQueryKey } from './usePostQueries';
import { incrementViewCount } from '../api/postApi';
import { readViewedPostIds, rememberViewedPost, shouldCountView } from '../utils/viewedPosts';
import type { PostDetail } from '../types';

/**
 * 상세 화면에 들어왔을 때 조회수를 한 번 올린다.
 *
 * ref로 한 번 더 막는 이유: StrictMode는 effect를 두 번 실행한다.
 * sessionStorage 기록만으로도 두 번째 실행은 걸리지만, 두 호출이 겹쳐 나가는 찰나에는
 * 둘 다 "아직 안 봤다"로 읽힐 수 있다.
 *
 * 실패해도 조용히 넘어간다. 조회수는 화면의 곁가지라 이것 때문에 오류를 띄울 이유가 없다.
 */
export function useViewCount(post: PostDetail | undefined, viewerId: string | null): void {
  const countedPostIdRef = useRef<number | null>(null);
  const queryClient = useQueryClient();

  useEffect(
    function countViewOnce(): void {
      if (post === undefined || countedPostIdRef.current === post.id) {
        return;
      }

      const canCount = shouldCountView({
        postId: post.id,
        sellerId: post.seller.id,
        viewerId,
        viewedIds: readViewedPostIds(),
      });
      if (!canCount) {
        return;
      }

      countedPostIdRef.current = post.id;
      rememberViewedPost(post.id);

      const postId = post.id;
      incrementViewCount(postId)
        .then(function reflectIncrement(): void {
          // 서버에서 올랐으니 화면에도 지금 반영한다. 다시 받아올 필요는 없다.
          queryClient.setQueryData(
            postDetailQueryKey(postId, viewerId),
            function bumpViewCount(previous: PostDetail | undefined): PostDetail | undefined {
              if (previous === undefined) {
                return previous;
              }
              return { ...previous, viewCount: previous.viewCount + 1 };
            },
          );
        })
        .catch(function ignoreViewCountFailure(): void {
          // 조회수는 곁가지다. 실패를 사용자에게 알리지 않는다.
        });
    },
    [post, viewerId, queryClient],
  );
}
