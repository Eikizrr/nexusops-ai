import type { Project } from "../types";

export const seedProjects: Project[] = [
  {
    id: "p-001",
    client: "Manaus Fresh Market",
    owner: "Amanda Costa",
    email: "amanda@freshmarket.dev",
    title: "Painel de vendas omnichannel",
    budget: 42000,
    progress: 72,
    status: "active",
    priority: "high",
    dueDate: "2026-07-18",
    notes: "Integra pedidos, estoque e previsão de ruptura para lojas físicas.",
    createdAt: "2026-05-20T10:00:00.000Z"
  },
  {
    id: "p-002",
    client: "LogiNorte",
    owner: "Rafael Souza",
    email: "rafael@loginorte.dev",
    title: "Rastreamento de entregas críticas",
    budget: 31000,
    progress: 38,
    status: "active",
    priority: "medium",
    dueDate: "2026-08-04",
    notes: "Módulo com alertas por clima e priorização de rotas urbanas.",
    createdAt: "2026-06-01T15:40:00.000Z"
  },
  {
    id: "p-003",
    client: "EducaPro",
    owner: "Lia Martins",
    email: "lia@educapro.dev",
    title: "CRM de matrículas",
    budget: 18500,
    progress: 91,
    status: "paused",
    priority: "low",
    dueDate: "2026-06-29",
    notes: "Aguardando homologação do time comercial.",
    createdAt: "2026-04-11T08:25:00.000Z"
  }
];
