export type DraftItem = { name: string; quantity: number; unit: string; price: number };

export const DRAFT_CONTENT_VERSION = 1;

export interface DraftContentPayload {
  version: number;
  notes: string;
  items: DraftItem[];
}

const normalizeItem = (item: unknown): DraftItem | null => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const candidate = item as Partial<DraftItem>;
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  if (!name) {
    return null;
  }

  const quantity = Number(candidate.quantity);
  const price = Number(candidate.price);

  return {
    name,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    unit: typeof candidate.unit === 'string' ? candidate.unit : '',
    price: Number.isFinite(price) && price >= 0 ? price : 0,
  };
};

const normalizeItems = (items: unknown): DraftItem[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map(normalizeItem)
    .filter((item): item is DraftItem => item !== null);
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const isCanonicalDraftContent = (content: string | null): boolean => {
  if (!content) {
    return false;
  }

  try {
    const parsed = JSON.parse(content);
    return (
      isObject(parsed) &&
      parsed.version === DRAFT_CONTENT_VERSION &&
      typeof parsed.notes === 'string' &&
      Array.isArray(parsed.items)
    );
  } catch {
    return false;
  }
};

export const parseContent = (content: string | null): { notes: string; items: DraftItem[] } => {
  if (!content) {
    return { notes: '', items: [] };
  }

  const trimmedContent = content.trim();
  const looksLikeJson = trimmedContent.startsWith('{') || trimmedContent.startsWith('[');

  try {
    const parsed = JSON.parse(content);
    if (!isObject(parsed)) {
      return { notes: content, items: [] };
    }

    if (parsed.version === DRAFT_CONTENT_VERSION && typeof parsed.notes === 'string') {
      return { notes: parsed.notes, items: normalizeItems(parsed.items) };
    }

    if ('notes' in parsed && typeof parsed.notes === 'string') {
      return { notes: parsed.notes, items: normalizeItems(parsed.items) };
    }
  } catch (error) {
    if (__DEV__ && looksLikeJson) {
      console.error('Error parsing draft content:', error);
    }
  }

  return { notes: content, items: [] };
};

export const serializeContent = (notes: string, items: DraftItem[]): string =>
  JSON.stringify({
    version: DRAFT_CONTENT_VERSION,
    notes,
    items: normalizeItems(items),
  } satisfies DraftContentPayload);
