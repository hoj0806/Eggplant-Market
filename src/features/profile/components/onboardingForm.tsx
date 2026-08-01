import { useState, type FormEvent } from 'react';
import AvatarPicker from './avatarPicker';
import TextField from '../../../shared/ui/textField';
import SubmitButton from '../../../shared/ui/submitButton';
import type { ProfileFieldErrors, ProfileOnboardingValues } from '../types';
import {
  hasProfileFieldError,
  validateProfileOnboardingValues,
} from '../utils/validateProfileInput';

type OnboardingFormProps = {
  isPending: boolean;
  onSubmit(values: ProfileOnboardingValues): void;
};

const EMPTY_ONBOARDING_VALUES: ProfileOnboardingValues = {
  nickname: '',
  avatarFile: null,
};

const NICKNAME_MAX_LENGTH = 12;

function OnboardingForm(props: OnboardingFormProps) {
  const [values, setValues] = useState<ProfileOnboardingValues>(EMPTY_ONBOARDING_VALUES);
  const [errors, setErrors] = useState<ProfileFieldErrors>({});

  function updateNickname(nickname: string): void {
    setValues(function mergeNickname(previous) {
      return { ...previous, nickname };
    });
  }

  function updateAvatarFile(avatarFile: File | null): void {
    setValues(function mergeAvatarFile(previous) {
      return { ...previous, avatarFile };
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
    });
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
      <AvatarPicker
        nickname={values.nickname}
        file={values.avatarFile}
        errorMessage={errors.avatarFile}
        disabled={props.isPending}
        onFileChange={updateAvatarFile}
      />

      <TextField
        id="nickname"
        label="닉네임"
        value={values.nickname}
        placeholder="이웃에게 보여질 이름"
        description="한글, 영문, 숫자, 밑줄(_) 2~12자. 나중에 바꿀 수 있어요."
        maxLength={NICKNAME_MAX_LENGTH}
        autoComplete="nickname"
        errorMessage={errors.nickname}
        disabled={props.isPending}
        onValueChange={updateNickname}
      />

      <SubmitButton label="시작하기" pendingLabel="저장 중…" isPending={props.isPending} />
    </form>
  );
}

export default OnboardingForm;
