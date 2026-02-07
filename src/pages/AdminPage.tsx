import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import DbProbePanel from "../components/DbProbePanel";
import Modal from "../components/Modal";
import {
  deletePontoOnlineById,
  fetchAvailableYearMonthsAdmin,
  fetchPontoOnlineAdminByMonth,
  updatePontoOnlineById,
  type PontoOnlineRow,
} from "../lib/pontoOnline";
import {
  buildMonthlyReportValidation,
  formatMinutes,
  statusLabel,
  type ReportValidation,
} from "../lib/reportRules";
import { generateMonthlyPdfReport } from "../lib/pdfReport";

type AdminDraft = {
  entrada: string;
  saida_almoco: string;
  volta_almoco: string;
  saida_final: string;
  observacao: string;
};

type AdminGridRow = PontoOnlineRow & {
  virtualWeekend?: boolean;
};

type ModalState = {
  title: string;
  message: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
};

type AdminViewMode = "records" | "report";

const OBS_OPTIONS = ["", "Feriado", "Dispensa Justificada", "Falta"];

export default function AdminPage() {
  const { signOut, loading, user, role } = useAuth();
  const [month, setMonth] = useState(currentMonthKey());
  const [selectedEmpregada, setSelectedEmpregada] = useState("");

  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [allRecords, setAllRecords] = useState<PontoOnlineRow[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, AdminDraft>>({});

  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<ReportValidation | null>(null);
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [showEditList, setShowEditList] = useState(true);
  const [showReportPreview, setShowReportPreview] = useState(true);
  const [viewMode, setViewMode] = useState<AdminViewMode>("records");
  const monthParts = splitMonth(month);

  const uniqueEmpregadas = useMemo(() => {
    const byKey = new Map<string, string>();

    allRecords.forEach((row) => {
      const key = normalizeEmpregadaKey(row.empregado);
      if (!key) return;
      if (!byKey.has(key)) {
        byKey.set(key, formatPersonName(row.empregado));
      }
    });

    return Array.from(byKey.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allRecords]);

  useEffect(() => {
    if (uniqueEmpregadas.length === 1) {
      setSelectedEmpregada(uniqueEmpregadas[0].key);
      return;
    }
    if (selectedEmpregada && !uniqueEmpregadas.some((item) => item.key === selectedEmpregada)) {
      setSelectedEmpregada("");
    }
  }, [uniqueEmpregadas, selectedEmpregada]);

  useEffect(() => {
    const loadAvailableMonths = async () => {
      const { months, error } = await fetchAvailableYearMonthsAdmin();
      if (error) {
        setRecordsError(error);
        return;
      }

      if (months.length === 0) {
        setAvailableMonths([currentMonthKey()]);
        return;
      }

      setAvailableMonths(months);
      if (!months.includes(month)) {
        setMonth(months[months.length - 1]);
      }
    };

    void loadAvailableMonths();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleRecords = useMemo(() => {
    if (!selectedEmpregada) {
      return [...allRecords].sort((a, b) => b.data.localeCompare(a.data)) as AdminGridRow[];
    }

    const selectedRows = allRecords.filter(
      (row) => normalizeEmpregadaKey(row.empregado) === selectedEmpregada,
    );
    const byDate = new Map(selectedRows.map((row) => [row.data, row]));
    const todayKey = currentDateKey();
    const weekends = buildMonthDays(month)
      .filter(isWeekendDate)
      .filter((date) => date <= todayKey)
      .filter((date) => !byDate.has(date))
      .map<AdminGridRow>((date) => ({
        id: `virtual-weekend-${selectedEmpregada}-${date}`,
        data: date,
        empregado: selectedEmpregadaLabel(selectedEmpregada, uniqueEmpregadas),
        entrada: null,
        saida_almoco: null,
        volta_almoco: null,
        saida_final: null,
        observacao: "Fim de Semana",
        inserido_em: null,
        user_id: null,
        virtualWeekend: true,
      }));

    return [...selectedRows, ...weekends].sort((a, b) => b.data.localeCompare(a.data));
  }, [allRecords, selectedEmpregada, month, uniqueEmpregadas]);

  const pendingPreview = useMemo(() => {
    if (!report?.pendingWeekdays.length) return [];
    return report.pendingWeekdays.slice(0, 8);
  }, [report]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    availableMonths.forEach((monthKey) => years.add(Number(monthKey.slice(0, 4))));
    return Array.from(years).sort((a, b) => a - b);
  }, [availableMonths]);

  const monthOptions = useMemo(() => {
    const monthsFromYear = availableMonths
      .filter((value) => Number(value.slice(0, 4)) === monthParts.year)
      .map((value) => Number(value.slice(5, 7)));
    return MONTH_OPTIONS.filter((option) => monthsFromYear.includes(option.value));
  }, [availableMonths, monthParts.year]);

  useEffect(() => {
    if (!yearOptions.includes(monthParts.year)) {
      const fallbackYear = yearOptions[yearOptions.length - 1];
      if (fallbackYear) {
        const fallbackMonth = availableMonths
          .filter((value) => Number(value.slice(0, 4)) === fallbackYear)
          .map((value) => Number(value.slice(5, 7)))
          .sort((a, b) => a - b)[0];
        if (fallbackMonth) {
          setMonth(mergeMonth(fallbackYear, fallbackMonth));
        }
      }
    }
  }, [yearOptions, monthParts.year, availableMonths]);

  const handleLoadRecords = async () => {
    setRecordsLoading(true);
    setRecordsError(null);

    const { data, error } = await fetchPontoOnlineAdminByMonth(month, "");
    setRecordsLoading(false);

    if (error || !data) {
      setAllRecords([]);
      setRecordsError(error ?? "Falha ao consultar registros.");
      return;
    }

    setAllRecords(data);
    setDrafts(createDrafts(data));
  };

  useEffect(() => {
    void handleLoadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const handleDraftChange = (
    id: string,
    field: keyof AdminDraft,
    value: string,
  ) => {
    setDrafts((previous) => ({
      ...previous,
      [id]: {
        ...previous[id],
        [field]: value,
      },
    }));
  };

  const handleSaveRow = async (row: PontoOnlineRow) => {
    if ((row as AdminGridRow).virtualWeekend) return;
    const draft = drafts[row.id];
    if (!draft) return;

    const { error } = await updatePontoOnlineById(row.id, {
      entrada: draft.entrada || null,
      saida_almoco: draft.saida_almoco || null,
      volta_almoco: draft.volta_almoco || null,
      saida_final: draft.saida_final || null,
      observacao: draft.observacao || null,
    });

    if (error) {
      setModalState({
        title: "Falha ao salvar",
        message: error,
      });
      return;
    }

    setModalState({
      title: "Registro atualizado",
      message: `Linha ${row.data} - ${row.empregado} salva com sucesso.`,
    });
    await handleLoadRecords();
  };

  const askDeleteRow = (row: PontoOnlineRow) => {
    if ((row as AdminGridRow).virtualWeekend) return;
    setModalState({
      title: "Apagar registro",
      message: `Confirma apagar a linha de ${row.data} (${row.empregado})? Essa ação remove o registro do dia.`,
      confirmLabel: "Apagar",
      cancelLabel: "Cancelar",
      onConfirm: () => {
        void handleDeleteRow(row.id);
      },
    });
  };

  const handleDeleteRow = async (id: string) => {
    setModalState(null);
    const { error } = await deletePontoOnlineById(id);
    if (error) {
      setModalState({
        title: "Falha ao apagar",
        message: error,
      });
      return;
    }

    setModalState({
      title: "Registro apagado",
      message: "A linha foi removida com sucesso.",
    });
    await handleLoadRecords();
  };

  const handleGenerateReport = async () => {
    const empregadoValue =
      selectedEmpregada || (uniqueEmpregadas.length === 1 ? uniqueEmpregadas[0].key : "");
    const empregadoLabel =
      selectedEmpregadaLabel(empregadoValue, uniqueEmpregadas) || "Empregada";

    if (!empregadoValue) {
      setModalState({
        title: "Campo obrigatório",
        message: "Selecione uma empregada para gerar o relatório.",
      });
      return;
    }

    setReportLoading(true);
    const data = allRecords.filter(
      (row) => normalizeEmpregadaKey(row.empregado) === empregadoValue,
    );
    setReportLoading(false);

    const validation = buildMonthlyReportValidation(data, month);
    setReport(validation);
    setShowReportPreview(true);

    if (validation.pendingWeekdays.length > 0) {
      setModalState({
        title: "Relatório bloqueado",
        message:
          "Existem dias úteis sem jornada completa e sem validação do admin. Preencha os horários ou marque Feriado, Dispensa Justificada ou Falta.",
        details: validation.pendingWeekdays.map(
          (day) => `${day} - pendente de preenchimento/validação`,
        ),
      });
      return;
    }

    try {
      generateMonthlyPdfReport({
        report: validation,
        month,
        empregada: empregadoLabel,
      });
      setModalState({
        title: "Relatório gerado",
        message: "O download do PDF foi iniciado com sucesso.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao gerar PDF.";
      setModalState({
        title: "Falha ao gerar relatório",
        message,
      });
    }
  };

  return (
    <main className="page">
      <header className="panel page-header">
        <h1>Painel Admin</h1>
        <p className="muted">Visualização geral e manutenção de registros.</p>
        <p>Usuário: {user?.email ?? user?.id ?? "sem usuário"}</p>
        <p>Perfil: {role ?? "sem role"}</p>
      </header>

      <section className="panel">
        <h2>Ações</h2>
        <div className="form-grid report-grid">
          <button
            type="button"
            className={viewMode === "records" ? "" : "button-muted"}
            onClick={() => setViewMode("records")}
          >
            Editar/Consultar registros
          </button>
          <button
            type="button"
            className={viewMode === "report" ? "" : "button-muted"}
            onClick={() => setViewMode("report")}
          >
            Relatórios
          </button>
        </div>
      </section>

      {viewMode === "records" ? (
        <section className="panel">
          <h2>Registros do mês</h2>
          <button
            type="button"
            className="button-muted"
            onClick={() => setShowEditList((previous) => !previous)}
          >
            {showEditList ? "Ocultar listagem" : "Mostrar listagem"}
          </button>
          <div className="form-grid report-grid">
            <label htmlFor="ano-admin">Ano</label>
            <select
              id="ano-admin"
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

            <label htmlFor="mes-admin">Mês</label>
            <select
              id="mes-admin"
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

            <label htmlFor="empregada-select">Empregada</label>
            <select
              id="empregada-select"
              value={selectedEmpregada}
              onChange={(event) => setSelectedEmpregada(event.target.value)}
              disabled={uniqueEmpregadas.length <= 1}
            >
              {uniqueEmpregadas.length > 1 ? <option value="">Todas</option> : null}
              {uniqueEmpregadas.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>

            <button type="button" onClick={() => void handleLoadRecords()} disabled={recordsLoading}>
              {recordsLoading ? "Carregando..." : "Atualizar lista"}
            </button>
          </div>

          {recordsError ? <p className="error-text">{recordsError}</p> : null}
          <p className="muted">Registros carregados: {visibleRecords.length}</p>

          {showEditList ? (
            <div className="report-table-wrap admin-table-wrap">
              <table className="report-table admin-table stack-mobile">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Empregada</th>
                    <th>Entrada</th>
                    <th>Saída almoço</th>
                    <th>Volta almoço</th>
                    <th>Saída final</th>
                    <th>Observação</th>
                    <th>Salvar</th>
                    <th>Apagar</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.map((row) => {
                    const draft = drafts[row.id];
                    const weekend = isWeekendDate(row.data);
                    return (
                      <tr key={row.id}>
                        <td data-label="Data">{row.data}</td>
                        <td data-label="Empregada">{row.empregado}</td>
                        <td data-label="Entrada">
                          <input
                            type="time"
                            value={draft?.entrada ?? ""}
                            disabled={isVirtualWeekendRow(row)}
                            onChange={(event) =>
                              handleDraftChange(row.id, "entrada", event.target.value)
                            }
                          />
                        </td>
                        <td data-label="Saída almoço">
                          <input
                            type="time"
                            value={draft?.saida_almoco ?? ""}
                            disabled={isVirtualWeekendRow(row)}
                            onChange={(event) =>
                              handleDraftChange(row.id, "saida_almoco", event.target.value)
                            }
                          />
                        </td>
                        <td data-label="Volta almoço">
                          <input
                            type="time"
                            value={draft?.volta_almoco ?? ""}
                            disabled={isVirtualWeekendRow(row)}
                            onChange={(event) =>
                              handleDraftChange(row.id, "volta_almoco", event.target.value)
                            }
                          />
                        </td>
                        <td data-label="Saída final">
                          <input
                            type="time"
                            value={draft?.saida_final ?? ""}
                            disabled={isVirtualWeekendRow(row)}
                            onChange={(event) =>
                              handleDraftChange(row.id, "saida_final", event.target.value)
                            }
                          />
                        </td>
                        <td data-label="Observação">
                          {weekend ? (
                            <span className="muted">Fim de Semana (visual)</span>
                          ) : (
                            <select
                              value={draft?.observacao ?? ""}
                              onChange={(event) =>
                                handleDraftChange(row.id, "observacao", event.target.value)
                              }
                            >
                              {OBS_OPTIONS.map((option) => (
                                <option key={option || "vazio"} value={option}>
                                  {option || "-"}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td data-label="Salvar">
                          <button
                            type="button"
                            onClick={() => void handleSaveRow(row)}
                            disabled={isVirtualWeekendRow(row)}
                          >
                            Salvar
                          </button>
                        </td>
                        <td data-label="Apagar">
                          <button
                            type="button"
                            className="button-danger"
                            disabled={isVirtualWeekendRow(row)}
                            onClick={() => askDeleteRow(row)}
                          >
                            Apagar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {viewMode === "report" ? (
        <section className="panel">
          <h2>Relatório mensal</h2>
          <p className="muted">
            Validação obrigatória de dias úteis antes da geração do PDF.
          </p>
          <div className="form-grid report-grid">
            <label htmlFor="ano-report">Ano</label>
            <select
              id="ano-report"
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

            <label htmlFor="mes-report">Mês</label>
            <select
              id="mes-report"
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

            <label htmlFor="empregado-report">Empregada para relatório</label>
            <select
              id="empregado-report"
              value={selectedEmpregada}
              onChange={(event) => setSelectedEmpregada(event.target.value)}
              disabled={uniqueEmpregadas.length <= 1}
            >
              {uniqueEmpregadas.length > 1 ? (
                <option value="">Selecione uma empregada</option>
              ) : null}
              {uniqueEmpregadas.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleGenerateReport()}
              disabled={reportLoading}
            >
              {reportLoading ? "Validando..." : "Gerar relatório"}
            </button>
          </div>
        </section>
      ) : null}

      {report && viewMode === "report" ? (
        <section className="panel">
          <h2>Prévia do relatório</h2>
          <button
            type="button"
            className="button-muted"
            onClick={() => setShowReportPreview((previous) => !previous)}
          >
            {showReportPreview ? "Ocultar prévia" : "Mostrar prévia"}
          </button>
          <p>
            Pendências de validação: {report.pendingWeekdays.length}
            {pendingPreview.length > 0 ? ` (ex.: ${pendingPreview.join(", ")})` : ""}
          </p>
          {showReportPreview ? (
            <div className="report-table-wrap admin-table-wrap">
              <table className="report-table stack-mobile">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Dia</th>
                    <th>Status</th>
                    <th>Entrada</th>
                    <th>Saída almoço</th>
                    <th>Volta almoço</th>
                    <th>Saída final</th>
                    <th>Observação</th>
                    <th>Horas dia</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {report.days.map((day) => (
                    <tr key={day.date}>
                      <td data-label="Data">{day.date}</td>
                      <td data-label="Dia">{day.weekday}</td>
                      <td data-label="Status">{statusLabel(day.status)}</td>
                      <td data-label="Entrada">{day.entrada ?? "-"}</td>
                      <td data-label="Saída almoço">{day.saida_almoco ?? "-"}</td>
                      <td data-label="Volta almoço">{day.volta_almoco ?? "-"}</td>
                      <td data-label="Saída final">{day.saida_final ?? "-"}</td>
                      <td data-label="Observação">
                        {day.status === "fim_semana"
                          ? "Fim de Semana"
                          : (day.observacao ?? "-")}
                      </td>
                      <td data-label="Horas dia">
                        {day.workedMinutes === null ? "-" : formatMinutes(day.workedMinutes)}
                      </td>
                      <td data-label="Saldo">{formatMinutes(day.saldoMinutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {report && viewMode === "report" ? (
        <section className="panel">
          <h2>Resumo mensal</h2>
          <p>Faltas: {report.summary.faltas}</p>
          <p>Feriados: {report.summary.feriados}</p>
          <p>Dispensas justificadas: {report.summary.dispensas}</p>
          <p>Horas extras: {formatMinutes(report.summary.horasExtras)}</p>
          <p>Horas negativas: {formatMinutes(report.summary.horasNegativas)}</p>
          <p>Balanço final: {formatMinutes(report.summary.balancoFinal)}</p>
        </section>
      ) : null}

      <DbProbePanel />

      <section className="panel">
        <button
          type="button"
          className="button-danger button-full"
          onClick={signOut}
          disabled={loading}
        >
          {loading ? "Saindo..." : "Sair"}
        </button>
      </section>

      {modalState ? (
        <Modal
          title={modalState.title}
          message={modalState.message}
          details={modalState.details}
          onConfirm={modalState.onConfirm}
          confirmLabel={modalState.confirmLabel}
          cancelLabel={modalState.cancelLabel}
          onClose={() => setModalState(null)}
        />
      ) : null}
    </main>
  );
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function currentDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function createDrafts(rows: PontoOnlineRow[]) {
  return rows.reduce<Record<string, AdminDraft>>((acc, row) => {
    acc[row.id] = {
      entrada: row.entrada ?? "",
      saida_almoco: row.saida_almoco ?? "",
      volta_almoco: row.volta_almoco ?? "",
      saida_final: row.saida_final ?? "",
      observacao: normalizeObservacaoToOption(row.observacao),
    };
    return acc;
  }, {});
}

function normalizeObservacaoToOption(observacao: string | null) {
  if (!observacao) return "";
  const normalized = observacao
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

  if (normalized === "feriado") return "Feriado";
  if (normalized === "dispensa justificada") return "Dispensa Justificada";
  if (normalized === "falta") return "Falta";
  return observacao;
}

function buildMonthDays(month: string) {
  const [yearString, monthString] = month.split("-");
  const year = Number(yearString);
  const monthIndex = Number(monthString) - 1;
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();

  const days: string[] = [];
  for (let day = 1; day <= totalDays; day += 1) {
    days.push(
      `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    );
  }
  return days;
}

function isWeekendDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekday = new Date(year, month - 1, day).getDay();
  return weekday === 0 || weekday === 6;
}

function isVirtualWeekendRow(row: PontoOnlineRow | AdminGridRow) {
  return Boolean((row as AdminGridRow).virtualWeekend);
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

function normalizeEmpregadaKey(value: string | null | undefined) {
  if (!value) return "";
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function formatPersonName(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function selectedEmpregadaLabel(
  key: string,
  options: Array<{ key: string; label: string }>,
) {
  return options.find((item) => item.key === key)?.label ?? key;
}
