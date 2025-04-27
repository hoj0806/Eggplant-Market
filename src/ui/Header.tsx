import styled from "styled-components";
import HeaderProfile from "./HeaderProfile";
import Logo from "./Logo";
import Navigation from "./Navigation";
import AuthButton from "./AuthButton";
import { useUser } from "../features/authentication/useUser";
import media from "../styles/media";
import HeaderMenuIcon from "./HeaderMenuIcon";

const Header = () => {
  const StyledHeader = styled.header`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;

    ${media.medium`
      padding-left :1rem;
      padding-right :1rem;

    `}
  `;

  const { isAuthenticated } = useUser();

  return (
    <StyledHeader>
      <Logo />
      <Navigation />
      {/* {isAuthenticated && <HeaderProfile />} */}
      <AuthButton />
      <HeaderMenuIcon />
    </StyledHeader>
  );
};

export default Header;
