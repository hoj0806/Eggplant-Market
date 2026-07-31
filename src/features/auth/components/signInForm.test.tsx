import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignInForm from './signInForm';

describe('SignInForm', function signInFormSuite() {
  it('이메일 형식이 틀리면 오류를 보여주고 onSubmit을 호출하지 않는다', async function invalidEmailCase() {
    const handleSubmit = jest.fn();
    render(<SignInForm isPending={false} onSubmit={handleSubmit} />);

    await userEvent.type(screen.getByLabelText('이메일'), 'eggplant.example.com');
    await userEvent.type(screen.getByLabelText('비밀번호'), 'eggplant1234');
    await userEvent.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByText('이메일 형식이 올바르지 않습니다.')).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('올바른 입력이면 onSubmit을 호출한다', async function validSubmitCase() {
    const handleSubmit = jest.fn();
    render(<SignInForm isPending={false} onSubmit={handleSubmit} />);

    await userEvent.type(screen.getByLabelText('이메일'), 'eggplant@example.com');
    await userEvent.type(screen.getByLabelText('비밀번호'), 'eggplant1234');
    await userEvent.click(screen.getByRole('button', { name: '로그인' }));

    expect(handleSubmit).toHaveBeenCalledWith({
      email: 'eggplant@example.com',
      password: 'eggplant1234',
    });
  });

  it('처리 중에는 버튼이 잠긴다', function pendingCase() {
    render(<SignInForm isPending onSubmit={jest.fn()} />);

    expect(screen.getByRole('button', { name: '로그인 중…' })).toBeDisabled();
  });
});
