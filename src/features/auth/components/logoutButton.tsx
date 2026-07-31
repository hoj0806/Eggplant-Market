import { useSignOutMutation } from '../hooks/useAuthMutations';
import { toAuthErrorMessage } from '../utils/authErrorMessage';

function LogoutButton() {
  const signOutMutation = useSignOutMutation();

  function handleClick(): void {
    signOutMutation.mutate();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={signOutMutation.isPending}
        onClick={handleClick}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700
                   transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60
                   dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        {signOutMutation.isPending ? '로그아웃 중…' : '로그아웃'}
      </button>
      {signOutMutation.error !== null ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {toAuthErrorMessage(signOutMutation.error)}
        </p>
      ) : null}
    </div>
  );
}

export default LogoutButton;
