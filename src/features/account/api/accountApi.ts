import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../../../shared/lib/supabaseClient';

export type ChangePasswordInput = {
  /** 본인 확인용으로 다시 로그인할 때 쓴다. 세션에 있는 이메일을 그대로 넘긴다. */
  email: string;
  currentPassword: string;
  newPassword: string;
};

const DELETE_ACCOUNT_FUNCTION = 'delete-account';

/**
 * 비밀번호 변경.
 *
 * `updateUser`는 **지금 세션만 있으면 통과한다** — 현재 비밀번호를 묻지 않는다.
 * 남이 열어 둔 브라우저를 잡으면 비밀번호를 바꿔 계정을 통째로 가져갈 수 있다는 뜻이라,
 * 바꾸기 전에 signInWithPassword로 본인인지 한 번 확인한다.
 * (Supabase의 "Secure password change" 설정도 같은 일을 하지만 대시보드 스위치라
 *  코드만 보고는 켜져 있는지 알 수 없다. 여기서 확실히 한다.)
 *
 * 확인 로그인이 세션을 새로 발급하지만 사용자는 그대로다. onAuthStateChange가
 * 새 세션을 받아 authStore를 갱신하므로 화면은 아무 일 없다는 듯 이어진다.
 */
export async function changePassword(input: ChangePasswordInput): Promise<void> {
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.currentPassword,
  });

  if (signInError !== null) {
    throw signInError;
  }

  const { error } = await supabase.auth.updateUser({ password: input.newPassword });

  if (error !== null) {
    throw error;
  }
}

/**
 * Edge Function이 4xx/5xx로 답하면 supabase-js는 본문을 읽지 않고
 * "Edge Function returned a non-2xx status code"만 준다. 우리가 함수에서 적어 보낸
 * 이유는 응답 본문에 들어 있으므로 직접 꺼낸다.
 */
async function readFunctionErrorMessage(error: unknown): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError)) {
    return null;
  }

  try {
    const body: unknown = await error.context.json();
    if (body !== null && typeof body === 'object') {
      const message = (body as { error?: unknown }).error;
      if (typeof message === 'string' && message.length > 0) {
        return message;
      }
    }
  } catch {
    // 본문이 JSON이 아니면 꺼낼 것이 없다. 원래 오류를 그대로 쓴다.
  }

  return null;
}

/**
 * 회원탈퇴.
 *
 * 사용자를 지우려면 `service_role`이 필요한데 그 키는 브라우저에 둘 수 없다.
 * 그래서 이 프로젝트의 첫 Edge Function을 부른다(`supabase/functions/delete-account`).
 * 토큰은 supabase-js가 Authorization 헤더에 실어 보내므로 여기서 따로 넘기지 않는다 —
 * **누구를 지울지는 함수가 그 토큰으로 정한다.** 몸통에 id를 실어 보내면
 * 남의 id를 적어 보내는 길이 열린다.
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke(DELETE_ACCOUNT_FUNCTION, {
    method: 'POST',
  });

  if (error !== null) {
    const message = await readFunctionErrorMessage(error);
    throw message === null ? error : new Error(message);
  }
}
