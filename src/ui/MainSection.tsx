import styled from "styled-components";
import ProductGrid from "../features/product/ProductGrid";

const StyledMainSection = styled.section`
  display: flex;
  gap: 6rem;
`;

const StyledFilterContainer = styled.div`
  width: 24.2rem;
  background-color: blue;
`;
const MainSection = () => {
  return (
    <StyledMainSection>
      <StyledFilterContainer>필터</StyledFilterContainer>
      <ProductGrid />
    </StyledMainSection>
  );
};

export default MainSection;
