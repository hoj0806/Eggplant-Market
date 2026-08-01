type PageSpinnerProps = {
  message: string;
};

/** 화면 전체를 차지하는 로딩 표시. 라우트 가드가 판단을 끝낼 때까지 보여준다. */
function PageSpinner(props: PageSpinnerProps) {
  return (
    <main
      role="status"
      className="mx-auto flex min-h-screen max-w-screen-sm flex-col items-center justify-center gap-3 p-6"
    >
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      <p className="text-sm text-gray-600 dark:text-gray-400">{props.message}</p>
    </main>
  );
}

export default PageSpinner;
