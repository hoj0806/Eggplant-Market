import styled from "styled-components";
import HeaderProfile from "./HeaderProfile";
import Logo from "./Logo";
import Navigation from "./Navigation";

const Header = () => {
  const StyledHeader = styled.header`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
  `;

  return (
    <StyledHeader>
      <Logo />
      <Navigation />
      <HeaderProfile />
    </StyledHeader>
  );
};

export default Header;
