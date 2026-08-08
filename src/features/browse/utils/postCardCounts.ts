import type { PostSummary } from '../../post/types';

/**
 * 카드 아래에 적는 숫자 줄. 셀 것이 하나도 없으면 null이다.
 *
 * **0인 것은 빼고 적는다.** 지금까지는 찜·조회 둘뿐이라 "찜 0 · 조회 3"도 견딜 만했지만,
 * 댓글이 붙어 셋이 되면서 "찜 0 · 조회 3 · 댓글 0"처럼 **없는 것이 있는 것보다 길어진다.**
 * 카드에서 이 줄은 곁가지라, 셀 것이 있을 때만 자리를 차지하는 편이 맞다.
 *
 * 순서는 찜 · 조회 · 댓글이다. 앞의 둘은 지금까지의 순서 그대로 두고 새것을 뒤에 붙였다 —
 * 익숙한 자리가 움직이면 같은 카드가 달라 보인다.
 */
type PostCardCount = {
  label: string;
  value: number;
};

export function toPostCountsText(post: PostSummary): string | null {
  const counts: ReadonlyArray<PostCardCount> = [
    { label: '찜', value: post.likeCount },
    { label: '조회', value: post.viewCount },
    { label: '댓글', value: post.commentCount },
  ];

  const parts = counts
    .filter(function hasAny(count: PostCardCount): boolean {
      return count.value > 0;
    })
    .map(function toText(count: PostCardCount): string {
      return `${count.label} ${count.value}`;
    });

  return parts.length === 0 ? null : parts.join(' · ');
}
