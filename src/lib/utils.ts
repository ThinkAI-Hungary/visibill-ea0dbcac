import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'HUF', compact?: boolean): string {
  if (compact && Math.abs(amount) >= 1000000) {
    return `${(amount / 1000000).toFixed(2).replace('.', ',')} M Ft`;
  }
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
