import styled from "styled-components";
import ProductGrid from "../features/product/ProductGrid";
import CategotyFilter from "./CategoryFilter";
import PriceFilter from "./PriceFilter";
import FilterContainer from "./FilterContainer";

const StyledMainSection = styled.section`
  display: flex;
  gap: 2em;
`;

const MainSection = () => {
  return (
    <StyledMainSection>
      <FilterContainer />
      {/* <div>
        <CategotyFilter />
        <PriceFilter />
      </div> */}
      <ProductGrid />
    </StyledMainSection>
  );
};

export default MainSection;
