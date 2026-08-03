import { MY_POSTS_PAGE_SIZE } from '../api/myPostsApi';
import type { MyPostCursor, MyPostSummary } from '../types';

/**
 * 방금 받은 페이지를 보고 다음 커서를 정한다.
 *
 * 규칙은 게시물 검색(post/utils/postSearchCursor)과 같다 — 한 페이지가 다 차지 않았으면
 * 뒤에 남은 것이 없다는 뜻이라 여기서 멈춘다. 딱 떨어질 때 한 번 헛걸음하는 것도 그대로다.
 *
 * 다른 점은 커서의 앞 절반이 bumped_at이 아니라 sortAt이라는 것뿐이다.
 * 목록마다 정렬 기준이 달라(찜한 때·본 때·구매한 때·끌올한 때) 그 값이 곧 커서다.
 *
 * TanStack Query의 getNextPageParam은 undefined를 "다음 없음"으로 읽는다.
 */
export function toNextMyPostCursor(lastPage: MyPostSummary[]): MyPostCursor | undefined {
  if (lastPage.length < MY_POSTS_PAGE_SIZE) {
    return undefined;
  }

  const lastPost = lastPage[lastPage.length - 1];

  return { sortAt: lastPost.sortAt, id: lastPost.id };
}
