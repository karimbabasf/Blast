import crypto from "crypto";
import StripeClient from "stripe";
import { Mppx, Store, stripe } from "mppx/server";

// Machine Payments Protocol: outside agents pay Blast over HTTP 402. Sandbox only.

function testKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is missing");
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    throw new Error("STRIPE_SECRET_KEY is not a test key, refusing to take payments");
  }
  return key;
}

let instance: ReturnType<typeof create> | null = null;

function create() {
  const key = testKey();
  const client = new StripeClient(key);
  const machinePayments = stripe.create({
    client,
    // Sandbox SPTs ignore the seller profile; a live key would need the real profile_ id.
    networkId: process.env.STRIPE_PROFILE_ID || "blast-sandbox",
    livemode: false,
    store: Store.memory(),
  });
  return Mppx.create({
    methods: machinePayments.defaultMethods(),
    secretKey: crypto.createHmac("sha256", key).update("mpp-challenge-signing").digest("base64"),
  });
}

export function mpp() {
  instance ??= create();
  return instance;
}

export function stripeClient() {
  return new StripeClient(testKey());
}
