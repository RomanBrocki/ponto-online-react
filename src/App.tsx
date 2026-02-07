import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import { AuthProvider, useAuth, type Role } from "./auth/AuthContext";
import AdminPage from "./pages/AdminPage";
import EmpregadaPage from "./pages/EmpregadaPage";
import LoadingPage from "./pages/LoadingPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";

function getRolePath(role: Role) {
  if (role === "admin") return "/admin";
  if (role === "empregada") return "/empregada";
  return "/login";
}

type ProtectedRouteProps = {
  allowedRoles?: Array<Exclude<Role, null>>;
};

function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!role) {
    if (loading) {
      return <LoadingPage />;
    }
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={getRolePath(role)} replace />;
  }

  return <Outlet />;
}

function RootRedirect() {
  const { user, role, loading } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return <LoadingPage />;
  }

  return <Navigate to={getRolePath(role)} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={["empregada"]} />}>
        <Route path="/empregada" element={<EmpregadaPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <div className="theme-gunmetal app-root">
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <AppRoutes />
        </BrowserRouter>
      </div>
    </AuthProvider>
  );
}
