import { PrismaClient } from "@prisma/client";
import { randomUUID, scryptSync } from "node:crypto";
import { seedProjects } from "../src/data/seed";

const prisma = new PrismaClient();
const DEMO_EMAIL = "demo@nexusops.ai";
const DEMO_PASSWORD = "NexusDemo@2026";

function hashPassword(password: string) {
  const salt = "nexusops-demo-salt";
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

async function main() {
  const count = await prisma.project.count();
  if (count === 0) {
    await prisma.project.createMany({
      data: seedProjects.map((project) => ({
        ...project,
        createdAt: new Date(project.createdAt)
      }))
    });
  }

  const activityCount = await prisma.activityLog.count();
  if (activityCount === 0) {
    await prisma.activityLog.createMany({
      data: [
        {
          id: randomUUID(),
          type: "weather",
          title: "Clima operacional sincronizado",
          description: "Open-Meteo conectado ao centro de decisoes para apoiar prazos e atividades externas.",
          createdAt: new Date(Date.now() - 1000 * 60 * 35)
        },
        {
          id: randomUUID(),
          type: "ai",
          title: "Copiloto pronto para briefing",
          description: "Resumo executivo gerado a partir de pipeline, prioridade e progresso dos projetos.",
          createdAt: new Date(Date.now() - 1000 * 60 * 70)
        }
      ]
    });
  }

  await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {
      name: "Nexus Demo",
      role: "admin",
      passwordHash: hashPassword(DEMO_PASSWORD)
    },
    create: {
      id: randomUUID(),
      name: "Nexus Demo",
      email: DEMO_EMAIL,
      role: "admin",
      passwordHash: hashPassword(DEMO_PASSWORD),
      createdAt: new Date()
    }
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
