import { useState } from "react";
import { useAuth } from "./auth";
import { useTheme } from "./theme";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001";

export default function Login() {
  const { setToken } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Request failed.");
        setLoading(false);
        return;
      }
      setToken(data.token, data.user);
    } catch (err) {
      setError("Network error.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-midnight-light dark:bg-midnight flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-panel-light dark:bg-panel p-6 relative">
        <button
          type="button"
          onClick={toggleTheme}
          className="absolute top-4 right-4 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 text-center">
          Instructor Command Center
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 text-center mt-2">
          {mode === "login" ? "Sign in to manage presentations" : "Create an account"}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-midnight px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-500"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-midnight px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-500"
            required
          />
          {error && (
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-accent px-4 py-2 text-sm font-semibold text-slate-900 hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "..." : mode === "login" ? "Log in" : "Register"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
          }}
          className="w-full mt-4 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
        >
          {mode === "login" ? "Create an account" : "Back to log in"}
        </button>
      </div>
    </div>
  );
}
