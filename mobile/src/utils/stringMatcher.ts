import { ShoppingListItem } from '../types';

export function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, '') // remove special characters
    .replace(/\s+/g, ' ') // replace multiple spaces with single space
    .trim();
}

const FISCAL_ABBREVIATIONS: Record<string, string> = {
  det: 'detergente',
  pao: 'pao',
  refrig: 'refrigerante',
  refri: 'refrigerante',
  lavat: 'sabao',
  cond: 'condensado',
  int: 'integral',
  desc: 'descartavel',
  shamp: 'shampoo',
  sab: 'sabonete',
  crem: 'creme',
  ref: 'refrigerante',
  pct: 'pacote',
  un: 'unidade',
  kg: 'quilo',
  g: 'grama',
  ml: 'mililitro',
  l: 'litro',
  // Common Brazilian brands spelling variation/abbr
  ype: 'ipe',
  tb: 'tirol',
  pr: 'prata',
};

// Words that, if present in the real item but NOT in the planned item, change the product identity and should penalize the match.
const EXCLUSION_MODIFIERS: Record<string, string[]> = {
  leite: ['condensado', 'creme', 'coco', 'po'],
  pao: ['queijo', 'mel'],
  cafe: ['capsula', 'soluvel'],
  suco: ['po', 'concentrado'],
};

/**
 * Expands common Brazilian fiscal abbreviations to standard words.
 */
export function expandAbbreviations(str: string): string {
  const words = str.split(/\s+/);
  const expanded = words.map(w => {
    const clean = w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    return FISCAL_ABBREVIATIONS[clean] || w.toLowerCase();
  });
  return expanded.join(' ');
}

/**
 * Calculates Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
}

/**
 * Returns a score between 0.0 and 1.0 representing how similar two words are.
 */
export function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(a, b);
  return 1.0 - dist / maxLen;
}

/**
 * Calculates a similarity score between a planned item name and a real item name.
 * 0 means completely different, 1 means perfect match.
 */
export function calculateSimilarity(planned: string, real: string): number {
  const expPlanned = expandAbbreviations(planned);
  const expReal = expandAbbreviations(real);

  const normPlanned = normalizeString(expPlanned);
  const normReal = normalizeString(expReal);

  if (!normPlanned || !normReal) return 0;
  if (normPlanned === normReal) return 1.0;

  // Check identity-changing exclusion modifiers
  for (const baseWord in EXCLUSION_MODIFIERS) {
    if (normPlanned.includes(baseWord)) {
      const modifiers = EXCLUSION_MODIFIERS[baseWord];
      for (const mod of modifiers) {
        if (normReal.includes(mod) && !normPlanned.includes(mod)) {
          return 0.1; // Heavy penalty: mismatching categories (e.g. "Leite" vs "Leite Condensado")
        }
      }
    }
  }

  const plannedTokens = normPlanned.split(' ').filter(t => t.length > 1);
  const realTokens = normReal.split(' ').filter(t => t.length > 1);

  if (plannedTokens.length === 0 || realTokens.length === 0) {
    return normReal.includes(normPlanned) || normPlanned.includes(normReal) ? 0.5 : 0;
  }

  let matches = 0;
  for (const pt of plannedTokens) {
    let matched = false;
    for (const rt of realTokens) {
      if (rt.includes(pt) || pt.includes(rt)) {
        matched = true;
        break;
      }
      // Compare word similarity for spelling variations (e.g. ype vs ipe)
      if (pt.length > 2 && rt.length > 2) {
        const score = tokenSimilarity(pt, rt);
        if (score >= 0.75) {
          matched = true;
          break;
        }
      }
    }
    if (matched) {
      matches++;
    }
  }

  const intersectionScore = matches / plannedTokens.length;
  const substringBonus = normReal.includes(normPlanned) ? 0.2 : 0;

  return Math.min(intersectionScore + substringBonus, 1.0);
}

/**
 * Determines the dynamic threshold based on the number of tokens in the planned query.
 * 1 token: requires high confidence (e.g. 0.8) to prevent matching unrelated terms.
 * 2 tokens: requires moderate confidence (e.g. 0.7).
 * 3+ tokens: allows partial matches (e.g. 0.5) if brands or key terms match.
 */
export function getDynamicThreshold(plannedName: string): number {
  const norm = normalizeString(expandAbbreviations(plannedName));
  const tokens = norm.split(' ').filter(t => t.length > 1);
  
  if (tokens.length <= 1) {
    return 0.80; // High threshold for single-word queries (e.g. "Leite" shouldn't match "Leite Condensado" unless highly similar)
  }
  if (tokens.length === 2) {
    return 0.70; // e.g. "Pão de forma"
  }
  return 0.50; // Allow partial hits on 3+ words (e.g. "Sabão em pó Omo")
}

/**
 * Finds the best matching item in a list of scraped items for a given planned item.
 */
export function findBestMatch<T extends { name: string }>(
  plannedName: string,
  realItems: T[],
  customThreshold?: number
): { item: T; index: number; score: number } | null {
  let bestScore = 0;
  let bestIndex = -1;
  const threshold = customThreshold ?? getDynamicThreshold(plannedName);

  for (let i = 0; i < realItems.length; i++) {
    const score = calculateSimilarity(plannedName, realItems[i].name);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestIndex !== -1 && bestScore >= threshold) {
    return {
      item: realItems[bestIndex],
      index: bestIndex,
      score: bestScore,
    };
  }

  return null;
}

/**
 * Compares a planned shopping list with the actual items bought.
 */
export interface MatchableItem {
  name: string;
  quantity: number;
  price: number;
  unit: string;
}

/**
 * Checks if two units are compatible for comparison.
 * UN↔UN, KG↔KG, L↔L, ML↔ML, G↔G are compatible.
 * KG↔UN, L↔ML, etc. are incompatible.
 */
export function areUnitsCompatible(unit1: string, unit2: string): boolean {
  if (!unit1 || !unit2) return true; // If either is missing, assume compatible
  const u1 = unit1.toUpperCase().trim();
  const u2 = unit2.toUpperCase().trim();
  if (u1 === u2) return true;

  // Normalize variations
  const normalize = (u: string): string => {
    if (u === 'KG' || u === 'QUILO') return 'KG';
    if (u === 'G' || u === 'GRAMA' || u === 'GR') return 'G';
    if (u === 'L' || u === 'LITRO') return 'L';
    if (u === 'ML' || u === 'MILILITRO') return 'ML';
    if (u === 'UN' || u === 'UNIDADE' || u === 'PCT' || u === 'PACOTE') return 'UN';
    return u;
  };

  return normalize(u1) === normalize(u2);
}

export function compareListWithReceipt(
  plannedItems: ShoppingListItem[],
  realItems: MatchableItem[]
) {
  const matchedItems: Array<{
    planned: ShoppingListItem;
    real: MatchableItem;
    quantityDiff: number;
    priceDiff: number;
    unitIncompatible: boolean;
  }> = [];

  const forgottenItems: ShoppingListItem[] = [];
  const remainingRealItems = [...realItems];

  for (const planned of plannedItems) {
    const match = findBestMatch(planned.name, remainingRealItems);

    if (match) {
      matchedItems.push({
        planned,
        real: match.item,
        quantityDiff: match.item.quantity - planned.quantity,
        priceDiff: match.item.price - planned.estimatedPrice,
        unitIncompatible: !areUnitsCompatible(planned.unit, match.item.unit),
      });
      // Remove from remaining items to avoid double matching
      remainingRealItems.splice(match.index, 1);
    } else {
      forgottenItems.push(planned);
    }
  }

  const estimatedTotal = plannedItems.reduce((acc, item) => acc + (item.quantity * item.estimatedPrice), 0);
  const realTotal = realItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);

  return {
    estimatedTotal,
    realTotal,
    economyOrLoss: estimatedTotal - realTotal,
    matchedItems,
    forgottenItems,
    extraItems: remainingRealItems,
  };
}
