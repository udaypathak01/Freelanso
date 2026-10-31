import { assignAdminRole } from "../modules/users/users.service.js";
import { logger } from "../config/logger.js";

const [uid, role, ...extra] = process.argv.slice(2);
const roles = new Set(["freelancer", "client", "admin"]);

try {
  if (!uid || !roles.has(role) || extra.length) {
    throw new Error(
      "Usage: npm run set-role -- <firebase-uid> <freelancer|client|admin>",
    );
  }
  await assignAdminRole(uid, role);
  logger.info({ uid, role }, "Administrative user role updated");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
