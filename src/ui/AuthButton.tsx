import styled from "styled-components";
import { useUser } from "../features/authentication/useUser";
import { useLogout } from "../features/authentication/useLogout";
import { useNavigate } from "react-router-dom";
import media from "../styles/media";

const StyledButton = styled.button`
  background-color: #7b2cbf;
  color: white;
  font-size: 1.4rem;
  font-weight: bold;
  padding: 0.5rem 1.5rem;
  border-radius: 0.5rem;

  ${media.medium`
    display: none;
`}
`;

const AuthButton = () => {
  const { isAuthenticated } = useUser();
  const { logout } = useLogout();
  const navigate = useNavigate();

  const navigateLoginPage = () => {
    navigate("/login");
  };

  const handleClick = () => {
    if (isAuthenticated) {
      logout();
      return;
    }
    navigateLoginPage();
  };

  return (
    <StyledButton onClick={handleClick}>
      {isAuthenticated ? "로그아웃" : "로그인"}
    </StyledButton>
  );
};

export default AuthButton;
