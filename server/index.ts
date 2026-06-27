import express from "express";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { seedProjects } from "../src/data/seed";
import { projectSchema } from "../src/lib/projects";
import type { ActivityLog, Project } from "../src/types";
import { authenticate, clearSession, createSession, getSessionUser, hashPassword } from "./auth";
import { prisma } from "./prisma";

const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDist = join(__dirname, "..", "dist");
const port = Number(process.env.PORT ?? 3333);

app.use(express.json({ limit: "1mb" }));

function serializeProject(project: {
  id: string;
  client: string;
  owner: string;
  email: string;
  title: string;
  budget: number;
  progress: number;
  status: string;
  priority: string;
  dueDate: string;
  notes: string;
  createdAt: Date;
}): Project {
  return {
    id: project.id,
    client: project.client,
    owner: project.owner,
    email: project.email,
    title: project.title,
    budget: project.budget,
    progress: project.progress,
    status: project.status as Project["status"],
    priority: project.priority as Project["priority"],
    dueDate: project.dueDate,
    notes: project.notes,
    createdAt: project.createdAt.toISOString()
  };
}

function serializeActivity(activity: {
  id: string;
  type: string;
  title: string;
  description: string;
  createdAt: Date;
}): ActivityLog {
  return {
    id: activity.id,
    type: activity.type as ActivityLog["type"],
    title: activity.title,
    description: activity.description,
    createdAt: activity.createdAt.toISOString()
  };
}

async function ensureSeeded() {
  const count = await prisma.project.count();
  if (count === 0) {
    await prisma.project.createMany({
      data: seedProjects.map((project) => ({
        ...project,
        createdAt: new Date(project.createdAt)
      }))
    });
  }

  await prisma.user.upsert({
    where: { email: "demo@nexusops.ai" },
    update: {},
    create: {
      id: randomUUID(),
      name: "Nexus Demo",
      email: "demo@nexusops.ai",
      role: "admin",
      passwordHash: hashPassword("NexusDemo@2026"),
      createdAt: new Date()
    }
  });
}

async function recordActivity(type: ActivityLog["type"], title: string, description: string) {
  return prisma.activityLog.create({
    data: {
      id: randomUUID(),
      type,
      title,
      description,
      createdAt: new Date()
    }
  });
}

function demoAiAnswer() {
  return "Analisando o estado atual, eu priorizaria projetos de alta prioridade com progresso abaixo de 50%, revisaria prazos próximos e acompanharia os alertas climáticos antes de confirmar atividades externas. Para a próxima ação, foque nos itens com maior impacto financeiro e maior risco de atraso.";
}

app.post("/api/auth/login", async (req, res, next) => {
  try {
    await ensureSeeded();
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ error: "E-mail e senha são obrigatórios." });

    const user = await authenticate(email, password);
    if (!user) return res.status(401).json({ error: "Credenciais inválidas." });

    createSession(res, user.id);
    await recordActivity("updated", "Sessão iniciada", `${user.name} acessou o command center.`);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", async (req, res, next) => {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "Sessão expirada." });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", async (req, res, next) => {
  try {
    const user = await getSessionUser(req);
    clearSession(req, res);
    if (user) await recordActivity("updated", "Sessão encerrada", `${user.name} saiu do command center.`);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects", async (_req, res, next) => {
  try {
    await ensureSeeded();
    const projects = await prisma.project.findMany({ orderBy: { createdAt: "desc" } });
    res.json(projects.map(serializeProject));
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects", async (req, res, next) => {
  try {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const project = await prisma.project.create({
      data: {
        ...parsed.data,
        id: randomUUID(),
        createdAt: new Date()
      }
    });
    await recordActivity("created", "Projeto criado", `${project.client} entrou no pipeline.`);
    res.status(201).json(serializeProject(project));
  } catch (error) {
    next(error);
  }
});

app.put("/api/projects/:id", async (req, res, next) => {
  try {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const current = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: "Projeto não encontrado." });

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: parsed.data
    });
    await recordActivity("updated", "Projeto atualizado", `${project.client} teve dados operacionais revisados.`);
    res.json(serializeProject(project));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/projects/:id", async (req, res, next) => {
  try {
    const current = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: "Projeto não encontrado." });

    await prisma.project.delete({ where: { id: req.params.id } });
    await recordActivity("deleted", "Projeto removido", `${current.client} saiu da carteira ativa.`);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/api/activity", async (_req, res, next) => {
  try {
    const activity = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50
    });
    res.json(activity.map(serializeActivity));
  } catch (error) {
    next(error);
  }
});

app.post("/api/ai-chat", async (req, res, next) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const { prompt, projects, weather } = req.body as {
      prompt?: string;
      projects?: unknown[];
      weather?: unknown;
    };

    if (!prompt) {
      return res.status(400).json({ error: "Prompt obrigatório." });
    }

    if (!apiKey) {
      await recordActivity("ai", "Copiloto consultado", "Resposta demonstrativa gerada com base no estado operacional.");
      return res.json({ answer: demoAiAnswer() });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "Você e um copiloto de operações. Responda em português do Brasil com recomendacoes objetivas, usando os projetos e o clima recebidos como contexto."
          },
          {
            role: "user",
            content: JSON.stringify({ prompt, projects, weather })
          }
        ]
      })
    });

    if (!response.ok) {
      console.warn(`OpenAI provider returned ${response.status}. Falling back to demo answer.`);
      await recordActivity("ai", "Copiloto consultado", "Provedor de IA indisponível; resposta demonstrativa enviada.");
      return res.json({ answer: demoAiAnswer() });
    }

    const data = (await response.json()) as { output_text?: string };
    await recordActivity("ai", "Copiloto consultado", "Resposta gerada pelo provedor de IA configurado no backend.");
    return res.json({ answer: data.output_text ?? "Não consegui gerar uma resposta agora." });
  } catch (error) {
    next(error);
  }
});

app.get("/api/health", async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: "nexusops-ai" });
  } catch (error) {
    next(error);
  }
});

if (process.env.NODE_ENV === "production" && existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/.*/, (_req, res) => {
    res.sendFile(join(clientDist, "index.html"));
  });
}

app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  void next;
  console.error(error);
  res.status(500).json({ error: "Erro interno no servidor." });
});

app.listen(port, () => {
  console.log(`NexusOps AI running at http://localhost:${port}`);
});
