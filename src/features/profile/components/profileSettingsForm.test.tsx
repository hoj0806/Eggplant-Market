import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileSettingsForm from './profileSettingsForm';

// jsdom에는 objectURL 구현이 없다. AvatarPicker의 미리보기가 이 API를 쓴다.
beforeAll(function stubObjectUrl() {
  URL.createObjectURL = jest.fn(function createObjectUrl() {
    return 'blob:preview';
  });
  URL.revokeObjectURL = jest.fn();
});

const SAVED_AVATAR_URL =
  'https://hcmpbpeyhmmismxjkkzv.supabase.co/storage/v1/object/public/avatars/user-1/1.png';

const SAVE_LABEL = '저장';

function createImageFile(name: string, type: string): File {
  return new File(['image-bytes'], name, { type });
}

type RenderOptions = {
  currentAvatarUrl?: string | null;
  isPending?: boolean;
  onSubmit?: jest.Mock;
};

function renderForm(options: RenderOptions = {}) {
  const handleSubmit = options.onSubmit ?? jest.fn();

  render(
    <ProfileSettingsForm
      initialNickname="가지마켓"
      currentAvatarUrl={
        options.currentAvatarUrl === undefined ? SAVED_AVATAR_URL : options.currentAvatarUrl
      }
      isPending={options.isPending === true}
      onSubmit={handleSubmit}
    />,
  );

  return handleSubmit;
}

describe('ProfileSettingsForm', function profileSettingsFormSuite() {
  it('지금 쓰는 닉네임과 사진을 채운 채로 시작한다', function prefillCase() {
    renderForm();

    expect(screen.getByLabelText('닉네임')).toHaveValue('가지마켓');
    expect(screen.getByRole('img', { name: '가지마켓님의 프로필 사진' })).toHaveAttribute(
      'src',
      SAVED_AVATAR_URL,
    );
  });

  it('사진을 그대로 두면 avatarFile도 removeAvatar도 비운 채 저장한다', async function keepAvatarCase() {
    const handleSubmit = renderForm();

    await userEvent.click(screen.getByRole('button', { name: SAVE_LABEL }));

    expect(handleSubmit).toHaveBeenCalledWith({
      nickname: '가지마켓',
      avatarFile: null,
      removeAvatar: false,
    });
  });

  it('닉네임이 규칙에 맞지 않으면 저장하지 않는다', async function invalidNicknameCase() {
    const handleSubmit = renderForm();

    await userEvent.clear(screen.getByLabelText('닉네임'));
    await userEvent.type(screen.getByLabelText('닉네임'), '가');
    await userEvent.click(screen.getByRole('button', { name: SAVE_LABEL }));

    expect(await screen.findByText('닉네임은 2자 이상이어야 합니다.')).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('새 사진을 고르면 그 파일을 실어 보낸다', async function newAvatarCase() {
    const file = createImageFile('avatar.png', 'image/png');
    const handleSubmit = renderForm();

    await userEvent.upload(screen.getByLabelText('프로필 사진'), file);
    await userEvent.click(screen.getByRole('button', { name: SAVE_LABEL }));

    expect(handleSubmit).toHaveBeenCalledWith({
      nickname: '가지마켓',
      avatarFile: file,
      removeAvatar: false,
    });
  });

  it('기본 이미지로 되돌리면 removeAvatar를 켜서 보낸다', async function removeAvatarCase() {
    const handleSubmit = renderForm();

    await userEvent.click(screen.getByRole('button', { name: '기본 이미지로' }));

    // 미리보기가 먼저 기본 이미지로 돌아간다.
    expect(screen.getByLabelText('가지마켓님의 기본 프로필 이미지')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: SAVE_LABEL }));

    expect(handleSubmit).toHaveBeenCalledWith({
      nickname: '가지마켓',
      avatarFile: null,
      removeAvatar: true,
    });
  });

  it('되돌린 뒤 새 사진을 고르면 되돌리기는 풀린다', async function reselectAfterRemoveCase() {
    const file = createImageFile('avatar.png', 'image/png');
    const handleSubmit = renderForm();

    await userEvent.click(screen.getByRole('button', { name: '기본 이미지로' }));
    await userEvent.upload(screen.getByLabelText('프로필 사진'), file);
    await userEvent.click(screen.getByRole('button', { name: SAVE_LABEL }));

    expect(handleSubmit).toHaveBeenCalledWith({
      nickname: '가지마켓',
      avatarFile: file,
      removeAvatar: false,
    });
  });

  it('이미 기본 이미지를 쓰는 사용자에게는 되돌리기 버튼을 보여주지 않는다', function noAvatarCase() {
    renderForm({ currentAvatarUrl: null });

    expect(screen.queryByRole('button', { name: '기본 이미지로' })).not.toBeInTheDocument();
  });

  it('저장 중에는 버튼과 입력을 잠근다', function pendingCase() {
    renderForm({ isPending: true });

    expect(screen.getByRole('button', { name: '저장 중…' })).toBeDisabled();
    expect(screen.getByLabelText('닉네임')).toBeDisabled();
  });
});
