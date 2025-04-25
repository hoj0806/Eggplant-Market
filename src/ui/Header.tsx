import HeaderProfile from "./HeaderProfile";
import Logo from "./Logo";
import Navigation from "./Navigation";

const Header = () => {
  return (
    <div style={{ display: "flex", gap: "5rem" }}>
      <Logo />

      <Navigation />
      <HeaderProfile />
    </div>
  );
};

export default Header;
