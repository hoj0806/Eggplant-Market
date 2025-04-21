import Input from "../../ui/AuthenticationInput";
import Button from "../../ui/Button";
import Form from "../../ui/Form";
import FormRow from "../../ui/FormRow";

const SignupForm = () => {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log(123);
  };

  return (
    <Form onSubmit={handleSubmit}>
      <FormRow label='닉네임' htmlFor='nickname'>
        <Input type='text' id='nickname' />
      </FormRow>
      <FormRow label='이메일' htmlFor='email'>
        <Input type='email' id='email' />
      </FormRow>
      <FormRow label='비밀번호' htmlFor='password'>
        <Input type='password' id='password' />
      </FormRow>
      <FormRow label='비밀번호 확인' htmlFor='passwordConfirm'>
        <Input type='password' id='passwordConfirm' />
      </FormRow>
      <FormRow>
        <Button>회원가입</Button>
      </FormRow>
    </Form>
  );
};

export default SignupForm;
