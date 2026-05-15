export const DEFAULT_FALLBACK_CATEGORY_ID = 999;

export type ProductCategoryRule = {
  categoryId: number;
  pattern: RegExp;
};

export type ProductCategorizerConfig = {
  rules: ProductCategoryRule[];
  fallbackCategoryId?: number;
  persistence?: ProductCategorizerPersistence;
};

export type LearnedReclassification = {
  productName: string;
  categoryId: number;
};

export type ProductCategorizerPersistence = {
  load: () => Promise<LearnedReclassification[]>;
  save: (entry: LearnedReclassification) => Promise<void>;
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
  private readonly persistence?: ProductCategorizerPersistence;
  private readonly learnedReclassifications = new Map<string, number>();
  private readonly initializationPromise: Promise<void>;

  constructor(config: ProductCategorizerConfig) {
    this.rules = config.rules;
    this.fallbackCategoryId = config.fallbackCategoryId ?? DEFAULT_FALLBACK_CATEGORY_ID;
    this.persistence = config.persistence;
    this.initializationPromise = this.loadPersistedReclassifications();
  }

  async ready(): Promise<void> {
    await this.initializationPromise;
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

  async reload(): Promise<void> {
    this.learnedReclassifications.clear();
    await this.loadPersistedReclassifications();
  }

  async learnReclassification(productName: string, categoryId: number): Promise<void> {
    const normalized = normalizeProductName(productName || '');
    if (!normalized) {
      return;
    }

    this.learnedReclassifications.set(normalized, categoryId);
    if (this.persistence) {
      await this.persistence.save({ productName: normalized, categoryId });
    }
  }

  private async loadPersistedReclassifications(): Promise<void> {
    if (!this.persistence) {
      return;
    }

    try {
      const learnedEntries = await this.persistence.load();
      for (const entry of learnedEntries) {
        const normalized = normalizeProductName(entry.productName || '');
        if (!normalized) {
          continue;
        }
        this.learnedReclassifications.set(normalized, entry.categoryId);
      }
    } catch {
      // Fallback silencioso: categorização continua com regras estáticas.
    }
  }
}
