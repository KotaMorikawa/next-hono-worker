// API Response Types
export interface ApiInfoResponse {
  message: string;
  version: string;
  endpoints: {
    free: string[];
    protected: string[];
  };
}

// x402 Payment Protocol Types
export interface X402PaymentInfo {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra: {
    name: string;
    version: string;
  };
}

export interface X402ErrorResponse {
  error: string;
  accepts: X402PaymentInfo[];
  x402Version: number;
}

// Protected Content Types
export interface DemoContentResponse {
  message: string;
  timestamp: string;
  data: {
    secret: string;
    value: number;
  };
}

export interface WeatherResponse {
  location: string;
  temperature: number;
  condition: string;
  humidity: number;
  paid_data: {
    detailed_forecast: string;
    alerts: string[];
  };
}
