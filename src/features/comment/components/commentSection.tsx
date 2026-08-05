import { useState } from 'react';
import { Link } from 'react-router-dom';
import CommentForm from './commentForm';
import CommentListItem from './commentListItem';
import { useCreateCommentMutation, useDeleteCommentMutation } from '../hooks/useCommentMutations';
import { usePostCommentsQuery } from '../hooks/useCommentQueries';
import { buildCommentTree, countReplies } from '../utils/buildCommentTree';
import { toCommentErrorMessage } from '../utils/commentErrorMessage';
import type { CommentTreeNode, PostComment } from '../types';

type CommentSectionProps = {
  postId: number;
  /** 비로그인이면 null. 그때는 입력칸 대신 로그인 안내가 온다. */
  viewerId: string | null;
  /** 게시물 판매자. 자기 글의 댓글은 남의 것이라도 지울 수 있다(0017). */
  sellerId: string;
};

const MESSAGE_CLASS = 'py-6 text-center text-sm text-gray-500 dark:text-gray-400';

/** 답글 줄과 답글 입력칸이 함께 들여쓰이는 폭. 아바타(sm) + 간격만큼이다. */
const REPLY_INDENT_CLASS =
  'ml-9 mt-2 flex flex-col gap-2 border-l border-gray-100 pl-3 dark:border-gray-800';

/**
 * 게시물 상세의 댓글 자리.
 *
 * 목록·입력·삭제가 한 컴포넌트에 있다. 셋이 같은 캐시 한 줄(`['comments', postId]`)을 보고
 * 서로의 결과를 바로 반영해야 해서, 나누면 부모가 그 배선만 맡는 껍데기가 된다.
 *
 * 로그인은 댓글을 **쓸 때만** 필요하다. 읽기는 누구에게나 열려 있어(0017의 comments_select)
 * 글만 보러 온 사람도 오간 이야기를 볼 수 있다. 답글 버튼도 같은 이유로 로그인한 사람에게만
 * 보인다 — 눌러 봐야 로그인하라는 말만 다시 하게 된다.
 *
 * 답글 입력칸은 한 번에 하나만 열린다(`replyTargetId`). 여러 개를 열어 두면 어느 칸에
 * 쓰고 있었는지 스스로도 헷갈리고, 등록 버튼이 화면에 여러 개 남는다.
 */
function CommentSection(props: CommentSectionProps) {
  // 폼을 비우는 방법이다. 폼이 값을 들고 있으므로 성공할 때마다 새로 세운다
  // (profileSettingsPage가 저장 뒤 key를 바꾸는 것과 같다).
  // 답글 폼은 성공하면 닫히면서 사라지므로 이 방법이 필요 없다.
  const [formKey, setFormKey] = useState(0);
  const [replyTargetId, setReplyTargetId] = useState<number | null>(null);

  const commentsQuery = usePostCommentsQuery(props.postId);
  const createMutation = useCreateCommentMutation(props.postId, props.viewerId ?? '');
  const deleteMutation = useDeleteCommentMutation(props.postId);

  function handleSubmit(content: string): void {
    if (props.viewerId === null) {
      return;
    }

    createMutation.mutate(
      { content, parentId: null },
      {
        onSuccess: function clearForm(): void {
          setFormKey(function next(previous: number): number {
            return previous + 1;
          });
        },
      },
    );
  }

  function handleReplySubmit(parentId: number, content: string): void {
    if (props.viewerId === null) {
      return;
    }

    createMutation.mutate(
      { content, parentId },
      {
        onSuccess: function closeReplyForm(): void {
          setReplyTargetId(null);
        },
      },
    );
  }

  function handleDelete(commentId: number): void {
    // 답글을 쓰던 중에 그 댓글이 사라지면 입력칸이 부모 없이 남는다.
    if (replyTargetId === commentId) {
      setReplyTargetId(null);
    }
    deleteMutation.mutate(commentId);
  }

  function openReply(commentId: number): void {
    setReplyTargetId(commentId);
  }

  function closeReply(): void {
    setReplyTargetId(null);
  }

  function canDelete(comment: PostComment): boolean {
    if (props.viewerId === null) {
      return false;
    }
    return props.viewerId === comment.author.id || props.viewerId === props.sellerId;
  }

  function isDeleting(commentId: number): boolean {
    return deleteMutation.isPending && deleteMutation.variables === commentId;
  }

  /** 이 폼이 지금 보내는 중인가. 폼이 여럿이라 어느 것인지까지 봐야 한다. */
  function isSubmitting(parentId: number | null): boolean {
    return createMutation.isPending && createMutation.variables?.parentId === parentId;
  }

  const comments = commentsQuery.data ?? [];
  const tree = buildCommentTree(comments);
  // 목록 전체가 같은 순간을 기준으로 "n분 전"을 잰다. 줄마다 new Date()를 부르면
  // 같은 시각에 쓴 댓글들이 1초씩 어긋나 보인다.
  const now = new Date();
  const error = createMutation.error ?? deleteMutation.error;

  function renderReply(reply: PostComment) {
    return (
      <CommentListItem
        key={reply.id}
        comment={reply}
        now={now}
        canDelete={canDelete(reply)}
        isDeleting={isDeleting(reply.id)}
        replyCount={0}
        onDelete={handleDelete}
      />
    );
  }

  function renderNode(node: CommentTreeNode) {
    const commentId = node.comment.id;
    const isReplying = replyTargetId === commentId;

    return (
      <CommentListItem
        key={commentId}
        comment={node.comment}
        now={now}
        canDelete={canDelete(node.comment)}
        isDeleting={isDeleting(commentId)}
        replyCount={countReplies(comments, commentId)}
        onReply={props.viewerId === null ? undefined : openReply}
        onDelete={handleDelete}
      >
        {node.replies.length > 0 || isReplying ? (
          <div className={REPLY_INDENT_CLASS}>
            {node.replies.length > 0 ? (
              <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
                {node.replies.map(renderReply)}
              </ul>
            ) : null}

            {isReplying ? (
              <CommentForm
                fieldId={`comment-reply-${commentId}`}
                label={`${node.comment.author.nickname}님에게 답글`}
                placeholder="답글을 남겨 보세요."
                submitLabel="답글 등록"
                isPending={isSubmitting(commentId)}
                onCancel={closeReply}
                onSubmit={function submitReply(content: string): void {
                  handleReplySubmit(commentId, content);
                }}
              />
            ) : null}
          </div>
        ) : null}
      </CommentListItem>
    );
  }

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
          {tree.map(renderNode)}
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
          fieldId="comment-content"
          label="댓글"
          placeholder="궁금한 점을 물어보세요."
          submitLabel="댓글 등록"
          isPending={isSubmitting(null)}
          onSubmit={handleSubmit}
        />
      )}
    </section>
  );
}

export default CommentSection;
