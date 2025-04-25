import styled from "styled-components";
import HeaderProfile from "./HeaderProfile";
import Logo from "./Logo";
import Navigation from "./Navigation";
import AuthButton from "./AuthButton";
import { useUser } from "../features/authentication/useUser";

const Header = () => {
  const StyledHeader = styled.header`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
  `;
  const { isAuthenticated } = useUser();

  return (
    <StyledHeader>
      <Logo />
      <Navigation />
      {isAuthenticated && <HeaderProfile />}
      <AuthButton />
    </StyledHeader>
  );
};

export default Header;
