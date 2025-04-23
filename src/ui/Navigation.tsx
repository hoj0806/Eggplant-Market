import { Link } from "react-router-dom";

const Navigation = () => {
  // 나중에 수정
  return (
    <nav>
      <ol style={{ display: "flex", gap: "1rem" }}>
        <Link to='/'>메인으로</Link>
        <Link to='/login'>로그인</Link>
        <Link to='/signup'>회원가입</Link>
        <Link to='/product/new'>물건팔기</Link>
        <li>회원가입</li>
      </ol>
    </nav>
  );
};

export default Navigation;
