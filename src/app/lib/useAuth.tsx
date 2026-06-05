/**
 * Auth context for MarketPlan multi-tenant system.
 *
 * - Supabase Auth for signup/login
 * - Workspace isolation (each owner has their own data namespace)
 * - Team members share owner's workspace
 * - Role-based access control
 * - Auto-migration of legacy mp: data to mp:ws:{workspaceId}: namespace
 */
import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { setAuthToken } from "./api";
import { clearKVCache } from "./useKV";
import { toast } from "sonner";

const SUPABASE_URL = `https://${projectId}.supabase.co`;
const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-b80b3260`;

// Singleton Supabase client
export const supabase = createClient(SUPABASE_URL, publicAnonKey);

/* ========== TYPES ========== */
export type UserRole = "owner" | "editor" | "viewer";

export interface TeamMember {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  access: string[] | "all";
  invitedAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  workspaceId: string;
  access: string[] | "all";
  avatarInitials: string;
}

export interface AuthState {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
  accessToken: string | null;
}

interface AuthContextValue extends AuthState {
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasAccess: (path: string) => boolean;
  isOwner: boolean;
}

// Persist context across HMR - prevents "useAuth must be used within AuthProvider" errors
// during hot module replacement when the context reference gets recreated
const AUTH_CTX_KEY = "__MARKETPLAN_AUTH_CTX__";
const AuthContext: React.Context<AuthContextValue | null> =
  (globalThis as any)[AUTH_CTX_KEY] ||
  ((globalThis as any)[AUTH_CTX_KEY] = createContext<AuthContextValue | null>(null));

/* ========== HELPERS ========== */
function getInitials(name: string, email: string): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

/** Decode the JWT exp claim without verifying signature. Returns ms timestamp. */
function jwtExpiresAt(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return (payload.exp || 0) * 1000;
  } catch {
    return 0;
  }
}

/** True if the token has expired or will expire within `bufferMs` (default 2 min). */
function isTokenStale(token: string, bufferMs = 120_000): boolean {
  const exp = jwtExpiresAt(token);
  return exp === 0 || exp < Date.now() + bufferMs;
}

async function serverFetch(path: string, token: string, opts?: RequestInit) {
  const maxRetries = 3;
  let delayMs = 2000;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const url = `${BASE_URL}${path}`;
      
      const res = await fetch(url, {
        ...opts,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(opts?.headers || {}),
        },
      });
      
      if (!res.ok) {
        const text = await res.text();
        // 4xx errors are permanent - never retry (retrying won't fix auth/client errors)
        if (res.status >= 400 && res.status < 500) {
          // Use debug level for 401 - callers handle auth errors gracefully
          if (res.status === 401) {
            console.debug(`[serverFetch] HTTP 401 for ${path} (not retrying):`, text);
          } else {
            console.warn(`[serverFetch] HTTP ${res.status} for ${path} (not retrying):`, text);
          }
          throw Object.assign(new Error(`HTTP ${res.status}: ${text}`), { permanent: true, statusCode: res.status });
        }
        console.error(`[serverFetch] HTTP ${res.status} for ${path}:`, text);
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      
      const json = await res.json();
      return json;
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : String(err);
      
      // Never retry permanent 4xx errors
      if (err.permanent) throw err;
      
      // Only log if it's not a network/fetch error on first attempts (cold start is expected)
      if (attempt === 0 && errMsg.includes("Failed to fetch")) {
        console.log(`[serverFetch] Server cold start for ${path}, warming up...`);
      } else {
        console.error(`[serverFetch] Attempt ${attempt + 1}/${maxRetries} failed for ${path}:`, errMsg);
      }
      
      if (attempt === maxRetries - 1) {
        // Last attempt failed - this is expected on first load (cold start)
        // Return a graceful fallback instead of throwing
        console.warn(`[serverFetch] All retries exhausted for ${path}. Using fallback. Error: ${errMsg}`);
        throw err;
      }
      
      console.log(`[serverFetch] Retrying in ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs *= 1.5;
    }
  }
  throw new Error("serverFetch: unreachable");
}

/**
 * Auto-migration: on first login, copies legacy mp:{key} data
 * to the workspace-scoped mp:ws:{workspaceId}:{key} namespace.
 * Runs once in background, idempotent (server checks flag).
 */
let _migrationTriggered = false;
async function triggerMigration(token: string) {
  if (_migrationTriggered) return;
  _migrationTriggered = true;

  try {
    // First check status to avoid unnecessary POST
    const statusJson = await serverFetch("/auth/migration-status", token).catch(err => {
      console.warn("[Migration] Status check failed (non-critical):", err);
      return { success: false };
    });
    
    if (statusJson.success && statusJson.data?.migrated) {
      console.log("[Migration] Already migrated:", statusJson.data.details);
      return;
    }

    // Run migration
    console.log("[Migration] Starting legacy data migration...");
    const migrateJson = await serverFetch("/auth/migrate", token, { method: "POST" }).catch(err => {
      console.error("[Migration] Migration failed:", err);
      return { success: false, error: String(err) };
    });
    
    if (migrateJson.success) {
      const d = migrateJson.data;
      if (d.alreadyMigrated) {
        console.log("[Migration] Already migrated (confirmed by server)");
      } else {
        console.log(`[Migration] Complete: ${d.migrated} keys migrated, ${d.skipped} skipped out of ${d.totalLegacyKeys} total`);
        // Clear SWR cache so fresh workspace data is loaded
        clearKVCache();
      }
    } else {
      console.error("[Migration] Failed:", migrateJson.error);
    }
  } catch (err) {
    console.error("[Migration] Error:", err);
  }
}

/* ========== PROVIDER ========== */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    accessToken: null,
  });

  const loadProfile = useCallback(async (session: Session) => {
    let token = session.access_token;
    let activeSession = session;

    // Ensure we have a valid session
    if (!session || !token) {
      console.warn("[Auth] loadProfile called with invalid session");
      setState(s => ({ ...s, loading: false }));
      return;
    }

    // Proactively refresh if the token is expired or expiring within 2 minutes.
    // This prevents a certain 401 from the server when loading with a stale cached token.
    if (isTokenStale(token)) {
      try {
        console.debug("[Auth] Token is stale, refreshing before /auth/me call");
        const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
        if (!refreshErr && refreshed.session?.access_token) {
          token = refreshed.session.access_token;
          activeSession = refreshed.session;
          console.debug("[Auth] Token refreshed successfully");
        } else {
          console.debug("[Auth] Proactive refresh failed:", refreshErr?.message);
        }
      } catch {
        // Use the original token and let the server decide
      }
    }

    // Helper: call /auth/me and return profile data or null
    const tryFetchProfile = async (t: string) => {
      const json = await serverFetch("/auth/me", t);
      if (json.success && json.data) return json.data;
      return null;
    };

    // --- Attempt: call /auth/me with the (possibly refreshed) token ---
    try {
      const p = await tryFetchProfile(token);
      if (p) {
        setState({
          user: {
            id: p.id,
            email: p.email,
            name: p.name || "",
            role: p.role || "owner",
            workspaceId: p.workspaceId || p.id,
            access: p.access || "all",
            avatarInitials: getInitials(p.name || "", p.email),
          },
          session: activeSession,
          loading: false,
          accessToken: token,
        });
        triggerMigration(token).catch(err => {
          console.warn("[Auth] Background migration failed (non-critical):", err);
        });
        return;
      }
    } catch (err: any) {
      if (err?.statusCode === 401) {
        // Token was refreshed but server still returns 401 - likely a server-side config issue.
        // Try one more explicit refresh as a last resort.
        try {
          const { data: retry, error: retryErr } = await supabase.auth.refreshSession();
          if (!retryErr && retry.session?.access_token) {
            token = retry.session.access_token;
            activeSession = retry.session;
            const p2 = await tryFetchProfile(token).catch(() => null);
            if (p2) {
              setState({
                user: {
                  id: p2.id,
                  email: p2.email,
                  name: p2.name || "",
                  role: p2.role || "owner",
                  workspaceId: p2.workspaceId || p2.id,
                  access: p2.access || "all",
                  avatarInitials: getInitials(p2.name || "", p2.email),
                },
                session: activeSession,
                loading: false,
                accessToken: token,
              });
              triggerMigration(token).catch(() => {});
              return;
            }
          }
        } catch {
          // Fall through to session fallback
        }
        console.debug("[Auth] /auth/me 401 after refresh - using session fallback");
      } else {
        console.warn("[Auth] loadProfile fetch failed (cold start?), using fallback:", err);
      }
    }
    
    // Fallback: build profile from session data.
    // Set accessToken: null so api.ts uses the anon-key /data/ route
    // instead of /ws/data/ with a rejected token (which would cause KV saves to fail).
    const u = activeSession.user;
    if (!u) {
      console.error("[Auth] No user in session, cannot create fallback profile");
      setState(s => ({ ...s, loading: false }));
      return;
    }
    
    console.info("[Auth] Using session-only fallback profile (ws/ data temporarily unavailable)");
    setState({
      user: {
        id: u.id,
        email: u.email || "",
        name: u.user_metadata?.name || "",
        role: "owner",
        workspaceId: u.id,
        access: "all",
        avatarInitials: getInitials(u.user_metadata?.name || "", u.email || ""),
      },
      session: activeSession,
      loading: false,
      // null: prevents saveData from using /ws/data/ with a bad token
      accessToken: null,
    });
  }, []);

  // Initialize auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // Invalid refresh token - clear stale session and start fresh
        console.warn("[Auth] getSession error (stale token?), signing out locally:", error.message);
        supabase.auth.signOut({ scope: "local" }).catch(() => {});
        setState(s => ({ ...s, loading: false }));
        return;
      }
      if (session) {
        loadProfile(session);
      } else {
        setState(s => ({ ...s, loading: false }));
      }
    }).catch((err) => {
      console.error("[Auth] getSession unexpected error:", err);
      setState(s => ({ ...s, loading: false }));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" && !session) {
        // Refresh failed - force local sign-out
        console.warn("[Auth] Token refresh failed, signing out locally");
        supabase.auth.signOut({ scope: "local" }).catch(() => {});
        setState({ user: null, session: null, loading: false, accessToken: null });
        clearKVCache();
        return;
      }
      if (event === "SIGNED_OUT") {
        setState({ user: null, session: null, loading: false, accessToken: null });
        return;
      }
      if (session) {
        loadProfile(session);
      } else {
        setState({ user: null, session: null, loading: false, accessToken: null });
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  // Sync auth token with api.ts
  useEffect(() => {
    setAuthToken(state.accessToken);
  }, [state.accessToken]);

  // signUp creates the user and immediately signs in.
  const signUp = useCallback(async (email: string, password: string, name: string): Promise<void> => {
    const json = await serverFetch("/auth/signup", publicAnonKey, {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    if (!json.success) throw new Error(json.error || "Sign up failed");

    // User created - now sign in immediately
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.session) await loadProfile(data.session);
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.session) await loadProfile(data.session);
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    // Use scope: "local" so sign-out always succeeds even if the
    // refresh token is already invalid on the server.
    await supabase.auth.signOut({ scope: "local" }).catch((err) => {
      console.warn("[Auth] signOut error (ignored):", err);
    });
    setState({ user: null, session: null, loading: false, accessToken: null });
    clearKVCache();
    _migrationTriggered = false; // Reset for next login
  }, []);

  const refreshProfile = useCallback(async () => {
    if (state.session) await loadProfile(state.session);
  }, [state.session, loadProfile]);

  const hasAccess = useCallback((path: string) => {
    if (!state.user) return false;
    if (state.user.role === "owner") return true;
    if (state.user.access === "all") return true;
    return state.user.access.some(a => path === a || path.startsWith(a + "/"));
  }, [state.user]);

  return (
    <AuthContext.Provider value={{
      ...state,
      signUp,
      signIn,
      signOut,
      refreshProfile,
      hasAccess,
      isOwner: state.user?.role === "owner",
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}