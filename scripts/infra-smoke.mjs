const baseUrl = process.env.INFRA_SMOKE_BASE_URL ?? "http://localhost:3001/api/v1";
const origin = process.env.INFRA_SMOKE_ORIGIN ?? "http://localhost:3000";
if (process.env.NODE_ENV === "production" || /prod/i.test(baseUrl))
  throw new Error("Refusing to run infrastructure smoke checks against production-like target");
const checks = [];
async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false });
    throw new Error(`${name} failed: ${error.message}`);
  }
}
await check("liveness", async () => {
  const r = await fetch(`${baseUrl}/health/live`);
  if (!r.ok) throw new Error(String(r.status));
});
await check("readiness", async () => {
  const r = await fetch(`${baseUrl}/health/ready`);
  if (!r.ok) throw new Error(String(r.status));
});
await check("cors preflight", async () => {
  const r = await fetch(`${baseUrl}/auth/login`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,x-csrf-token",
    },
  });
  const allowOrigin = r.headers.get("access-control-allow-origin");
  if (allowOrigin !== origin) throw new Error("unexpected CORS origin");
  if (r.headers.get("access-control-allow-credentials") !== "true")
    throw new Error("credentials not allowed");
});
process.stdout.write(`Infrastructure smoke checks passed: ${checks.length}\n`);
