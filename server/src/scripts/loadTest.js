import { randomUUID } from "node:crypto";
import autocannon from "autocannon";

process.env.NODE_ENV ||= "test";
process.env.PORT ||= "5000";
process.env.CORS_ALLOWED_ORIGINS ||= "http://localhost:5173";
process.env.FIREBASE_PROJECT_ID ||= "demo-freelanso-test";
process.env.FIREBASE_DATABASE_URL ||=
  "https://demo-freelanso-test-default-rtdb.firebaseio.com";
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
process.env.FIREBASE_DATABASE_EMULATOR_HOST ||= "127.0.0.1:9000";
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
process.env.LOG_LEVEL ||= "silent";
process.env.TRUST_PROXY ||= "false";
process.env.RATE_LIMIT_WINDOW_MS ||= "60000";
process.env.RATE_LIMIT_MAX ||= "1000";

const { app } = await import("../app.js");
const server = app.listen(0, "127.0.0.1");

function runAutocannon(options) {
  return new Promise((resolve, reject) => {
    autocannon(options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

function printResult(label, result) {
  console.log(
    JSON.stringify({
      test: label,
      requests: result.requests.total,
      requestsPerSecond: result.requests.average,
      latencyMs: {
        average: result.latency.average,
        p50: result.latency.p50,
        p97_5: result.latency.p97_5,
        p99: result.latency.p99,
      },
      statusCodes: result.statusCodeStats,
      errors: result.errors,
      timeouts: result.timeouts,
    }),
  );
}

try {
  await new Promise((resolveListen, rejectListen) => {
    server.once("listening", resolveListen);
    server.once("error", rejectListen);
  });
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;
  const warmup = await fetch(`${url}/api/projects?limit=20`);
  if (!warmup.ok) {
    throw new Error(`Load-test warm-up failed with HTTP ${warmup.status}`);
  }
  await warmup.arrayBuffer();

  const listResult = await runAutocannon({
    url,
    title: "public project list",
    connections: 10,
    amount: 100,
    timeout: 15,
    requests: [{ method: "GET", path: "/api/projects?limit=20" }],
  });
  printResult("GET /api/projects?limit=20", listResult);
  if (
    listResult.errors ||
    listResult.timeouts ||
    listResult.statusCodeStats["200"]?.count !== listResult.requests.total
  ) {
    throw new Error("The project-list benchmark had request errors");
  }

  let writeIndex = 0;
  const writeResult = await runAutocannon({
    url,
    title: "support ticket writes (four-request rate-limit-safe sample)",
    connections: 1,
    amount: 4,
    timeout: 15,
    requests: [
      {
        method: "POST",
        path: "/api/support/tickets",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Load Test",
          email: "load-test@example.invalid",
          subject: "Local benchmark",
          message: "Synthetic request used only for the local API load test.",
          companyWebsite: "",
        }),
        setupRequest(request, context) {
          context.runId ||= randomUUID();
          request.headers["Idempotency-Key"] =
            `${context.runId}-${writeIndex++}`;
          return request;
        },
      },
    ],
  });
  printResult("POST /api/support/tickets (4 requests)", writeResult);
  if (
    writeResult.errors ||
    writeResult.timeouts ||
    writeResult.statusCodeStats["201"]?.count !== writeResult.requests.total
  ) {
    throw new Error("The support-ticket benchmark had request errors");
  }
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}
