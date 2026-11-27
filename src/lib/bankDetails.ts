export const ACCOUNT_NUMBER_PATTERN = /^\d{9,18}$/;
export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function bankDetailsAreBlank(holder: string, accountNumber: string, ifsc: string): boolean {
  return !holder.trim() && !accountNumber.trim() && !ifsc.trim();
}

export function bankDetailError(holder: string, accountNumber: string, ifsc: string): string | null {
  if (bankDetailsAreBlank(holder, accountNumber, ifsc)) return null;
  const name = holder.trim();
  const account = accountNumber.trim();
  const code = ifsc.trim().toUpperCase();
  if (name.length < 2 || name.length > 80) return 'Enter the account holder name.';
  if (!ACCOUNT_NUMBER_PATTERN.test(account)) return 'Enter the account number using 9 to 18 digits.';
  if (!IFSC_PATTERN.test(code)) return 'Enter a valid 11-character IFSC code.';
  return null;
}

export function normalizeBankDetails(holder: string, accountNumber: string, ifsc: string) {
  return {
    bank_account_holder: holder.trim(),
    bank_account_number: accountNumber.trim(),
    bank_ifsc: ifsc.trim().toUpperCase(),
  };
}
