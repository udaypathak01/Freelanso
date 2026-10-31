import { env } from "../../config/env.js";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../utils/AppError.js";
import {
  createService,
  deleteService,
  findService,
  findServiceOwners,
  findServices,
  updateService,
} from "./services.repository.js";
import { getServiceCategoryLabel } from "./serviceCategories.js";

const allowedRoles = new Set(["freelancer", "admin"]);

export function buildServiceSearchKeywords(service) {
  const tokens = [
    service.title,
    service.description,
    service.category,
    getServiceCategoryLabel(service.category),
    ...(service.skills ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu);
  return [...new Set(tokens ?? [])].slice(0, 300);
}

function validateAssets(images) {
  for (const image of images) {
    let url;
    try {
      url = new URL(image.url);
    } catch {
      url = null;
    }
    const parts = url?.pathname.split("/").filter(Boolean) ?? [];
    const uploadIndex = parts.indexOf("upload");
    const publicPath = uploadIndex >= 0 ? parts.slice(uploadIndex + 1) : [];
    const versionIndex = publicPath.findIndex((part) => /^v\d+$/.test(part));
    const publicIdParts =
      versionIndex >= 0 ? publicPath.slice(versionIndex + 1) : publicPath;
    if (publicIdParts.length) {
      const last = publicIdParts.at(-1);
      publicIdParts[publicIdParts.length - 1] = last.replace(
        /\.[A-Za-z0-9]+$/,
        "",
      );
    }
    if (
      !url ||
      url.protocol !== "https:" ||
      url.hostname !== "res.cloudinary.com" ||
      parts[0] !== env.cloudinaryCloudName ||
      parts[1] !== "image" ||
      uploadIndex !== 2 ||
      publicIdParts.join("/") !== image.publicId
    ) {
      throw new ValidationError([
        {
          path: ["body", "images"],
          message: "Every image must belong to this Cloudinary cloud",
        },
      ]);
    }
  }
}

function assertPublisher(actor) {
  if (!allowedRoles.has(actor.role)) {
    throw new ForbiddenError(
      "Only freelancers and admins can publish services",
    );
  }
}

function assertOwner(actor, service) {
  if (actor.uid !== service.ownerId && actor.role !== "admin") {
    throw new ForbiddenError();
  }
}

function withOwner(service, owner) {
  return {
    ...service,
    ownerSummary: owner,
    categoryLabel: getServiceCategoryLabel(service.category),
  };
}

export async function listServices(filters) {
  const page = await findServices(filters);
  const owners = await findServiceOwners(page.items);
  return {
    items: page.items.map((service) =>
      withOwner(service, owners.get(service.ownerId)),
    ),
    nextCursor: page.nextCursor,
    total: page.total,
  };
}

export async function getService(id) {
  const service = await findService(id);
  if (!service || service.status !== "published") {
    throw new NotFoundError("Service not found");
  }
  const owners = await findServiceOwners([service]);
  return withOwner(service, owners.get(service.ownerId));
}

export async function createNewService(actor, input) {
  assertPublisher(actor);
  validateAssets(input.images);
  const service = await createService(
    actor.uid,
    input,
    buildServiceSearchKeywords(input),
  );
  const owners = await findServiceOwners([service]);
  return withOwner(service, owners.get(service.ownerId));
}

export async function updateExistingService(actor, id, input) {
  const existing = await findService(id);
  if (!existing || existing.status !== "published") {
    throw new NotFoundError("Service not found");
  }
  assertOwner(actor, existing);
  if (input.images) validateAssets(input.images);
  const updatesKeywords =
    input.title !== undefined ||
    input.description !== undefined ||
    input.category !== undefined ||
    input.skills !== undefined;
  const searchKeywords = updatesKeywords
    ? buildServiceSearchKeywords({ ...existing, ...input })
    : undefined;
  const service = await updateService(id, input, searchKeywords);
  if (!service) throw new NotFoundError("Service not found");
  const owners = await findServiceOwners([service]);
  return withOwner(service, owners.get(service.ownerId));
}

export async function deleteExistingService(actor, id) {
  const service = await findService(id);
  if (!service || service.status !== "published") {
    throw new NotFoundError("Service not found");
  }
  assertOwner(actor, service);
  if (!(await deleteService(id))) throw new NotFoundError("Service not found");
}
