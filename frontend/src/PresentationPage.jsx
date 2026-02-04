import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import { useTheme } from "./theme.jsx";
import { useTeams } from "./TeamContext.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001";

const formatTime = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export default function PresentationPage() {
  const navigate = useNavigate();
  const { getAuthHeaders, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { teams, remainingCount, selectedTeam, loading, randomize, resetRandomizer, fetchTeams } = useTeams();
  
  const [presentationMinutes, setPresentationMinutes] = useState(7);
  const [qaMinutes, setQaMinutes] = useState(3);
  const [phase, setPhase] = useState("ready");
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [recordedPresentationSeconds, setRecordedPresentationSeconds] = useState(0);
  const [recordedQaSeconds, setRecordedQaSeconds] = useState(0);
  const [notes, setNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  
  const presentationStartTime = useRef(null);
  const qaStartTime = useRef(null);

  const warningActive = useMemo(
    () => phase === "presentation" && remainingSeconds <= 120,
    [phase, remainingSeconds]
  );

  useEffect(() => {
    if (selectedTeam) {
      setNotes(selectedTeam.notes || "");
    } else {
      setNotes("");
    }
  }, [selectedTeam?.id]);

  useEffect(() => {
    if (!timerRunning) return;
    if (remainingSeconds <= 0) {
      setTimerRunning(false);
      return;
    }
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, remainingSeconds]);

  const recordPresentationTime = async (seconds) => {
    if (!selectedTeam) return;
    try {
      const response = await fetch(`${API_BASE}/api/teams/${selectedTeam.id}/presentation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          presentationSeconds: Math.max(0, seconds),
          qaSeconds: 0,
        }),
      });
      if (response.status === 401) return logout();
      if (response.ok) {
        setRecordedPresentationSeconds(seconds);
      }
    } catch (error) {
      console.error("Failed to record presentation time:", error);
    }
  };

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
        setRecordedQaSeconds(qaSecs);
        await fetchTeams();
      }
    } catch (error) {
      console.error("Failed to record session:", error);
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
        await fetchTeams();
      } else {
        window.alert("Failed to save notes.");
      }
    } catch (error) {
      window.alert("Network error while saving notes.");
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleRandomize = async () => {
    try {
      await randomize();
    } catch (error) {
      window.alert(error.message);
    }
  };

  const handleResetRandomizer = async () => {
    await resetRandomizer();
  };

  const handleStartTimer = () => {
    if (timerRunning) return;
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
    const actualTime = presentationStartTime.current 
      ? Math.floor((Date.now() - presentationStartTime.current) / 1000)
      : presentationMinutes * 60 - remainingSeconds;
    
    recordPresentationTime(actualTime);
    setPhase("qa");
    setRemainingSeconds(qaMinutes * 60);
    qaStartTime.current = Date.now();
    setTimerRunning(true);
  };

  const handleResetTimer = () => {
    if (phase === "qa" && qaStartTime.current) {
      const actualQaTime = Math.floor((Date.now() - qaStartTime.current) / 1000);
      recordCompleteSession(recordedPresentationSeconds, actualQaTime);
    }
    setTimerRunning(false);
    setPhase("ready");
    setRemainingSeconds(0);
    setRecordedPresentationSeconds(0);
    setRecordedQaSeconds(0);
    presentationStartTime.current = null;
    qaStartTime.current = null;
  };

  const handleDownloadData = async (format = "csv") => {
    try {
      const response = await fetch(`${API_BASE}/api/export?format=${format}`, {
        headers: getAuthHeaders(),
      });
      if (response.status === 401) return logout();
      if (!response.ok) {
        window.alert("Failed to download data.");
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `teams-export-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      window.alert("Network error while downloading data.");
    }
  };

  return (
    <div className="min-h-screen bg-midnight-light dark:bg-midnight px-6 py-8 text-slate-900 dark:text-slate-100">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">NextUp</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Presentation session</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">{remainingCount} left</span>
          <button
            type="button"
            onClick={() => navigate('/setup')}
            className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ⚙️ Manage Teams
          </button>
          <button
            type="button"
            onClick={handleResetRandomizer}
            className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Reset Round
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
        {/* Left Panel - Controls */}
        <section className="space-y-4">
          {/* Randomizer */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-panel-light dark:bg-panel p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Randomizer</p>
              <span className="text-xs text-slate-500">
                {loading ? "Selecting..." : "Ready"}
              </span>
            </div>
            <button
              type="button"
              onClick={handleRandomize}
              disabled={loading || remainingCount === 0}
              className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-slate-900 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Picking…" : "Pick Next Team"}
            </button>
          </div>

          {/* Timer */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-panel-light dark:bg-panel p-4">
            <p className="text-sm font-semibold mb-3">Timer</p>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <label className="flex flex-col gap-1">
                <span className="text-slate-500 dark:text-slate-400">Present (min)</span>
                <input
                  type="number"
                  min="1"
                  value={presentationMinutes}
                  onChange={(e) => setPresentationMinutes(Number(e.target.value))}
                  className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-slate-500 dark:text-slate-400">Q&A (min)</span>
                <input
                  type="number"
                  min="1"
                  value={qaMinutes}
                  onChange={(e) => setQaMinutes(Number(e.target.value))}
                  className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5"
                />
              </label>
            </div>
            
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-midnight p-4 text-center mb-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                {phase === "presentation" ? "Presentation" : phase === "qa" ? "Q&A" : phase === "complete" ? "Complete" : "Ready"}
              </p>
              <p className={`mt-2 text-3xl font-semibold ${warningActive ? "text-danger font-bold" : ""}`}>
                {formatTime(Math.max(remainingSeconds, 0))}
              </p>
              {warningActive && (
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-danger">
                  2-minute warning
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleStartTimer}
                disabled={!selectedTeam}
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-slate-900 hover:brightness-110 disabled:opacity-50"
              >
                Start
              </button>
              <button
                type="button"
                onClick={handlePauseTimer}
                className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Pause
              </button>
              <button
                type="button"
                onClick={handleQaTransition}
                disabled={phase !== "presentation"}
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Q&A
              </button>
              <button
                type="button"
                onClick={handleResetTimer}
                className="rounded-full border border-dashed border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Export */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-panel-light dark:bg-panel p-4">
            <p className="text-sm font-semibold mb-3">Export Data</p>
            <button
              type="button"
              onClick={() => handleDownloadData("csv")}
              className="w-full rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Download CSV
            </button>
          </div>
        </section>

        {/* Right Panel - Team Display */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-panel-light dark:bg-panel p-6">
          {selectedTeam ? (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-2xl font-semibold">{selectedTeam.name}</h2>
                  <span className="rounded-full border border-accent bg-sky-50 dark:bg-slate-900/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-accent">
                    Live
                  </span>
                </div>
                {selectedTeam.topic && (
                  <p className="text-sm text-slate-600 dark:text-slate-400">{selectedTeam.topic}</p>
                )}
                {selectedTeam.members && selectedTeam.members.length > 0 && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {selectedTeam.members.join(", ")}
                  </p>
                )}
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
                      <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
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
                    className="rounded-full border border-accent bg-accent px-3 py-1 text-xs font-semibold text-slate-900 hover:brightness-110 disabled:opacity-50"
                  >
                    {isSavingNotes ? "Saving..." : "Save"}
                  </button>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add feedback or observations..."
                  rows={10}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full border-4 border-dashed border-slate-200 dark:border-slate-800 w-24 h-24 flex items-center justify-center mb-6">
                <span className="text-4xl">🎤</span>
              </div>
              <h2 className="text-xl font-semibold mb-2">No Team Selected</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm mb-6">
                Click "Pick Next Team" to begin a presentation session.
              </p>
              {teams.length === 0 && (
                <button
                  type="button"
                  onClick={() => navigate('/setup')}
                  className="rounded-full bg-accent px-6 py-2 text-sm font-semibold text-slate-900 hover:brightness-110"
                >
                  Add Teams First
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}