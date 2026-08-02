import ProfileAvatar from '../../profile/components/profileAvatar';
import type { PostSeller } from '../types';

type PostSellerCardProps = {
  seller: PostSeller;
  dongName: string | null;
};

/** 매너온도는 소수 한 자리까지 보여준다. 기본값 36.5°가 그대로 읽혀야 한다. */
function toTemperatureText(mannerTemp: number): string {
  return `${mannerTemp.toFixed(1)}°C`;
}

function PostSellerCard(props: PostSellerCardProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-y border-gray-200 py-4 dark:border-gray-800">
      <div className="flex items-center gap-3">
        <ProfileAvatar
          nickname={props.seller.nickname}
          avatarUrl={props.seller.avatarUrl}
          size="md"
        />
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900 dark:text-gray-50">
            {props.seller.nickname}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {props.dongName ?? '동네 정보 없음'}
          </span>
        </div>
      </div>

      <span className="text-right">
        <span className="block text-xs text-gray-500 dark:text-gray-400">매너온도</span>
        <span className="block font-semibold text-emerald-600 dark:text-emerald-400">
          {toTemperatureText(props.seller.mannerTemp)}
        </span>
      </span>
    </div>
  );
}

export default PostSellerCard;
