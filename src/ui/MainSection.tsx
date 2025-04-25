import styled from "styled-components";
import ProductGrid from "../features/product/ProductGrid";
import CategotyFilter from "./CategoryFilter";

const StyledMainSection = styled.section`
  display: flex;
  gap: 6rem;
`;

const MainSection = () => {
  return (
    <StyledMainSection>
      <CategotyFilter />
      <ProductGrid />
    </StyledMainSection>
  );
};

export default MainSection;
