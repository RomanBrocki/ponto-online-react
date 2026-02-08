import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function getRolePath(role: "admin" | "empregada" | null) {
  if (role === "admin") return "/admin";
  if (role === "empregada") return "/empregada";
  return "/login";
}

type LoginMode = "sign_in" | "change_password" | "reset_password";

export default function LoginPage() {
  const {
    user,
    role,
    loading,
    signIn,
    requestPasswordReset,
    changePasswordWithCurrent,
  } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<LoginMode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && role) {
      navigate(getRolePath(role), { replace: true });
    }
  }, [loading, navigate, role, user]);

  const resetMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const switchMode = (next: LoginMode) => {
    setMode(next);
    resetMessages();
  };

  const modeTitle =
    mode === "sign_in"
      ? "Ponto Online"
      : mode === "change_password"
        ? "Alterar senha"
        : "Recuperar senha";

  const modeDescription =
    mode === "sign_in"
      ? "Entre com seu email e senha."
      : mode === "change_password"
        ? "Informe email, senha atual e a nova senha."
        : "Informe seu email para receber o link de recuperação.";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    if (!email.trim()) {
      setErrorMessage("Informe seu email.");
      return;
    }

    if (mode === "sign_in") {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        setErrorMessage(error);
      }
      return;
    }

    if (mode === "reset_password") {
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error } = await requestPasswordReset(email.trim(), redirectTo);
      if (error) {
        setErrorMessage(error);
        return;
      }
      setSuccessMessage("Se o email existir, enviamos um link para redefinir a senha.");
      return;
    }

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setErrorMessage("Preencha senha antiga, nova senha e confirmação.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMessage("A confirmação da nova senha não confere.");
      return;
    }

    const { error } = await changePasswordWithCurrent(
      email.trim(),
      currentPassword,
      newPassword,
    );

    if (error) {
      setErrorMessage(error);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setPassword("");
    setSuccessMessage("Senha alterada com sucesso. Faça login com a nova senha.");
    setMode("sign_in");
  };

  return (
    <main className="page-center">
      <section className="panel auth-panel">
        <h1>{modeTitle}</h1>
        <p className="muted">{modeDescription}</p>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          {mode === "sign_in" ? (
            <>
              <label htmlFor="password">Senha</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </>
          ) : null}

          {mode === "change_password" ? (
            <>
              <label htmlFor="current-password">Senha atual</label>
              <input
                id="current-password"
                name="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />

              <label htmlFor="new-password">Nova senha</label>
              <input
                id="new-password"
                name="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />

              <label htmlFor="confirm-new-password">Confirmar nova senha</label>
              <input
                id="confirm-new-password"
                name="confirm-new-password"
                type="password"
                autoComplete="new-password"
                value={confirmNewPassword}
                onChange={(event) => setConfirmNewPassword(event.target.value)}
                required
              />
            </>
          ) : null}

          <button type="submit" disabled={loading}>
            {loading
              ? "Processando..."
              : mode === "sign_in"
                ? "Entrar"
                : mode === "change_password"
                  ? "Atualizar senha"
                  : "Enviar link"}
          </button>

          <div className="auth-mode-links">
            {mode !== "change_password" ? (
              <button
                type="button"
                className="auth-text-link"
                onClick={() => switchMode("change_password")}
              >
                Alterar senha
              </button>
            ) : null}

            {mode !== "reset_password" ? (
              <button
                type="button"
                className="auth-text-link"
                onClick={() => switchMode("reset_password")}
              >
                Esqueci minha senha
              </button>
            ) : null}

            {mode !== "sign_in" ? (
              <button
                type="button"
                className="auth-text-link"
                onClick={() => switchMode("sign_in")}
              >
                Voltar para entrar
              </button>
            ) : null}
          </div>
        </form>

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        {successMessage ? <p className="success-text">{successMessage}</p> : null}
      </section>
    </main>
  );
}
