export const DEFAULT_FALLBACK_CATEGORY_ID = 999;

export type ProductCategoryRule = {
  categoryId: number;
  pattern: RegExp;
};

export type ProductCategorizerConfig = {
  rules: ProductCategoryRule[];
  fallbackCategoryId?: number;
};

const normalizeProductName = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

export class ProductCategorizerService {
  private readonly rules: ProductCategoryRule[];
  private readonly fallbackCategoryId: number;
  private readonly learnedReclassifications = new Map<string, number>();

  constructor(config: ProductCategorizerConfig) {
    this.rules = config.rules;
    this.fallbackCategoryId = config.fallbackCategoryId ?? DEFAULT_FALLBACK_CATEGORY_ID;
  }

  categorizeProduct(productName: string): number {
    const normalized = normalizeProductName(productName || '');
    const learnedCategory = this.learnedReclassifications.get(normalized);
    if (learnedCategory !== undefined) {
      return learnedCategory;
    }

    for (const rule of this.rules) {
      if (rule.pattern.test(normalized)) {
        return rule.categoryId;
      }
    }

    return this.fallbackCategoryId;
  }

  learnReclassification(productName: string, categoryId: number): void {
    const normalized = normalizeProductName(productName || '');
    if (!normalized) {
      return;
    }

    this.learnedReclassifications.set(normalized, categoryId);
  }
}
