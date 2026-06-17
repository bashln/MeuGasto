export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
}

export interface Supermarket {
  id: number;
  name: string;
  cnpj: string;
  city: string;
  state: string;
  isManual: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: number;
  name: string;
  code?: string;
  categoryId?: number;
  quantity: number;
  unit: string;
  price: number;
}

export interface Purchase {
  id: number;
  supermarket: Supermarket;
  date: string;
  totalPrice: number;
  isManual: boolean;
  products: Item[];
  createdAt: string;
  updatedAt: string;
}

export interface Draft {
  id: number;
  supermarket?: Supermarket;
  content: string;
  items?: Array<{
    name: string;
    quantity: number;
    unit: string;
    price: number;
  }>;
  totalPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface PageResponse<T> {
  statusMessage: string;
  success: boolean;
  data: T[];
  page: {
    pageNumber: number;
    pageSize: number;
    totalElements: number;
    totalPages: number;
    last: boolean;
  };
}

export interface PurchaseFilter {
  supermarketId?: number;
  isManual?: boolean;
  startDate?: string;
  endDate?: string;
  minPrice?: number;
  maxPrice?: number;
  categoryId?: number;
  page?: number;
  size?: number;
}

export interface PurchaseMetrics {
  totalCount: number;
  totalValue: number;
}

export interface DraftFilter {
  supermarketId?: number;
  page?: number;
  size?: number;
}

export interface CreateDraftRequest {
  supermarketId?: number;
  content: string;
  items: Array<{
    name: string;
    quantity: number;
    unit: string;
    price: number;
  }>;
}

export interface UpdateDraftRequest {
  supermarketId?: number;
  content?: string;
  items?: Array<{
    name: string;
    quantity: number;
    unit: string;
    price: number;
  }>;
}


export interface DashboardStats {
  totalSpent: number;
  purchaseCount: number;
  itemCount: number;
  savings: number;
}

export interface ShoppingList {
  id: number;
  userId: string;
  name: string;
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
  items?: ShoppingListItem[];
}

export interface ShoppingListItem {
  id: number;
  shoppingListId: number;
  name: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
  createdAt: string;
}

export interface PriceComparisonSession {
  id: number;
  userId: string;
  title: string;
  sourceShoppingListId?: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  quotes?: PriceComparisonQuote[];
}

export interface PriceComparisonQuote {
  id: number;
  sessionId: number;
  supermarketId?: number;
  marketNameSnapshot: string;
  notes?: string;
  totalPrice: number;
  createdAt: string;
  items?: PriceComparisonQuoteItem[];
}

export interface PriceComparisonQuoteItem {
  id: number;
  quoteId: number;
  name: string;
  normalizedName?: string;
  quantity: number;
  unit: string;
  price: number;
  createdAt: string;
}

export interface ComparisonResult {
  estimatedTotal: number;
  realTotal: number;
  economyOrLoss: number;
  matchedItems: Array<{
    planned: ShoppingListItem;
    real: {
      name: string;
      quantity: number;
      price: number;
      unit: string;
    };
    quantityDiff: number;
    priceDiff: number;
    unitIncompatible: boolean;
  }>;
  forgottenItems: ShoppingListItem[];
  extraItems: Array<{
    name: string;
    quantity: number;
    price: number;
    unit: string;
  }>;
}

