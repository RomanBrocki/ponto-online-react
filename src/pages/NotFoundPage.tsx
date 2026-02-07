import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="page-center">
      <section className="panel">
        <h1>Página não encontrada</h1>
        <p>A rota informada não existe.</p>
        <Link className="link" to="/">
          Voltar ao início
        </Link>
      </section>
    </main>
  );
}
