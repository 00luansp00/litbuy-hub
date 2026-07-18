import { existsSync, readFileSync } from "node:fs";

const baseUrl = process.env.WAIT_BACKEND_BASE_URL ?? "http://localhost:3001/api/v1";
const pidFile = process.env.WAIT_BACKEND_PID_FILE ?? "/tmp/litbuy-backend.pid";
const logFile = process.env.WAIT_BACKEND_LOG_FILE ?? "/tmp/litbuy-backend.log";
const timeoutMs = Number(process.env.WAIT_BACKEND_TIMEOUT_MS ?? 90_000);

function printBackendLog() {
  process.stderr.write(`\n----- backend log: ${logFile} -----\n`);
  if (existsSync(logFile)) process.stderr.write(readFileSync(logFile, "utf8"));
  else process.stderr.write("backend log file does not exist\n");
  process.stderr.write("----- end backend log -----\n");
}

function readPid() {
  if (!existsSync(pidFile)) throw new Error(`PID file not found: ${pidFile}`);
  const pid = Number(readFileSync(pidFile, "utf8").trim());
  if (!Number.isInteger(pid) || pid <= 0) throw new Error(`Invalid backend PID in ${pidFile}`);
  return pid;
}

function assertAlive(pid) {
  try {
    process.kill(pid, 0);
  } catch {
    printBackendLog();
    throw new Error(`Backend process ${pid} is not running`);
  }
}

async function pollEndpoint(pid, path, expectedOk) {
  const deadline = Date.now() + timeoutMs;
  let last = "no response yet";
  while (Date.now() < deadline) {
    assertAlive(pid);
    try {
      const response = await fetch(`${baseUrl}${path}`);
      const body = await response.text();
      last = `HTTP ${response.status} ${body.slice(0, 1000)}`;
      process.stdout.write(`${path}: ${last}\n`);
      if (expectedOk(response.status)) return;
    } catch (error) {
      last = `connection error: ${error.message}`;
      process.stdout.write(`${path}: ${last}\n`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  printBackendLog();
  throw new Error(`${path} did not become ready before timeout; last response: ${last}`);
}

try {
  const pid = readPid();
  assertAlive(pid);
  await pollEndpoint(pid, "/health/live", (status) => status >= 200 && status < 300);
  await pollEndpoint(pid, "/health/ready", (status) => status >= 200 && status < 300);
} catch (error) {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exit(1);
}
