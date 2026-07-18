const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function validateInfraSmokeTarget({
  baseUrl,
  environment = process.env.INFRA_SMOKE_ENVIRONMENT ?? process.env.NODE_ENV ?? "local",
  allowRemote = process.env.INFRA_SMOKE_ALLOW_REMOTE === "true",
} = {}) {
  const target = new URL(baseUrl ?? "http://localhost:3001/api/v1");
  if (target.username || target.password)
    throw new Error("Refusing smoke target URL with credentials");
  if (environment === "production")
    throw new Error("Refusing to run infrastructure smoke checks against production");
  const isLocal = localHosts.has(target.hostname);
  if (isLocal) return target;
  if (!environment || environment === "local")
    throw new Error("Remote smoke targets require INFRA_SMOKE_ENVIRONMENT=staging");
  if (environment !== "staging")
    throw new Error("Remote smoke targets are only allowed for staging");
  if (!allowRemote) throw new Error("Remote staging smoke requires INFRA_SMOKE_ALLOW_REMOTE=true");
  if (target.protocol !== "https:") throw new Error("Remote staging smoke requires HTTPS");
  return target;
}
