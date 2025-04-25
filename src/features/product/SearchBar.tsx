import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import styled from "styled-components";

const StyledInputContainer = styled.div`
  background-color: orange;
  position: relative;
  width: 100%;
`;

const StyledInput = styled.input`
  padding: 2rem;
  width: 100%;
  border-radius: 4rem;
  padding-right: 4rem; /* 버튼 여백을 위해 오른쪽 패딩 추가 */
  font-size: 1.6rem;
`;

const StyledButton = styled.button`
  position: absolute;
  right: 1rem; /* 오른쪽 끝으로 위치 */
  top: 50%;
  transform: translateY(-50%);
  background-color: #ff6f0f;
  border: none;
  padding: 1rem;
  border-radius: 2rem;
  cursor: pointer;
`;

const SearchBar = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState(
    searchParams.get("search") || ""
  );

  const handleSearch = () => {
    searchParams.set("search", searchValue);
    setSearchParams(searchParams);
  };

  return (
    <StyledInputContainer>
      <StyledInput
        type='text'
        onChange={(e) => setSearchValue(e.target.value)}
        value={searchValue}
        placeholder='필요한 물건을 검색해 보세요.'
      />
      <StyledButton onClick={handleSearch}>검색</StyledButton>
    </StyledInputContainer>
  );
};

export default SearchBar;
