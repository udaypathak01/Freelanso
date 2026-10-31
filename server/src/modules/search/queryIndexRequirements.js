const sortFields = {
  newest: [
    { fieldPath: "createdAt", order: "DESCENDING" },
    { fieldPath: "__name__", order: "DESCENDING" },
  ],
  oldest: [
    { fieldPath: "createdAt", order: "ASCENDING" },
    { fieldPath: "__name__", order: "ASCENDING" },
  ],
  price_asc: [
    { fieldPath: "price", order: "ASCENDING" },
    { fieldPath: "createdAt", order: "DESCENDING" },
    { fieldPath: "__name__", order: "DESCENDING" },
  ],
  price_desc: [
    { fieldPath: "price", order: "DESCENDING" },
    { fieldPath: "createdAt", order: "DESCENDING" },
    { fieldPath: "__name__", order: "DESCENDING" },
  ],
};

export function marketplaceIndexRequirements(
  collectionGroup,
  popularityFields,
) {
  const popularity = [
    ...popularityFields.map((fieldPath) => ({
      fieldPath,
      order: "DESCENDING",
    })),
    { fieldPath: "createdAt", order: "DESCENDING" },
    { fieldPath: "__name__", order: "DESCENDING" },
  ];
  const requirements = [];
  for (const hasCategory of [false, true]) {
    for (const arrayField of [null, "searchKeywords", "skills"]) {
      for (const [sort, orderFields] of Object.entries({
        ...sortFields,
        popular: popularity,
      })) {
        const fields = [
          { fieldPath: "status", order: "ASCENDING" },
          ...(hasCategory
            ? [{ fieldPath: "category", order: "ASCENDING" }]
            : []),
          ...(arrayField
            ? [{ fieldPath: arrayField, arrayConfig: "CONTAINS" }]
            : []),
          ...orderFields,
        ];
        requirements.push({
          collectionGroup,
          queryScope: "COLLECTION",
          fields,
          sort,
          hasCategory,
          arrayField,
        });
      }
    }
  }
  return requirements;
}

export const marketplaceIndexPlans = [
  ...marketplaceIndexRequirements("projects", ["likesCount", "viewsCount"]),
  ...marketplaceIndexRequirements("services", ["ratingAvg", "ratingCount"]),
  ...["projects", "services"].flatMap((collectionGroup) =>
    ["createdAt", "status"].map((sortField) => ({
      collectionGroup,
      queryScope: "COLLECTION",
      fields:
        sortField === "createdAt"
          ? [
              { fieldPath: "ownerId", order: "ASCENDING" },
              { fieldPath: "createdAt", order: "DESCENDING" },
              { fieldPath: "__name__", order: "DESCENDING" },
            ]
          : [
              { fieldPath: "ownerId", order: "ASCENDING" },
              { fieldPath: "status", order: "ASCENDING" },
            ],
    })),
  ),
];

const jobSortFields = {
  newest: [{ fieldPath: "createdAt", order: "DESCENDING" }],
  oldest: [{ fieldPath: "createdAt", order: "ASCENDING" }],
  price_asc: [
    { fieldPath: "budgetMin", order: "ASCENDING" },
    { fieldPath: "createdAt", order: "DESCENDING" },
  ],
  price_desc: [
    { fieldPath: "budgetMin", order: "DESCENDING" },
    { fieldPath: "createdAt", order: "DESCENDING" },
  ],
  popular: [
    { fieldPath: "applicationsCount", order: "DESCENDING" },
    { fieldPath: "createdAt", order: "DESCENDING" },
  ],
};

export const jobIndexPlans = [false, true].flatMap((hasCategory) =>
  [false, true].flatMap((hasSearchKeywords) =>
    Object.entries(jobSortFields).map(([sort, sortFieldsForQuery]) => ({
      collectionGroup: "jobs",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "status", order: "ASCENDING" },
        ...(hasCategory ? [{ fieldPath: "category", order: "ASCENDING" }] : []),
        ...(hasSearchKeywords
          ? [{ fieldPath: "searchKeywords", arrayConfig: "CONTAINS" }]
          : []),
        ...sortFieldsForQuery,
      ],
      sort,
      hasCategory,
      hasSearchKeywords,
    })),
  ),
);

export const dashboardJobIndexPlans = [
  {
    collectionGroup: "jobs",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "postedBy", order: "ASCENDING" },
      { fieldPath: "status", order: "ASCENDING" },
      { fieldPath: "createdAt", order: "DESCENDING" },
      { fieldPath: "__name__", order: "DESCENDING" },
    ],
  },
];

export const applicationIndexPlans = [
  {
    collectionGroup: "applications",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "applicantId", order: "ASCENDING" },
      { fieldPath: "createdAt", order: "DESCENDING" },
    ],
  },
  {
    collectionGroup: "applications",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "jobId", order: "ASCENDING" },
      { fieldPath: "createdAt", order: "DESCENDING" },
    ],
  },
];

export const dashboardIndexPlans = [
  {
    collectionGroup: "projects",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "ownerId", order: "ASCENDING" },
      { fieldPath: "commentsCount", order: "ASCENDING" },
      { fieldPath: "likesCount", order: "ASCENDING" },
      { fieldPath: "viewsCount", order: "ASCENDING" },
    ],
  },
];

export const battleIndexPlans = [
  {
    collectionGroup: "battles",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "status", order: "ASCENDING" },
      { fieldPath: "createdAt", order: "DESCENDING" },
    ],
  },
  {
    collectionGroup: "battles",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "category", order: "ASCENDING" },
      { fieldPath: "createdAt", order: "DESCENDING" },
    ],
  },
  {
    collectionGroup: "battles",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "status", order: "ASCENDING" },
      { fieldPath: "category", order: "ASCENDING" },
      { fieldPath: "createdAt", order: "DESCENDING" },
    ],
  },
  {
    collectionGroup: "battles",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "status", order: "ASCENDING" },
      { fieldPath: "endsAt", order: "ASCENDING" },
    ],
  },
];

export function indexKey(index) {
  return JSON.stringify({
    collectionGroup: index.collectionGroup,
    queryScope: index.queryScope,
    fields: index.fields.filter(({ fieldPath }) => fieldPath !== "__name__"),
  });
}
