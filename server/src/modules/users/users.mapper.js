function toIsoString(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return null;
}

function onlyStrings(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    keys
      .filter((key) => typeof value[key] === "string")
      .map((key) => [key, value[key]]),
  );
}

function stringArray(value, maxItems) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string").slice(0, maxItems)
    : [];
}

function mappedArray(value, maxItems, keys) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) =>
      Object.fromEntries(
        keys
          .filter((key) => {
            const valueAtKey = item[key];
            return (
              typeof valueAtKey === "string" ||
              typeof valueAtKey === "number" ||
              typeof valueAtKey === "boolean"
            );
          })
          .map((key) => [key, item[key]]),
      ),
    );
}

function httpsUrl(value) {
  if (typeof value !== "string") return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

export function toPublicUserDto(uid, user) {
  const allowedRoles = new Set(["freelancer", "client", "admin"]);
  const stats = user.stats && typeof user.stats === "object" ? user.stats : {};
  const socialLinks = onlyStrings(user.socialLinks, [
    "website",
    "linkedin",
    "github",
    "twitter",
    "dribbble",
    "behance",
  ]);
  return {
    id: uid,
    displayName: typeof user.displayName === "string" ? user.displayName : "",
    photoURL: httpsUrl(user.photoURL),
    role: allowedRoles.has(user.role) ? user.role : null,
    headline: typeof user.headline === "string" ? user.headline : "",
    bio: typeof user.bio === "string" ? user.bio : "",
    handle: typeof user.handle === "string" ? user.handle : "",
    bannerURL: httpsUrl(user.bannerURL),
    skills: stringArray(user.skills, 30),
    hourlyRate:
      typeof user.hourlyRate === "number" &&
      user.hourlyRate >= 0 &&
      user.hourlyRate <= 1_000_000
        ? user.hourlyRate
        : null,
    location: onlyStrings(user.location, ["country", "state", "city"]),
    languages: mappedArray(user.languages, 20, ["lang", "proficiency"]),
    socialLinks: Object.fromEntries(
      Object.entries(socialLinks).filter(([, value]) => httpsUrl(value)),
    ),
    stats: {
      projectsCount:
        Number.isInteger(stats.projectsCount) && stats.projectsCount >= 0
          ? stats.projectsCount
          : 0,
      ratingAvg:
        Number.isFinite(stats.ratingAvg) &&
        stats.ratingAvg >= 0 &&
        stats.ratingAvg <= 5
          ? stats.ratingAvg
          : 0,
      ratingCount:
        Number.isInteger(stats.ratingCount) && stats.ratingCount >= 0
          ? stats.ratingCount
          : 0,
    },
    experience: mappedArray(user.experience, 20, [
      "title",
      "company",
      "city",
      "country",
      "startMonth",
      "startYear",
      "isCurrent",
      "endMonth",
      "endYear",
      "description",
    ]),
    education: mappedArray(user.education, 20, [
      "school",
      "degree",
      "field",
      "startYear",
      "endYear",
      "description",
    ]),
    certifications: mappedArray(user.certifications, 30, [
      "name",
      "issuer",
      "year",
    ]),
    createdAt: toIsoString(user.createdAt),
    updatedAt: toIsoString(user.updatedAt),
  };
}

export function toPrivateUserDto(uid, user) {
  return {
    ...toPublicUserDto(uid, user),
    email: user.email ?? null,
    phone: typeof user.phone === "string" ? user.phone : "",
    privateAddress: onlyStrings(user.privateAddress, [
      "line1",
      "line2",
      "postalCode",
    ]),
  };
}
