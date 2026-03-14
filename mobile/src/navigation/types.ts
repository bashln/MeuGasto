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
  ScanQRCode: undefined;
  PriceComparator: undefined;
  EditProfile: undefined;
};

export type MainTabParamList = {
  DashboardTab: undefined;
  PurchasesTab: undefined;
  DraftsTab: undefined;
  ReportsTab: undefined;
  ProfileTab: undefined;
};
