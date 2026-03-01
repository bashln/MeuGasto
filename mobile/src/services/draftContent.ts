export type DraftItem = { name: string; quantity: number; unit: string; price: number };

export const parseContent = (content: string | null): { notes: string; items: DraftItem[] } => {
  try {
    const parsed = JSON.parse(content || '{}');
    if (parsed && typeof parsed === 'object' && 'notes' in parsed) {
      return { notes: parsed.notes || '', items: parsed.items || [] };
    }
  } catch {}
  return { notes: content || '', items: [] };
};

export const serializeContent = (notes: string, items: DraftItem[]): string =>
  JSON.stringify({ notes, items });
