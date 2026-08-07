import { User } from 'lucide-react';

export type ProfileAvatarSize = 'sm' | 'md' | 'lg';

type ProfileAvatarProps = {
  nickname: string;
  /** null이면 닉네임 첫 글자로 만든 기본 이미지를 보여준다. */
  avatarUrl: string | null;
  size: ProfileAvatarSize;
};

/** 아이콘 크기는 원 크기를 따라간다. 작은 원에 큰 아이콘을 넣으면 테두리에 닿는다. */
const ICON_SIZE: Record<ProfileAvatarSize, number> = { sm: 16, md: 22, lg: 40 };

const SIZE_CLASS: Record<ProfileAvatarSize, string> = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-12 w-12 text-lg',
  lg: 'h-24 w-24 text-3xl',
};

/**
 * 이모지·결합 문자를 쪼개지 않도록 코드 포인트 단위로 자른다.
 *
 * 닉네임이 비어 있으면 **글자가 없다.** 예전에는 `🍆`를 대신 넣었는데, 그건
 * "이 사람의 첫 글자"가 아니라 브랜드 표식이라 자리에 맞지 않았다 —
 * 이제 사람 아이콘을 그린다(아래 `null` 갈래).
 */
function toInitial(nickname: string): string | null {
  const trimmed = nickname.trim();
  if (trimmed.length === 0) {
    return null;
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
      {toInitial(props.nickname) ?? <User size={ICON_SIZE[props.size]} />}
    </span>
  );
}

export default ProfileAvatar;
