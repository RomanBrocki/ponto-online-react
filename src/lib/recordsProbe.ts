import { supabase } from "./supabase";

type ProbeOk = {
  ok: true;
  table: string;
  rows: Record<string, unknown>[];
};

type ProbeFail = {
  ok: false;
  attempts: Array<{
    table: string;
    message: string;
  }>;
};

export type RecordsProbeResult = ProbeOk | ProbeFail;

const configuredTable = import.meta.env.VITE_SUPABASE_RECORDS_TABLE as
  | string
  | undefined;

const CANDIDATE_TABLES = [configuredTable, "ponto_online"].filter(
  (value): value is string => Boolean(value),
);

export async function probeRecordsTable(): Promise<RecordsProbeResult> {
  const attempts: ProbeFail["attempts"] = [];

  for (const table of CANDIDATE_TABLES) {
    const { data, error } = await supabase.from(table).select("*").limit(5);

    if (error) {
      attempts.push({
        table,
        message: error.message,
      });
      continue;
    }

    return {
      ok: true,
      table,
      rows: data ?? [],
    };
  }

  return {
    ok: false,
    attempts,
  };
}
