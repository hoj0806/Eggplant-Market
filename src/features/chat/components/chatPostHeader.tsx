import { Link } from 'react-router-dom';
import { formatPrice } from '../../../shared/utils/formatPrice';
import PostStatusBadge from '../../post/components/postStatusBadge';
import PostStatusControl from '../../post/components/postStatusControl';
import { isSaleRoom } from '../utils/chatRoomFilter';
import type { ChatRoomSummary } from '../types';

type ChatPostHeaderProps = {
  room: ChatRoomSummary;
  viewerId: string;
};

/**
 * 채팅방 위에 고정된 상품 요약.
 *
 * 판매자에게는 여기서도 상태를 바꿀 수 있게 한다. 당근에서 가장 자연스러운 거래완료 동선이
 * "이 사람과 거래를 마쳤다"이기 때문이다. 그래서 상대를 고르는 목록에 **이 방 상대가
 * 미리 골라져** 있다.
 *
 * 지금 누가 예약자인지는 넘기지 않는다(`buyer={null}`). 채팅 화면은 게시물 상세를 읽지 않고
 * fetch_chat_room이 주는 요약만 보기 때문이다 — 상세를 읽게 하면 chat이 post API에 의존하게 된다.
 * 대신 이 방 상대가 후보 목록에서 미리 골라져 있어 실제로 고르는 데는 지장이 없다.
 */
function ChatPostHeader(props: ChatPostHeaderProps) {
  const room = props.room;
  // 판매자 판정은 목록의 판매/구매 구분과 같은 규칙이어야 한다. 한곳에서 가져온다.
  const isSeller = isSaleRoom(room, props.viewerId);

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
      <Link to={`/posts/${room.postId}`} className="flex items-center gap-3">
        {room.postThumbnailUrl === null ? (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[10px] text-gray-400 dark:bg-gray-800">
            사진 없음
          </span>
        ) : (
          <img
            src={room.postThumbnailUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg bg-gray-100 object-cover dark:bg-gray-800"
          />
        )}

        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <PostStatusBadge status={room.postStatus} />
            <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-50">
              {room.postTitle}
            </span>
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            {formatPrice(room.postPrice)}
          </span>
        </div>
      </Link>

      {isSeller ? (
        <PostStatusControl
          postId={room.postId}
          status={room.postStatus}
          buyer={null}
          viewerId={props.viewerId}
          defaultPartnerId={room.partner.id}
        />
      ) : null}
    </section>
  );
}

export default ChatPostHeader;
