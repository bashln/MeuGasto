import { ComparisonResult } from '../types';

export type RootStackParamList = {
  Onboarding: undefined;
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
  ScanQRCode: { fromShoppingList?: boolean; shoppingListId?: number } | undefined;
  PriceComparator: undefined;
  EditProfile: undefined;
  ShoppingList: undefined;
  ShoppingListComparison: { comparison: ComparisonResult };
  Planning: undefined;
  SavedComparison: undefined;
  ComparisonSessionDetail: { sessionId: number };
};

export type MainTabParamList = {
  DashboardTab: undefined;
  PurchasesTab: undefined;
  ReportsTab: undefined;
  ProfileTab: undefined;
};
