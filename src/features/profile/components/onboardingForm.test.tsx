import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OnboardingForm from './onboardingForm';
import type { ProfileOnboardingValues } from '../types';

// jsdom에는 objectURL 구현이 없다. AvatarPicker의 미리보기가 이 API를 쓴다.
beforeAll(function stubObjectUrl() {
  URL.createObjectURL = jest.fn(function createObjectUrl() {
    return 'blob:preview';
  });
  URL.revokeObjectURL = jest.fn();
});

const EMPTY_VALUES: ProfileOnboardingValues = { nickname: '', avatarFile: null };

const NEXT_LABEL = '다음';

function createImageFile(name: string, type: string): File {
  return new File(['image-bytes'], name, { type });
}

type RenderOptions = {
  isPending?: boolean;
  initialValues?: ProfileOnboardingValues;
  onSubmit?: jest.Mock;
};

function renderForm(options: RenderOptions = {}) {
  const handleSubmit = options.onSubmit ?? jest.fn();

  render(
    <OnboardingForm
      initialValues={options.initialValues ?? EMPTY_VALUES}
      submitLabel={NEXT_LABEL}
      isPending={options.isPending === true}
      onSubmit={handleSubmit}
    />,
  );

  return handleSubmit;
}

describe('OnboardingForm', function onboardingFormSuite() {
  it('빈 값으로 제출하면 닉네임 오류를 보여주고 onSubmit을 호출하지 않는다', async function emptySubmitCase() {
    const handleSubmit = renderForm();

    await userEvent.click(screen.getByRole('button', { name: NEXT_LABEL }));

    expect(await screen.findByText('닉네임을 입력해 주세요.')).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('사진을 고르지 않아도 닉네임만으로 다음 단계로 넘어간다', async function nicknameOnlyCase() {
    const handleSubmit = renderForm();

    await userEvent.type(screen.getByLabelText('닉네임'), '  가지마켓  ');
    await userEvent.click(screen.getByRole('button', { name: NEXT_LABEL }));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith({ nickname: '가지마켓', avatarFile: null });
  });

  it('initialValues의 닉네임을 채운 채로 시작한다', function prefillCase() {
    renderForm({ initialValues: { nickname: '기존닉네임', avatarFile: null } });

    expect(screen.getByLabelText('닉네임')).toHaveValue('기존닉네임');
  });

  it('사진을 고르지 않았을 때는 기본 이미지를 보여준다', function defaultAvatarCase() {
    renderForm();

    expect(screen.getByLabelText('님의 기본 프로필 이미지')).toBeInTheDocument();
  });

  it('고른 사진과 닉네임을 함께 넘긴다', async function withAvatarCase() {
    const file = createImageFile('avatar.png', 'image/png');
    const handleSubmit = renderForm();

    await userEvent.upload(screen.getByLabelText('프로필 사진'), file);
    await userEvent.type(screen.getByLabelText('닉네임'), '가지마켓');
    await userEvent.click(screen.getByRole('button', { name: NEXT_LABEL }));

    expect(handleSubmit).toHaveBeenCalledWith({ nickname: '가지마켓', avatarFile: file });
  });

  it('사진을 고르면 미리보기를 보여주고, 기본 이미지로 되돌릴 수 있다', async function resetAvatarCase() {
    renderForm();

    await userEvent.upload(
      screen.getByLabelText('프로필 사진'),
      createImageFile('avatar.png', 'image/png'),
    );
    expect(await screen.findByRole('img', { name: '님의 프로필 사진' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '기본 이미지 사용' }));

    expect(screen.getByLabelText('님의 기본 프로필 이미지')).toBeInTheDocument();
  });

  it('허용하지 않는 형식이면 오류를 보여주고 onSubmit을 호출하지 않는다', async function invalidFileCase() {
    const handleSubmit = renderForm();

    // accept 속성이 파일 선택창을 걸러주지만 드래그·"모든 파일" 선택으로 우회할 수 있다.
    // userEvent.upload는 accept를 존중해 아예 올리지 않으므로, 우회 상황을 직접 만든다.
    const input = screen.getByLabelText('프로필 사진');
    Object.defineProperty(input, 'files', {
      value: [createImageFile('doc.pdf', 'application/pdf')],
    });
    fireEvent.change(input);

    await userEvent.type(screen.getByLabelText('닉네임'), '가지마켓');
    await userEvent.click(screen.getByRole('button', { name: NEXT_LABEL }));

    expect(await screen.findByText('JPG, PNG, WEBP, GIF 형식만 올릴 수 있습니다.')).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('처리 중에는 버튼과 입력을 잠근다', function pendingCase() {
    renderForm({ isPending: true });

    expect(screen.getByRole('button', { name: '저장 중…' })).toBeDisabled();
    expect(screen.getByLabelText('닉네임')).toBeDisabled();
  });
});
