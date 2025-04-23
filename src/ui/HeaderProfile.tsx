import { useUser } from "../features/authentication/useUser";

const HeaderProfile = () => {
  const { user, isLoading } = useUser();

  if (isLoading) return <div>정보 불러오는중...</div>;
  return <div>{user?.user_metadata.nickname}님 환영합니다</div>;
};

export default HeaderProfile;
