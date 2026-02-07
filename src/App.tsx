import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

type Role = "admin" | "empregada" | null;

export default function App() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<Role>(null);

  async function carregarRole(uid: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", uid)
      .maybeSingle();

    if (error) {
      setMsg(`Erro ao ler profiles.role: ${error.message}`);
      setRole(null);
      return;
    }

    setRole((data?.role as Role) ?? null);
  }

  async function login() {
    setLoading(true);
    setMsg(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      setMsg(`Login falhou: ${error.message}`);
      setLoading(false);
      return;
    }

    const uid = data.user?.id ?? null;
    setUserId(uid);

    if (uid) await carregarRole(uid);

    setLoading(false);
  }

  async function logout() {
    setLoading(true);
    setMsg(null);
    await supabase.auth.signOut();
    setUserId(null);
    setRole(null);
    setLoading(false);
  }

  useEffect(() => {
    // Carrega sessão existente (se já estiver logado)
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (uid) carregarRole(uid);
    });

    // Atualiza ao logar/deslogar
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (uid) carregarRole(uid);
      else setRole(null);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", fontFamily: "system-ui" }}>
      <h2>Ponto Online – Teste de Auth</h2>

      {!userId ? (
        <>
          <div style={{ display: "grid", gap: 10 }}>
            <label>
              Email
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
                placeholder="seu@email.com"
              />
            </label>

            <label>
              Senha
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                style={{ width: "100%", padding: 8, marginTop: 4 }}
                placeholder="********"
              />
            </label>

            <button
              onClick={login}
              disabled={loading || !email || !senha}
              style={{ padding: 10, cursor: "pointer" }}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </div>

          {msg && <p style={{ marginTop: 16 }}>{msg}</p>}
        </>
      ) : (
        <>
          <p>
            <b>User ID:</b> {userId}
          </p>
          <p>
            <b>Role:</b> {role ?? "(não carregou)"}
          </p>

          <button
            onClick={logout}
            disabled={loading}
            style={{ padding: 10, cursor: "pointer" }}
          >
            {loading ? "Saindo..." : "Sair"}
          </button>

          {msg && <p style={{ marginTop: 16 }}>{msg}</p>}
        </>
      )}
    </div>
  );
}

