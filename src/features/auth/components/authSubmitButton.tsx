type AuthSubmitButtonProps = {
  label: string;
  pendingLabel: string;
  isPending: boolean;
};

function AuthSubmitButton(props: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={props.isPending}
      className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white
                 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {props.isPending ? props.pendingLabel : props.label}
    </button>
  );
}

export default AuthSubmitButton;
