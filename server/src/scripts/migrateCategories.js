import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { migrateLegacyServiceCategories } from "../modules/services/services.repository.js";

const dryRun = process.argv.slice(2).includes("--dry-run");

if (process.argv.slice(2).some((argument) => argument !== "--dry-run")) {
  console.error("Usage: node src/scripts/migrateCategories.js [--dry-run]");
  process.exitCode = 1;
} else if (env.nodeEnv === "production") {
  console.error("Category migration is disabled in production.");
  process.exitCode = 1;
} else {
  try {
    const migrated = await migrateLegacyServiceCategories({ dryRun });
    logger.info(
      { dryRun, migrated },
      dryRun
        ? "Legacy service category migration preview"
        : "Service categories migrated",
    );
  } catch (error) {
    logger.error({ error }, "Service category migration failed");
    process.exitCode = 1;
  }
}
