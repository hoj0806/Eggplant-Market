import { useSearchParams } from "react-router-dom";
import SearchBar from "../features/product/SearchBar";
import MainSection from "../ui/MainSection";
import SearchTermViewer from "../ui/SearchTermViewer";

const HomePage = () => {
  const [searchParams] = useSearchParams();
  const searchTerm = searchParams.get("search");

  return (
    <div>
      <SearchBar />
      {searchTerm && <SearchTermViewer />}
      <MainSection />
    </div>
  );
};

export default HomePage;
