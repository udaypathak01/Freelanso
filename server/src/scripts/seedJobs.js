import { FieldValue } from "firebase-admin/firestore";
import { env } from "../config/env.js";
import { firestore } from "../config/firebase.js";
import { logger } from "../config/logger.js";
import { buildJobSearchKeywords } from "../modules/jobs/jobs.service.js";

const seedData = [
  {
    id: "seed-job-1",
    postedBy: "seed-gigsupp",
    displayName: "Gigsupp",
    title:
      "I want a sales executive for lead generation and client closing (commission-based)",
    description:
      "I am looking for a motivated individual who can help with lead generation, client communication, and deal closing for digital services. The role involves finding potential clients, understanding their requirements, explaining services, and converting leads into successful projects. Services include website development, mobile app development, landing pages, SEO, and digital solutions. This is a commission-based role with flexible working hours and location.",
    category: "business-legal",
    skills: ["Business Plans", "Lead Generation"],
    budgetMin: 1000,
    budgetMax: 1000,
    jobType: "freelance",
    location: null,
  },
  {
    id: "seed-job-2",
    postedBy: "seed-gigsupp",
    displayName: "Gigsupp",
    title: "Sales & Client Acquisition Executive (Commission-Based)",
    description:
      "Sales and client acquisition opportunity for a commission-based role.",
    category: "business-legal",
    skills: ["Communication Skills", "Sales"],
    budgetMin: 5000,
    budgetMax: 30000,
    jobType: "part-time",
    location: "Pune, Maharashtra, India",
  },
  {
    id: "seed-job-3",
    postedBy: "seed-wnfact",
    displayName: "WNFact Technologies",
    title: "I want lead generation",
    description: "Seeking support for lead generation.",
    category: "business-legal",
    skills: ["Business Plans", "Lead Generation"],
    budgetMin: 1000,
    budgetMax: 1000,
    jobType: "freelance",
    location: null,
  },
  {
    id: "seed-job-4",
    postedBy: "seed-mapcom",
    displayName: "Mapcom Info Solution Pvt. Ltd.",
    title: ".NET Full Stack Developer",
    description: ".NET full stack developer opportunity.",
    category: "technology",
    skills: [".NET", "Full Stack Development"],
    budgetMin: 25000,
    budgetMax: 60000,
    jobType: "full-time",
    location: "Bangalore Rural, Karnataka, India",
  },
  {
    id: "seed-job-5",
    postedBy: "seed-nextgen",
    displayName: "NextGen Web & AI Labs",
    title: "I want Client Communication & Project Manager (Web/SaaS)",
    description:
      "Seeking a project manager for client communication on web and SaaS projects.",
    category: "business-legal",
    skills: ["Client Communication", "Project Management"],
    budgetMin: 12000,
    budgetMax: 12000,
    jobType: "freelance",
    location: null,
  },
  {
    id: "seed-job-6",
    postedBy: "seed-nextgen",
    displayName: "NextGen Web & AI Labs",
    title: "I want Client Acquisition Partner (Web, SaaS & AI Projects)",
    description:
      "Seeking a client acquisition partner for web, SaaS, and AI projects.",
    category: "business-legal",
    skills: ["Client Acquisition", "Sales"],
    budgetMin: 5000,
    budgetMax: 5000,
    jobType: "freelance",
    location: null,
  },
];

if (env.nodeEnv === "production") {
  console.error("Job seeding is disabled in production.");
  process.exitCode = 1;
} else if (env.nodeEnv !== "development" && !env.firestoreEmulatorHost) {
  console.error(
    "Job seeding is allowed only in development or with the Firestore emulator.",
  );
  process.exitCode = 1;
} else {
  try {
    const userProfiles = new Map(
      seedData.map(({ postedBy, displayName }) => [postedBy, displayName]),
    );
    let profilesCreated = 0;
    for (const [uid, displayName] of userProfiles) {
      const profileRef = firestore.collection("users").doc(uid);
      const created = await firestore.runTransaction(async (transaction) => {
        const existing = await transaction.get(profileRef);
        if (existing.exists) return false;
        transaction.create(profileRef, {
          displayName,
          email: null,
          photoURL: null,
          role: "client",
          stats: { projectsCount: 0, ratingAvg: 0, ratingCount: 0 },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return true;
      });
      if (created) profilesCreated += 1;
    }

    let jobsCreated = 0;
    for (const item of seedData) {
      const ref = firestore.collection("jobs").doc(item.id);
      const created = await firestore.runTransaction(async (transaction) => {
        const existing = await transaction.get(ref);
        if (existing.exists) return false;
        const job = {
          title: item.title,
          description: item.description,
          category: item.category,
          skills: item.skills,
          budgetMin: item.budgetMin,
          budgetMax: item.budgetMax,
          jobType: item.jobType,
          location: item.location,
        };
        transaction.create(ref, {
          ...job,
          postedBy: item.postedBy,
          status: "open",
          applicationsCount: 0,
          searchKeywords: buildJobSearchKeywords(job),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return true;
      });
      if (created) jobsCreated += 1;
    }

    logger.info({ profilesCreated, jobsCreated }, "Development jobs seeded");
  } catch (error) {
    logger.error({ error }, "Development job seeding failed");
    process.exitCode = 1;
  }
}
