import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../../../shared/lib/supabaseClient';

const DELETE_ACCOUNT_FUNCTION = 'delete-account';

/**
 * 비밀번호 변경은 **없앴다.** 로그인이 소셜뿐이라 가지마켓이 들고 있는 비밀번호가 없다 —
 * 바꿀 것은 카카오·구글 쪽에 있고, 우리가 대신 바꿔 줄 수 있는 값이 아니다.
 * (`accountSettingsPage`가 그 사실을 한 문단으로 알린다.)
 */

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
