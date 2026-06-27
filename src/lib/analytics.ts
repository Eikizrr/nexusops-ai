import type { Project, WeatherInsight } from "../types";

export function getProjectsByStatus(projects: Project[]) {
  const labels: Record<Project["status"], string> = {
    lead: "Lead",
    active: "Ativo",
    paused: "Pausado",
    done: "Concluído"
  };

  return (Object.keys(labels) as Project["status"][]).map((status) => ({
    key: status,
    label: labels[status],
    value: projects.filter((project) => project.status === status).length
  }));
}

export function getRevenueByStatus(projects: Project[]) {
  return getProjectsByStatus(projects).map((item) => ({
    ...item,
    value: projects
      .filter((project) => project.status === item.key)
      .reduce((sum, project) => sum + project.budget, 0)
  }));
}

export function getDeliveryRisk(project: Project, weather?: WeatherInsight | null) {
  const daysToDue = Math.ceil((new Date(project.dueDate).getTime() - Date.now()) / 86_400_000);
  let score = 0;
  if (project.priority === "high") score += 30;
  if (project.progress < 45) score += 25;
  if (daysToDue <= 7) score += 25;
  if (daysToDue < 0) score += 30;
  if (weather && weather.rainRisk >= 70 && project.status === "active") score += 20;
  return Math.min(score, 100);
}

export function getSmartAlerts(projects: Project[], weather?: WeatherInsight | null) {
  const risky = projects
    .map((project) => ({ project, risk: getDeliveryRisk(project, weather) }))
    .filter(({ project, risk }) => project.status !== "done" && risk >= 55)
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 3);

  const alerts = risky.map(({ project, risk }) => ({
    id: `risk-${project.id}`,
    title: `${project.client} exige atenção`,
    description: `${project.title} está com risco ${risk}% por prazo, prioridade ou progresso.`,
    severity: risk >= 80 ? "critical" : "warning"
  }));

  if (weather && weather.rainRisk >= 70) {
    alerts.unshift({
      id: "weather-risk",
      title: "Risco climatico elevado",
      description: `${weather.rainRisk}% de chance de chuva nas próximas 12h. Replaneje atividades externas.`,
      severity: "critical"
    });
  }

  return alerts;
}
