function AuthDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
      <span className="text-xs text-gray-400 dark:text-gray-500">또는</span>
      <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
    </div>
  );
}

export default AuthDivider;
