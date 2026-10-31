function toIsoString(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return null;
}

export function toServiceDto(id, service, owner = {}) {
  const images = Array.isArray(service.images)
    ? service.images
        .filter(
          (image) =>
            image &&
            typeof image.url === "string" &&
            typeof image.publicId === "string",
        )
        .slice(0, 10)
        .map(({ url, publicId }) => ({ url, publicId }))
    : [];
  const ownerSummary = {
    id: service.ownerId,
    displayName:
      typeof owner.displayName === "string" ? owner.displayName : "Freelancer",
    photoURL: typeof owner.photoURL === "string" ? owner.photoURL : null,
    ratingAvg:
      Number.isFinite(owner.stats?.ratingAvg) && owner.stats.ratingAvg >= 0
        ? owner.stats.ratingAvg
        : 0,
    headline: typeof owner.headline === "string" ? owner.headline : "",
    skills: Array.isArray(owner.skills)
      ? owner.skills.filter((skill) => typeof skill === "string").slice(0, 30)
      : [],
    experience: Array.isArray(owner.experience)
      ? owner.experience
          .filter((entry) => entry && typeof entry.title === "string")
          .slice(0, 20)
          .map(({ title, company, startYear, endYear, isCurrent }) => ({
            title,
            ...(typeof company === "string" ? { company } : {}),
            ...(typeof startYear === "number" ? { startYear } : {}),
            ...(typeof endYear === "number" ? { endYear } : {}),
            ...(typeof isCurrent === "boolean" ? { isCurrent } : {}),
          }))
      : [],
  };
  const price = Number.isFinite(service.price) ? service.price : null;
  return {
    id,
    ownerId: service.ownerId,
    title: service.title,
    description: service.description,
    category: service.category,
    categoryLabel: service.categoryLabel,
    price,
    deliveryDays: Number.isInteger(service.deliveryDays)
      ? service.deliveryDays
      : null,
    revisions: Number.isInteger(service.revisions) ? service.revisions : 0,
    images,
    skills: Array.isArray(service.skills) ? service.skills : [],
    status: service.status,
    ratingAvg:
      Number.isFinite(service.ratingAvg) && service.ratingAvg >= 0
        ? service.ratingAvg
        : 0,
    ratingCount:
      Number.isInteger(service.ratingCount) && service.ratingCount >= 0
        ? service.ratingCount
        : 0,
    owner: ownerSummary,
    createdAt: toIsoString(service.createdAt),
    updatedAt: toIsoString(service.updatedAt),
    authorUid: service.ownerId,
    author: {
      name: ownerSummary.displayName,
      avatar: ownerSummary.photoURL,
    },
    image: images[0]?.url ?? null,
    imageUrl: images[0]?.url ?? null,
  };
}
