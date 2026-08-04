import { Link } from 'react-router-dom';
import ProfileAvatar from '../../profile/components/profileAvatar';
import { toTemperatureText } from '../../profile/utils/mannerTemperature';
import type { PostSeller } from '../types';

type PostSellerCardProps = {
  seller: PostSeller;
  dongName: string | null;
};

/**
 * 게시물 상세의 판매자 줄.
 *
 * 이름과 사진이 프로필로 가는 링크다 — 여기가 "이 사람 믿을 만한가"를 확인하러 떠나는 입구다.
 * 매너온도는 링크 밖에 둔다. 안에 넣으면 스크린리더가 링크 이름에 온도까지 섞어 읽는다.
 */
function PostSellerCard(props: PostSellerCardProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-y border-gray-200 py-4 dark:border-gray-800">
      <Link
        to={`/users/${props.seller.id}`}
        className="flex min-w-0 items-center gap-3 rounded-lg p-1 transition hover:bg-gray-50
                   dark:hover:bg-gray-900"
      >
        <ProfileAvatar
          nickname={props.seller.nickname}
          avatarUrl={props.seller.avatarUrl}
          size="md"
        />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-gray-900 dark:text-gray-50">
            {props.seller.nickname}
          </span>
          <span className="truncate text-sm text-gray-500 dark:text-gray-400">
            {props.dongName ?? '동네 정보 없음'}
          </span>
        </div>
      </Link>

      <span className="shrink-0 text-right">
        <span className="block text-xs text-gray-500 dark:text-gray-400">매너온도</span>
        <span className="block font-semibold text-emerald-600 dark:text-emerald-400">
          {toTemperatureText(props.seller.mannerTemp)}
        </span>
      </span>
    </div>
  );
}

export default PostSellerCard;
