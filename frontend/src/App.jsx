import { useEffect, useMemo, useState, useRef } from "react";
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
  const [recordedPresentationSeconds, setRecordedPresentationSeconds] = useState(0);
  const [recordedQaSeconds, setRecordedQaSeconds] = useState(0);
  const [notes, setNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  
  // Use refs to track elapsed time accurately
  const presentationStartTime = useRef(null);
  const qaStartTime = useRef(null);

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

  // Record presentation time only
  const recordPresentationTime = async (seconds) => {
    if (!selectedTeam) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/teams/${selectedTeam.id}/presentation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          presentationSeconds: Math.max(0, seconds),
          qaSeconds: 0, // Q&A not completed yet
        }),
      });

      if (response.status === 401) return logout();
      
      if (response.ok) {
        console.log(`✓ Presentation time recorded: ${formatTime(seconds)}`);
        setRecordedPresentationSeconds(seconds);
      }
    } catch (error) {
      console.error("Failed to record presentation time:", error);
    }
  };

  // Record complete session (presentation + Q&A)
  const recordCompleteSession = async (presentationSecs, qaSecs) => {
    if (!selectedTeam) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/teams/${selectedTeam.id}/presentation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          presentationSeconds: Math.max(0, presentationSecs),
          qaSeconds: Math.max(0, qaSecs),
        }),
      });

      if (response.status === 401) return logout();
      
      if (response.ok) {
        console.log(`✓ Complete session recorded - Presentation: ${formatTime(presentationSecs)}, Q&A: ${formatTime(qaSecs)}`);
        setRecordedQaSeconds(qaSecs);
      }
    } catch (error) {
      console.error("Failed to record session:", error);
      window.alert("Network error while recording session times.");
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedTeam) return;
    
    setIsSavingNotes(true);
    try {
      const response = await fetch(`${API_BASE}/api/teams/${selectedTeam.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ notes }),
      });

      if (response.status === 401) return logout();
      
      if (response.ok) {
        console.log(`✓ Notes saved for ${selectedTeam.name}`);
        // Update the selected team with new notes
        setSelectedTeam(prev => ({ ...prev, notes }));
        // Update teams list
        setTeams(prev => prev.map(team => 
          team.id === selectedTeam.id ? { ...team, notes } : team
        ));
      } else {
        window.alert("Failed to save notes.");
      }
    } catch (error) {
      console.error("Failed to save notes:", error);
      window.alert("Network error while saving notes.");
    } finally {
      setIsSavingNotes(false);
    }
  };

  useEffect(() => {
    if (selectedTeam) {
      setNotes(selectedTeam.notes || "");
    } else {
      setNotes("");
    }
  }, [selectedTeam?.id]);

  useEffect(() => {
    if (!timerRunning) {
      return;
    }
    if (remainingSeconds <= 0) {
      // Timer reached 00:00, just pause it
      setTimerRunning(false);
      return;
    }
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, remainingSeconds, phase]);

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
      setRecordedPresentationSeconds(0);
      setRecordedQaSeconds(0);
      presentationStartTime.current = Date.now();
      qaStartTime.current = null;
    }
    setTimerRunning(true);
  };

  const handlePauseTimer = () => {
    setTimerRunning(false);
  };

  const handleQaTransition = () => {
    if (phase !== "presentation") {
      window.alert("Q&A transition is only available during presentation phase.");
      return;
    }

    // Calculate actual presentation time
    const actualTime = presentationStartTime.current 
      ? Math.floor((Date.now() - presentationStartTime.current) / 1000)
      : presentationMinutes * 60 - remainingSeconds;
    
    // Record presentation time
    recordPresentationTime(actualTime);
    
    // Switch to Q&A phase
    setPhase("qa");
    setRemainingSeconds(qaMinutes * 60);
    qaStartTime.current = Date.now();
    
    // Automatically start Q&A timer
    setTimerRunning(true);
  };

  const handleResetTimer = () => {
    // If in Q&A phase and Q&A has started, record the session
    if (phase === "qa" && qaStartTime.current) {
      const actualQaTime = Math.floor((Date.now() - qaStartTime.current) / 1000);
      
      // Record complete session
      recordCompleteSession(recordedPresentationSeconds, actualQaTime);
    }

    // Reset everything
    setTimerRunning(false);
    setPhase("ready");
    setRemainingSeconds(0);
    setRecordedPresentationSeconds(0);
    setRecordedQaSeconds(0);
    presentationStartTime.current = null;
    qaStartTime.current = null;
  };

  const handleDownloadData = async (format = "json") => {
    try {
      const response = await fetch(`${API_BASE}/api/export?format=${format}`, {
        headers: getAuthHeaders(),
      });

      if (response.status === 401) return logout();
      
      if (!response.ok) {
        window.alert("Failed to download data.");
        return;
      }

      if (format === "csv") {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `teams-export-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `teams-export-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      window.alert("Network error while downloading data.");
    }
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
                  {(recordedPresentationSeconds > 0 || recordedQaSeconds > 0) && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs space-y-1">
                      <p className="text-slate-500 dark:text-slate-400">Recorded Times:</p>
                      {recordedPresentationSeconds > 0 && (
                        <p>Presentation: {formatTime(recordedPresentationSeconds)}</p>
                      )}
                      {recordedQaSeconds > 0 && (
                        <p>Q&A: {formatTime(recordedQaSeconds)}</p>
                      )}
                    </div>
                  )}
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
                {phase === "presentation" ? "Presentation" : phase === "qa" ? "Q&A" : phase === "complete" ? "Complete" : "Ready"}
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
              {phase === "complete" && (
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-green-600 dark:text-green-400">
                  Session Complete ✓
                </p>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleStartTimer}
                disabled={!selectedTeam}
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-slate-900 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start
              </button>
              <button
                type="button"
                onClick={handlePauseTimer}
                className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500"
              >
                Pause
              </button>
              <button
                type="button"
                onClick={handleQaTransition}
                disabled={phase !== "presentation"}
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Q&A
              </button>
              <button
                type="button"
                onClick={handleResetTimer}
                className="rounded-full border border-dashed border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500"
              >
                Reset
              </button>
            </div>
            <p className="mt-3 text-xs text-center text-slate-500 dark:text-slate-400">
              Click "Q&A" to end presentation and start Q&A. Click "Reset" after Q&A to record times.
            </p>
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

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-midnight p-4">
            <p className="text-sm font-semibold mb-3">Export Data</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleDownloadData("json")}
                className="flex-1 rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500"
              >
                Download JSON
              </button>
              <button
                type="button"
                onClick={() => handleDownloadData("csv")}
                className="flex-1 rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500"
              >
                Download CSV
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-panel-light dark:bg-panel p-6">
          {selectedTeam ? (
            <div className="space-y-6">
              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-semibold">{selectedTeam.name}</h2>
                      <span className="rounded-full border border-accent bg-sky-50 dark:bg-slate-900/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-accent">
                        Live
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Topic: <span className="font-medium text-slate-900 dark:text-slate-100">{selectedTeam.topic}</span>
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-midnight p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-3">
                    Team Members
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTeam.members.map((member, index) => (
                      <span
                        key={index}
                        className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1 text-sm text-slate-700 dark:text-slate-300"
                      >
                        {member}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {(recordedPresentationSeconds > 0 || recordedQaSeconds > 0) && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-midnight p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-3">
                    Recorded Times
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {recordedPresentationSeconds > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Presentation</p>
                        <p className="text-2xl font-semibold mt-1">{formatTime(recordedPresentationSeconds)}</p>
                      </div>
                    )}
                    {recordedQaSeconds > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Q&A</p>
                        <p className="text-2xl font-semibold mt-1">{formatTime(recordedQaSeconds)}</p>
                      </div>
                    )}
                  </div>
                  {recordedPresentationSeconds > 0 && recordedQaSeconds > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Total Time</p>
                      <p className="text-2xl font-semibold mt-1">
                        {formatTime(recordedPresentationSeconds + recordedQaSeconds)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-midnight p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    Instructor Notes
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="rounded-full border border-accent bg-accent px-3 py-1 text-xs font-semibold text-slate-900 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingNotes ? "Saving..." : "Save Notes"}
                  </button>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add feedback, observations, or comments about this team's presentation..."
                  rows={12}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                />
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Notes are automatically saved to the team's record and included in exports.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-midnight p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-3">
                  All Teams
                </p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {teams.map((team) => {
                    const isCurrentTeam = team.id === selectedTeam.id;
                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => {
                          setSelectedTeam(team);
                          fetchStatus();
                        }}
                        className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                          isCurrentTeam
                            ? "border-accent bg-sky-50 dark:bg-slate-900/70 text-accent font-semibold"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>{team.name}</span>
                          {team.presented && (
                            <span className="text-[10px] text-green-600 dark:text-green-400">✓</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[600px] text-center">
              <div className="rounded-full border-4 border-dashed border-slate-200 dark:border-slate-800 w-24 h-24 flex items-center justify-center mb-6">
                <span className="text-4xl">🎤</span>
              </div>
              <h2 className="text-xl font-semibold mb-2">No Team Selected</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm">
                Click "Select Next Team" in the control panel to begin a presentation session.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
