import styled from "styled-components";
import ProductGrid from "../features/product/ProductGrid";
import CategotyFilter from "./CategoryFilter";
import PriceFilter from "./PriceFilter";

const StyledMainSection = styled.section`
  display: flex;
  gap: 6rem;
`;

const MainSection = () => {
  return (
    <StyledMainSection>
      <CategotyFilter />
      <PriceFilter />
      <ProductGrid />
    </StyledMainSection>
  );
};

export default MainSection;
