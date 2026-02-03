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
    <div className="min-h-screen bg-midnight-light dark:bg-midnight px-8 py-10 text-slate-900 dark:text-slate-100">
      <header className="mb-10 flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Instructor Command Center
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Presentation Randomizer</h1>
          <p className="mt-2 max-w-xl text-slate-600 dark:text-slate-300">
            Manage team order, highlight the current presenters, and keep the timing
            under control.
          </p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-500">
            Logged in as {user?.email}{" "}
            <button
              type="button"
              onClick={logout}
              className="text-accent hover:underline"
            >
              Log out
            </button>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-panel-light dark:bg-panel px-6 py-4 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Teams Remaining
          </p>
          <p className="mt-2 text-3xl font-semibold">{remainingCount}</p>
          <button
            type="button"
            onClick={handleResetRandomizer}
            className="mt-3 w-full rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500"
          >
            Reset Round
          </button>
        </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="space-y-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-panel-light dark:bg-panel p-6">
          <div>
            <h2 className="text-lg font-semibold">Control Panel</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Add teams, pick the next presenters, and control the timer.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-midnight p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Randomizer</p>
              <span className="text-xs text-slate-500">
                {loading ? "Selecting..." : "Ready"}
              </span>
            </div>
            <button
              type="button"
              onClick={handleRandomize}
              className="mt-4 w-full rounded-full bg-accent px-4 py-2 text-sm font-semibold text-slate-900 hover:brightness-110"
            >
              Select Next Team
            </button>
            <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-panel-light dark:bg-panel p-4">
              {selectedTeam ? (
                <>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    Current Team
                  </p>
                  <p className="mt-2 text-lg font-semibold">{selectedTeam.name}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Topic: {selectedTeam.topic}
                  </p>
                  <p className="mt-2 text-sm">
                    Members: {selectedTeam.members.join(", ")}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-400">No team selected yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-midnight p-4">
            <p className="text-sm font-semibold">Dual-Phase Timer</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-400">
              <label className="flex flex-col gap-2">
                Presentation (min)
                <input
                  type="number"
                  min="1"
                  value={presentationMinutes}
                  onChange={(event) => setPresentationMinutes(Number(event.target.value))}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-panel-light dark:bg-panel px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-2">
                Q&A (min)
                <input
                  type="number"
                  min="1"
                  value={qaMinutes}
                  onChange={(event) => setQaMinutes(Number(event.target.value))}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-panel-light dark:bg-panel px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </label>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-panel-light dark:bg-panel p-4 text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                {phase === "presentation" ? "Presentation" : phase === "qa" ? "Q&A" : "Ready"}
              </p>
              <p
                className={`mt-2 text-3xl font-semibold ${
                  warningActive ? "text-danger font-bold" : "text-slate-900 dark:text-slate-100"
                }`}
              >
                {formatTime(Math.max(remainingSeconds, 0))}
              </p>
              {warningActive && (
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-danger">
                  2-minute warning
                </p>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleStartTimer}
                className="flex-1 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-slate-900 hover:brightness-110"
              >
                Start
              </button>
              <button
                type="button"
                onClick={handlePauseTimer}
                className="flex-1 rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500"
              >
                Pause
              </button>
              <button
                type="button"
                onClick={handleResetTimer}
                className="flex-1 rounded-full border border-dashed border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500"
              >
                Reset
              </button>
            </div>
          </div>

          <form onSubmit={handleAddTeam} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-midnight p-4">
            <p className="text-sm font-semibold">Team Metadata</p>
            <div className="mt-3 flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="text"
                placeholder="Team name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-panel-light dark:bg-panel px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                placeholder="Members (comma separated, optional)"
                value={form.members}
                onChange={(event) => setForm((prev) => ({ ...prev, members: event.target.value }))}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-panel-light dark:bg-panel px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                placeholder="Topic (optional)"
                value={form.topic}
                onChange={(event) => setForm((prev) => ({ ...prev, topic: event.target.value }))}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-panel-light dark:bg-panel px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-slate-900 hover:brightness-110"
              >
                Add Team
              </button>
              <button
                type="button"
                onClick={handleResetTeams}
                className="flex-1 rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500"
              >
                Reset Teams
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-panel-light dark:bg-panel p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Dashboard</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Current roster with metadata and quick actions.
              </p>
            </div>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {teams.length} Teams
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
                    className="mt-3 w-full rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500"
                  >
                    Remove Team
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
