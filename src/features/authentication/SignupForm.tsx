import Input from "../../ui/AuthenticationInput";
import Button from "../../ui/Button";
import Form from "../../ui/Form";
import FormRow from "../../ui/FormRow";
import { useSignup } from "./useSignup";
import { useForm } from "react-hook-form";

type FormValues = {
  nickname: string;
  email: string;
  password: string;
  passwordConfirm: string;
};

const SignupForm = () => {
  const { signup, isPending } = useSignup();

  const { register, handleSubmit } = useForm<FormValues>();

  const onSubmit = ({ nickname, email, password }) => {
    signup({
      nickname,
      email,
      password,
    });
  };

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <FormRow label='닉네임' htmlFor='nickname'>
        <Input type='text' id='nickname' {...register("nickname")} />
      </FormRow>
      <FormRow label='이메일' htmlFor='email'>
        <Input type='email' id='email' {...register("email")} />
      </FormRow>
      <FormRow label='비밀번호' htmlFor='password'>
        <Input type='password' id='password' {...register("password")} />
      </FormRow>
      <FormRow label='비밀번호 확인' htmlFor='passwordConfirm'>
        <Input
          type='password'
          id='passwordConfirm'
          {...register("passwordConfirm")}
        />
      </FormRow>
      <FormRow>
        <Button disabled={isPending}>
          {isPending ? "회원가입 중..." : "회원가입"}
        </Button>
      </FormRow>
    </Form>
  );
};

export default SignupForm;
