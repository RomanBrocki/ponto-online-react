import { supabase } from "./supabase";

export type PontoOnlineRow = {
  id: string;
  data: string;
  empregado: string;
  entrada: string | null;
  saida_almoco: string | null;
  volta_almoco: string | null;
  saida_final: string | null;
  observacao: string | null;
  inserido_em: string | null;
  user_id: string | null;
};

export async function fetchPontoOnlineByMonth(
  empregado: string,
  month: string,
): Promise<{ data: PontoOnlineRow[] | null; error: string | null }> {
  const [yearString, monthString] = month.split("-");
  const year = Number(yearString);
  const monthIndex = Number(monthString) - 1;

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return { data: null, error: "Mes invalido." };
  }

  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);

  const startKey = toDateKey(start);
  const endKey = toDateKey(end);

  const { data, error } = await supabase
    .from("ponto_online")
    .select(
      "id,data,empregado,entrada,saida_almoco,volta_almoco,saida_final,observacao,inserido_em,user_id",
    )
    .eq("empregado", empregado)
    .gte("data", startKey)
    .lte("data", endKey)
    .order("data", { ascending: true });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? []) as PontoOnlineRow[], error: null };
}

export async function fetchPontoOnlineAdminByMonth(
  month: string,
  empregadoFilter: string,
): Promise<{ data: PontoOnlineRow[] | null; error: string | null }> {
  const range = monthRange(month);
  if (!range) {
    return { data: null, error: "Mes invalido." };
  }

  let query = supabase
    .from("ponto_online")
    .select(
      "id,data,empregado,entrada,saida_almoco,volta_almoco,saida_final,observacao,inserido_em,user_id",
    )
    .gte("data", range.startKey)
    .lte("data", range.endKey)
    .order("data", { ascending: true })
    .order("empregado", { ascending: true });

  if (empregadoFilter.trim()) {
    query = query.ilike("empregado", `%${empregadoFilter.trim()}%`);
  }

  const { data, error } = await query;
  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? []) as PontoOnlineRow[], error: null };
}

export async function fetchPontoOnlineByUserMonth(
  userId: string,
  month: string,
): Promise<{ data: PontoOnlineRow[] | null; error: string | null }> {
  const range = monthRange(month);
  if (!range) {
    return { data: null, error: "Mes invalido." };
  }

  const { data, error } = await supabase
    .from("ponto_online")
    .select(
      "id,data,empregado,entrada,saida_almoco,volta_almoco,saida_final,observacao,inserido_em,user_id",
    )
    .eq("user_id", userId)
    .gte("data", range.startKey)
    .lte("data", range.endKey)
    .order("data", { ascending: false });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? []) as PontoOnlineRow[], error: null };
}

export async function fetchPontoOnlineByUserDate(
  userId: string,
  dateKey: string,
): Promise<{ data: PontoOnlineRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("ponto_online")
    .select(
      "id,data,empregado,entrada,saida_almoco,volta_almoco,saida_final,observacao,inserido_em,user_id",
    )
    .eq("user_id", userId)
    .eq("data", dateKey)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data as PontoOnlineRow | null) ?? null, error: null };
}

export async function updatePontoOnlineById(
  id: string,
  payload: Partial<
    Pick<
      PontoOnlineRow,
      "entrada" | "saida_almoco" | "volta_almoco" | "saida_final" | "observacao"
    >
  >,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("ponto_online").update(payload).eq("id", id);
  return { error: error ? error.message : null };
}

export async function deletePontoOnlineById(
  id: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("ponto_online").delete().eq("id", id);
  return { error: error ? error.message : null };
}

export async function upsertPontoOnlineToday(
  params: {
    userId: string;
    empregado: string;
    dateKey: string;
    field: "entrada" | "saida_almoco" | "volta_almoco" | "saida_final";
    value: string;
  },
): Promise<{ error: string | null }> {
  const existing = await fetchPontoOnlineByUserDate(params.userId, params.dateKey);
  if (existing.error) {
    return { error: existing.error };
  }

  if (existing.data) {
    const { error } = await supabase
      .from("ponto_online")
      .update({
        [params.field]: params.value,
      })
      .eq("id", existing.data.id);
    return { error: error ? error.message : null };
  }

  const { error } = await supabase.from("ponto_online").insert({
    data: params.dateKey,
    empregado: params.empregado,
    user_id: params.userId,
    inserido_em: new Date().toISOString(),
    [params.field]: params.value,
  });

  return { error: error ? error.message : null };
}

export async function fetchProfileNameById(
  userId: string,
): Promise<{ nome: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("nome")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { nome: null, error: error.message };
  }

  return { nome: (data?.nome as string | null) ?? null, error: null };
}

export async function fetchAvailableYearMonthsAdmin(
  empregado?: string,
): Promise<{ months: string[]; error: string | null }> {
  let query = supabase.from("ponto_online").select("data,empregado").order("data");
  if (empregado?.trim()) {
    query = query.eq("empregado", empregado.trim());
  }

  const { data, error } = await query;
  if (error) {
    return { months: [], error: error.message };
  }

  const months = new Set<string>();
  (data ?? []).forEach((row) => {
    const date = (row as { data?: string }).data;
    if (date && date.length >= 7) {
      months.add(date.slice(0, 7));
    }
  });

  return { months: Array.from(months).sort(), error: null };
}

export async function fetchAvailableYearMonthsByUser(
  userId: string,
): Promise<{ months: string[]; error: string | null }> {
  const { data, error } = await supabase
    .from("ponto_online")
    .select("data")
    .eq("user_id", userId)
    .order("data");

  if (error) {
    return { months: [], error: error.message };
  }

  const months = new Set<string>();
  (data ?? []).forEach((row) => {
    const date = (row as { data?: string }).data;
    if (date && date.length >= 7) {
      months.add(date.slice(0, 7));
    }
  });

  return { months: Array.from(months).sort(), error: null };
}

function monthRange(month: string) {
  const [yearString, monthString] = month.split("-");
  const year = Number(yearString);
  const monthIndex = Number(monthString) - 1;

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return null;
  }

  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return {
    startKey: toDateKey(start),
    endKey: toDateKey(end),
  };
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
