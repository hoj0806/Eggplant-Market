import { useState } from 'react';
import { Link } from 'react-router-dom';
import CommentForm from './commentForm';
import CommentListItem from './commentListItem';
import { useCreateCommentMutation, useDeleteCommentMutation } from '../hooks/useCommentMutations';
import { usePostCommentsQuery } from '../hooks/useCommentQueries';
import { toCommentErrorMessage } from '../utils/commentErrorMessage';
import type { PostComment } from '../types';

type CommentSectionProps = {
  postId: number;
  /** 비로그인이면 null. 그때는 입력칸 대신 로그인 안내가 온다. */
  viewerId: string | null;
  /** 게시물 판매자. 자기 글의 댓글은 남의 것이라도 지울 수 있다(0017). */
  sellerId: string;
};

const MESSAGE_CLASS = 'py-6 text-center text-sm text-gray-500 dark:text-gray-400';

/**
 * 게시물 상세의 댓글 자리.
 *
 * 목록·입력·삭제가 한 컴포넌트에 있다. 셋이 같은 캐시 한 줄(`['comments', postId]`)을 보고
 * 서로의 결과를 바로 반영해야 해서, 나누면 부모가 그 배선만 맡는 껍데기가 된다.
 *
 * 로그인은 댓글을 **쓸 때만** 필요하다. 읽기는 누구에게나 열려 있어(0017의 comments_select)
 * 글만 보러 온 사람도 오간 이야기를 볼 수 있다.
 */
function CommentSection(props: CommentSectionProps) {
  // 폼을 비우는 방법이다. 폼이 값을 들고 있으므로 성공할 때마다 새로 세운다
  // (profileSettingsPage가 저장 뒤 key를 바꾸는 것과 같다).
  const [formKey, setFormKey] = useState(0);

  const commentsQuery = usePostCommentsQuery(props.postId);
  const createMutation = useCreateCommentMutation(props.postId, props.viewerId ?? '');
  const deleteMutation = useDeleteCommentMutation(props.postId);

  function handleSubmit(content: string): void {
    if (props.viewerId === null) {
      return;
    }

    createMutation.mutate(content, {
      onSuccess: function clearForm(): void {
        setFormKey(function next(previous: number): number {
          return previous + 1;
        });
      },
    });
  }

  function handleDelete(commentId: number): void {
    deleteMutation.mutate(commentId);
  }

  function canDelete(comment: PostComment): boolean {
    if (props.viewerId === null) {
      return false;
    }
    return props.viewerId === comment.author.id || props.viewerId === props.sellerId;
  }

  const comments = commentsQuery.data ?? [];
  // 목록 전체가 같은 순간을 기준으로 "n분 전"을 잰다. 줄마다 new Date()를 부르면
  // 같은 시각에 쓴 댓글들이 1초씩 어긋나 보인다.
  const now = new Date();
  const error = createMutation.error ?? deleteMutation.error;

  return (
    <section className="flex flex-col gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        댓글 {commentsQuery.isLoading ? '' : comments.length}
      </h2>

      {error !== null ? (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700
                     dark:border-red-800 dark:bg-red-950 dark:text-red-300"
        >
          {toCommentErrorMessage(error)}
        </p>
      ) : null}

      {commentsQuery.isLoading ? (
        <p className={MESSAGE_CLASS}>댓글을 불러오는 중입니다…</p>
      ) : commentsQuery.isError ? (
        <p className={MESSAGE_CLASS}>댓글을 불러오지 못했습니다.</p>
      ) : comments.length === 0 ? (
        <p className={MESSAGE_CLASS}>아직 댓글이 없어요. 궁금한 점을 물어보세요.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {comments.map(function renderComment(comment: PostComment) {
            return (
              <CommentListItem
                key={comment.id}
                comment={comment}
                now={now}
                canDelete={canDelete(comment)}
                isDeleting={deleteMutation.isPending && deleteMutation.variables === comment.id}
                onDelete={handleDelete}
              />
            );
          })}
        </ul>
      )}

      {props.viewerId === null ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <Link to="/login" className="font-medium text-emerald-600 hover:underline">
            로그인
          </Link>
          하고 댓글을 남겨 보세요.
        </p>
      ) : (
        <CommentForm
          key={formKey}
          isPending={createMutation.isPending}
          onSubmit={handleSubmit}
        />
      )}
    </section>
  );
}

export default CommentSection;
