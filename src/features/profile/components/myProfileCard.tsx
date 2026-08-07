import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProfileAvatar from './profileAvatar';
import { toTemperatureText } from '../utils/mannerTemperature';
import type { Profile } from '../types';

type MyProfileCardProps = {
  profile: Profile;
};

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

        {/*
          기록으로 들어가는 길을 **숫자 자체**에 붙였다. "왜 이 값이지"를 묻는 순간이
          곧 이 숫자를 보는 순간이라, 메뉴 목록에 아홉 번째 줄을 더하는 것보다 가깝다
          (myPageMenu의 순서는 자주 여는 것부터라는 규칙을 지키고 있다).
        */}
        <Link to="/my/manner" className="shrink-0 rounded-lg text-right transition hover:opacity-80">
          <span className="block text-xs text-gray-500 dark:text-gray-400">매너온도 기록</span>
          <span className="flex items-center justify-end gap-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
            {toTemperatureText(profile.mannerTemp)}
            <ChevronRight size={14} className="text-gray-400" />
          </span>
        </Link>
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
