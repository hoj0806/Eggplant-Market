import { Outlet } from "react-router-dom";
import Header from "../ui/Header";
import styled from "styled-components";

const MainLayout = () => {
  const StyledMainWrapper = styled.div`
    background-color: yellow;
  `;

  const ContentWrapper = styled.div`
    background-color: var(--color-accent);
    max-width: 124rem;
    margin: 0 auto;
  `;

  return (
    <StyledMainWrapper>
      <ContentWrapper>
        <Header />
        <Outlet />
      </ContentWrapper>
    </StyledMainWrapper>
  );
};

export default MainLayout;
