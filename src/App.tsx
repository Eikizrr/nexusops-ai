import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  CalendarClock,
  Check,
  CloudSun,
  FileText,
  LayoutDashboard,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users
} from "lucide-react";
import type { ActivityLog, ChatMessage, Project, User, UserRole, WeatherInsight } from "./types";
import { demoCredentials, getStoredUser, login, logout, persistUser, validateCredentials } from "./lib/auth";
import { askCopilot, buildLocalInsight } from "./lib/ai";
import { fetchWeatherInsight } from "./lib/weather";
import { loadProjects, ProjectInput, projectSchema, saveProjects, upsertProject } from "./lib/projects";
import { createActivity, loadActivity, saveActivity } from "./lib/activity";
import { getDeliveryRisk, getProjectsByStatus, getRevenueByStatus, getSmartAlerts } from "./lib/analytics";
import { api } from "./lib/api";

const blankProject: ProjectInput = {
  client: "",
  owner: "",
  email: "",
  title: "",
  budget: 1000,
  progress: 0,
  status: "lead",
  priority: "medium",
  dueDate: "",
  notes: ""
};

const statusLabel: Record<Project["status"], string> = {
  lead: "Lead",
  active: "Ativo",
  paused: "Pausado",
  done: "Concluído"
};

const priorityLabel: Record<Project["priority"], string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta"
};

const roleLabel: Record<UserRole, string> = {
  admin: "Admin",
  manager: "Manager",
  analyst: "Analyst"
};

type Toast = {
  id: string;
  title: string;
  description: string;
  tone: "success" | "warning" | "error";
};

type AppSection = "overview" | "projects" | "intelligence" | "activity" | "warroom" | "case";

const sectionItems: { id: AppSection; label: string; helper: string }[] = [
  { id: "overview", label: "Overview", helper: "Resumo executivo" },
  { id: "projects", label: "Projects", helper: "Carteira e CRUD" },
  { id: "intelligence", label: "Intelligence", helper: "Riscos e dados" },
  { id: "activity", label: "Activity", helper: "Histórico" },
  { id: "warroom", label: "War Room", helper: "Chat e IA" },
  { id: "case", label: "Case Study", helper: "Arquitetura" }
];

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function LoginScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState(demoCredentials.email);
  const [password, setPassword] = useState(demoCredentials.password);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function authenticateUser(nextEmail = email, nextPassword = password) {
    const nextErrors = validateCredentials(nextEmail, nextPassword);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setLoading(true);
    try {
      const { user } = await api.login(nextEmail, nextPassword);
      persistUser(user);
      onLogin(user);
    } catch {
      onLogin(login(nextEmail, nextPassword));
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await authenticateUser();
  }

  async function enterDemo() {
    setEmail(demoCredentials.email);
    setPassword(demoCredentials.password);
    await authenticateUser(demoCredentials.email, demoCredentials.password);
  }

  return (
    <main
      className="login-page"
      onMouseMove={(event) => {
        event.currentTarget.style.setProperty("--mx", `${event.clientX}px`);
        event.currentTarget.style.setProperty("--my", `${event.clientY}px`);
      }}
    >
      <section className="login-panel">
        <div className="brand-mark">NO</div>
        <p className="eyebrow">Operations intelligence</p>
        <h1>NexusOps AI</h1>
        <p className="lead">
          Centralize clientes, projetos, clima operacional e decisões assistidas por IA em uma experiência rápida,
          segura e orientada por dados.
        </p>
        <form onSubmit={submit} className="auth-form">
          <label>
            E-mail
            <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
            {errors.email && <span>{errors.email}</span>}
          </label>
          <label>
            Senha
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
            />
            {errors.password && <span>{errors.password}</span>}
          </label>
          {errors.general && <p className="form-error">{errors.general}</p>}
          <button type="submit" disabled={loading}>
            {loading ? "Validando acesso..." : "Acessar command center"}
          </button>
          <button type="button" className="demo-login-button" onClick={enterDemo} disabled={loading}>
            Entrar como demo
          </button>
        </form>
        <div className="demo-card">
          <ShieldCheck size={18} />
          <span>
            Demo: {demoCredentials.email} / {demoCredentials.password}
          </span>
        </div>
      </section>
      <aside className="login-showcase" aria-label="Resumo do produto">
        <div className="showcase-topline">
          <span className="live-dot" />
          Live operations
        </div>
        <div className="login-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
          <b>AI</b>
        </div>
        <strong>Decisões mais rápidas para times que operam com prazo, clima e receita.</strong>
        <div className="showcase-grid">
          <div>
            <span>Pipeline</span>
            <b>R$ 91,5k</b>
          </div>
          <div>
            <span>SLA médio</span>
            <b>92%</b>
          </div>
          <div>
            <span>Alertas</span>
            <b>3</b>
          </div>
        </div>
      </aside>
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
  helper
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

function MiniBarChart({
  title,
  caption,
  data,
  format = String
}: {
  title: string;
  caption: string;
  data: { label: string; value: number }[];
  format?: (value: number) => string;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <article className="chart-card">
      <div className="section-title">
        <div>
          <p className="eyebrow">{caption}</p>
          <h2>{title}</h2>
        </div>
        <BarChart3 />
      </div>
      <div className="bar-list">
        {data.map((item) => (
          <div className="bar-row" key={item.label}>
            <span>{item.label}</span>
            <div className="bar-track">
              <i style={{ width: `${Math.max((item.value / max) * 100, item.value ? 8 : 0)}%` }} />
            </div>
            <strong>{format(item.value)}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function AlertsPanel({
  alerts,
  onStartDemo
}: {
  alerts: ReturnType<typeof getSmartAlerts>;
  onStartDemo: () => void;
}) {
  return (
    <section className="alerts-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">Decision engine</p>
          <h2>Alertas inteligentes</h2>
        </div>
        <Bell />
      </div>
      <div className="alerts-list">
        {alerts.length ? (
          alerts.map((alert) => (
            <article className={`alert-item ${alert.severity}`} key={alert.id}>
              <strong>{alert.title}</strong>
              <p>{alert.description}</p>
            </article>
          ))
        ) : (
          <article className="alert-item">
            <strong>Operação estável</strong>
            <p>Nenhum risco crítico detectado combinando prazo, prioridade, progresso e clima.</p>
          </article>
        )}
      </div>
      <button className="demo-button" onClick={onStartDemo}>
        <Sparkles size={18} />
        Iniciar demo guiada
      </button>
    </section>
  );
}

function ActivityTimeline({ activity }: { activity: ActivityLog[] }) {
  return (
    <section className="timeline-card">
      <div className="section-title">
        <div>
          <p className="eyebrow">Audit trail</p>
          <h2>Histórico de atividades</h2>
        </div>
        <Activity />
      </div>
      <div className="timeline">
        {activity.slice(0, 7).map((item) => (
          <article className={`timeline-item ${item.type}`} key={item.id}>
            <span />
            <div>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
              <time>{new Date(item.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DemoGuide({
  step,
  onNext,
  onClose
}: {
  step: number | null;
  onNext: () => void;
  onClose: () => void;
}) {
  if (step === null) return null;

  const steps = [
    {
      title: "1. Leia os KPIs",
      text: "Comece pelo pipeline, progresso médio e projetos urgentes. Eles são derivados do estado atual."
    },
    {
      title: "2. Veja riscos reais",
      text: "Os alertas combinam prazo, prioridade, progresso e clima vindo da API Open-Meteo."
    },
    {
      title: "3. Atualize o fluxo",
      text: "Crie ou edite um projeto para ver dashboard, timeline e permissões reagirem."
    },
    {
      title: "4. Consulte o copiloto",
      text: "Pergunte no war room o que priorizar. O backend protege a chave de IA quando configurada."
    }
  ];
  const current = steps[step];

  return (
    <aside className="demo-guide">
      <button className="demo-close" onClick={onClose} aria-label="Fechar demo">
        ×
      </button>
      <p className="eyebrow">Demo guiada</p>
      <h2>{current.title}</h2>
      <p>{current.text}</p>
      <button className="primary-action" onClick={step === steps.length - 1 ? onClose : onNext}>
        {step === steps.length - 1 ? "Concluir" : "Próximo passo"}
      </button>
    </aside>
  );
}

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <article className={`toast ${toast.tone}`} key={toast.id}>
          <div>
            <strong>{toast.title}</strong>
            <p>{toast.description}</p>
          </div>
          <button onClick={() => onDismiss(toast.id)} aria-label="Fechar notificação">
            ×
          </button>
        </article>
      ))}
    </div>
  );
}

function ConfirmDialog({
  project,
  onCancel,
  onConfirm
}: {
  project: Project | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!project) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <p className="eyebrow">Confirmar exclusão</p>
        <h2 id="confirm-title">Remover {project.client}?</h2>
        <p>
          Essa ação tira o projeto da carteira ativa e registra o evento no histórico. Use quando o contrato saiu do
          fluxo operacional.
        </p>
        <div className="dialog-actions">
          <button className="ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button className="danger-action" onClick={onConfirm}>
            Excluir projeto
          </button>
        </div>
      </section>
    </div>
  );
}

function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton-block" aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}

function CaseStudyPanel() {
  const architecture = [
    "React + TypeScript para interface responsiva e estado de produto",
    "Express como API server e camada segura para IA",
    "Prisma ORM com SQLite local e caminho claro para PostgreSQL",
    "Open-Meteo como API externa convertida em recomendação operacional",
    "BroadcastChannel para chat em tempo real entre abas",
    "Vitest cobrindo validação, analytics e risco operacional"
  ];

  return (
    <section className="case-grid">
      <article className="case-hero-card">
        <p className="eyebrow">Product case</p>
        <h2>NexusOps AI transforma dados soltos em decisão operacional.</h2>
        <p>
          O produto foi desenhado para times que precisam acompanhar receita, prazo, risco externo e comunicação em
          um único command center. A experiência mostra domínio de UX, estado, API, autenticação, IA e deploy.
        </p>
      </article>

      <article className="case-card">
        <FileText />
        <h3>Problema</h3>
        <p>Gestores perdem contexto quando clientes, prazos, alertas e decisões ficam espalhados entre ferramentas.</p>
      </article>

      <article className="case-card">
        <Sparkles />
        <h3>Solucao</h3>
        <p>Um painel unificado com CRUD validado, sinais externos, IA assistiva, auditoria e colaboração em tempo real.</p>
      </article>

      <article className="case-card">
        <ShieldCheck />
        <h3>Confiança</h3>
        <p>Login por API, cookie HTTP-only, roles, fallback offline, testes automatizados e healthcheck público.</p>
      </article>

      <article className="case-stack-card">
        <p className="eyebrow">Architecture map</p>
        <h3>Decisões técnicas</h3>
        <ul>
          {architecture.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>

      <article className="case-stack-card impact">
        <p className="eyebrow">What it proves</p>
        <h3>Competências demonstradas</h3>
        <div className="impact-tags">
          <span>Frontend architecture</span>
          <span>REST API</span>
          <span>Auth</span>
          <span>Prisma</span>
          <span>AI integration</span>
          <span>Data UX</span>
          <span>Responsive UI</span>
          <span>Deploy</span>
        </div>
      </article>
    </section>
  );
}

function ProjectForm({
  editing,
  onCancel,
  onSave
}: {
  editing: Project | null;
  onCancel: () => void;
  onSave: (project: ProjectInput, id?: string) => void;
}) {
  const [form, setForm] = useState<ProjectInput>(editing ?? blankProject);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setForm(editing ?? blankProject);
    setErrors({});
  }, [editing]);

  function update<K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = projectSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(
        parsed.error.issues.reduce<Record<string, string>>((acc, issue) => {
          acc[String(issue.path[0])] = issue.message;
          return acc;
        }, {})
      );
      return;
    }
    onSave(parsed.data, editing?.id);
    setForm(blankProject);
  }

  return (
    <form className="project-form" onSubmit={submit}>
      <div className="form-head">
        <h2>{editing ? "Editar projeto" : "Novo projeto"}</h2>
        {editing && (
          <button type="button" className="ghost" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
      <div className="form-grid">
        <label>
          Cliente
          <input value={form.client} onChange={(event) => update("client", event.target.value)} />
          {errors.client && <span>{errors.client}</span>}
        </label>
        <label>
          Responsável
          <input value={form.owner} onChange={(event) => update("owner", event.target.value)} />
          {errors.owner && <span>{errors.owner}</span>}
        </label>
        <label>
          E-mail
          <input value={form.email} onChange={(event) => update("email", event.target.value)} />
          {errors.email && <span>{errors.email}</span>}
        </label>
        <label>
          Projeto
          <input value={form.title} onChange={(event) => update("title", event.target.value)} />
          {errors.title && <span>{errors.title}</span>}
        </label>
        <label>
          Orçamento
          <input
            value={form.budget}
            onChange={(event) => update("budget", Number(event.target.value))}
            type="number"
            min="1000"
          />
          {errors.budget && <span>{errors.budget}</span>}
        </label>
        <label>
          Progresso
          <input
            value={form.progress}
            onChange={(event) => update("progress", Number(event.target.value))}
            type="number"
            min="0"
            max="100"
          />
          {errors.progress && <span>{errors.progress}</span>}
        </label>
        <label>
          Status
          <select value={form.status} onChange={(event) => update("status", event.target.value as Project["status"])}>
            <option value="lead">Lead</option>
            <option value="active">Ativo</option>
            <option value="paused">Pausado</option>
            <option value="done">Concluído</option>
          </select>
        </label>
        <label>
          Prioridade
          <select
            value={form.priority}
            onChange={(event) => update("priority", event.target.value as Project["priority"])}
          >
            <option value="low">Baixa</option>
            <option value="medium">Média</option>
            <option value="high">Alta</option>
          </select>
        </label>
        <label>
          Prazo
          <input value={form.dueDate} onChange={(event) => update("dueDate", event.target.value)} type="date" />
          {errors.dueDate && <span>{errors.dueDate}</span>}
        </label>
      </div>
      <label>
        Observações
        <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} rows={3} />
        {errors.notes && <span>{errors.notes}</span>}
      </label>
      <button type="submit" className="primary-action">
        <Plus size={18} />
        {editing ? "Salvar alterações" : "Adicionar projeto"}
      </button>
    </form>
  );
}

function ChatPanel({
  projects,
  weather,
  user
}: {
  projects: Project[];
  weather: WeatherInsight | null;
  user: User;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      author: "Nexus Copilot",
      role: "assistant",
      body: buildLocalInsight(projects, weather),
      createdAt: new Date().toISOString()
    }
  ]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const tabId = useMemo(() => crypto.randomUUID(), []);
  const quickPrompts = [
    "Gere um resumo executivo da operação.",
    "Quais projetos estão em maior risco agora?",
    "O que devo priorizar hoje?",
    "Crie um plano de ação para as próximas 24 horas."
  ];

  useEffect(() => {
    const channel = new BroadcastChannel("nexusops-chat");
    channel.onmessage = (event: MessageEvent<ChatMessage & { sourceId?: string }>) => {
      if (event.data.sourceId === tabId) return;
      const message: ChatMessage = {
        id: event.data.id,
        author: event.data.author,
        role: event.data.role,
        body: event.data.body,
        createdAt: event.data.createdAt
      };
      setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
    };
    return () => channel.close();
  }, [tabId]);

  function broadcastMessage(message: ChatMessage) {
    const channel = new BroadcastChannel("nexusops-chat");
    channel.postMessage({ ...message, sourceId: tabId });
    channel.close();
  }

  async function submitPrompt(prompt: string) {
    if (!prompt.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      author: user.name,
      role: "user",
      body: prompt.trim(),
      createdAt: new Date().toISOString()
    };
    setMessages((current) => [...current, userMessage]);
    broadcastMessage(userMessage);
    setText("");
    setLoading(true);

    const answer = await askCopilot(userMessage.body, projects, weather);
    const aiMessage: ChatMessage = {
      id: crypto.randomUUID(),
      author: "Nexus Copilot",
      role: "assistant",
      body: answer,
      createdAt: new Date().toISOString()
    };
    setMessages((current) => [...current, aiMessage]);
    broadcastMessage(aiMessage);
    setLoading(false);
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    await submitPrompt(text);
  }

  return (
    <section className="chat-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">Tempo real + IA</p>
          <h2>War room</h2>
        </div>
        <Bot />
      </div>
      <div className="messages" aria-live="polite">
        {messages.map((message) => (
          <article key={message.id} className={`message ${message.role}`}>
            <strong>{message.author}</strong>
            <p>{message.body}</p>
            <time>{new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
          </article>
        ))}
        {loading && <p className="typing">Copilot analisando estado atual...</p>}
      </div>
      <div className="quick-prompts" aria-label="Sugestoes rápidas para o copiloto">
        {quickPrompts.map((prompt) => (
          <button key={prompt} onClick={() => void submitPrompt(prompt)} disabled={loading}>
            {prompt}
          </button>
        ))}
      </div>
      <form className="chat-form" onSubmit={sendMessage}>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Pergunte: qual projeto priorizar agora?"
        />
        <button type="submit">Enviar</button>
      </form>
    </section>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [activityLog, setActivityLog] = useState<ActivityLog[]>(() => loadActivity());
  const [editing, setEditing] = useState<Project | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Project["status"]>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Project["priority"]>("all");
  const [riskFilter, setRiskFilter] = useState<"all" | "high" | "dueSoon">("all");
  const [weather, setWeather] = useState<WeatherInsight | null>(null);
  const [weatherError, setWeatherError] = useState("");
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [demoStep, setDemoStep] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [activeSection, setActiveSection] = useState<AppSection>("overview");

  const pushActivity = useCallback((type: ActivityLog["type"], title: string, description: string) => {
    setActivityLog((current) => [createActivity(type, title, description), ...current].slice(0, 16));
  }, []);

  const pushToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    setToasts((current) => [{ id, ...toast }, ...current].slice(0, 4));
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  useEffect(() => {
    saveProjects(projects);
  }, [projects]);

  useEffect(() => {
    saveActivity(activityLog);
  }, [activityLog]);

  useEffect(() => {
    api
      .me()
      .then(({ user }) => {
        persistUser(user);
        setUser(user);
      })
      .catch(() => undefined);
    api
      .listProjects()
      .then(setProjects)
      .catch(() =>
        pushToast({
          tone: "warning",
          title: "Modo offline ativo",
          description: "A API local não respondeu. A interface usará dados salvos no navegador."
        })
      )
      .finally(() => setBootstrapping(false));
    api
      .listActivity()
      .then((items) => {
        if (items.length) setActivityLog(items);
      })
      .catch(() => undefined);
  }, [pushToast]);

  const refreshWeather = useCallback(async () => {
    setLoadingWeather(true);
    setWeatherError("");
    try {
      setWeather(await fetchWeatherInsight());
      pushActivity("weather", "Clima sincronizado", "Dados da Open-Meteo atualizaram os alertas operacionais.");
      pushToast({
        tone: "success",
        title: "Sinais atualizados",
        description: "Clima operacional sincronizado com a Open-Meteo."
      });
    } catch (error) {
      setWeatherError(error instanceof Error ? error.message : "Falha ao consultar API real.");
      pushToast({
        tone: "error",
        title: "Falha ao atualizar clima",
        description: "A API externa não respondeu agora. Os dados locais continuam disponíveis."
      });
    } finally {
      setLoadingWeather(false);
    }
  }, [pushActivity, pushToast]);

  useEffect(() => {
    void refreshWeather();
  }, [refreshWeather]);

  const filteredProjects = useMemo(() => {
    const term = query.toLowerCase();
    return projects.filter((project) => {
      const matchesSearch = [project.client, project.owner, project.title, project.status, project.priority].some((value) =>
        value.toLowerCase().includes(term)
      );
      const matchesStatus = statusFilter === "all" || project.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || project.priority === priorityFilter;
      const daysToDue = Math.ceil((new Date(project.dueDate).getTime() - Date.now()) / 86_400_000);
      const matchesRisk =
        riskFilter === "all" ||
        (riskFilter === "high" && getDeliveryRisk(project, weather) >= 55) ||
        (riskFilter === "dueSoon" && project.status !== "done" && daysToDue <= 10);
      return matchesSearch && matchesStatus && matchesPriority && matchesRisk;
    });
  }, [projects, query, riskFilter, statusFilter, priorityFilter, weather]);

  const metrics = useMemo(() => {
    const total = projects.reduce((sum, project) => sum + project.budget, 0);
    const active = projects.filter((project) => project.status === "active").length;
    const avgProgress = Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / Math.max(projects.length, 1));
    const urgent = projects.filter((project) => project.priority === "high" && project.status !== "done").length;
    return { total, active, avgProgress, urgent };
  }, [projects]);

  const statusChart = useMemo(() => getProjectsByStatus(projects), [projects]);
  const revenueChart = useMemo(() => getRevenueByStatus(projects), [projects]);
  const alerts = useMemo(() => getSmartAlerts(projects, weather), [projects, weather]);

  function updateRole(role: UserRole) {
    if (!user) return;
    const next = { ...user, role };
    persistUser(next);
    setUser(next);
    pushActivity("updated", "Permissão alterada", `Perfil ativo mudou para ${roleLabel[role]}.`);
  }

  async function handleSave(input: ProjectInput, id?: string) {
    setProjects((current) => upsertProject(current, input, id));
    pushActivity(id ? "updated" : "created", id ? "Projeto atualizado" : "Projeto criado", `${input.client} foi salvo no fluxo operacional.`);
    pushToast({
      tone: "success",
      title: id ? "Projeto atualizado" : "Projeto criado",
      description: `${input.client} ja aparece nos indicadores e na timeline.`
    });
    setEditing(null);

    try {
      if (id) await api.updateProject(id, input);
      else await api.createProject(input);
      const [nextProjects, nextActivity] = await Promise.all([api.listProjects(), api.listActivity()]);
      setProjects(nextProjects);
      if (nextActivity.length) setActivityLog(nextActivity);
    } catch {
      // Fallback local keeps the demo fully usable without the API process.
      pushToast({
        tone: "warning",
        title: "Salvo localmente",
        description: "Backend indisponível no momento. O navegador manteve a alteração."
      });
    }
  }

  async function handleDelete(project: Project) {
    setProjects((current) => current.filter((item) => item.id !== project.id));
    pushActivity("deleted", "Projeto removido", `${project.client} saiu da carteira ativa.`);
    pushToast({
      tone: "success",
      title: "Projeto removido",
      description: `${project.client} saiu da carteira ativa.`
    });
    try {
      await api.deleteProject(project.id);
      const nextActivity = await api.listActivity();
      if (nextActivity.length) setActivityLog(nextActivity);
    } catch {
      // Fallback local keeps the demo fully usable without the API process.
      pushToast({
        tone: "warning",
        title: "Exclusão local",
        description: "A API não respondeu, mas a interface ja removeu o item localmente."
      });
    }
  }

  if (!user) return <LoginScreen onLogin={setUser} />;

  const canManage = user.role !== "analyst";

  return (
    <main
      className="app-shell"
      onMouseMove={(event) => {
        event.currentTarget.style.setProperty("--mx", `${event.clientX}px`);
        event.currentTarget.style.setProperty("--my", `${event.clientY}px`);
      }}
    >
      <div className="ambient-layer" aria-hidden="true" />
      <header className="topbar">
        <div>
          <p className="eyebrow">NexusOps AI</p>
          <h1>Command center para receita, projetos e decisões operacionais.</h1>
          <p className="header-copy">
            Uma visão executiva do funil, com dados externos, estado em tempo real e copiloto para transformar
            movimento em ação.
          </p>
          <div className="quick-actions">
            <button
              onClick={() => {
                setDemoStep(0);
                setActiveSection("overview");
                pushActivity("demo", "Demo guiada iniciada", "Fluxo de apresentação do produto foi acionado.");
              }}
            >
              <Sparkles size={17} />
              Demo guiada
            </button>
            <button onClick={refreshWeather}>
              <RefreshCw size={17} />
              Atualizar sinais
            </button>
            <button
              onClick={() => {
                setQuery("high");
                setActiveSection("projects");
              }}
            >
              <Bell size={17} />
              Ver urgencias
            </button>
          </div>
        </div>
        <aside className="hero-console" aria-label="Console visual de operações">
          <div className="radar">
            <span />
            <span />
            <span />
            <b>{metrics.urgent}</b>
          </div>
          <div className="console-stack">
            <div>
              <span>Risk pulse</span>
              <strong>{alerts.length || 1} sinais</strong>
            </div>
            <div>
              <span>Weather API</span>
              <strong>{weather ? `${weather.rainRisk}% chuva` : "sync"}</strong>
            </div>
            <div>
              <span>AI copilot</span>
              <strong>online</strong>
            </div>
          </div>
        </aside>
        <div className="topbar-actions">
          <label className="role-switcher">
            Perfil
            <select value={user.role} onChange={(event) => updateRole(event.target.value as UserRole)}>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="analyst">Analyst</option>
            </select>
          </label>
          <span className="user-chip">{user.name}</span>
          <button
            className="ghost"
            onClick={async () => {
              try {
                await api.logout();
              } catch {
                // Local fallback covers demos without the backend process.
              }
              logout();
              setUser(null);
            }}
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </header>

      <nav className="section-tabs" aria-label="Navegação principal do produto">
        {sectionItems.map((item) => (
          <button
            key={item.id}
            className={activeSection === item.id ? "active" : ""}
            onClick={() => setActiveSection(item.id)}
            aria-current={activeSection === item.id ? "page" : undefined}
          >
            <strong>{item.label}</strong>
            <span>{item.helper}</span>
          </button>
        ))}
      </nav>

      {activeSection === "overview" && (
        <section className="section-view">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Executive overview</p>
              <h2>O que precisa de decisão agora</h2>
            </div>
            <span>{projects.length} projetos monitorados</span>
          </div>
          <section className="metrics-grid">
            <MetricCard icon={<LayoutDashboard />} label="Pipeline" value={currency(metrics.total)} helper="Receita mapeada" />
            <MetricCard icon={<Activity />} label="Projetos ativos" value={String(metrics.active)} helper="Execução em andamento" />
            <MetricCard icon={<Check />} label="Progresso médio" value={`${metrics.avgProgress}%`} helper="Atualizado pelo fluxo" />
            <MetricCard icon={<CalendarClock />} label="Prioridade alta" value={String(metrics.urgent)} helper="Demandam atenção" />
          </section>

          <section className="dashboard-grid">
        <article className="weather-card">
          <div className="section-title">
            <div>
              <p className="eyebrow">Open-Meteo live</p>
              <h2>Inteligência operacional</h2>
            </div>
            <button className="icon-button" onClick={refreshWeather} disabled={loadingWeather} aria-label="Atualizar clima">
              <RefreshCw size={18} />
            </button>
          </div>
          {weather ? (
            <div className="weather-content">
              <CloudSun size={42} />
              <div>
                <strong>
                  {weather.city} - {weather.currentTemperature} C
                </strong>
                <p>{weather.recommendation}</p>
                <span>
                  Próximas 12h: {weather.avgNext12hTemp} C média, {weather.rainRisk}% risco de chuva, vento máximo{" "}
                  {weather.maxWindNext12h} km/h.
                </span>
              </div>
            </div>
          ) : (
            <>
              {loadingWeather && <SkeletonBlock lines={3} />}
              {!loadingWeather && <p className="muted">{weatherError}</p>}
            </>
          )}
        </article>
        <article className="insight-card">
          <div className="section-title">
            <div>
              <p className="eyebrow">Estado derivado</p>
              <h2>Leitura executiva</h2>
            </div>
            <Users />
          </div>
          <p>{buildLocalInsight(projects, weather)}</p>
        </article>
      </section>
        </section>
      )}

      {activeSection === "projects" && (
        <section className="section-view">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Commercial operations</p>
              <h2>Carteira, criação e manutenção de projetos</h2>
            </div>
            <span>{filteredProjects.length} resultado(s)</span>
          </div>
      <section className="workspace">
        {canManage ? (
          <ProjectForm editing={editing} onCancel={() => setEditing(null)} onSave={handleSave} />
        ) : (
          <section className="permission-card">
            <ShieldCheck />
            <p className="eyebrow">Permissão de leitura</p>
            <h2>Analyst acompanha indicadores sem alterar carteira</h2>
            <p>Troque para Manager ou Admin para criar, editar e remover projetos.</p>
          </section>
        )}

        <section className="project-list">
          <div className="section-title">
            <div>
              <p className="eyebrow">Operações comerciais</p>
              <h2>Clientes e projetos</h2>
            </div>
            <div className="project-tools">
              <div className="search-box">
                <Search size={18} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar..." />
              </div>
              <div className="filter-grid">
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                  <option value="all">Todos status</option>
                  <option value="lead">Lead</option>
                  <option value="active">Ativo</option>
                  <option value="paused">Pausado</option>
                  <option value="done">Concluído</option>
                </select>
                <select
                  value={priorityFilter}
                  onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)}
                >
                  <option value="all">Todas prioridades</option>
                  <option value="high">Alta</option>
                  <option value="medium">Média</option>
                  <option value="low">Baixa</option>
                </select>
                <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as typeof riskFilter)}>
                  <option value="all">Todos riscos</option>
                  <option value="high">Risco alto</option>
                  <option value="dueSoon">Prazo próximo</option>
                </select>
                <button
                  className="clear-filters"
                  onClick={() => {
                    setQuery("");
                    setStatusFilter("all");
                    setPriorityFilter("all");
                    setRiskFilter("all");
                  }}
                >
                  Limpar
                </button>
              </div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Prioridade</th>
                  <th>Progresso</th>
                  <th>Valor</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {bootstrapping ? (
                  <tr>
                    <td colSpan={6}>
                      <SkeletonBlock lines={4} />
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((project) => (
                  <tr key={project.id}>
                    <td data-label="Cliente">
                      <strong>{project.client}</strong>
                      <span>{project.title}</span>
                    </td>
                    <td data-label="Status">
                      <span className={`pill ${project.status}`}>{statusLabel[project.status]}</span>
                    </td>
                    <td data-label="Prioridade">{priorityLabel[project.priority]}</td>
                    <td data-label="Progresso">
                      <div className="progress">
                        <span style={{ width: `${project.progress}%` }} />
                      </div>
                      {project.progress}%
                    </td>
                    <td data-label="Valor">{currency(project.budget)}</td>
                    <td data-label="Ações">
                      {canManage ? (
                        <div className="row-actions">
                          <button className="icon-button" onClick={() => setEditing(project)} aria-label="Editar">
                            <Pencil size={16} />
                          </button>
                          <button
                            className="icon-button danger"
                            onClick={() => setProjectToDelete(project)}
                            aria-label="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ) : (
                        <span className="readonly-chip">Somente leitura</span>
                      )}
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
        </section>
      )}

      {activeSection === "intelligence" && (
        <section className="section-view">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Decision intelligence</p>
              <h2>Riscos, gráficos e sinais externos</h2>
            </div>
            <span>{alerts.length || 1} sinal(is) ativos</span>
          </div>
          <section className="intelligence-grid">
            <AlertsPanel
              alerts={alerts}
              onStartDemo={() => {
                setDemoStep(0);
                setActiveSection("overview");
                pushActivity("demo", "Demo guiada iniciada", "Fluxo de apresentação do produto foi acionado.");
              }}
            />
            <MiniBarChart title="Projetos por status" caption="Operational health" data={statusChart} />
            <MiniBarChart title="Receita por status" caption="Revenue view" data={revenueChart} format={currency} />
          </section>
        </section>
      )}

      {activeSection === "activity" && (
        <section className="section-view">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Audit trail</p>
              <h2>Eventos recentes do sistema</h2>
            </div>
            <span>{activityLog.length} registro(s)</span>
          </div>
          <ActivityTimeline activity={activityLog} />
        </section>
      )}

      {activeSection === "warroom" && (
        <section className="section-view">
          <div className="section-heading">
            <div>
              <p className="eyebrow">AI operations</p>
              <h2>War Room com estado em tempo real</h2>
            </div>
            <span>BroadcastChannel + Copilot</span>
          </div>
          <ChatPanel projects={projects} weather={weather} user={user} />
        </section>
      )}

      {activeSection === "case" && (
        <section className="section-view">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Case study</p>
              <h2>Como o NexusOps AI foi pensado</h2>
            </div>
            <span>Produto + engenharia</span>
          </div>
          <CaseStudyPanel />
        </section>
      )}
      <DemoGuide
        step={demoStep}
        onNext={() => setDemoStep((current) => (current === null ? 0 : current + 1))}
        onClose={() => setDemoStep(null)}
      />
      <ConfirmDialog
        project={projectToDelete}
        onCancel={() => setProjectToDelete(null)}
        onConfirm={() => {
          if (projectToDelete) void handleDelete(projectToDelete);
          setProjectToDelete(null);
        }}
      />
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
    </main>
  );
}

export default App;
