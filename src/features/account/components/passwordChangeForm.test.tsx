import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PasswordChangeForm from './passwordChangeForm';

async function fill(current: string, next: string, confirm: string): Promise<void> {
  await userEvent.type(screen.getByLabelText('현재 비밀번호'), current);
  await userEvent.type(screen.getByLabelText('새 비밀번호'), next);
  await userEvent.type(screen.getByLabelText('새 비밀번호 확인'), confirm);
  await userEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }));
}

describe('PasswordChangeForm', function passwordChangeFormSuite() {
  it('올바른 입력이면 onSubmit을 호출한다', async function validCase() {
    const handleSubmit = jest.fn();
    render(<PasswordChangeForm isPending={false} onSubmit={handleSubmit} />);

    await fill('eggplant1234', 'eggplant5678', 'eggplant5678');

    expect(handleSubmit).toHaveBeenCalledWith({
      currentPassword: 'eggplant1234',
      newPassword: 'eggplant5678',
      newPasswordConfirm: 'eggplant5678',
    });
  });

  it('확인 값이 다르면 오류를 보여주고 보내지 않는다', async function mismatchCase() {
    const handleSubmit = jest.fn();
    render(<PasswordChangeForm isPending={false} onSubmit={handleSubmit} />);

    await fill('eggplant1234', 'eggplant5678', 'eggplant9999');

    expect(await screen.findByText('비밀번호가 일치하지 않습니다.')).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  // 서버도 거절하지만(same_password) 화면이 알아볼 수 있는 것을 왕복시킬 이유가 없다.
  it('지금과 같은 비밀번호는 보내지 않는다', async function samePasswordCase() {
    const handleSubmit = jest.fn();
    render(<PasswordChangeForm isPending={false} onSubmit={handleSubmit} />);

    await fill('eggplant1234', 'eggplant1234', 'eggplant1234');

    expect(
      await screen.findByText('지금 쓰고 있는 비밀번호와 다른 비밀번호를 입력해 주세요.'),
    ).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('처리 중에는 버튼이 잠긴다', function pendingCase() {
    render(<PasswordChangeForm isPending onSubmit={jest.fn()} />);

    expect(screen.getByRole('button', { name: '변경 중…' })).toBeDisabled();
  });
});
