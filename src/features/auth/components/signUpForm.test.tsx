import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignUpForm from './signUpForm';

describe('SignUpForm', function signUpFormSuite() {
  it('빈 값으로 제출하면 필드 오류를 보여주고 onSubmit을 호출하지 않는다', async function emptySubmitCase() {
    const handleSubmit = jest.fn();
    render(<SignUpForm isPending={false} onSubmit={handleSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: '회원가입' }));

    expect(await screen.findByText('이메일을 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('비밀번호를 입력해 주세요.')).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('비밀번호 확인이 다르면 불일치 오류를 보여준다', async function mismatchCase() {
    const handleSubmit = jest.fn();
    render(<SignUpForm isPending={false} onSubmit={handleSubmit} />);

    await userEvent.type(screen.getByLabelText('이메일'), 'eggplant@example.com');
    await userEvent.type(screen.getByLabelText('비밀번호'), 'eggplant1234');
    await userEvent.type(screen.getByLabelText('비밀번호 확인'), 'eggplant4321');
    await userEvent.click(screen.getByRole('button', { name: '회원가입' }));

    expect(await screen.findByText('비밀번호가 일치하지 않습니다.')).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('올바른 입력이면 공백을 제거한 자격증명으로 onSubmit을 호출한다', async function validSubmitCase() {
    const handleSubmit = jest.fn();
    render(<SignUpForm isPending={false} onSubmit={handleSubmit} />);

    await userEvent.type(screen.getByLabelText('이메일'), '  eggplant@example.com  ');
    await userEvent.type(screen.getByLabelText('비밀번호'), 'eggplant1234');
    await userEvent.type(screen.getByLabelText('비밀번호 확인'), 'eggplant1234');
    await userEvent.click(screen.getByRole('button', { name: '회원가입' }));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith({
      email: 'eggplant@example.com',
      password: 'eggplant1234',
    });
  });

  it('처리 중에는 버튼과 입력을 잠근다', function pendingCase() {
    render(<SignUpForm isPending onSubmit={jest.fn()} />);

    expect(screen.getByRole('button', { name: '가입 중…' })).toBeDisabled();
    expect(screen.getByLabelText('이메일')).toBeDisabled();
  });
});
