import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type Role = "admin" | "empregada" | null;

type SignInResult = {
  error: string | null;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  role: Role;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

const ROLE_TIMEOUT_MS = 8000;
const AUTH_TIMEOUT_MS = 10000;

function withTimeout<T>(
  promiseLike: PromiseLike<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timeout while loading role"));
    }, timeoutMs);

    Promise.resolve(promiseLike)
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  const loadRole = useCallback(async (userId: string) => {
    try {
      const { data, error } = await withTimeout(
        supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
        ROLE_TIMEOUT_MS,
      );

      if (error) {
        setRole(null);
        return;
      }

      const nextRole = data?.role;
      if (nextRole === "admin" || nextRole === "empregada") {
        setRole(nextRole);
        return;
      }

      setRole(null);
    } catch {
      setRole(null);
    }
  }, []);

  const syncAuthState = useCallback(
    async (nextSession: Session | null) => {
      setSession(nextSession);
      const nextUser = nextSession?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        setRole(null);
        return;
      }

      await loadRole(nextUser.id);
    },
    [loadRole],
  );

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        if (mounted) {
          setLoading(true);
        }
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_TIMEOUT_MS,
        );
        if (!mounted) return;
        await syncAuthState(data.session);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!mounted) return;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        if (!nextSession?.user) {
          setRole(null);
        }
        setLoading(false);
      },
    );

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [syncAuthState]);

  useEffect(() => {
    let active = true;

    const refreshRole = async () => {
      if (!user) {
        setRole(null);
        return;
      }
      await loadRole(user.id);
      if (!active) return;
    };

    refreshRole();

    return () => {
      active = false;
    };
  }, [user, loadRole]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      try {
        setLoading(true);
        const { error } = await withTimeout(
          supabase.auth.signInWithPassword({
            email,
            password,
          }),
          AUTH_TIMEOUT_MS,
        );
        if (error) {
          return { error: error.message };
        }
        return { error: null };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro inesperado no login";
        return { error: message };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      await withTimeout(supabase.auth.signOut(), AUTH_TIMEOUT_MS);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      role,
      loading,
      signIn,
      signOut,
    }),
    [session, user, role, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
