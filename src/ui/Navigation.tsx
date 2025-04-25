import { Link } from "react-router-dom";
import styled from "styled-components";

const Navigation = () => {
  const StyledNavigation = styled.nav``;

  const StyledNavList = styled.ol`
    display: flex;
    gap: 2rem;
    font-size: 1.8rem;
  `;

  return (
    <StyledNavigation>
      <StyledNavList>
        <Link to='/'>메인으로</Link>
        <Link to='/login'>로그인</Link>
        <Link to='/signup'>회원가입</Link>
        <Link to='/product/new'>물건팔기</Link>
        <Link to='/product/new'>내 정보</Link>
      </StyledNavList>
    </StyledNavigation>
  );
};

export default Navigation;
