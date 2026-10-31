function toIsoString(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return null;
}

const categoryLabels = {
  "logo-design": "Logo Design",
  "ui-ux-design": "UI/UX Design",
  "web-development": "Web Development",
  "video-editing": "Video Editing",
  illustration: "Illustration",
  "content-writing": "Content Writing",
  "seo-marketing": "SEO / Marketing",
  "motion-graphics": "Motion Graphics",
};

export function toProjectDto(id, project, owner = {}) {
  const storedMedia = Array.isArray(project.media)
    ? project.media
    : Array.isArray(project.images)
      ? project.images
      : typeof project.coverImage === "string"
        ? [{ url: project.coverImage, type: project.mediaType }]
        : [];
  const media = storedMedia
        .filter(
          (asset) =>
            asset &&
            typeof asset.url === "string",
        )
        .slice(0, 10)
        .map((asset) => ({
          url: asset.url,
          ...(typeof asset.publicId === "string"
            ? { publicId: asset.publicId }
            : {}),
          type:
            asset.type === "video" || asset.mediaType === "video"
              ? "video"
              : "image",
          isCover: asset.isCover === true,
          resourceType: asset.resourceType === "video" ? "video" : "image",
        }))
  if (media.length && !media.some((asset) => asset.isCover)) {
    media[0].isCover = true;
  }
  const coverIndex = media.findIndex((asset) => asset.isCover)
  if (coverIndex > 0) media.unshift(media.splice(coverIndex, 1)[0])
  const images = media.map((asset) => ({
    url: asset.url,
    ...(asset.publicId ? { publicId: asset.publicId } : {}),
    mediaType: asset.type,
    resourceType: asset.resourceType,
  }))
  const ownerSummary = {
    id: project.ownerId,
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

  return {
    id,
    ownerId: project.ownerId,
    title: project.title,
    description: project.description,
    category: project.category,
    categoryLabel: categoryLabels[project.category] ?? project.category,
    tags: Array.isArray(project.tags) ? project.tags : [],
    skills: Array.isArray(project.skills) ? project.skills : [],
    price: typeof project.price === "number" ? project.price : null,
    deliveryDays:
      Number.isInteger(project.deliveryDays) && project.deliveryDays > 0
        ? project.deliveryDays
        : null,
    level: typeof project.level === "string" ? project.level : null,
    images,
    media,
    links: Array.isArray(project.links) ? project.links : [],
    status: project.status,
    likesCount:
      Number.isInteger(project.likesCount) && project.likesCount >= 0
        ? project.likesCount
        : 0,
    commentsCount:
      Number.isInteger(project.commentsCount) && project.commentsCount >= 0
        ? project.commentsCount
        : 0,
    viewsCount:
      Number.isInteger(project.viewsCount) && project.viewsCount >= 0
        ? project.viewsCount
        : 0,
    likedByMe: project.likedByMe === true,
    owner: ownerSummary,
    createdAt: toIsoString(project.createdAt),
    updatedAt: toIsoString(project.updatedAt),
    authorUid: project.ownerId,
    author: ownerSummary.displayName,
    avatar: ownerSummary.photoURL,
    imageUrl: images[0]?.url ?? null,
    img: images[0]?.url ?? null,
    mediaType: images[0]?.mediaType ?? "image",
    likes: Number.isInteger(project.likesCount) ? project.likesCount : 0,
    delivery: project.deliveryDays ? `${project.deliveryDays}d` : null,
    source: "live",
  };
}

export function toCommentDto(id, comment, author = {}) {
  return {
    id,
    projectId: comment.projectId,
    authorId: comment.authorId,
    userName:
      typeof author.displayName === "string" ? author.displayName : "Freelancer",
    userAvatar: typeof author.photoURL === "string" ? author.photoURL : null,
    text: comment.text,
    createdAt: toIsoString(comment.createdAt),
  };
}
