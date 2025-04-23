import ProductGrid from "../features/product/ProductTable";
import SearchBar from "../features/product/SearchBar";

const HomePage = () => {
  return (
    <div>
      <h1>Home Page</h1>
      <SearchBar />
      <ProductGrid />
    </div>
  );
};

export default HomePage;
