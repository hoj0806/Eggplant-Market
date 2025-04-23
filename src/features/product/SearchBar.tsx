import { useState } from "react";
import { useSearchParams } from "react-router-dom";

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
    <div>
      <input
        type='text'
        onChange={(e) => setSearchValue(e.target.value)}
        value={searchValue}
        placeholder='필요한 물건을 검색해 보세요.'
      />
      <button onClick={handleSearch}>검색</button>
    </div>
  );
};

export default SearchBar;
