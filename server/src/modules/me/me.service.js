import { ensureUserProfile } from "../users/users.repository.js";

export function getCurrentUserDto(user) {
  return ensureUserProfile(user).then(() => ({
    uid: user.uid,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
  }));
}
