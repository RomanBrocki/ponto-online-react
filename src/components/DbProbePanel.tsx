import { useEffect, useState } from "react";
import { probeRecordsTable, type RecordsProbeResult } from "../lib/recordsProbe";

export default function DbProbePanel() {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<RecordsProbeResult | null>(null);

  useEffect(() => {
    let mounted = true;

    const runProbe = async () => {
      setLoading(true);
      const next = await probeRecordsTable();
      if (!mounted) return;
      setResult(next);
      setLoading(false);
    };

    runProbe();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="panel">
      <h2>Diagnóstico DB</h2>
      {loading ? <p className="muted">Verificando leitura de registros...</p> : null}

      {!loading && result?.ok ? (
        <>
          <p>Tabela acessada: {result.table}</p>
          <p>Registros retornados (até 5): {result.rows.length}</p>
          <p className="muted">
            Se vier 0, a conexão pode estar OK e apenas não existir dado visível para
            este usuário.
          </p>
        </>
      ) : null}

      {!loading && result && !result.ok ? (
        <>
          <p className="error-text">Não foi possível ler registros.</p>
          {result.attempts.map((attempt) => (
            <p className="muted" key={attempt.table}>
              {attempt.table}: {attempt.message}
            </p>
          ))}
          <p className="muted">
            Se o nome da tabela for outro, defina `VITE_SUPABASE_RECORDS_TABLE` no
            `.env`.
          </p>
        </>
      ) : null}
    </section>
  );
}
