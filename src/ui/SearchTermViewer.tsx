import { useSearchParams } from "react-router-dom";
import styled from "styled-components";

const StyledContainer = styled.div`
  padding-top: 2rem;
  padding-bottom: 2rem;
  font-size: 2.8rem;
  font-weight: bold;
`;

const SearchTermViewer = () => {
  const [searchParams] = useSearchParams();
  const searchTerm = searchParams.get("search");
  return <StyledContainer>"{searchTerm}" 검색결과</StyledContainer>;
};

export default SearchTermViewer;
