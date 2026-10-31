import { DEFAULT_PAGE_SIZE } from "../../utils/pagination.js";
import { findProjectOwners } from "../projects/projects.repository.js";
import { toProjectDto } from "../projects/projects.mapper.js";
import { findServiceOwners } from "../services/services.repository.js";
import { toServiceDto } from "../services/services.mapper.js";
import { getServiceCategoryLabel } from "../services/serviceCategories.js";
import { getDashboardRepositoryData } from "./dashboard.repository.js";

export async function getDashboard(uid, query = {}) {
  const limit = query.limit ?? DEFAULT_PAGE_SIZE;
  const data = await getDashboardRepositoryData(uid, {
    limit,
    projectCursor: query.projectCursor,
    serviceCursor: query.serviceCursor,
  });
  const [projectOwners, serviceOwners] = await Promise.all([
    findProjectOwners(data.projects.items),
    findServiceOwners(data.services.items),
  ]);
  const ratingCount = Number.isInteger(data.stats.ratingCount)
    ? Math.max(0, data.stats.ratingCount)
    : 0;
  const ratingAvg = Number.isFinite(data.stats.ratingAvg)
    ? data.stats.ratingAvg
    : null;

  return {
    projects: data.projects.items.map((project) =>
      toProjectDto(project.id, project, projectOwners.get(project.ownerId)),
    ),
    services: data.services.items.map((service) =>
      toServiceDto(
        service.id,
        {
          ...service,
          categoryLabel: getServiceCategoryLabel(service.category),
        },
        serviceOwners.get(service.ownerId),
      ),
    ),
    pagination: {
      limit,
      projectsNextCursor: data.projects.nextCursor,
      servicesNextCursor: data.services.nextCursor,
    },
    counts: {
      projects: data.projectCounts,
      services: data.serviceCounts,
      listings: data.projectCounts.total + data.serviceCounts.total,
    },
    engagement: data.engagement,
    applications: data.applications,
    earnings: { total: 0, currency: null },
    satisfaction: {
      ratingAvg: ratingCount > 0 ? ratingAvg : null,
      ratingCount,
    },
  };
}
