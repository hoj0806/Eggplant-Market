import supabase from "../supabase";

interface SignupCredentials {
  nickname: string;
  email: string;
  password: string;
}

export async function signup({ nickname, email, password }: SignupCredentials) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nickname,
        avatar: "",
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
