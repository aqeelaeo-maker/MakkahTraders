export function formatAmount(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '0';
  const num = Number(val);
  const isDecimal = num % 1 !== 0;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: isDecimal ? 2 : 0,
    maximumFractionDigits: isDecimal ? 2 : 0,
  });
}
