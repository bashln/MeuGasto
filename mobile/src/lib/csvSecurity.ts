const DANGEROUS_PREFIX_RE = /^[=+\-@]/;

export const escapeCsvCell = (value: string | number): string => {
  const raw = String(value ?? '');
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const prefixed = DANGEROUS_PREFIX_RE.test(normalized) ? `'${normalized}` : normalized;
  const escaped = prefixed.replace(/"/g, '""');
  return `"${escaped}"`;
};

export const toCsvRow = (cells: Array<string | number>): string =>
  cells.map(cell => escapeCsvCell(cell)).join(',');
