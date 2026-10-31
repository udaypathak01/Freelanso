import { FieldValue } from "firebase-admin/firestore";
import { env } from "../config/env.js";
import { firestore } from "../config/firebase.js";
import { logger } from "../config/logger.js";
import { normalizeServiceCategory } from "../modules/services/serviceCategories.js";

const seedData = [
  {
    id: "static-1",
    title: "Desktop/Laptop/HDD/SDD/Pendrive Data Recovery",
    ownerId: "seed-vansh-thakkar",
    ownerName: "Vansh Thakkar",
    category: "IT",
    price: 500,
  },
  {
    id: "static-2",
    title: "Custom Mobile App Development (Android & iOS)",
    ownerId: "seed-prathamesh-vaishnav",
    ownerName: "Prathamesh Vaishnav",
    category: "Tech And Development",
    price: 30_000,
  },
  {
    id: "static-3",
    title: "Professional Website Development for Businesses",
    ownerId: "seed-prathamesh-vaishnav",
    ownerName: "Prathamesh Vaishnav",
    category: "Tech And Development",
    price: 10_000,
  },
  {
    id: "static-4",
    title: "Professional Video Editing for Reels and Shorts",
    ownerId: "seed-aryan-khan",
    ownerName: "Aryan Khan",
    category: "Video & Animation",
    price: 2_500,
  },
  {
    id: "static-5",
    title: "Logo Design and Brand Identity Package",
    ownerId: "seed-saarthi-ai",
    ownerName: "Saarthi AI",
    category: "Design & Creative",
    price: 5_000,
  },
  {
    id: "static-6",
    title: "Content Creation and Social Media Management",
    ownerId: "seed-classichub",
    ownerName: "ClassicHub",
    category: "Digital Marketing",
    price: 15_000,
  },
];

if (env.nodeEnv === "production") {
  console.error("Service seeding is disabled in production.");
  process.exitCode = 1;
} else if (env.nodeEnv !== "development" && !env.firestoreEmulatorHost) {
  console.error(
    "Service seeding is allowed only in development or with the Firestore emulator.",
  );
  process.exitCode = 1;
} else {
  try {
    const users = firestore.collection("users");
    const services = firestore.collection("services");
    let profilesCreated = 0;
    let servicesCreated = 0;

    for (const item of seedData) {
      const userRef = users.doc(item.ownerId);
      const userResult = await firestore.runTransaction(async (transaction) => {
        const existing = await transaction.get(userRef);
        if (existing.exists) return false;
        transaction.create(userRef, {
          displayName: item.ownerName,
          email: null,
          photoURL: null,
          role: "freelancer",
          stats: { projectsCount: 0, ratingAvg: 0, ratingCount: 0 },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return true;
      });
      if (userResult) profilesCreated += 1;

      const serviceRef = services.doc(`seed-${item.id}`);
      const category = normalizeServiceCategory(item.category);
      if (!category) {
        throw new Error(`No canonical category mapping for ${item.category}`);
      }
      const serviceResult = await firestore.runTransaction(
        async (transaction) => {
          const existing = await transaction.get(serviceRef);
          if (existing.exists) return false;
          transaction.create(serviceRef, {
            ownerId: item.ownerId,
            title: item.title,
            description: item.title,
            category,
            price: item.price,
            deliveryDays: 5,
            revisions: 1,
            images: [],
            skills: [],
            status: "published",
            ratingAvg: 0,
            ratingCount: 0,
            searchKeywords: [
              ...new Set(
                `${item.title} ${category}`
                  .toLowerCase()
                  .match(/[\p{L}\p{N}]+/gu) ?? [],
              ),
            ],
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          return true;
        },
      );
      if (serviceResult) servicesCreated += 1;
    }

    logger.info(
      { profilesCreated, servicesCreated },
      "Development services seeded",
    );
  } catch (error) {
    logger.error({ error }, "Development service seeding failed");
    process.exitCode = 1;
  }
}
