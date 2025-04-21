import { useForm } from "react-hook-form";
import Input from "../../ui/AuthenticationInput";
import Form from "../../ui/Form";
import FormRow from "../../ui/FormRow";
import Button from "../../ui/Button";

type FormValues = {
  email: string;
  password: string;
};

const LoginForm = () => {
  const { register, handleSubmit } = useForm<FormValues>();

  const onSubmit = ({ email, password }) => {
    console.log(email, password);
  };

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <FormRow label='이메일' htmlFor='email'>
        <Input type='email' id='email' {...register("email")} />
      </FormRow>
      <FormRow label='비밀번호' htmlFor='password'>
        <Input type='password' id='password' {...register("password")} />
      </FormRow>
      <FormRow>
        <Button>로그인</Button>
      </FormRow>
    </Form>
  );
};

export default LoginForm;
