import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import styled from "styled-components";

const StyledInputContainer = styled.div`
  background-color: transparent;
  position: relative;
  width: 100%;
`;

const StyledInput = styled.input`
  width: 100%;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #ccc;
  font-size: 1.4rem;
  border-radius: 100rem;
`;

const StyledButton = styled.button`
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  padding: 1rem;
  border-radius: 2rem;
  background-color: gray;
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
      <StyledButton onClick={handleSearch}>
        <svg
          viewBox='0 0 24 24'
          fill='none'
          xmlns='http://www.w3.org/2000/svg'
          data-seed-icon='true'
          data-seed-icon-version='0.0.10'
          width='15'
          height='15'
        >
          <g>
            <path
              fill-rule='evenodd'
              clip-rule='evenodd'
              d='M11.6507 2.15225C11.1821 2.62088 11.1821 3.38068 11.6507 3.84931L18.1022 10.3008H2.99922C2.33648 10.3008 1.79922 10.8381 1.79922 11.5008C1.79922 12.1635 2.33648 12.7008 2.99922 12.7008H18.1022L11.6507 19.1523C11.1821 19.6209 11.1821 20.3807 11.6507 20.8493C12.1193 21.3179 12.8791 21.3179 13.3477 20.8493L21.8477 12.3493C22.0728 12.1243 22.1992 11.8191 22.1992 11.5008C22.1992 11.1825 22.0728 10.8773 21.8477 10.6523L13.3477 2.15225C12.8791 1.68362 12.1193 1.68362 11.6507 2.15225Z'
              fill='currentColor'
            ></path>
          </g>
        </svg>
      </StyledButton>
    </StyledInputContainer>
  );
};

export default SearchBar;
