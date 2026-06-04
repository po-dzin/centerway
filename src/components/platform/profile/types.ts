export type ProfileResponse = {
  userId: string;
  profile: {
    account: {
      email: string | null;
      fullName: string | null;
      avatarUrl: string | null;
    };
    contacts: {
      phone: string | null;
      telegram: string | null;
    } | null;
    dosha: {
      attemptId: string;
      testId: string;
      testSlug: string;
      resultType: string;
      version: number | null;
      completedAt: string | null;
      scores: {
        vata: number | null;
        pitta: number | null;
        kapha: number | null;
      };
    } | null;
    purchases: Array<{
      orderRef: string;
      offerCode: string;
      offerKind: string;
      title: string;
      amount: number | null;
      currency: string | null;
      createdAt: string | null;
      access: {
        order_ref: string;
        used: boolean;
        expires_at: string | null;
        created_at: string | null;
      } | null;
    }>;
    progress: {
      items: unknown[];
      note: string;
    };
  };
};

export type ProfileLang = "uk" | "en";

export type ProfileCopy = {
  profile: string;
  loadingTitle: string;
  loadingLead: string;
  authTitle: string;
  authLead: string;
  signIn: string;
  returnHome: string;
  takeDosha: string;
  badge: string;
  dosha: string;
  activePrograms: string;
  products: string;
  contacts: string;
  contactsReady: string;
  contactsMissing: string;
  noDosha: string;
  noPrograms: string;
  hasPrograms: string;
  hasProducts: string;
  noProducts: string;
  heroViewDosha: string;
  signOut: string;
  doshaCurrent: string;
  doshaResultPrefix: string;
  doshaCompletedPrefix: string;
  completedShort: string;
  retakeTest: string;
  doshaEmptyLead: string;
  startTest: string;
  routeSummaryLabel: string;
  routeSummaryTitle: string;
  summaryActivePrograms: string;
  summaryCompletedPrograms: string;
  summaryProducts: string;
  summaryActiveProgramsValue: string;
  summaryCompletedProgramsValue: string;
  summaryProductsValue: string;
  programsLabel: string;
  programsTitle: string;
  activeProgramLabel: string;
  completedProgramLabel: string;
  routeStarted: string;
  purchasedAt: string;
  accessStatus: string;
  programProgressNote: string;
  programAccessManual: string;
  programAccessNoToken: string;
  noProgramsLead: string;
  productsTitle: string;
  productLabel: string;
  price: string;
  productNoAccess: string;
  noProductsLead: string;
  progressLabel: string;
  progressTitle: string;
  progressLead: string;
  contactsTitle: string;
  name: string;
  email: string;
  phone: string;
  telegram: string;
  unavailableTitle: string;
  unavailableLead: string;
  errorTitle: string;
  errorFallback: string;
  emptyValue: string;
  doshaLabels: {
    vata: string;
    pitta: string;
    kapha: string;
  };
};
