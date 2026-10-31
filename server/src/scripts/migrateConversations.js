import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { migrateConversationShapes } from "../modules/conversations/conversations.repository.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

if (args.some((argument) => argument !== "--dry-run")) {
  console.error("Usage: node src/scripts/migrateConversations.js [--dry-run]");
  process.exitCode = 1;
} else if (env.nodeEnv === "production" && !dryRun) {
  console.error("Conversation migration writes are disabled in production.");
  process.exitCode = 1;
} else {
  try {
    const result = await migrateConversationShapes({ dryRun });
    logger.info({ ...result, dryRun }, "Conversation shape migration completed");
  } catch (error) {
    logger.error({ error }, "Conversation shape migration failed");
    process.exitCode = 1;
  }
}
