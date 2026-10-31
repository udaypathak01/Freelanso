import { createHash } from "node:crypto";
import { notifyUser } from "../notifications/notifications.service.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../utils/AppError.js";
import {
  addProjectView,
  createProject,
  createProjectComment,
  deleteProjectComment,
  deleteProjectTree,
  findPendingCloudinaryDeletions,
  findProject,
  hasProjectLike,
  findProjectComment,
  findProjectComments,
  findProjectOwners,
  findProjects,
  findProjectsByOwner,
  queueCloudinaryDeletions,
  removeCloudinaryDeletionJob,
  rescheduleCloudinaryDeletion,
  rollbackCloudinaryDeletions,
  toggleProjectLike,
  updateProject,
} from "./projects.repository.js";

const allowedRoles = new Set(["freelancer", "admin"]);
const viewWindowMs = 24 * 60 * 60 * 1000;

export function buildSearchKeywords(project) {
  const tokens = [
    project.title,
    project.description,
    project.category,
    ...(project.tags ?? []),
    ...(project.skills ?? []),
  ]
    .join(" ")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu);
  return [...new Set(tokens ?? [])].slice(0, 200);
}

function validateCloudinaryAsset(asset) {
  let url;
  try {
    url = new URL(asset.url);
  } catch {
    return false;
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "res.cloudinary.com" ||
    !url.pathname.startsWith(`/${env.cloudinaryCloudName}/`)
  ) {
    return false;
  }
  const parts = url.pathname.split("/").filter(Boolean);
  const uploadIndex = parts.indexOf("upload");
  const resourceType = parts[1];
  if (
    uploadIndex !== 2 ||
    !["image", "video"].includes(resourceType) ||
    asset.resourceType !== resourceType ||
    asset.mediaType !== resourceType
  ) {
    return false;
  }
  const pathAfterUpload = parts.slice(uploadIndex + 1);
  const versionIndex = pathAfterUpload.findIndex((part) => /^v\d+$/.test(part));
  const publicPath =
    versionIndex >= 0
      ? pathAfterUpload.slice(versionIndex + 1)
      : pathAfterUpload;
  if (!publicPath.length) return false;
  let lastPart;
  try {
    lastPart = decodeURIComponent(publicPath.at(-1));
  } catch {
    return false;
  }
  const publicIdParts = [...publicPath];
  publicIdParts[publicIdParts.length - 1] = lastPart.replace(
    /\.[A-Za-z0-9]+$/,
    "",
  );
  return publicIdParts.join("/") === asset.publicId;
}

function validateAssets(assets) {
  for (const asset of assets) {
    if (!validateCloudinaryAsset(asset)) {
      throw new ValidationError([
        {
          path: ["body", "images"],
          message: "Every media item must be a Cloudinary asset in this cloud",
        },
      ]);
    }
  }
}

function assertProjectPublisher(actor) {
  if (!allowedRoles.has(actor.role)) {
    logger.warn(
      { uid: actor.uid, role: actor.role, authorizationFailure: true },
      "Project creation denied",
    );
    throw new ForbiddenError(
      "Only freelancers and admins can publish projects",
    );
  }
}

function assertProjectOwner(actor, project) {
  if (actor.uid !== project.ownerId && actor.role !== "admin") {
    logger.warn(
      {
        uid: actor.uid,
        projectId: project.id,
        authorizationFailure: true,
      },
      "Project modification denied",
    );
    throw new ForbiddenError();
  }
}

function normalizeComment(text) {
  return text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function viewerKey(user, ip, now) {
  const identity = user?.uid ? `uid:${user.uid}` : `ip:${ip || "unknown"}`;
  const bucket = Math.floor(now.getTime() / viewWindowMs);
  return createHash("sha256").update(`${identity}:${bucket}`).digest("hex");
}

function withOwner(project, owner) {
  return { ...project, ownerSummary: owner };
}

export async function listProjects(filters) {
  const { items, nextCursor, total } = await findProjects(filters, filters);
  const owners = await findProjectOwners(items);
  return {
    items: items.map((project) =>
      withOwner(project, owners.get(project.ownerId)),
    ),
    nextCursor,
    total,
  };
}

export async function listMyProjects(actor, filters) {
  const { items, nextCursor } = await findProjectsByOwner(actor.uid, filters);
  const owners = await findProjectOwners(items);
  return {
    items: items.map((project) =>
      withOwner(project, owners.get(project.ownerId)),
    ),
    nextCursor,
  };
}

export async function getProject(id, actor, ip, now = new Date()) {
  const project = await findProject(id);
  if (!project) throw new NotFoundError("Project not found");
  if (
    project.status !== "published" &&
    (!actor || (actor.uid !== project.ownerId && actor.role !== "admin"))
  ) {
    throw new NotFoundError("Project not found");
  }
  if (project.status === "published") {
    const counted = await addProjectView(
      id,
      viewerKey(actor, ip, now),
      new Date(Math.floor(now.getTime() / viewWindowMs) * viewWindowMs),
    );
    if (counted) project.viewsCount = (project.viewsCount ?? 0) + 1;
    project.likedByMe = actor?.uid
      ? await hasProjectLike(id, actor.uid)
      : false;
  }
  const owners = await findProjectOwners([project]);
  return withOwner(project, owners.get(project.ownerId));
}

export async function createNewProject(actor, input) {
  assertProjectPublisher(actor);
  const media = input.media ?? input.images ?? [];
  validateAssets(media);
  const orderedMedia = [...media].sort(
    (left, right) => Number(right.isCover === true) - Number(left.isCover === true),
  );
  const normalizedMedia = orderedMedia.map((asset, index) => {
    const mediaType = asset.type ?? asset.mediaType;
    return {
      ...asset,
      mediaType,
      resourceType: asset.resourceType ?? mediaType,
      isCover: asset.isCover === true || index === 0,
    };
  });
  const projectInput = {
    ...input,
    images: normalizedMedia.map(({ type: _type, isCover: _cover, ...asset }) => asset),
    media: normalizedMedia.map((asset) => ({
      url: asset.url,
      publicId: asset.publicId,
      type: asset.mediaType,
      resourceType: asset.resourceType,
      isCover: asset.isCover,
    })),
    coverImage: normalizedMedia[0]?.url,
    links: input.links ?? [],
  };
  const project = await createProject(
    actor.uid,
    projectInput,
    buildSearchKeywords(projectInput),
  );
  const owners = await findProjectOwners([project]);
  return withOwner(project, owners.get(project.ownerId));
}

export async function updateExistingProject(actor, id, input) {
  const existing = await findProject(id);
  if (!existing) throw new NotFoundError("Project not found");
  assertProjectOwner(actor, existing);
  const mediaInput = input.media ?? input.images;
  if (mediaInput) validateAssets(mediaInput);
  const normalizedUpdates = mediaInput
    ? (() => {
        const orderedMedia = [...mediaInput].sort(
          (left, right) =>
            Number(right.isCover === true) - Number(left.isCover === true),
        );
        const normalizedMedia = orderedMedia.map((asset, index) => {
          const mediaType = asset.type ?? asset.mediaType;
          return {
            ...asset,
            mediaType,
            resourceType: asset.resourceType ?? mediaType,
            isCover: asset.isCover === true || index === 0,
          };
        });
        return {
          ...input,
          images: normalizedMedia.map(
            ({ type: _type, isCover: _cover, ...asset }) => asset,
          ),
          media: normalizedMedia.map((asset) => ({
            url: asset.url,
            publicId: asset.publicId,
            type: asset.mediaType,
            resourceType: asset.resourceType,
            isCover: asset.isCover,
          })),
          coverImage: normalizedMedia[0]?.url,
        };
      })()
    : input;
  const needsKeywords =
    normalizedUpdates.title !== undefined ||
    normalizedUpdates.tags !== undefined ||
    normalizedUpdates.skills !== undefined;
  const searchKeywords = needsKeywords
    ? buildSearchKeywords({ ...existing, ...normalizedUpdates })
    : undefined;
  const project = await updateProject(id, normalizedUpdates, searchKeywords);
  if (!project) throw new NotFoundError("Project not found");
  const owners = await findProjectOwners([project]);
  return withOwner(project, owners.get(project.ownerId));
}

async function destroyCloudinaryAsset(job) {
  const { cloudinaryApiKey, cloudinaryApiSecret, cloudinaryCloudName } = env;
  if (!cloudinaryApiKey || !cloudinaryApiSecret || !cloudinaryCloudName) {
    throw Object.assign(
      new Error("Cloudinary credentials are not configured"),
      {
        code: "CLOUDINARY_NOT_CONFIGURED",
      },
    );
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha1")
    .update(
      `public_id=${job.publicId}&timestamp=${timestamp}${cloudinaryApiSecret}`,
    )
    .digest("hex");
  const body = new URLSearchParams({
    public_id: job.publicId,
    timestamp: String(timestamp),
    api_key: cloudinaryApiKey,
    signature,
  });
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/${job.resourceType}/destroy`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
          signal: AbortSignal.timeout(5000),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (response.ok && ["ok", "not found"].includes(payload.result)) return;
      lastError = Object.assign(new Error("Cloudinary deletion failed"), {
        code: "CLOUDINARY_DELETE_FAILED",
      });
    } catch (error) {
      lastError = Object.assign(new Error("Cloudinary request failed"), {
        code:
          error?.name === "TimeoutError"
            ? "CLOUDINARY_TIMEOUT"
            : "CLOUDINARY_NETWORK_ERROR",
      });
    }
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt));
    }
  }
  throw lastError;
}

async function deleteAssetsBestEffort(jobs, requestId) {
  for (const job of jobs) {
    try {
      await destroyCloudinaryAsset(job);
      await removeCloudinaryDeletionJob(job.id);
    } catch (error) {
      try {
        await rescheduleCloudinaryDeletion(job.id, 1);
      } catch (queueError) {
        logger.error(
          {
            requestId,
            projectId: job.projectId,
            errorName: queueError.name,
            retryQueued: false,
          },
          "Cloudinary deletion retry could not be scheduled",
        );
      }
      logger.warn(
        {
          requestId,
          projectId: job.projectId,
          errorCode: error.code ?? "CLOUDINARY_DELETE_FAILED",
          retryQueued: true,
        },
        "Cloudinary asset deletion deferred",
      );
    }
  }
}

export async function deleteExistingProject(actor, id, requestId) {
  const project = await findProject(id);
  if (!project) throw new NotFoundError("Project not found");
  assertProjectOwner(actor, project);
  const jobs = await queueCloudinaryDeletions(id, project.images ?? []);
  try {
    const deleted = await deleteProjectTree(id);
    if (!deleted) throw new NotFoundError("Project not found");
  } catch (error) {
    await rollbackCloudinaryDeletions(jobs);
    throw error;
  }
  await deleteAssetsBestEffort(jobs, requestId);
}

export async function likeProject(actor, id) {
  const project = await findProject(id);
  if (!project) throw new NotFoundError("Project not found");
  const result = await toggleProjectLike(id, actor.uid);
  if (!result) throw new NotFoundError("Project not found");
  if (result.liked && project.ownerId !== actor.uid) {
    await notifyUser(
      project.ownerId,
      {
        type: "project_like",
        title: "Your project got a like",
        body: `${actor.displayName || "Someone"} liked "${project.title}"`,
        href: "/explore",
        actorUid: actor.uid,
        actorName: actor.displayName || "Freelanso member",
        createdAt: Date.now(),
        readAt: null,
      },
      `${id}:${actor.uid}`,
    );
  }
  return result;
}

export async function listProjectComments(id, filters) {
  const project = await findProject(id);
  if (!project || project.status !== "published") {
    throw new NotFoundError("Project not found");
  }
  const { items, nextCursor } = await findProjectComments(id, filters);
  return {
    items,
    nextCursor,
  };
}

export async function addProjectComment(actor, id, text) {
  const safeText = normalizeComment(text);
  if (!safeText) {
    throw new ValidationError([
      { path: ["body", "text"], message: "Comment must contain plain text" },
    ]);
  }
  const project = await findProject(id);
  if (!project || project.status !== "published") {
    throw new NotFoundError("Project not found");
  }
  const result = await createProjectComment(id, actor.uid, safeText);
  if (!result) throw new NotFoundError("Project not found");
  if (project.ownerId !== actor.uid) {
    await notifyUser(
      project.ownerId,
      {
        type: "project_comment",
        title: "New comment on your project",
        body: `${actor.displayName || "Someone"}: ${safeText.slice(0, 120)}`,
        href: "/explore",
        actorUid: actor.uid,
        actorName: actor.displayName || "Freelanso member",
        createdAt: Date.now(),
        readAt: null,
      },
      result.id,
    );
  }
  return result;
}

export async function removeProjectComment(actor, id, commentId) {
  const project = await findProject(id);
  if (!project || project.status !== "published") {
    throw new NotFoundError("Project not found");
  }
  const comment = await findProjectComment(id, commentId);
  if (!comment) throw new NotFoundError("Comment not found");
  if (
    actor.uid !== comment.authorId &&
    actor.uid !== project.ownerId &&
    actor.role !== "admin"
  ) {
    logger.warn(
      { uid: actor.uid, projectId: id, commentId, authorizationFailure: true },
      "Comment deletion denied",
    );
    throw new ForbiddenError();
  }
  const removed = await deleteProjectComment(id, commentId);
  if (!removed) throw new NotFoundError("Comment not found");
}

export async function processCloudinaryDeletionQueue() {
  const jobs = await findPendingCloudinaryDeletions();
  for (const job of jobs) {
    try {
      await destroyCloudinaryAsset(job);
      await removeCloudinaryDeletionJob(job.id);
    } catch (error) {
      const nextAttempt = (job.attemptCount ?? 0) + 1;
      await rescheduleCloudinaryDeletion(job.id, nextAttempt);
      logger.warn(
        {
          projectId: job.projectId,
          errorCode: error.code ?? "CLOUDINARY_DELETE_FAILED",
          attemptCount: nextAttempt,
          retryQueued: true,
        },
        "Cloudinary deletion retry deferred",
      );
    }
  }
}
