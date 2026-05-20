export function formatInrLakh(paise: number | null | undefined): string {
  if (paise == null) return '—';
  const rupees = paise / 100;
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(1)} Cr`;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(1)} L`;
  return `₹${Math.round(rupees).toLocaleString('en-IN')}`;
}
