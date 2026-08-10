import { Share2 } from 'lucide-react';
import { useState } from 'react';
import { loadKakaoShare } from '../../../shared/lib/kakaoShareLoader';
import { toPostShareTemplate } from '../utils/postShareContent';
import type { PostDetail } from '../types';

type PostShareButtonProps = {
  post: PostDetail;
};

type ShareState = 'idle' | 'sharing' | 'copied' | 'failed';

/**
 * 게시물을 카카오톡으로 보낸다.
 *
 * **로그인을 묻지 않는다.** 공유는 우리 서버에 아무것도 쓰지 않고, 카카오톡 쪽에서 누구에게
 * 보낼지 고르는 일이라 우리가 아는 사람일 필요가 없다. 글만 보러 온 사람이 친구에게
 * 넘기는 것이 오히려 흔한 경로다.
 *
 * ── 안 되는 자리가 있다 ──────────────────────────────────────────────
 * SDK를 못 받거나(네트워크·도메인 미등록) 카카오톡이 없는 기기가 있다. 그때 **아무 일도
 * 일어나지 않으면 "눌렀는데 왜 안 되지"** 가 된다. 그래서 물러설 자리를 둔다 —
 * **주소를 클립보드에 복사**하고 그렇게 말해 준다. 공유의 목적(이 글을 남에게 보낸다)은
 * 그것으로도 이뤄진다.
 *
 * 복사도 막히면(권한 거부·비보안 문맥) 마지막으로 실패를 말한다. 조용히 삼키지 않는다.
 */
function PostShareButton(props: PostShareButtonProps) {
  const [state, setState] = useState<ShareState>('idle');

  async function copyLink(): Promise<void> {
    const url = `${window.location.origin}/posts/${props.post.id}`;

    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('failed');
    }
  }

  async function handleShare(): Promise<void> {
    setState('sharing');

    try {
      const kakao = await loadKakaoShare();

      kakao.Share.sendDefault(toPostShareTemplate(props.post, window.location.origin));
      setState('idle');
    } catch {
      await copyLink();
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        aria-label="카카오톡으로 공유"
        disabled={state === 'sharing'}
        onClick={function share(): void {
          void handleShare();
        }}
        className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600
                   transition hover:bg-gray-100 disabled:opacity-50
                   dark:text-gray-300 dark:hover:bg-gray-800"
      >
        {/* 이름은 위의 aria-label이 맡는다. lucide는 스스로 aria-hidden을 붙인다. */}
        <Share2 size={18} />
      </button>

      {state === 'copied' ? (
        <p role="status" className="text-xs text-gray-500 dark:text-gray-400">
          링크를 복사했어요
        </p>
      ) : null}

      {state === 'failed' ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          공유하지 못했어요
        </p>
      ) : null}
    </div>
  );
}

export default PostShareButton;
