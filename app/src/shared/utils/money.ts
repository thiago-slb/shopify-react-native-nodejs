export type Money = {
  amount: string;
  currencyCode: string;
};

export function formatMoney(value: Money): string {
  const amount = Number(value.amount);

  if (Number.isNaN(amount)) {
    return `${value.amount} ${value.currencyCode}`;
  }

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: value.currencyCode
  }).format(amount);
}
