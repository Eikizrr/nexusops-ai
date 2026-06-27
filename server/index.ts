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

type AiProjectContext = {
  client: string;
  title: string;
  status: string;
  priority: string;
  progress: number;
  budget: number;
  dueDate: string;
};

type AiWeatherContext = {
  rainRisk?: number;
  recommendation?: string;
};

function normalizeProjects(projects: unknown[] | undefined): AiProjectContext[] {
  if (!Array.isArray(projects)) return [];

  return projects
    .map((item) => item as Partial<AiProjectContext>)
    .filter((item) => item.client && item.title)
    .map((item) => ({
      client: String(item.client),
      title: String(item.title),
      status: String(item.status ?? "lead"),
      priority: String(item.priority ?? "medium"),
      progress: Number(item.progress ?? 0),
      budget: Number(item.budget ?? 0),
      dueDate: String(item.dueDate ?? new Date().toISOString())
    }));
}

function daysToDue(project: AiProjectContext) {
  return Math.ceil((new Date(project.dueDate).getTime() - Date.now()) / 86_400_000);
}

function demoRisk(project: AiProjectContext, weather?: AiWeatherContext) {
  const days = daysToDue(project);
  let score = 0;
  if (project.priority === "high") score += 30;
  if (project.progress < 45) score += 25;
  if (days <= 7) score += 25;
  if (days < 0) score += 30;
  if ((weather?.rainRisk ?? 0) >= 70 && project.status === "active") score += 20;
  return Math.min(score, 100);
}

function demoAiAnswer(prompt: string, rawProjects?: unknown[], weather?: AiWeatherContext) {
  const projects = normalizeProjects(rawProjects);
  const normalizedPrompt = prompt.toLowerCase();
  const ranked = projects
    .filter((project) => project.status !== "done")
    .map((project) => ({ project, risk: demoRisk(project, weather), days: daysToDue(project) }))
    .sort((a, b) => b.risk - a.risk || a.days - b.days);
  const top = ranked[0];
  const second = ranked[1];
  const totalPipeline = projects.reduce((sum, project) => sum + project.budget, 0);
  const active = projects.filter((project) => project.status === "active").length;
  const weatherLine =
    weather?.rainRisk && weather.rainRisk >= 65
      ? `Como o risco de chuva está em ${weather.rainRisk}%, mantenha plano B para atividades externas.`
      : weather?.recommendation
        ? `Clima operacional: ${weather.recommendation}`
        : "Sem sinal climático sincronizado nesta resposta.";

  if (!projects.length) {
    return "Ainda não há projetos no contexto recebido. Cadastre cliente, prazo, orçamento e prioridade para o copiloto gerar recomendações com base no estado real.";
  }

  if (normalizedPrompt.includes("risco") || normalizedPrompt.includes("priorizar")) {
    return [
      top
        ? `Eu priorizaria ${top.project.client}: ${top.project.title} está com ${top.risk}% de risco, ${top.project.progress}% de progresso e prazo em ${top.days} dia(s).`
        : "Não encontrei risco crítico na carteira atual.",
      second ? `Segundo foco: ${second.project.client}, por combinação de prioridade, prazo ou progresso.` : "Depois disso, revise manutenção dos projetos ativos.",
      weatherLine
    ].join(" ");
  }

  if (normalizedPrompt.includes("24") || normalizedPrompt.includes("plano")) {
    return [
      "Plano para as próximas 24 horas:",
      top ? `1. destravar ${top.project.client} com uma entrega verificável hoje.` : "1. confirmar prioridades da carteira.",
      "2. atualizar responsáveis, progresso e histórico após cada decisão.",
      `3. revisar impacto financeiro antes de alterar prazos. ${weatherLine}`
    ].join(" ");
  }

  return [
    `Leitura executiva: ${projects.length} projetos monitorados, ${active} ativos e ${totalPipeline.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} em pipeline.`,
    top ? `Maior atenção agora: ${top.project.client}, com ${top.risk}% de risco operacional.` : "Carteira sem alerta crítico no momento.",
    `Recomendação: decida por impacto financeiro, prazo e dependências externas. ${weatherLine}`
  ].join(" ");
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
      return res.json({ answer: demoAiAnswer(prompt, projects, weather as AiWeatherContext | undefined) });
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
              "Você é um copiloto de operações. Responda em português do Brasil com recomendações objetivas, usando os projetos e o clima recebidos como contexto."
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
      return res.json({ answer: demoAiAnswer(prompt, projects, weather as AiWeatherContext | undefined) });
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
