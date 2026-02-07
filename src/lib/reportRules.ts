import type { PontoOnlineRow } from "./pontoOnline";

const DAILY_TARGET_MINUTES = 8 * 60;

export type DayStatus =
  | "fim_semana"
  | "pendente"
  | "jornada"
  | "feriado"
  | "dispensa_justificada"
  | "falta";

export type DayReportRow = {
  date: string;
  weekday: string;
  status: DayStatus;
  entrada: string | null;
  saida_almoco: string | null;
  volta_almoco: string | null;
  saida_final: string | null;
  observacao: string | null;
  workedMinutes: number | null;
  saldoMinutes: number;
};

export type ReportSummary = {
  faltas: number;
  feriados: number;
  dispensas: number;
  horasExtras: number;
  horasNegativas: number;
  balancoFinal: number;
};

export type ReportValidation = {
  days: DayReportRow[];
  pendingWeekdays: string[];
  summary: ReportSummary;
};

export function buildMonthlyReportValidation(
  rows: PontoOnlineRow[],
  month: string,
): ReportValidation {
  const days = buildMonthDays(month);
  const rowByDate = new Map(rows.map((row) => [row.data, row]));
  const resultDays: DayReportRow[] = [];
  const pendingWeekdays: string[] = [];

  for (const date of days) {
    const row = rowByDate.get(date);
    const weekday = weekdayLabel(date);
    const weekend = isWeekend(date);

    if (weekend) {
      resultDays.push({
        date,
        weekday,
        status: "fim_semana",
        entrada: row?.entrada ?? null,
        saida_almoco: row?.saida_almoco ?? null,
        volta_almoco: row?.volta_almoco ?? null,
        saida_final: row?.saida_final ?? null,
        observacao: row?.observacao ?? null,
        workedMinutes: null,
        saldoMinutes: 0,
      });
      continue;
    }

    if (!row) {
      resultDays.push(emptyPendingDay(date, weekday));
      pendingWeekdays.push(date);
      continue;
    }

    const worked = calculateWorkedMinutes(row);
    const obs = normalizeObservacao(row.observacao);

    if (worked !== null) {
      resultDays.push({
        date,
        weekday,
        status: "jornada",
        entrada: row.entrada,
        saida_almoco: row.saida_almoco,
        volta_almoco: row.volta_almoco,
        saida_final: row.saida_final,
        observacao: row.observacao,
        workedMinutes: worked,
        saldoMinutes: worked - DAILY_TARGET_MINUTES,
      });
      continue;
    }

    if (obs === "feriado") {
      resultDays.push({
        date,
        weekday,
        status: "feriado",
        entrada: row.entrada,
        saida_almoco: row.saida_almoco,
        volta_almoco: row.volta_almoco,
        saida_final: row.saida_final,
        observacao: row.observacao,
        workedMinutes: null,
        saldoMinutes: 0,
      });
      continue;
    }

    if (obs === "dispensa_justificada") {
      resultDays.push({
        date,
        weekday,
        status: "dispensa_justificada",
        entrada: row.entrada,
        saida_almoco: row.saida_almoco,
        volta_almoco: row.volta_almoco,
        saida_final: row.saida_final,
        observacao: row.observacao,
        workedMinutes: null,
        saldoMinutes: 0,
      });
      continue;
    }

    if (obs === "falta") {
      resultDays.push({
        date,
        weekday,
        status: "falta",
        entrada: row.entrada,
        saida_almoco: row.saida_almoco,
        volta_almoco: row.volta_almoco,
        saida_final: row.saida_final,
        observacao: row.observacao,
        workedMinutes: null,
        saldoMinutes: -DAILY_TARGET_MINUTES,
      });
      continue;
    }

    resultDays.push(emptyPendingDay(date, weekday, row));
    pendingWeekdays.push(date);
  }

  return {
    days: resultDays,
    pendingWeekdays,
    summary: buildSummary(resultDays),
  };
}

export function formatMinutes(minutes: number) {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `${sign}${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function statusLabel(status: DayStatus) {
  switch (status) {
    case "fim_semana":
      return "Fim de Semana";
    case "pendente":
      return "Pendente";
    case "jornada":
      return "Jornada";
    case "feriado":
      return "Feriado";
    case "dispensa_justificada":
      return "Dispensa Justificada";
    case "falta":
      return "Falta";
    default:
      return "Pendente";
  }
}

function buildSummary(days: DayReportRow[]): ReportSummary {
  let faltas = 0;
  let feriados = 0;
  let dispensas = 0;
  let horasExtras = 0;
  let horasNegativas = 0;
  let balancoFinal = 0;

  for (const day of days) {
    if (day.status === "falta") faltas += 1;
    if (day.status === "feriado") feriados += 1;
    if (day.status === "dispensa_justificada") dispensas += 1;

    if (day.saldoMinutes > 0) {
      horasExtras += day.saldoMinutes;
    }

    if (day.saldoMinutes < 0) {
      horasNegativas += Math.abs(day.saldoMinutes);
    }

    balancoFinal += day.saldoMinutes;
  }

  return {
    faltas,
    feriados,
    dispensas,
    horasExtras,
    horasNegativas,
    balancoFinal,
  };
}

function emptyPendingDay(
  date: string,
  weekday: string,
  row?: PontoOnlineRow,
): DayReportRow {
  return {
    date,
    weekday,
    status: "pendente",
    entrada: row?.entrada ?? null,
    saida_almoco: row?.saida_almoco ?? null,
    volta_almoco: row?.volta_almoco ?? null,
    saida_final: row?.saida_final ?? null,
    observacao: row?.observacao ?? null,
    workedMinutes: null,
    saldoMinutes: 0,
  };
}

function calculateWorkedMinutes(row: PontoOnlineRow) {
  if (!row.entrada || !row.saida_almoco || !row.volta_almoco || !row.saida_final) {
    return null;
  }

  const entry = parseTimeMinutes(row.entrada);
  const lunchOut = parseTimeMinutes(row.saida_almoco);
  const lunchIn = parseTimeMinutes(row.volta_almoco);
  const finalOut = parseTimeMinutes(row.saida_final);

  if (
    entry === null ||
    lunchOut === null ||
    lunchIn === null ||
    finalOut === null
  ) {
    return null;
  }

  if (lunchOut < entry || lunchIn < lunchOut || finalOut < lunchIn) {
    return null;
  }

  return lunchOut - entry + (finalOut - lunchIn);
}

function parseTimeMinutes(value: string) {
  const [hour, minute] = value.split(":");
  const h = Number(hour);
  const m = Number(minute);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function normalizeObservacao(observacao: string | null) {
  if (!observacao) return null;

  const normalized = observacao
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

  if (normalized === "feriado") return "feriado";
  if (normalized === "dispensa justificada") return "dispensa_justificada";
  if (normalized === "falta") return "falta";
  return null;
}

function isWeekend(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(year, month - 1, day).getDay();
  return weekday === 0 || weekday === 6;
}

function weekdayLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR", {
    weekday: "short",
  });
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
