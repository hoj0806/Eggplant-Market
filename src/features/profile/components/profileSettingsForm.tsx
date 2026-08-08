import { useState, type FormEvent } from 'react';
import AvatarPicker from './avatarPicker';
import SubmitButton from '../../../shared/ui/submitButton';
import TextField from '../../../shared/ui/textField';
import {
  hasProfileFieldError,
  validateProfileOnboardingValues,
} from '../utils/validateProfileInput';
import type { ProfileEditValues, ProfileFieldErrors } from '../types';

type ProfileSettingsFormProps = {
  /** 지금 저장돼 있는 닉네임. */
  initialNickname: string;
  /** 지금 저장돼 있는 사진. null이면 기본 이미지를 쓰는 중이다. */
  currentAvatarUrl: string | null;
  isPending: boolean;
  onSubmit(values: ProfileEditValues): void;
};

const NICKNAME_MAX_LENGTH = 12;

/**
 * 프로필 수정 폼 — 닉네임과 사진.
 *
 * 온보딩 폼(onboardingForm)과 입력은 같지만 "사진 없음"의 뜻이 하나 더 있다.
 *   avatarFile === null && !removeAvatar  → 사진은 그대로 둔다
 *   removeAvatar                          → 기본 이미지로 되돌린다
 * 그래서 값 타입을 따로 두고 폼도 따로 둔다. 검증은 온보딩 것을 그대로 쓴다.
 */
function ProfileSettingsForm(props: ProfileSettingsFormProps) {
  const [values, setValues] = useState<ProfileEditValues>({
    nickname: props.initialNickname,
    avatarFile: null,
    removeAvatar: false,
  });
  const [errors, setErrors] = useState<ProfileFieldErrors>({});

  function updateNickname(nickname: string): void {
    setValues(function mergeNickname(previous) {
      return { ...previous, nickname };
    });
  }

  /** 새 사진을 고르면 되돌리기는 풀린다. 두 뜻이 동시에 서면 무엇을 저장할지 알 수 없다. */
  function updateAvatarFile(avatarFile: File | null): void {
    setValues(function mergeAvatarFile(previous) {
      return { ...previous, avatarFile, removeAvatar: false };
    });
  }

  function removeAvatar(): void {
    setValues(function markRemoved(previous) {
      return { ...previous, avatarFile: null, removeAvatar: true };
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const nextErrors = validateProfileOnboardingValues(values);
    setErrors(nextErrors);
    if (hasProfileFieldError(nextErrors)) {
      return;
    }

    props.onSubmit({
      nickname: values.nickname.trim(),
      avatarFile: values.avatarFile,
      removeAvatar: values.removeAvatar,
    });
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
      <AvatarPicker
        nickname={values.nickname}
        file={values.avatarFile}
        currentAvatarUrl={props.currentAvatarUrl}
        isRemoved={values.removeAvatar}
        errorMessage={errors.avatarFile}
        disabled={props.isPending}
        onFileChange={updateAvatarFile}
        onRemove={removeAvatar}
      />

      <TextField
        id="nickname"
        label="닉네임"
        value={values.nickname}
        placeholder="이웃에게 보여질 이름"
        description="한글, 영문, 숫자, 밑줄(_) 2~12자."
        maxLength={NICKNAME_MAX_LENGTH}
        autoComplete="nickname"
        errorMessage={errors.nickname}
        disabled={props.isPending}
        onValueChange={updateNickname}
      />

      <SubmitButton label="저장" pendingLabel="저장 중…" isPending={props.isPending} />
    </form>
  );
}

export default ProfileSettingsForm;
