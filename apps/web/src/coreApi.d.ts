export type CoreIntegration = {
  id: string;
  role?: string;
  adapter?: string;
  environment?: string;
  mode?: string;
  configured?: boolean;
  verification?: string;
};

export type CoreConnection = {
  connectionId: string;
  provider: string;
  environment: string;
  recordStatus: string;
  readiness: string;
  dataVerified: boolean;
  capabilities?: {
    accountRead?: boolean;
    marketDataRead?: boolean;
    orderSubmission?: false;
  };
  ordersEnabled: false;
  liveTradingEnabled: false;
};

export type CoreSnapshot = {
  integrations: CoreIntegration[];
  connections: CoreConnection[];
  mode: string;
};

export function fetchCoreSnapshot(
  accessToken: string,
  fetchImpl?: typeof fetch,
): Promise<CoreSnapshot>;
