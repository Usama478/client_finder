import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { api, setToken, clearToken } from "./api"

const THEME_KEY = "cf_theme"

interface User {
  user_id: number
  name: string
  email: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  theme: "dark" | "light"
  toggleTheme: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem(THEME_KEY) as "dark" | "light") || "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
    } else {
      root.classList.remove("light");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t: "dark" | "light") => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_KEY, next);
      const root = document.documentElement;
      if (next === "light") {
        root.classList.add("light");
      } else {
        root.classList.remove("light");
      }
      return next;
    });
  };

  useEffect(() => {
    const stored = localStorage.getItem("cf_user")
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch {}
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password)
    setToken(res.access_token)
    const u = { user_id: res.user_id, name: res.name, email: res.email }
    setUser(u)
    localStorage.setItem("cf_user", JSON.stringify(u))
  }

  const signup = async (name: string, email: string, password: string) => {
    const res = await api.signup(name, email, password)
    setToken(res.access_token)
    const u = { user_id: res.user_id, name: res.name, email: res.email }
    setUser(u)
    localStorage.setItem("cf_user", JSON.stringify(u))
  }

  const logout = () => {
    clearToken()
    setUser(null)
    window.location.href = "/auth/login"
  }

  const refreshUser = async () => {
    try {
      const u = await api.me()
      setUser(u)
      localStorage.setItem("cf_user", JSON.stringify(u))
    } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser, theme, toggleTheme }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
