const MAX_TEXT_FIELD_LENGTH = 120;
const MAX_ITEM_NAME_LENGTH = 200;
const MAX_ITEM_UNIT_LENGTH = 10;
const MAX_CNPJ_LENGTH = 14;
const MAX_EMITTED_AT_LENGTH = 32;

const MIN_ITEM_QUANTITY = 0.001;
const MAX_ITEM_QUANTITY = 99999;
const MIN_PRICE = 0;
const MAX_PRICE = 99999999.99;
const MAX_ITEMS_PER_PURCHASE = 300;

export interface NFCeScrapedItem {
  name: string;
  quantity: number;
  unit: string;
  unityPrice?: number;
  totalPrice?: number;
}

export interface NFCeScrapedData {
  storeName?: string;
  cnpj?: string;
  emittedAt?: string;
  city?: string;
  state?: string;
  total: number;
  items: NFCeScrapedItem[];
}

const sanitizeText = (value: unknown, maxLength: number): string => {
  if (typeof value !== 'string') {
    return '';
  }

  // eslint-disable-next-line no-control-regex
  const withoutControlChars = value.replace(/[\x00-\x1f\x7f]/g, ' ');
  const normalizedSpaces = withoutControlChars.replace(/\s+/g, ' ').trim();
  return normalizedSpaces.slice(0, maxLength);
};

const sanitizeCnpj = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\D/g, '').slice(0, MAX_CNPJ_LENGTH);
};

const sanitizeState = (value: unknown): string => {
  const raw = sanitizeText(value, 2).toUpperCase();
  return /^[A-Z]{2}$/.test(raw) ? raw : '';
};

const sanitizeEmittedAt = (value: unknown): string => {
  const emittedAt = sanitizeText(value, MAX_EMITTED_AT_LENGTH);
  if (!emittedAt) {
    return '';
  }

  const isValid = /^\d{2}\/\d{2}\/\d{4}(\s+\d{2}:\d{2}:\d{2})?$/.test(emittedAt);
  return isValid ? emittedAt : '';
};

const normalizeNumber = (value: unknown, fieldName: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Campo "${fieldName}" invalido.`);
  }

  return value;
};

const validatePrice = (value: number, fieldName: string): number => {
  if (value < MIN_PRICE || value > MAX_PRICE) {
    throw new Error(`Campo "${fieldName}" fora do intervalo permitido.`);
  }

  return value;
};

const sanitizeItem = (item: unknown, index: number): NFCeScrapedItem => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error(`Item ${index + 1} invalido.`);
  }

  const source = item as Record<string, unknown>;
  const name = sanitizeText(source.name, MAX_ITEM_NAME_LENGTH);
  if (!name) {
    throw new Error(`Item ${index + 1} sem nome valido.`);
  }

  const quantity = normalizeNumber(source.quantity, `items[${index}].quantity`);
  if (quantity < MIN_ITEM_QUANTITY || quantity > MAX_ITEM_QUANTITY) {
    throw new Error(`Quantidade do item ${index + 1} fora do intervalo permitido.`);
  }

  const unit = sanitizeText(source.unit, MAX_ITEM_UNIT_LENGTH).toUpperCase() || 'UN';

  const unityPrice =
    source.unityPrice === undefined
      ? undefined
      : validatePrice(normalizeNumber(source.unityPrice, `items[${index}].unityPrice`), `items[${index}].unityPrice`);

  const totalPrice =
    source.totalPrice === undefined
      ? undefined
      : validatePrice(normalizeNumber(source.totalPrice, `items[${index}].totalPrice`), `items[${index}].totalPrice`);

  return {
    name,
    quantity,
    unit,
    unityPrice,
    totalPrice,
  };
};

export const validateAndSanitizeNFCePayload = (payload: unknown): NFCeScrapedData => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Payload NFC-e invalido.');
  }

  const source = payload as Record<string, unknown>;
  const total = validatePrice(normalizeNumber(source.total, 'total'), 'total');

  if (!Array.isArray(source.items)) {
    throw new Error('Campo "items" invalido.');
  }

  if (source.items.length === 0) {
    throw new Error('Nenhum item encontrado na NFC-e.');
  }

  if (source.items.length > MAX_ITEMS_PER_PURCHASE) {
    throw new Error(`NFC-e excede o limite de ${MAX_ITEMS_PER_PURCHASE} itens.`);
  }

  const items = source.items.map((item, index) => sanitizeItem(item, index));

  return {
    storeName: sanitizeText(source.storeName, MAX_TEXT_FIELD_LENGTH),
    cnpj: sanitizeCnpj(source.cnpj),
    emittedAt: sanitizeEmittedAt(source.emittedAt),
    city: sanitizeText(source.city, MAX_TEXT_FIELD_LENGTH),
    state: sanitizeState(source.state),
    total,
    items,
  };
};

export const validateAccessKey = (accessKey: string): string => {
  const normalized = accessKey.trim();
  if (!/^\d{44}$/.test(normalized)) {
    throw new Error('Chave NFC-e invalida: deve conter exatamente 44 digitos.');
  }

  return normalized;
};

export const NFCeValidationLimits = {
  maxItemsPerPurchase: MAX_ITEMS_PER_PURCHASE,
  maxItemNameLength: MAX_ITEM_NAME_LENGTH,
  maxTextFieldLength: MAX_TEXT_FIELD_LENGTH,
};
