import { calculateSimilarity, findBestMatch, expandAbbreviations } from '../stringMatcher';

describe('expandAbbreviations', () => {
  it('should correctly expand common Brazilian fiscal abbreviations', () => {
    expect(expandAbbreviations('DET IPE MACA')).toBe('detergente ipe maca');
    expect(expandAbbreviations('LAVAT OMO MULTIACT')).toBe('sabao omo multiact');
    expect(expandAbbreviations('REFRI COCA COLA PET 2L')).toBe('refrigerante coca cola pet 2l');
    expect(expandAbbreviations('LEITE COND MOÇA')).toBe('leite condensado moça');
  });
});

describe('calculateSimilarity', () => {
  it('should match items with abbreviations and brands correctly', () => {
    // Leite UHT Integral vs Leite
    expect(calculateSimilarity('Leite', 'LEITE UHT INTEGRAL 1L')).toBe(1.0);
    expect(calculateSimilarity('Leite', 'LEITE TIROL INTEGRAL')).toBe(1.0);

    // Coca Cola
    expect(calculateSimilarity('Coca Cola', 'REFRIG COCA COLA PET 2L')).toBe(1.0);
    expect(calculateSimilarity('Coca Cola', 'COCA COLA 2L')).toBe(1.0);

    // Detergente Ypê vs DET IPE MACA 500ML (phonetic/spelling alignment)
    expect(calculateSimilarity('Detergente Ypê', 'DET IPE MACA 500ML')).toBeGreaterThanOrEqual(0.75);
  });

  it('should score different items lower', () => {
    // Pão de forma vs Pão francês (only "pao" token matches)
    const similarity = calculateSimilarity('Pao de forma', 'PAO FRANCES KG');
    expect(similarity).toBeLessThan(0.70); // Should be 0.50 (1 out of 2 tokens matched)
  });

  it('should penalize exclusion modifiers (e.g. condensed milk vs milk)', () => {
    // Leite vs Leite Condensado -> should be heavily penalized (0.1)
    expect(calculateSimilarity('Leite', 'LEITE CONDENSADO MOÇA')).toBe(0.1);
    expect(calculateSimilarity('Leite', 'LEITE DE COCO SOCOCO')).toBe(0.1);
    expect(calculateSimilarity('Leite', 'LEITE INTEGRAL TIROL 1L')).toBe(1.0); // should still match normal milk

    // Pão vs Pão de queijo
    expect(calculateSimilarity('Pao', 'PAO DE QUEIJO CONGELADO')).toBe(0.1);
  });
});

describe('getDynamicThreshold & findBestMatch', () => {
  it('should dynamically prevent false positives', () => {
    const realItems = [
      { name: 'PAO FRANCES KG' },
      { name: 'PAO DE FORMA WICKBOLD' },
    ];

    // "Pao de forma" has 2 tokens. Dynamic threshold is 0.70.
    // "PAO FRANCES KG" score is 0.50. It should NOT match.
    // "PAO DE FORMA WICKBOLD" score should be 1.0 (both 'pao' and 'forma' match). It should match.
    const match1 = findBestMatch('Pao de forma', realItems);
    expect(match1).not.toBeNull();
    expect(match1?.item.name).toBe('PAO DE FORMA WICKBOLD');
  });

  it('should require very high similarity for single-word items and prevent modified item matches', () => {
    const realItems = [
      { name: 'LEITE CONDENSADO MOÇA' },
      { name: 'LEITE INTEGRAL TIROL 1L' },
    ];

    // "Leite" (1 token, threshold = 0.80).
    // "LEITE CONDENSADO MOÇA" should NOT match because of the exclusion modifier.
    // "LEITE INTEGRAL TIROL 1L" should match.
    const match = findBestMatch('Leite', realItems);
    expect(match).not.toBeNull();
    expect(match?.item.name).toBe('LEITE INTEGRAL TIROL 1L');
  });
});
