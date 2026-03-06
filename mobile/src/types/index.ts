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
  quantity: number;
  unit: string;
  price: number;
}

export interface Purchase {
  id: number;
  supermarket: Supermarket;
  accessKey: string;
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
  page?: number;
  size?: number;
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

export interface NfceRequest {
  qrCodeData: string;
}

export interface DashboardStats {
  totalSpent: number;
  purchaseCount: number;
  itemCount: number;
  savings: number;
}
