import styled from "styled-components";
import { useUser } from "../features/authentication/useUser";

const StyledButton = styled.button`
  background-color: #7b2cbf;
  color: white;
  font-size: 1.6rem;
  padding: 0.5rem 1.5rem;
  border-radius: 0.5rem;
`;

const AuthButton = () => {
  const { isAuthenticated } = useUser();

  return <StyledButton>{isAuthenticated ? "로그아웃" : "로그인"}</StyledButton>;
};

export default AuthButton;
