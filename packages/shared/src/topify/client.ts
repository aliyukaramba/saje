// Topify API client. Base URL and paths are from https://pay.topify.ng/docs.
// Secret keys (sk_*) stay on the server. Public keys (pk_*) are safe for checkout only.
export interface TopifyConfig {
  secretKey?: string;
  publicKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

const REFERENCE_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

export class TopifyError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "TopifyError";
  }
}

function assertKobo(amountKobo: bigint): number {
  if (amountKobo < 100n) throw new Error("Minimum amount is 100 kobo (₦1)");
  const n = Number(amountKobo);
  if (!Number.isSafeInteger(n)) throw new Error("Amount too large");
  return n;
}

function assertReference(reference: string): void {
  if (!REFERENCE_PATTERN.test(reference)) throw new Error("Invalid reference format");
}

export class TopifyClient {
  private readonly baseUrl: string;
  private readonly fetch: typeof fetch;

  constructor(private readonly config: TopifyConfig) {
    this.baseUrl = (config.baseUrl ?? "https://apipay.topify.ng").replace(/\/$/, "");
    this.fetch = config.fetchImpl ?? fetch;
  }

  /** Hosted checkout session. Uses the public key, which cannot settle payments. */
  async initializeCheckout(input: {
    amountKobo: bigint; email: string; reference?: string; customerName?: string;
    callbackUrl?: string; metadata?: Record<string, unknown>;
  }) {
    if (!this.config.publicKey) throw new Error("Public key not configured");
    const amount = assertKobo(input.amountKobo);
    if (input.reference) assertReference(input.reference);
    return this.request<{ access_code: string; reference: string; checkout_url: string; amount: number; expires_at: string }>(
      "POST", "/api/checkout/initialize", this.config.publicKey, {
        public_key: this.config.publicKey,
        amount,
        email: input.email,
        reference: input.reference,
        customer_name: input.customerName,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
      },
    );
  }

  /** Dynamic virtual account for a bank transfer. Uses the secret key. */
  async createDynamicTransfer(input: { amountKobo: bigint; customerName: string; customerEmail: string; reference: string }) {
    const secret = this.requireSecret();
    const amount = assertKobo(input.amountKobo);
    assertReference(input.reference);
    return this.request<{ reference: string; account_number: string; account_name: string; bank_name: string; expires_at: string }>(
      "POST", "/api/v1/payments/create-transfer", secret, {
        amount,
        customer_name: input.customerName,
        customer_email: input.customerEmail,
        reference: input.reference,
      },
    );
  }

  /** Server-side verification. Always call before marking an order paid. */
  async verifyTransaction(reference: string) {
    assertReference(reference);
    return this.request<{ reference: string; type: string; amount: number; fee: number; status: string; provider: string; created_at: string }>(
      "GET", `/api/v1/transactions/verify/${encodeURIComponent(reference)}`, this.requireSecret(),
    );
  }

  async getPaymentStatus(reference: string) {
    assertReference(reference);
    return this.request<{ reference: string; status: string; amount: number; provider: string; expires_at: string }>(
      "GET", `/api/v1/payments/${encodeURIComponent(reference)}`, this.requireSecret(),
    );
  }

  private requireSecret(): string {
    if (!this.config.secretKey) throw new Error("Secret key not configured");
    return this.config.secretKey;
  }

  private async request<T>(method: string, path: string, key: string, body?: unknown): Promise<T> {
    const res = await this.fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: { status?: boolean; data?: T; message?: string } = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new TopifyError(res.status, "Unexpected response from payment gateway");
    }
    if (!res.ok) throw new TopifyError(res.status, json.message ?? `Gateway error (${res.status})`);
    if (json.data === undefined) throw new TopifyError(res.status, "Gateway response missing data");
    return json.data;
  }
}
