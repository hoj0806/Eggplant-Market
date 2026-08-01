export type ProfileAvatarSize = 'sm' | 'md' | 'lg';

type ProfileAvatarProps = {
  nickname: string;
  /** null이면 닉네임 첫 글자로 만든 기본 이미지를 보여준다. */
  avatarUrl: string | null;
  size: ProfileAvatarSize;
};

const FALLBACK_INITIAL = '🍆';

const SIZE_CLASS: Record<ProfileAvatarSize, string> = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-12 w-12 text-lg',
  lg: 'h-24 w-24 text-3xl',
};

/** 이모지·결합 문자를 쪼개지 않도록 코드 포인트 단위로 자른다. */
function toInitial(nickname: string): string {
  const trimmed = nickname.trim();
  if (trimmed.length === 0) {
    return FALLBACK_INITIAL;
  }
  return Array.from(trimmed)[0].toUpperCase();
}

function ProfileAvatar(props: ProfileAvatarProps) {
  const sizeClass = SIZE_CLASS[props.size];

  if (props.avatarUrl !== null) {
    return (
      <img
        src={props.avatarUrl}
        alt={`${props.nickname}님의 프로필 사진`}
        className={`${sizeClass} shrink-0 rounded-full object-cover
                    ring-1 ring-gray-200 dark:ring-gray-700`}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={`${props.nickname}님의 기본 프로필 이미지`}
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full
                  bg-emerald-100 font-semibold text-emerald-700
                  dark:bg-emerald-900 dark:text-emerald-200`}
    >
      {toInitial(props.nickname)}
    </span>
  );
}

export default ProfileAvatar;
