import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { useTheme } from './theme.jsx';
import { useTeams } from './TeamContext.jsx';

const initialForm = {
  name: "",
  members: "",
  topic: "",
};

export default function SetupPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { teams, addTeam, removeTeam, resetTeams } = useTeams();
  const [form, setForm] = useState(initialForm);

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
    try {
      await addTeam(form.name, members, form.topic);
      setForm(initialForm);
    } catch (error) {
      window.alert(error.message);
    }
  };

  const handleContinue = () => {
    if (teams.length === 0) {
      window.alert("Add at least one team before continuing.");
      return;
    }
    navigate('/present');
  };

  return (
    <div className="min-h-screen bg-midnight-light dark:bg-midnight px-6 py-8 text-slate-900 dark:text-slate-100">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team Setup</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Add and manage presentation teams</p>
        </div>
        <div className="flex items-center gap-3">
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

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Add Team Form */}
        <form onSubmit={handleAddTeam} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-panel-light dark:bg-panel p-6">
          <h2 className="text-lg font-semibold mb-4">Add New Team</h2>
          <div className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="Team name *"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100"
              required
            />
            <input
              type="text"
              placeholder="Members (comma-separated, optional)"
              value={form.members}
              onChange={(e) => setForm((prev) => ({ ...prev, members: e.target.value }))}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100"
            />
            <input
              type="text"
              placeholder="Topic (optional)"
              value={form.topic}
              onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-slate-900 hover:brightness-110"
            >
              Add Team
            </button>
          </div>
        </form>

        {/* Team List */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-panel-light dark:bg-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Teams ({teams.length})</h2>
            {teams.length > 0 && (
              <button
                type="button"
                onClick={resetTeams}
                className="rounded-full border border-red-300 dark:border-red-700 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Reset All
              </button>
            )}
          </div>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {teams.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                No teams added yet. Add your first team above.
              </p>
            ) : (
              teams.map((team) => {
                const hasPresented = team.presentations && team.presentations.length > 0;
                return (
                  <div
                    key={team.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{team.name}</p>
                          {hasPresented && (
                            <span className="text-[10px] uppercase tracking-wider text-green-600 dark:text-green-400 font-semibold">
                              Presented
                            </span>
                          )}
                        </div>
                        {team.topic && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {team.topic}
                          </p>
                        )}
                        {team.members && team.members.length > 0 && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                            {team.members.join(", ")}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTeam(team.id)}
                        className="flex-shrink-0 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Continue Button */}
        <button
          type="button"
          onClick={handleContinue}
          disabled={teams.length === 0}
          className="w-full rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start Session →
        </button>
      </div>
    </div>
  );
}