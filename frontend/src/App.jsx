import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth.jsx";
import { useTheme } from "./theme.jsx";
import Login from "./Login.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001";

const formatTime = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const initialForm = {
  name: "",
  members: "",
  topic: "",
};

export default function App() {
  const { token, user, loading: authLoading, getAuthHeaders, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [teams, setTeams] = useState([]);
  const [remainingCount, setRemainingCount] = useState(0);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [presentationMinutes, setPresentationMinutes] = useState(7);
  const [qaMinutes, setQaMinutes] = useState(3);
  const [phase, setPhase] = useState("ready");
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  const warningActive = useMemo(
    () => phase === "presentation" && remainingSeconds <= 120,
    [phase, remainingSeconds]
  );

  const fetchTeams = async () => {
    const response = await fetch(`${API_BASE}/api/teams`, { headers: getAuthHeaders() });
    if (response.status === 401) return logout();
    const data = await response.json();
    setTeams(data.teams || []);
  };

  const fetchStatus = async () => {
    const response = await fetch(`${API_BASE}/api/status`, { headers: getAuthHeaders() });
    if (response.status === 401) return logout();
    const data = await response.json();
    setRemainingCount(data.remainingCount ?? 0);
    setSelectedTeam(data.lastSelected || null);
  };

  useEffect(() => {
    if (!token) return;
    fetchTeams();
    fetchStatus();
  }, [token]);

  useEffect(() => {
    if (!timerRunning) {
      return;
    }
    if (remainingSeconds <= 0) {
      if (phase === "presentation") {
        setPhase("qa");
        setRemainingSeconds(qaMinutes * 60);
      } else {
        setTimerRunning(false);
        setPhase("complete");
      }
      return;
    }
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, remainingSeconds, phase, qaMinutes]);

  const handleRandomize = async () => {
    setLoading(true);
    const response = await fetch(`${API_BASE}/api/randomize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    });
    if (response.status === 401) return logout();
    const data = await response.json();
    if (!response.ok) {
      window.alert(data.message || "No teams remaining.");
      setLoading(false);
      return;
    }
    setSelectedTeam(data.team);
    setRemainingCount(data.remainingCount);
    setLoading(false);
  };

  const handleResetRandomizer = async () => {
    const res = await fetch(`${API_BASE}/api/reset`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (res.status === 401) return logout();
    setSelectedTeam(null);
    fetchStatus();
  };

  const handleAddTeam = async (event) => {
    event.preventDefault();
    const members = form.members
      .split(",")
      .map((member) => member.trim())
      .filter(Boolean);
    if (!form.name) {
      window.alert("Enter a team name.");
      return;
    }
    const response = await fetch(`${API_BASE}/api/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({
        name: form.name,
        members,
        topic: form.topic || "TBD",
      }),
    });
    if (response.status === 401) return logout();
    if (!response.ok) {
      const data = await response.json();
      window.alert(data.message || "Unable to add team.");
      return;
    }
    setForm(initialForm);
    fetchTeams();
    fetchStatus();
  };

  const handleRemoveTeam = async (id) => {
    const res = await fetch(`${API_BASE}/api/teams/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (res.status === 401) return logout();
    fetchTeams();
    fetchStatus();
  };

  const handleResetTeams = async () => {
    const res = await fetch(`${API_BASE}/api/teams/reset`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (res.status === 401) return logout();
    fetchTeams();
    fetchStatus();
  };

  const handleStartTimer = () => {
    if (timerRunning) {
      return;
    }
    if (phase === "ready" || phase === "complete") {
      setPhase("presentation");
      setRemainingSeconds(presentationMinutes * 60);
    }
    setTimerRunning(true);
  };

  const handlePauseTimer = () => {
    setTimerRunning(false);
  };

  const handleResetTimer = () => {
    setTimerRunning(false);
    setPhase("ready");
    setRemainingSeconds(0);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-midnight-light dark:bg-midnight flex items-center justify-center text-slate-600 dark:text-slate-400">
        Loading…
      </div>
    );
  }
  if (!token) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-midnight-light dark:bg-midnight px-6 py-8 text-slate-900 dark:text-slate-100">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">NextUp</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Presentation day, simplified.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">{remainingCount} left</span>
          <button
            type="button"
            onClick={handleResetRandomizer}
            className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Reset round
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full border border-slate-300 dark:border-slate-700 p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button type="button" onClick={logout} className="text-sm text-slate-500 dark:text-slate-400 hover:underline">
            Log out
          </button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-panel-light dark:bg-panel p-4">
          <div>
            <button
              type="button"
              onClick={handleRandomize}
              disabled={loading}
              className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-slate-900 hover:brightness-110 disabled:opacity-50"
            >
              {loading ? "Picking…" : "Pick next"}
            </button>
            <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-midnight p-3">
              {selectedTeam ? (
                <>
                  <p className="font-medium">{selectedTeam.name}</p>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{selectedTeam.topic}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{selectedTeam.members.join(", ")}</p>
                </>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">No team picked yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-midnight p-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-slate-500 dark:text-slate-400">Present (min)</span>
                <input
                  type="number"
                  min="1"
                  value={presentationMinutes}
                  onChange={(e) => setPresentationMinutes(Number(e.target.value))}
                  className="rounded border border-slate-200 dark:border-slate-700 bg-panel-light dark:bg-panel px-2 py-1.5 text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-slate-500 dark:text-slate-400">Q&A (min)</span>
                <input
                  type="number"
                  min="1"
                  value={qaMinutes}
                  onChange={(e) => setQaMinutes(Number(e.target.value))}
                  className="rounded border border-slate-200 dark:border-slate-700 bg-panel-light dark:bg-panel px-2 py-1.5 text-slate-900 dark:text-slate-100"
                />
              </label>
            </div>
            <p className={`mt-2 text-center text-xl font-medium ${warningActive ? "text-red-500 dark:text-red-400 font-semibold" : "text-slate-900 dark:text-slate-100"}`}>
              {formatTime(Math.max(remainingSeconds, 0))}
            </p>
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              {phase === "presentation" ? "Presentation" : phase === "qa" ? "Q&A" : "Ready"}
            </p>
            {warningActive && <p className="text-center text-xs text-red-500">2 min left</p>}
            <div className="mt-2 flex gap-1">
              <button type="button" onClick={handleStartTimer} className="flex-1 rounded bg-accent py-1.5 text-sm font-medium text-slate-900">Start</button>
              <button type="button" onClick={handlePauseTimer} className="flex-1 rounded border border-slate-300 dark:border-slate-700 py-1.5 text-sm text-slate-600 dark:text-slate-300">Pause</button>
              <button type="button" onClick={handleResetTimer} className="flex-1 rounded border border-dashed border-slate-300 dark:border-slate-700 py-1.5 text-sm text-slate-500">Reset</button>
            </div>
          </div>

          <form onSubmit={handleAddTeam} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-midnight p-3">
            <input
              type="text"
              placeholder="Team name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="mb-2 w-full rounded border border-slate-200 dark:border-slate-700 bg-panel-light dark:bg-panel px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100"
            />
            <input
              type="text"
              placeholder="Members (optional)"
              value={form.members}
              onChange={(e) => setForm((prev) => ({ ...prev, members: e.target.value }))}
              className="mb-2 w-full rounded border border-slate-200 dark:border-slate-700 bg-panel-light dark:bg-panel px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100"
            />
            <input
              type="text"
              placeholder="Topic (optional)"
              value={form.topic}
              onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))}
              className="mb-2 w-full rounded border border-slate-200 dark:border-slate-700 bg-panel-light dark:bg-panel px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100"
            />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 rounded bg-accent py-1.5 text-sm font-medium text-slate-900">Add</button>
              <button type="button" onClick={handleResetTeams} className="rounded border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400">Reset all</button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-panel-light dark:bg-panel p-4">
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">{teams.length} teams</p>

          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((team) => {
              const isSelected = selectedTeam && selectedTeam.id === team.id;
              return (
                <article
                  key={team.id}
                  className={`rounded-xl border px-4 py-3 ${
                    isSelected
                      ? "border-accent bg-sky-50 dark:bg-slate-900/70 shadow-[0_0_0_1px_rgba(56,189,248,0.6)]"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-midnight"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">{team.name}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Topic: {team.topic}</p>
                    </div>
                    {isSelected && (
                      <span className="rounded-full border border-accent px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-accent">
                        Live
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                    Members: {team.members.join(", ")}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleRemoveTeam(team.id)}
                    className="mt-2 w-full rounded border border-slate-300 dark:border-slate-700 py-1 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Remove
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
