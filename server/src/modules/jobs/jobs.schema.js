import { z } from "zod";

const jobTypes = [
  "freelance",
  "part-time",
  "full-time",
  "contract",
  "internship",
];
const statuses = ["open", "closed", "filled"];
const idSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

const fields = {
  title: z.string().trim().min(4).max(120),
  description: z.string().trim().min(10).max(4000),
  category: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  skills: z.array(z.string().trim().min(1).max(40)).max(30),
  budgetMin: z.number().finite().min(0).max(100_000_000),
  budgetMax: z.number().finite().min(0).max(100_000_000),
  budgetType: z.enum(["fixed", "hourly"]).optional(),
  jobType: z.enum(jobTypes),
  deadlineDays: z.number().int().min(1).max(365).optional(),
  deadlineDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  experienceLevel: z.enum(["entry", "intermediate", "expert"]).optional(),
  projectDuration: z.string().trim().min(1).max(80).optional(),
  workMode: z.enum(["remote", "hybrid", "onsite"]).optional(),
  additionalDetails: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(120).nullable().optional(),
};

function validBudgetRange(job, context) {
  if (job.budgetMin > job.budgetMax) {
    context.addIssue({
      code: "custom",
      path: ["budgetMax"],
      message: "budgetMax must be greater than or equal to budgetMin",
    });
  }
}

export const jobCreateSchema = z
  .object({
    ...fields,
    budgetType: z.enum(["fixed", "hourly"]).default("fixed"),
    projectDuration: z.string().trim().min(1).max(80),
    workMode: z.enum(["remote", "hybrid", "onsite"]).default("remote"),
  })
  .strict()
  .superRefine((job, context) => {
    validBudgetRange(job, context);
    const deadlineTimestamp = job.deadlineDate
      ? Date.parse(`${job.deadlineDate}T00:00:00.000Z`)
      : null;
    if (
      job.deadlineDate &&
      (!Number.isFinite(deadlineTimestamp) ||
        new Date(deadlineTimestamp).toISOString().slice(0, 10) !==
          job.deadlineDate)
    ) {
      context.addIssue({
        code: "custom",
        path: ["deadlineDate"],
        message: "deadlineDate must be a valid calendar date",
      });
    }
  });

export const jobUpdateSchema = z
  .object({
    ...Object.fromEntries(
      Object.entries(fields).map(([field, schema]) => [
        field,
        schema.optional(),
      ]),
    ),
    deadlineDays: fields.deadlineDays.nullable().optional(),
    deadlineDate: fields.deadlineDate.nullable().optional(),
    experienceLevel: fields.experienceLevel.nullable().optional(),
    projectDuration: fields.projectDuration.nullable().optional(),
    additionalDetails: fields.additionalDetails.nullable().optional(),
    status: z.enum(statuses).optional(),
  })
  .strict()
  .refine((job) => Object.keys(job).length > 0, {
    message: "At least one job field must be provided",
  })
  .superRefine((job, context) => {
    const deadlineTimestamp =
      typeof job.deadlineDate === "string"
        ? Date.parse(`${job.deadlineDate}T00:00:00.000Z`)
        : null;
    if (
      typeof job.deadlineDate === "string" &&
      (!Number.isFinite(deadlineTimestamp) ||
        new Date(deadlineTimestamp).toISOString().slice(0, 10) !==
          job.deadlineDate)
    ) {
      context.addIssue({
        code: "custom",
        path: ["deadlineDate"],
        message: "deadlineDate must be a valid calendar date",
      });
    }
    if (
      job.budgetMin !== undefined &&
      job.budgetMax !== undefined &&
      job.budgetMin > job.budgetMax
    ) {
      context.addIssue({
        code: "custom",
        path: ["budgetMax"],
        message: "budgetMax must be greater than or equal to budgetMin",
      });
    }
  });

const pageFields = {
  limit: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .refine((value) => value <= 50, "limit must be from 1 to 50")
    .optional(),
  cursor: z.string().min(1).max(2048).optional(),
};

export const jobListQuerySchema = z
  .object({
    ...pageFields,
    q: z.string().trim().max(80).optional(),
    category: fields.category.optional(),
    skills: z
      .string()
      .transform((value) =>
        value
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
      )
      .pipe(
        z
          .array(z.string().min(1).max(40))
          .min(1)
          .max(10)
          .refine(
            (skills) =>
              new Set(skills.map((skill) => skill.toLowerCase())).size ===
              skills.length,
            "skills must be unique",
          ),
      )
      .optional(),
    minPrice: z
      .string()
      .regex(/^\d+(?:\.\d{1,2})?$/)
      .transform(Number)
      .pipe(z.number().finite().min(0).max(100_000_000))
      .optional(),
    maxPrice: z
      .string()
      .regex(/^\d+(?:\.\d{1,2})?$/)
      .transform(Number)
      .pipe(z.number().finite().min(0).max(100_000_000))
      .optional(),
    jobType: z.enum(jobTypes).optional(),
    location: z.string().trim().min(1).max(120).optional(),
    sort: z
      .enum(["newest", "oldest", "price_asc", "price_desc", "popular"])
      .default("newest"),
  })
  .strict()
  .refine(
    ({ minPrice, maxPrice }) =>
      minPrice === undefined || maxPrice === undefined || minPrice <= maxPrice,
    {
      path: ["maxPrice"],
      message: "maxPrice must be greater than or equal to minPrice",
    },
  );

export const jobIdParamsSchema = z.object({ id: idSchema }).strict();
export const applicationIdParamsSchema = z.object({ id: idSchema }).strict();
export const emptyObjectSchema = z.object({}).strict();
