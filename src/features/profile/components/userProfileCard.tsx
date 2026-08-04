import ProfileAvatar from './profileAvatar';
import { toTemperatureRatio, toTemperatureText } from '../utils/mannerTemperature';
import type { UserProfile } from '../types';

type UserProfileCardProps = {
  profile: UserProfile;
};

const COUNT_LABEL_CLASS = 'block text-xs text-gray-500 dark:text-gray-400';
const COUNT_VALUE_CLASS = 'block text-base font-semibold text-gray-900 dark:text-gray-50';

/** "2026년 8월 가입". 며칠인지까지는 남을 볼 때 쓸모가 없다. */
function toJoinedText(createdAt: string): string {
  const joined = new Date(createdAt);

  if (Number.isNaN(joined.getTime())) {
    return '';
  }

  return `${joined.getFullYear()}년 ${joined.getMonth() + 1}월 가입`;
}

/**
 * 남의 프로필 머리말.
 *
 * 마이페이지 카드(MyProfileCard)와 담는 것이 다르다 — 설정으로 가는 길 대신 **판단 재료**가 온다.
 * 매너온도에 눈금을 붙인 것도 같은 이유다. 36.5°라는 숫자만으로는 그게 높은지 낮은지
 * 알 수 없는데, 이 화면은 "이 사람과 거래해도 되나"를 정하러 오는 자리다.
 */
function UserProfileCard(props: UserProfileCardProps) {
  const profile = props.profile;
  const temperaturePercent = Math.round(toTemperatureRatio(profile.mannerTemp) * 100);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <ProfileAvatar nickname={profile.nickname} avatarUrl={profile.avatarUrl} size="lg" />

        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-gray-50">
            {profile.nickname}
          </h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {profile.dongName ?? '동네 미설정'}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {toJoinedText(profile.createdAt)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">매너온도</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            {toTemperatureText(profile.mannerTemp)}
          </span>
        </div>

        {/* 눈금은 장식이라 스크린리더에서 숨긴다 — 같은 값을 바로 위에서 이미 읽어 준다. */}
        <div
          aria-hidden="true"
          className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
        >
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${temperaturePercent}%` }}
          />
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-900">
        <div>
          <dt className={COUNT_LABEL_CLASS}>판매중</dt>
          <dd className={COUNT_VALUE_CLASS}>{profile.sellingCount}</dd>
        </div>
        <div>
          <dt className={COUNT_LABEL_CLASS}>거래완료</dt>
          <dd className={COUNT_VALUE_CLASS}>{profile.soldCount}</dd>
        </div>
        <div>
          <dt className={COUNT_LABEL_CLASS}>받은 후기</dt>
          <dd className={COUNT_VALUE_CLASS}>{profile.reviewCount}</dd>
        </div>
      </dl>
    </section>
  );
}

export default UserProfileCard;
