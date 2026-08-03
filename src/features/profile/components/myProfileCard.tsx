import { Link } from 'react-router-dom';
import ProfileAvatar from './profileAvatar';
import type { Profile } from '../types';

type MyProfileCardProps = {
  profile: Profile;
};

/** 매너온도는 소수 한 자리까지 보여준다. 기본값 36.5°가 그대로 읽혀야 한다(postSellerCard와 같은 규칙). */
function toTemperatureText(mannerTemp: number): string {
  return `${mannerTemp.toFixed(1)}°C`;
}

const ACTION_CLASS =
  'flex-1 rounded-lg border border-gray-300 px-3 py-2 text-center text-sm font-medium ' +
  'text-gray-700 transition hover:bg-gray-50 ' +
  'dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800';

/** 마이페이지 맨 위 — 내 프로필 요약과 두 가지 설정으로 가는 길. */
function MyProfileCard(props: MyProfileCardProps) {
  const profile = props.profile;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ProfileAvatar nickname={profile.nickname} avatarUrl={profile.avatarUrl} size="md" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-semibold text-gray-900 dark:text-gray-50">
              {profile.nickname}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {profile.region?.fullName ?? '동네 미설정'}
            </span>
          </div>
        </div>

        <span className="shrink-0 text-right">
          <span className="block text-xs text-gray-500 dark:text-gray-400">매너온도</span>
          <span className="block font-semibold text-emerald-600 dark:text-emerald-400">
            {toTemperatureText(profile.mannerTemp)}
          </span>
        </span>
      </div>

      <div className="flex gap-2">
        <Link to="/settings/profile" className={ACTION_CLASS}>
          프로필 수정
        </Link>
        <Link to="/settings/region" className={ACTION_CLASS}>
          내 동네 설정
        </Link>
      </div>
    </section>
  );
}

export default MyProfileCard;
