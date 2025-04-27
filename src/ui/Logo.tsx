import { useNavigate } from "react-router-dom";

const Logo = () => {
  const navigate = useNavigate();

  const handleClickLogo = () => {
    navigate("/");
  };

  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='50 0 140 70'
      width='100'
      height='50'
      onClick={handleClickLogo}
      cursor='pointer'
    >
      <path
        d='M60 40 C 50 20, 80 10, 90 30 C 95 40, 85 60, 70 60 C 65 60, 60 55, 60 40'
        fill='#7B2CBF'
      />
      <path d='M65 20 C 60 10, 75 5, 80 15 Z' fill='#3CB371' />
      <path d='M70 18 C 65 8, 85 5, 88 18 Z' fill='#3CB371' />
      <text
        x='100'
        y='35'
        font-size='24'
        fontWeight='bold '
        fill='#7B2CBF'
        font-family="'Segoe UI Rounded', sans-serif"
        dominant-baseline='middle'
      >
        가지
      </text>
    </svg>
  );
};

export default Logo;
