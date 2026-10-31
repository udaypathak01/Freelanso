export const serviceCategories = [
  { slug: "design-creative", label: "Design & Creative" },
  { slug: "video-animation", label: "Video & Animation" },
  { slug: "writing-translation", label: "Writing & Translation" },
  { slug: "digital-marketing", label: "Digital Marketing" },
  { slug: "tech-development", label: "Tech & Development" },
  { slug: "ai-automation", label: "AI & Automation" },
  { slug: "business-legal", label: "Business & Legal" },
];

const legacyCategorySlugs = new Map([
  ["Design & Creative", "design-creative"],
  ["Video & Animation", "video-animation"],
  ["Writing & Translation", "writing-translation"],
  ["Digital Marketing", "digital-marketing"],
  ["Tech And Development", "tech-development"],
  ["Tech & Development", "tech-development"],
  ["IT", "tech-development"],
  ["AI & Automation", "ai-automation"],
  ["Business & Legal", "business-legal"],
]);

export const legacyServiceCategories = [...legacyCategorySlugs.keys()];

export function normalizeServiceCategory(value) {
  return serviceCategories.some((category) => category.slug === value)
    ? value
    : (legacyCategorySlugs.get(value) ?? null);
}

export function getServiceCategoryLabel(slug) {
  return serviceCategories.find((category) => category.slug === slug)?.label;
}
