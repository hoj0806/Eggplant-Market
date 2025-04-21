import LoginForm from "../features/authentication/LoginForm";
import AuthenticationLayout from "../layout/AuthenticationLayout";

const Login = () => {
  return (
    <AuthenticationLayout>
      <LoginForm />
    </AuthenticationLayout>
  );
};

export default Login;
