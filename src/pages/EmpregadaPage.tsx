import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  fetchAvailableYearMonthsByUser,
  fetchPontoOnlineByUserDate,
  fetchPontoOnlineByUserMonth,
  fetchProfileNameById,
  upsertPontoOnlineToday,
  type PontoOnlineRow,
} from "../lib/pontoOnline";
import { formatMinutes } from "../lib/reportRules";

type Stage = "entrada" | "saida_almoco" | "volta_almoco" | "saida_final";

const STAGE_CONFIG: Record<Stage, { label: string; actionLabel: string }> = {
  entrada: { label: "Entrada", actionLabel: "Registrar entrada" },
  saida_almoco: { label: "Saída Almoço", actionLabel: "Registrar saída almoço" },
  volta_almoco: { label: "Volta Almoço", actionLabel: "Registrar volta almoço" },
  saida_final: { label: "Saída Final", actionLabel: "Registrar saída final" },
};

const STAGES: Stage[] = ["entrada", "saida_almoco", "volta_almoco", "saida_final"];

const MONTH_OPTIONS = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

export default function EmpregadaPage() {
  const { signOut, loading, user } = useAuth();
  const [month, setMonth] = useState(currentMonthKey());
  const [profileName, setProfileName] = useState<string>("");

  const [todayRow, setTodayRow] = useState<PontoOnlineRow | null>(null);
  const [todayLoading, setTodayLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<PontoOnlineRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [availableMonths, setAvailableMonths] = useState<string[]>([currentMonthKey()]);
  const [pageError, setPageError] = useState<string | null>(null);

  const [pendingStage, setPendingStage] = useState<Stage | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string>("");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const dateKey = useMemo(() => todayDateKey(), []);
  const currentStage = nextStage(todayRow);
  const monthParts = splitMonth(month);
  const displayName = formatPersonName(
    profileName || extractNameFromEmail(user?.email) || "Empregada",
  );
  const isErrorFeedback = Boolean(
    feedbackMessage && feedbackMessage.toLowerCase().startsWith("falha"),
  );

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    availableMonths.forEach((value) => years.add(Number(value.slice(0, 4))));
    return Array.from(years).sort((a, b) => a - b);
  }, [availableMonths]);

  const monthOptions = useMemo(() => {
    const months = availableMonths
      .filter((value) => Number(value.slice(0, 4)) === monthParts.year)
      .map((value) => Number(value.slice(5, 7)));
    return MONTH_OPTIONS.filter((option) => months.includes(option.value));
  }, [availableMonths, monthParts.year]);

  const loadToday = async (userId: string) => {
    setTodayLoading(true);
    const { data, error } = await fetchPontoOnlineByUserDate(userId, dateKey);
    setTodayLoading(false);

    if (error) {
      setPageError(error);
      return;
    }

    setTodayRow(data);
  };

  const loadHistory = async (userId: string) => {
    setHistoryLoading(true);
    const { data, error } = await fetchPontoOnlineByUserMonth(userId, month);
    setHistoryLoading(false);

    if (error || !data) {
      setPageError(error ?? "Falha ao carregar histórico.");
      return;
    }

    const previousDays = data.filter((row) => row.data < dateKey);
    setHistory(previousDays);
  };

  useEffect(() => {
    if (!user?.id) return;

    const init = async () => {
      setPageError(null);

      const profileResult = await fetchProfileNameById(user.id);
      if (!profileResult.error && profileResult.nome) {
        setProfileName(profileResult.nome);
      }

      const availableResult = await fetchAvailableYearMonthsByUser(user.id);
      if (availableResult.error) {
        setPageError(availableResult.error);
      } else if (availableResult.months.length > 0) {
        setAvailableMonths(availableResult.months);
        if (!availableResult.months.includes(month)) {
          setMonth(availableResult.months[availableResult.months.length - 1]);
        }
      } else {
        setAvailableMonths([currentMonthKey()]);
      }
    };

    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    void loadToday(user.id);
    void loadHistory(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, month]);

  const askRegisterStage = () => {
    setFeedbackMessage(null);

    if (!currentStage) {
      setFeedbackMessage("Jornada de hoje encerrada.");
      return;
    }

    setPendingStage(currentStage);
    setPendingMessage(confirmationMessage(currentStage, todayRow));
  };

  const cancelPending = () => {
    setPendingStage(null);
    setPendingMessage("");
  };

  const confirmPending = async () => {
    if (!pendingStage || !user?.id) return;

    const empregadoBase =
      profileName || extractNameFromEmail(user.email) || "empregada";
    const empregado = normalizeEmpregadoForDb(empregadoBase);
    const { error } = await upsertPontoOnlineToday({
      userId: user.id,
      empregado,
      dateKey,
      field: pendingStage,
      value: timeNow(),
    });

    if (error) {
      setFeedbackMessage(`Falha ao registrar ponto: ${error}`);
      cancelPending();
      return;
    }

    const refreshed = await fetchPontoOnlineByUserDate(user.id, dateKey);
    const refreshedRow = refreshed.error ? null : refreshed.data;
    setTodayRow(refreshedRow);
    setFeedbackMessage(stageProgressMessage(pendingStage, refreshedRow));
    cancelPending();
    await loadHistory(user.id);
  };

  return (
    <main className="page page-empregada">
      <section className="panel page-intro">
        <h1 className="page-intro-title">
          Controle de Ponto
          <br />
          On-line
        </h1>
      </section>

      <header className="panel page-header">
        <p>Olá, {displayName}!</p>
        <p className="muted">Perfil de acesso: Funcionário</p>
      </header>

      <section className="panel">
        <h2>{weekdayTitle(dateKey)}</h2>
        <p className="muted">{displayDate(dateKey)}</p>

        <div className="punch-grid">
          {STAGES.map((stage, index) => {
            const stageValue = todayRow?.[stage] ?? null;
            const completed = Boolean(stageValue);
            const current = !completed && currentStage === stage;
            const locked = !completed && !current && isRightOfCurrent(index, currentStage);

            return (
              <article
                key={stage}
                className={`punch-card stage-${stage}${completed ? " is-done" : ""}${current ? " is-active" : ""}${locked ? " is-locked" : ""}`}
              >
                <p className="punch-title">{STAGE_CONFIG[stage].label}</p>
                <p className="punch-time">
                  {stageValue ? shortTime(stageValue) : current ? "Aguardando marcação" : "-"}
                </p>
              </article>
            );
          })}
        </div>

        <button
          type="button"
          className="button-full"
          disabled={todayLoading || !currentStage}
          onClick={askRegisterStage}
          aria-label={primaryActionAriaLabel(currentStage)}
        >
          {todayLoading
            ? "Atualizando..."
            : currentStage
              ? STAGE_CONFIG[currentStage].actionLabel
              : "Jornada encerrada hoje"}
        </button>

        {pendingStage ? (
          <section className="confirm-panel">
            <p>{pendingMessage}</p>
            <div className="confirm-actions">
              <button type="button" className="button-muted" onClick={cancelPending}>
                Cancelar
              </button>
              <button type="button" onClick={() => void confirmPending()}>
                Confirmar
              </button>
            </div>
          </section>
        ) : null}

        {feedbackMessage ? (
          <p
            className={isErrorFeedback ? "error-text" : "success-text"}
            role={isErrorFeedback ? "alert" : "status"}
            aria-live={isErrorFeedback ? "assertive" : "polite"}
          >
            {feedbackMessage}
          </p>
        ) : null}

        <button
          type="button"
          className="button-muted collapse-toggle history-toggle"
          onClick={() => setShowHistory((previous) => !previous)}
        >
          {showHistory ? "Ocultar histórico" : "Mostrar histórico"}
        </button>
      </section>

      {showHistory ? (
        <section className="panel">
          <h2>Histórico</h2>
          <div className="form-grid report-grid">
            <label htmlFor="ano-empregada">Ano</label>
          <select
            id="ano-empregada"
            value={String(monthParts.year)}
            onChange={(event) =>
              setMonth(
                mergeMonth(
                  Number(event.target.value),
                  firstMonthForYear(
                    availableMonths,
                    Number(event.target.value),
                    monthParts.month,
                  ),
                ),
              )
            }
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <label htmlFor="mes-empregada">Mês</label>
          <select
            id="mes-empregada"
            value={String(monthParts.month)}
            onChange={(event) =>
              setMonth(mergeMonth(monthParts.year, Number(event.target.value)))
            }
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            </select>
          </div>

          {historyLoading ? <p className="muted">Carregando histórico...</p> : null}
          {pageError ? (
            <p className="error-text" role="alert" aria-live="assertive">
              {pageError}
            </p>
          ) : null}
          {!historyLoading && !pageError && history.length === 0 ? (
            <p className="muted">Sem registros para o período selecionado.</p>
          ) : null}

          <div className="report-table-wrap">
            <table className="report-table stack-mobile">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Entrada</th>
                  <th>Saída Almoço</th>
                  <th>Volta Almoço</th>
                  <th>Saída Final</th>
                  <th>Saldo</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Data">{row.data}</td>
                    <td data-label="Entrada">{row.entrada ?? "-"}</td>
                    <td data-label="Saída Almoço">{row.saida_almoco ?? "-"}</td>
                    <td data-label="Volta Almoço">{row.volta_almoco ?? "-"}</td>
                    <td data-label="Saída Final">{row.saida_final ?? "-"}</td>
                    <td data-label="Saldo">{dayBalanceLabel(row)}</td>
                    <td data-label="Observação">{row.observacao ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <button
          type="button"
          className="button-muted button-full"
          onClick={signOut}
          disabled={loading}
        >
          {loading ? "Saindo..." : "Sair"}
        </button>
      </section>
    </main>
  );
}

function nextStage(row: PontoOnlineRow | null): Stage | null {
  if (!row?.entrada) return "entrada";
  if (!row.saida_almoco) return "saida_almoco";
  if (!row.volta_almoco) return "volta_almoco";
  if (!row.saida_final) return "saida_final";
  return null;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function todayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function timeNow() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:00`;
}

function dayBalanceLabel(row: PontoOnlineRow) {
  const worked = workedMinutes(row);
  if (worked === null) return "-";
  return formatMinutes(worked - 8 * 60);
}

function workedMinutes(row: PontoOnlineRow) {
  if (!row.entrada || !row.saida_almoco || !row.volta_almoco || !row.saida_final) {
    return null;
  }

  const e = parseTime(row.entrada);
  const sa = parseTime(row.saida_almoco);
  const va = parseTime(row.volta_almoco);
  const sf = parseTime(row.saida_final);

  if (e === null || sa === null || va === null || sf === null) return null;
  if (sa < e || va < sa || sf < va) return null;

  return sa - e + (sf - va);
}

function parseTime(value: string) {
  const [h, m] = value.split(":");
  const hh = Number(h);
  const mm = Number(m);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function stageProgressMessage(stage: Stage, row: PontoOnlineRow | null) {
  if (!row) {
    return `${STAGE_CONFIG[stage].label} registrada com sucesso.`;
  }

  if (stage === "entrada") {
    return `Entrada registrada às ${shortTime(row.entrada ?? "00:00")}.`;
  }

  if (stage === "saida_almoco") {
    const saidaAlmoco = shortTime(row.saida_almoco ?? "00:00");
    const worked = minutesBetween(row.entrada, row.saida_almoco);
    if (worked === null) return `Saída almoço registrada às ${saidaAlmoco}.`;
    return `Saída almoço às ${saidaAlmoco}. Jornada até almoço: ${formatDuration(worked)}.`;
  }

  if (stage === "volta_almoco") {
    const voltaAlmoco = shortTime(row.volta_almoco ?? "00:00");
    const breakMinutes = minutesBetween(row.saida_almoco, row.volta_almoco);
    if (breakMinutes === null) return `Volta almoço registrada às ${voltaAlmoco}.`;
    return `Volta almoço às ${voltaAlmoco}. Intervalo: ${formatDuration(breakMinutes)}.`;
  }

  const saidaFinal = shortTime(row.saida_final ?? "00:00");
  const workedDay = workedMinutes(row);
  if (workedDay === null) return `Saída final registrada às ${saidaFinal}.`;
  return `Saída final às ${saidaFinal}. Jornada do dia: ${formatDuration(workedDay)}.`;
}

function minutesBetween(start: string | null, end: string | null) {
  if (!start || !end) return null;
  const s = parseTime(start);
  const e = parseTime(end);
  if (s === null || e === null || e < s) return null;
  return e - s;
}

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hLabel = hours === 1 ? "hora" : "horas";
  const mLabel = minutes === 1 ? "minuto" : "minutos";
  return `${hours} ${hLabel} ${minutes} ${mLabel}`;
}

function confirmationMessage(stage: Stage, row: PontoOnlineRow | null) {
  const now = timeNow();

  if (stage === "entrada") {
    return "Registrar entrada agora?";
  }

  if (stage === "saida_almoco") {
    const worked = minutesBetween(row?.entrada ?? null, now);
    if (worked === null) return "Registrar saída almoço agora?";
    return `Registrar saída almoço agora? Jornada até almoço: ${formatDuration(worked)}.`;
  }

  if (stage === "volta_almoco") {
    const breakMinutes = minutesBetween(row?.saida_almoco ?? null, now);
    if (breakMinutes === null) return "Registrar volta almoço agora?";
    return `Registrar volta almoço agora? Intervalo: ${formatDuration(breakMinutes)}.`;
  }

  const entryToLunch = minutesBetween(row?.entrada ?? null, row?.saida_almoco ?? null);
  const lunchToNow = minutesBetween(row?.volta_almoco ?? null, now);
  if (entryToLunch === null || lunchToNow === null) {
    return "Registrar saída final agora?";
  }
  return `Registrar saída final agora? Jornada do dia: ${formatDuration(entryToLunch + lunchToNow)}.`;
}

function primaryActionAriaLabel(stage: Stage | null) {
  if (!stage) {
    return "Jornada de hoje concluída";
  }
  return STAGE_CONFIG[stage].actionLabel;
}

function displayDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR");
}

function weekdayTitle(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const title = new Date(year, month - 1, day).toLocaleDateString("pt-BR", {
    weekday: "long",
  });
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function shortTime(value: string) {
  return value.slice(0, 5);
}

function isRightOfCurrent(index: number, currentStage: Stage | null) {
  if (!currentStage) return false;
  return index > STAGES.indexOf(currentStage);
}

function splitMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return {
    year,
    month,
  };
}

function mergeMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function firstMonthForYear(
  availableMonths: string[],
  year: number,
  preferredMonth: number,
) {
  const months = availableMonths
    .filter((value) => Number(value.slice(0, 4)) === year)
    .map((value) => Number(value.slice(5, 7)))
    .sort((a, b) => a - b);
  if (months.includes(preferredMonth)) return preferredMonth;
  return months[0] ?? 1;
}

function extractNameFromEmail(email: string | null | undefined) {
  if (!email) return null;
  const [localPart] = email.split("@");
  return localPart || null;
}

function formatPersonName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeEmpregadoForDb(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
