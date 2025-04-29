import { Link } from "react-router-dom";
import styled from "styled-components";
import media from "../styles/media";

const StyledNavigation = styled.nav`
  ${media.medium`
    display: none;
  `}
`;

const StyledNavList = styled.ol`
  display: flex;
  gap: 2rem;
  font-size: 1.6rem;
  font-weight: bold;
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

const DropdownMenu = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  display: none;
  flex-direction: column;
  background-color: white;
  border: 1px solid #ccc;
  padding: 0.5rem 0;
  width: 180px;
  z-index: 10;

  ${StyledNavList}:hover & {
    display: flex;
  }
`;

const DropdownItem = styled(Link)`
  color: black;
  padding: 0.8rem 1.2rem;
  text-decoration: none;
  font-size: 1.4rem;
  font-weight: normal;
  transition: background-color 0.3s, color 0.3s;

  &:hover {
    background-color: #f0f0f0;
    color: #007bff;
  }
`;

const Navigation = () => {
  return (
    <StyledNavigation>
      <StyledNavList>
        <Link to='/'>메인으로</Link>
        <Link to='/product/new'>물건팔기</Link>
        <StyledNavList>
          <Link to='/product/new'>내 정보</Link>
          <DropdownMenu>
            <DropdownItem to='/my/posts'>내 게시물</DropdownItem>
            <DropdownItem to='/my/requests'>내 요청</DropdownItem>
            <DropdownItem to='/my-records'>내 기록</DropdownItem>
            <DropdownItem to='/account-settings'>계정 관리</DropdownItem>
          </DropdownMenu>
        </StyledNavList>
      </StyledNavList>
    </StyledNavigation>
  );
};

export default Navigation;
