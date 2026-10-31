import { asyncHandler } from "../../utils/asyncHandler.js";
import { created, noContent, ok, paginated } from "../../utils/response.js";
import { DEFAULT_PAGE_SIZE } from "../../utils/pagination.js";
import { toServiceDto } from "./services.mapper.js";
import {
  createNewService,
  deleteExistingService,
  getService,
  listServices,
  updateExistingService,
} from "./services.service.js";

const serviceDto = (service) =>
  toServiceDto(service.id, service, service.ownerSummary);

export const getServices = asyncHandler(async (req, res) => {
  const filters = req.validated.query;
  const page = await listServices(filters);
  return paginated(res, page.items.map(serviceDto), page.nextCursor, {
    ...(page.total !== undefined ? { total: page.total } : {}),
    limit: filters.limit ?? DEFAULT_PAGE_SIZE,
    appliedFilters: {
      q: filters.q ?? "",
      category: filters.category ?? null,
      skills: filters.skills ?? [],
      minPrice: filters.minPrice ?? null,
      maxPrice: filters.maxPrice ?? null,
      sort: filters.sort,
    },
  });
});

export const getServiceById = asyncHandler(async (req, res) => {
  return ok(res, serviceDto(await getService(req.validated.params.id)));
});

export const postService = asyncHandler(async (req, res) => {
  return created(
    res,
    serviceDto(await createNewService(req.user, req.validated.body)),
  );
});

export const putService = asyncHandler(async (req, res) => {
  return ok(
    res,
    serviceDto(
      await updateExistingService(
        req.user,
        req.validated.params.id,
        req.validated.body,
      ),
    ),
  );
});

export const removeService = asyncHandler(async (req, res) => {
  await deleteExistingService(req.user, req.validated.params.id);
  return noContent(res);
});
