import { z } from "zod";

const optionalText = (max) => z.string().trim().max(max).optional();
const secureUrl = z
  .string()
  .url()
  .max(2048)
  .refine((value) => new URL(value).protocol === "https:");

const languageSchema = z
  .object({
    lang: z.string().trim().min(1).max(40),
    proficiency: z.string().trim().min(1).max(40),
  })
  .strict();

const experienceSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    company: z.string().trim().min(1).max(120),
    city: optionalText(80),
    country: optionalText(80),
    startMonth: optionalText(20),
    startYear: z
      .union([z.string().max(4), z.number().int().min(1900).max(2100)])
      .optional(),
    isCurrent: z.boolean().optional(),
    endMonth: optionalText(20),
    endYear: z
      .union([z.string().max(4), z.number().int().min(1900).max(2100)])
      .optional(),
    description: optionalText(1500),
  })
  .strict();

const educationSchema = z
  .object({
    school: z.string().trim().min(1).max(120),
    degree: optionalText(120),
    field: optionalText(120),
    startYear: z
      .union([z.string().max(4), z.number().int().min(1900).max(2100)])
      .optional(),
    endYear: z
      .union([z.string().max(4), z.number().int().min(1900).max(2100)])
      .optional(),
    description: optionalText(1000),
  })
  .strict();

const certificationSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    issuer: optionalText(120),
    year: z
      .union([z.string().max(4), z.number().int().min(1900).max(2100)])
      .optional(),
  })
  .strict();

const locationSchema = z
  .object({
    country: optionalText(80),
    state: optionalText(80),
    city: optionalText(80),
  })
  .strict();

const privateAddressSchema = z
  .object({
    line1: optionalText(160),
    line2: optionalText(160),
    postalCode: optionalText(24),
  })
  .strict();

const socialLinksSchema = z
  .object({
    website: secureUrl.optional(),
    linkedin: secureUrl.optional(),
    github: secureUrl.optional(),
    twitter: secureUrl.optional(),
    dribbble: secureUrl.optional(),
    behance: secureUrl.optional(),
  })
  .strict();

export const uidParamsSchema = z
  .object({
    uid: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict();

export const emptyBodySchema = z.object({}).strict();
export const emptyObjectSchema = z.object({}).strict();

export const onboardingSchema = z
  .object({
    role: z.enum(["freelancer", "client"]),
  })
  .strict();

export const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    headline: optionalText(120),
    bio: optionalText(2000),
    handle: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^@?[A-Za-z0-9_.-]+$/)
      .optional(),
    photoURL: secureUrl.optional(),
    bannerURL: secureUrl.optional(),
    phone: z.string().trim().max(30).optional(),
    location: locationSchema.optional(),
    privateAddress: privateAddressSchema.optional(),
    skills: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
    hourlyRate: z.number().min(0).max(1_000_000).nullable().optional(),
    languages: z.array(languageSchema).max(20).optional(),
    socialLinks: socialLinksSchema.optional(),
    experience: z.array(experienceSchema).max(20).optional(),
    education: z.array(educationSchema).max(20).optional(),
    certifications: z.array(certificationSchema).max(30).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one profile field must be provided",
  });
