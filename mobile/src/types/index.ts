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

export interface Rascunho {
  id: number;
  supermarket?: Supermarket;
  conteudo: string;
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
  startDate?: string;
  endDate?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  size?: number;
}

export interface RascunhoFilter {
  supermarketId?: number;
  page?: number;
  size?: number;
}

export interface CreateRascunhoRequest {
  supermarketId?: number;
  conteudo: string;
  items: Array<{
    name: string;
    quantity: number;
    unit: string;
    price: number;
  }>;
}

export interface UpdateRascunhoRequest {
  supermarketId?: number;
  conteudo?: string;
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

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Main: undefined;
  Dashboard: undefined;
  Purchases: undefined;
  PurchaseDetail: { purchaseId: number };
  PurchaseEdit: { purchaseId: number };
  Drafts: undefined;
  DraftDetail: { draftId: number };
  Reports: undefined;
  Profile: undefined;
  ScanQRCode: undefined;
  EditProfile: undefined;
};

export type MainTabParamList = {
  DashboardTab: undefined;
  PurchasesTab: undefined;
  DraftsTab: undefined;
  ReportsTab: undefined;
  ProfileTab: undefined;
};
