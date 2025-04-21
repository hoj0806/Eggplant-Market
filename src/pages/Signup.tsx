import SignupForm from "../features/authentication/SignupForm";
import AuthenticationLayout from "../layout/AuthenticationLayout";

const Signup = () => {
  return (
    <AuthenticationLayout>
      <SignupForm />
    </AuthenticationLayout>
  );
};

export default Signup;
