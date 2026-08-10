import type { InfiniteData } from '@tanstack/react-query';
import type { PostComment } from '../types';

/**
 * 댓글 캐시를 고치는 순수 함수들.
 *
 * 목록이 페이징되면서 캐시 모양이 `PostComment[]`에서 `InfiniteData<PostComment[]>`로
 * 바뀌었다. 세 뮤테이션(쓰기·고치기·지우기)이 같은 자리를 만지므로 여기 모은다 —
 * 알림이 `notificationCache`로 같은 일을 한 자리와 같은 모양이다.
 *
 * **무효화하지 않는다.** 무한 스크롤은 커서를 이어 붙인 것이라 다시 부르면 첫 페이지만
 * 남고 아래로 읽어 둔 것이 전부 날아간다. 댓글 한 줄 때문에 그럴 이유가 없다.
 */

/**
 * 새 댓글을 **마지막 페이지 끝**에 붙인다.
 *
 * 끝인 이유는 순서다 — 댓글은 오래된 것이 위라 방금 쓴 것이 맨 아래다.
 * 답글도 같은 자리에 붙는다. 캐시는 평평한 채로 두고 트리는 그릴 때 접으므로
 * (`buildCommentTree`), 끝에 붙은 답글이 자기 부모 밑으로 알아서 들어간다.
 *
 * **캐시가 없으면 아무것도 하지 않는다.** 목록을 한 번도 안 받아 온 상태에서 배열을 새로
 * 만들면 "방금 쓴 댓글 하나만 있는 목록"이 되고, 그것이 전부인 줄 알게 된다.
 */
export function withAppendedComment(
  data: InfiniteData<PostComment[]> | undefined,
  created: PostComment,
): InfiniteData<PostComment[]> | undefined {
  if (data === undefined || data.pages.length === 0) {
    return data;
  }

  const lastIndex = data.pages.length - 1;

  return {
    ...data,
    pages: data.pages.map(function appendToLast(page: PostComment[], index: number): PostComment[] {
      return index === lastIndex ? [...page, created] : page;
    }),
  };
}

/** 고친 댓글을 제자리에서 바꾼다. 어느 페이지에 있든 찾는다. */
export function withUpdatedComment(
  data: InfiniteData<PostComment[]> | undefined,
  updated: PostComment,
): InfiniteData<PostComment[]> | undefined {
  if (data === undefined) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map(function replaceInPage(page: PostComment[]): PostComment[] {
      return page.map(function swapOne(comment: PostComment): PostComment {
        return comment.id === updated.id ? updated : comment;
      });
    }),
  };
}

/**
 * 지운 댓글과 **거기 딸린 답글**을 함께 빼낸다.
 *
 * 서버에서는 FK가 cascade라 한 번의 delete로 둘 다 사라지는데(0001), 캐시에서 부모만
 * 걷어내면 남은 답글이 부모를 잃는다 — `buildCommentTree`가 그것을 1단으로 올려 그리므로
 * 지워진 대화가 맥락 없이 떠오른다. 0017이 한 번 겪고 고친 자리라 페이징을 얹으면서도
 * 그대로 지킨다.
 *
 * 페이지가 통째로 비어도 그 페이지를 없애지 않는다. 페이지 배열은 커서의 흔적이라
 * 개수가 줄면 `getNextPageParam`이 보는 마지막 페이지가 달라진다.
 */
export function withoutComment(
  data: InfiniteData<PostComment[]> | undefined,
  commentId: number,
): InfiniteData<PostComment[]> | undefined {
  if (data === undefined) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map(function removeFromPage(page: PostComment[]): PostComment[] {
      return page.filter(function keepOthers(comment: PostComment): boolean {
        return comment.id !== commentId && comment.parentId !== commentId;
      });
    }),
  };
}
