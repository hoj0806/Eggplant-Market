export type PasswordChangeValues = {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirm: string;
};

export type PasswordChangeFieldName = keyof PasswordChangeValues;

export type PasswordChangeFieldErrors = Partial<Record<PasswordChangeFieldName, string>>;
