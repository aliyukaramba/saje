import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyTopifySignature, parseTopifyWebhook } from "../src/topify/webhook";
import { normalizeTopifyStatus } from "../src/topify/status";
import { confirmGatewayPayment, PaymentMismatchError } from "../src/topify/confirm";
import { TopifyClient } from "../src/topify/client";

const secret = "whsec_test";
const body = JSON.stringify({
  event: "charge.success",
  data: { reference: "INV-123456", provider_reference: "P1", provider: "x", amount: 250050, fee: 100, currency: "NGN", status: "success" },
});
const sig = createHmac("sha512", secret).update(body, "utf8").digest("hex");

describe("webhook signature", () => {
  it("accepts the correct HMAC-SHA512 of the raw body", () => {
    expect(verifyTopifySignature(body, sig, secret)).toBe(true);
  });
  it("rejects a tampered body, wrong secret or missing signature", () => {
    expect(verifyTopifySignature(body.replace("250050", "1"), sig, secret)).toBe(false);
    expect(verifyTopifySignature(body, sig, "other")).toBe(false);
    expect(verifyTopifySignature(body, null, secret)).toBe(false);
    expect(verifyTopifySignature(body, "zz", secret)).toBe(false);
  });
  it("parses the verified event", () => {
    const e = parseTopifyWebhook(body);
    expect(e.reference).toBe("INV-123456");
    expect(e.amountKobo).toBe(250050);
    expect(e.currency).toBe("NGN");
  });
});

describe("status normalisation", () => {
  it("accepts both documented spellings of success", () => {
    expect(normalizeTopifyStatus("successful")).toBe("SUCCESSFUL");
    expect(normalizeTopifyStatus("success")).toBe("SUCCESSFUL");
  });
  it("maps expired to FAILED and rejects unknown values", () => {
    expect(normalizeTopifyStatus("expired")).toBe("FAILED");
    expect(normalizeTopifyStatus("weird")).toBeNull();
  });
});

describe("gateway confirmation", () => {
  const expected = { reference: "INV-123456", amountKobo: 250050n, currency: "NGN" as const };
  it("confirms only when reference, amount and currency match", () => {
    expect(confirmGatewayPayment(expected, { reference: "INV-123456", status: "success", amountKobo: 250050, currency: "NGN" })).toBe("SUCCESSFUL");
  });
  it("rejects amount, currency and reference mismatches", () => {
    expect(() => confirmGatewayPayment(expected, { reference: "INV-123456", status: "success", amountKobo: 250000, currency: "NGN" }))
      .toThrow(PaymentMismatchError);
    expect(() => confirmGatewayPayment(expected, { reference: "INV-123456", status: "success", amountKobo: 250050, currency: "USD" }))
      .toThrow(/Currency/);
    expect(() => confirmGatewayPayment(expected, { reference: "OTHER-1", status: "success", amountKobo: 250050, currency: "NGN" }))
      .toThrow(/Reference/);
  });
});

describe("TopifyClient", () => {
  it("sends the public key on checkout and the secret key on verification, with kobo amounts", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ status: true, data: { reference: "INV-123456", status: "successful" } }), { status: 200 });
    }) as typeof fetch;
    const client = new TopifyClient({ publicKey: "pk_test_1", secretKey: "sk_test_1", fetchImpl });

    await client.initializeCheckout({ amountKobo: 250050n, email: "a@b.co", reference: "INV-123456" });
    expect(calls[0].url).toBe("https://apipay.topify.ng/api/checkout/initialize");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer pk_test_1");
    expect(JSON.parse(calls[0].init.body as string).amount).toBe(250050);

    await client.verifyTransaction("INV-123456");
    expect(calls[1].url).toBe("https://apipay.topify.ng/api/v1/transactions/verify/INV-123456");
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_1");
  });

  it("refuses amounts under 100 kobo and malformed references before calling the network", async () => {
    let called = false;
    const client = new TopifyClient({ publicKey: "pk", secretKey: "sk", fetchImpl: (async () => { called = true; return new Response("{}"); }) as typeof fetch });
    await expect(client.initializeCheckout({ amountKobo: 50n, email: "a@b.co" })).rejects.toThrow(/Minimum/);
    await expect(client.verifyTransaction("bad ref!")).rejects.toThrow(/Invalid reference/);
    expect(called).toBe(false);
  });

  it("surfaces gateway errors without leaking internals", async () => {
    const client = new TopifyClient({ secretKey: "sk", fetchImpl: (async () => new Response(JSON.stringify({ message: "nope" }), { status: 401 })) as typeof fetch });
    await expect(client.verifyTransaction("INV-123456")).rejects.toThrow("nope");
  });
});
