import type { Project, WeatherInsight } from "../types";

export function buildLocalInsight(projects: Project[], weather?: WeatherInsight | null) {
  const active = projects.filter((project) => project.status === "active");
  const highPriority = projects.filter((project) => project.priority === "high" && project.status !== "done");
  const overdue = projects.filter((project) => new Date(project.dueDate) < new Date() && project.status !== "done");
  const totalPipeline = projects.reduce((sum, project) => sum + project.budget, 0);
  const weatherLine = weather ? ` Clima: ${weather.recommendation}` : "";

  return [
    `Resumo executivo: ${projects.length} projetos no pipeline, ${active.length} ativos e ${highPriority.length} de alta prioridade.`,
    `Valor em carteira: ${totalPipeline.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
    overdue.length ? `Atenção: ${overdue.length} projeto(s) já passaram do prazo.` : "Nenhum projeto atrasado no momento.",
    weatherLine
  ].join(" ");
}

export async function askCopilot(prompt: string, projects: Project[], weather?: WeatherInsight | null) {
  const context = {
    prompt,
    projects: projects.map(({ client, title, status, priority, progress, budget, dueDate }) => ({
      client,
      title,
      status,
      priority,
      progress,
      budget,
      dueDate
    })),
    weather
  };

  try {
    const response = await fetch("/api/ai-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(context)
    });
    if (response.ok) {
      const data = (await response.json()) as { answer: string };
      return data.answer;
    }
  } catch {
    // Local fallback keeps the product demo useful without backend or API keys.
  }

  return `${buildLocalInsight(projects, weather)} Sugestão: ataque primeiro itens de alta prioridade com progresso abaixo de 50% e atualize responsável, prazo e status no fluxo de projetos.`;
}
