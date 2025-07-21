// Cloudflare Workers型定義
// これらはCloudflare Workers環境で利用可能なグローバル型です

declare global {
  // KVNamespace型定義
  interface KVNamespace {
    get(key: string): Promise<string | null>;
    get<T = unknown>(key: string, options: { type: "json" }): Promise<T | null>;
    get(
      key: string,
      options: { type: "arrayBuffer" },
    ): Promise<ArrayBuffer | null>;
    get(
      key: string,
      options: { type: "stream" },
    ): Promise<ReadableStream | null>;

    put(
      key: string,
      value: string | ArrayBuffer | ReadableStream,
      options?: {
        expirationTtl?: number;
        expiration?: number;
        metadata?: any;
      },
    ): Promise<void>;

    delete(key: string): Promise<void>;

    list(options?: {
      prefix?: string;
      limit?: number;
      cursor?: string;
    }): Promise<{
      keys: Array<{ name: string; expiration?: number; metadata?: any }>;
      list_complete: boolean;
      cursor?: string;
    }>;
  }

  // R2Bucket型定義
  interface R2Bucket {
    get(key: string): Promise<R2Object | null>;
    put(
      key: string,
      value: ReadableStream | ArrayBuffer | string,
      options?: {
        httpMetadata?: R2HTTPMetadata;
        customMetadata?: Record<string, string>;
      },
    ): Promise<R2Object>;
    delete(key: string): Promise<void>;
    list(options?: {
      prefix?: string;
      delimiter?: string;
      cursor?: string;
      include?: ("httpMetadata" | "customMetadata")[];
      limit?: number;
    }): Promise<R2Objects>;
  }

  interface R2Object {
    key: string;
    version: string;
    size: number;
    etag: string;
    checksums: R2Checksums;
    uploaded: Date;
    httpMetadata?: R2HTTPMetadata;
    customMetadata?: Record<string, string>;
    body: ReadableStream;
    bodyUsed: boolean;
    arrayBuffer(): Promise<ArrayBuffer>;
    text(): Promise<string>;
    json<T = unknown>(): Promise<T>;
  }

  interface R2Objects {
    objects: R2Object[];
    truncated: boolean;
    cursor?: string;
    delimitedPrefixes: string[];
  }

  interface R2HTTPMetadata {
    contentType?: string;
    contentLanguage?: string;
    contentDisposition?: string;
    contentEncoding?: string;
    cacheControl?: string;
    cacheExpiry?: Date;
  }

  interface R2Checksums {
    md5?: ArrayBuffer;
    sha1?: ArrayBuffer;
    sha256?: ArrayBuffer;
    sha384?: ArrayBuffer;
    sha512?: ArrayBuffer;
  }

  // Hyperdrive型定義
  interface Hyperdrive {
    connectionString: string;
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  }

  // Cloudflare Workers環境のバインディング
  interface CloudflareBindings {
    // KV Namespaces
    CACHE?: KVNamespace;
    DYNAMIC_ROUTES?: KVNamespace;
    
    // R2 Buckets
    STORAGE?: R2Bucket;
    API_ASSETS?: R2Bucket;
    
    // Hyperdrive Database
    HYPERDRIVE?: Hyperdrive;
    
    // Service Bindings
    BACKEND?: Fetcher;
  }

  // Service Binding用のFetcher型
  interface Fetcher {
    fetch(request: Request): Promise<Response>;
    fetch(url: string, init?: RequestInit): Promise<Response>;
  }

  // Workers環境のグローバル変数
  const cloudflare: {
    env: CloudflareBindings;
    cf?: IncomingRequestCfProperties;
    ctx: {
      waitUntil(promise: Promise<any>): void;
      passThroughOnException(): void;
    };
  };
}

// IncomingRequestCfProperties型定義（Cloudflare独自のリクエスト情報）
interface IncomingRequestCfProperties {
  asn: number;
  asOrganization: string;
  city?: string;
  clientTrustScore?: number;
  colo: string;
  continent?: string;
  country?: string;
  httpProtocol: string;
  latitude?: string;
  longitude?: string;
  postalCode?: string;
  region?: string;
  regionCode?: string;
  timezone?: string;
  tlsCipher: string;
  tlsClientAuth?: {
    certIssuerDNLegacy: string;
    certIssuerDN: string;
    certPresented: "0" | "1";
    certSubjectDNLegacy: string;
    certSubjectDN: string;
    certNotBefore: string;
    certNotAfter: string;
    certSerial: string;
    certFingerprintSHA1: string;
    certFingerprintSHA256: string;
    certVerified: string;
  };
  tlsExportedAuthenticator?: {
    clientFinished: string;
    clientRandom: string;
    serverHandshakeHash: string;
    serverFinished: string;
  };
  tlsVersion: string;
}

export {};
