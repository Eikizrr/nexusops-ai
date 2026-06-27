import type { Project, WeatherInsight } from "../types";

function daysToDue(project: Project) {
  return Math.ceil((new Date(project.dueDate).getTime() - Date.now()) / 86_400_000);
}

function riskScore(project: Project, weather?: WeatherInsight | null) {
  const days = daysToDue(project);
  let score = 0;
  if (project.priority === "high") score += 30;
  if (project.progress < 45) score += 25;
  if (days <= 7) score += 25;
  if (days < 0) score += 30;
  if (weather && weather.rainRisk >= 70 && project.status === "active") score += 20;
  return Math.min(score, 100);
}

function topRiskProjects(projects: Project[], weather?: WeatherInsight | null) {
  return projects
    .filter((project) => project.status !== "done")
    .map((project) => ({ project, risk: riskScore(project, weather), days: daysToDue(project) }))
    .sort((a, b) => b.risk - a.risk || a.days - b.days);
}

export function buildLocalInsight(projects: Project[], weather?: WeatherInsight | null) {
  const active = projects.filter((project) => project.status === "active");
  const highPriority = projects.filter((project) => project.priority === "high" && project.status !== "done");
  const overdue = projects.filter((project) => new Date(project.dueDate) < new Date() && project.status !== "done");
  const totalPipeline = projects.reduce((sum, project) => sum + project.budget, 0);
  const mainRisk = topRiskProjects(projects, weather)[0];
  const weatherLine = weather ? ` Clima: ${weather.recommendation}` : "";

  return [
    `Resumo executivo: ${projects.length} projetos no pipeline, ${active.length} ativos e ${highPriority.length} de alta prioridade.`,
    `Valor em carteira: ${totalPipeline.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
    overdue.length ? `Atenção: ${overdue.length} projeto(s) já passaram do prazo.` : "Nenhum projeto atrasado no momento.",
    mainRisk
      ? `Maior risco agora: ${mainRisk.project.client}, com ${mainRisk.risk}% de risco operacional.`
      : "Nenhum risco crítico detectado.",
    weatherLine
  ].join(" ");
}

export function buildDemoCopilotAnswer(prompt: string, projects: Project[], weather?: WeatherInsight | null) {
  const normalizedPrompt = prompt.toLowerCase();
  const ranked = topRiskProjects(projects, weather);
  const top = ranked[0];
  const second = ranked[1];
  const totalPipeline = projects.reduce((sum, project) => sum + project.budget, 0);
  const active = projects.filter((project) => project.status === "active");
  const blockedByProgress = ranked.filter(({ project }) => project.progress < 50).slice(0, 2);
  const weatherAlert =
    weather && weather.rainRisk >= 65
      ? `Como o risco de chuva está em ${weather.rainRisk}%, eu evitaria prometer atividades externas sem plano B.`
      : weather
        ? `O clima está administrável para a operação: ${weather.recommendation}`
        : "Sem clima sincronizado agora, eu decidiria usando prazo, prioridade e progresso.";

  if (!projects.length) {
    return "Ainda não há projetos cadastrados. O melhor próximo passo é criar uma carteira inicial com cliente, prazo, orçamento e prioridade para o painel gerar risco, receita e recomendações.";
  }

  if (normalizedPrompt.includes("risco") || normalizedPrompt.includes("priorizar")) {
    return [
      top
        ? `Eu priorizaria ${top.project.client}: ${top.project.title} está com ${top.risk}% de risco, ${top.project.progress}% de progresso e prazo em ${top.days} dia(s).`
        : "Não encontrei risco crítico na carteira atual.",
      second
        ? `Segundo foco: ${second.project.client}, porque ainda combina prioridade, prazo ou progresso sensível.`
        : "Depois disso, revise apenas manutenção dos projetos ativos.",
      weatherAlert
    ].join(" ");
  }

  if (normalizedPrompt.includes("24") || normalizedPrompt.includes("plano")) {
    return [
      "Plano para as próximas 24 horas:",
      top ? `1. destravar ${top.project.client} e definir uma entrega verificável hoje.` : "1. revisar a carteira e confirmar prioridades.",
      blockedByProgress[0]
        ? `2. cobrar atualização de progresso em ${blockedByProgress.map(({ project }) => project.client).join(" e ")}.`
        : "2. validar se os projetos ativos continuam com escopo e prazo alinhados.",
      `3. atualizar o histórico após cada decisão para manter o painel confiável. ${weatherAlert}`
    ].join(" ");
  }

  return [
    `Leitura executiva: ${projects.length} projetos monitorados, ${active.length} ativos e ${totalPipeline.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} em pipeline.`,
    top ? `O ponto de atenção é ${top.project.client}, com ${top.risk}% de risco operacional.` : "A carteira está sem alerta crítico agora.",
    `Minha recomendação é decidir primeiro por impacto financeiro, depois prazo, depois dependências externas. ${weatherAlert}`
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

  return buildDemoCopilotAnswer(prompt, projects, weather);
}
