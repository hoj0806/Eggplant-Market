import { Link } from "react-router-dom";
import styled from "styled-components";

const StyledNavigation = styled.nav``;

const StyledNavList = styled.ol`
  display: flex;
  gap: 2rem;
  font-size: 1.4rem;
  position: relative;

  &:has(a:hover) a:not(:hover) {
    color: #aaa;
  }

  a {
    color: black;
    transition: color 0.2s;
    text-decoration: none;
  }

  a:hover {
    color: black;
  }
`;

const Navigation = () => {
  return (
    <StyledNavigation>
      <StyledNavList>
        <Link to='/'>메인으로</Link>
        <Link to='/product/new'>물건팔기</Link>
        <Link to='/product/new'>내 정보</Link>
      </StyledNavList>
    </StyledNavigation>
  );
};

export default Navigation;
