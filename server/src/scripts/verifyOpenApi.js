import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const appSource = await readFile(resolve(root, "src/app.js"), "utf8");
const specification = parse(
  await readFile(resolve(root, "openapi.yaml"), "utf8"),
);
const routeModules = [
  ...appSource.matchAll(
    /import\s+(\w+)\s+from\s+["']\.\/modules\/([^"']+)\.routes\.js["'];/g,
  ),
];
const documented = new Set();
const registered = new Set();
const methods = new Set(["get", "post", "put", "patch", "delete"]);

for (const [, variable, modulePath] of routeModules) {
  const mountPattern = new RegExp(
    `app\\.use\\(\\s*(?:"([^"]+)"\\s*,\\s*)?${variable}\\s*\\)`,
  );
  const mount = appSource.match(mountPattern);
  if (!mount) throw new Error(`No app mount found for ${modulePath}`);

  const routeSource = await readFile(
    resolve(root, "src/modules", `${modulePath}.routes.js`),
    "utf8",
  );
  for (const [, method, routePath] of routeSource.matchAll(
    /router\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g,
  )) {
    const fullPath = `${mount[1] || ""}${routePath}`
      .replace(/\/+/g, "/")
      .replace(/\/$/, "")
      .replace(/:([A-Za-z0-9_]+)/g, "{$1}");
    registered.add(`${method.toLowerCase()} ${fullPath || "/"}`);
  }
}

for (const [path, operations] of Object.entries(specification.paths || {})) {
  for (const method of Object.keys(operations)) {
    if (methods.has(method.toLowerCase())) {
      documented.add(`${method.toLowerCase()} ${path}`);
    }
  }
}

const missingDocumentation = [...registered].filter(
  (route) => !documented.has(route),
);
const staleDocumentation = [...documented].filter(
  (route) => !registered.has(route),
);
if (missingDocumentation.length || staleDocumentation.length) {
  if (missingDocumentation.length) {
    console.error("Routes missing from OpenAPI:", missingDocumentation);
  }
  if (staleDocumentation.length) {
    console.error("OpenAPI operations without a route:", staleDocumentation);
  }
  process.exitCode = 1;
} else {
  console.log(`OpenAPI route check passed for ${registered.size} operations.`);
}
