import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './auth.jsx';

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5001";

const TeamContext = createContext();

export function TeamProvider({ children }) {
  const { token, getAuthHeaders, logout } = useAuth();
  const [teams, setTeams] = useState([]);
  const [remainingCount, setRemainingCount] = useState(0);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchTeams = async () => {
    if (!token) return;
    const response = await fetch(`${API_BASE}/api/teams`, { headers: getAuthHeaders() });
    if (response.status === 401) return logout();
    const data = await response.json();
    setTeams(data.teams || []);
  };

  const fetchStatus = async () => {
    if (!token) return;
    const response = await fetch(`${API_BASE}/api/status`, { headers: getAuthHeaders() });
    if (response.status === 401) return logout();
    const data = await response.json();
    setRemainingCount(data.remainingCount ?? 0);
    setSelectedTeam(data.lastSelected || null);
  };

  const addTeam = async (name, members, topic) => {
    const response = await fetch(`${API_BASE}/api/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ name, members, topic: topic || "TBD" }),
    });
    if (response.status === 401) return logout();
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || "Unable to add team.");
    }
    await fetchTeams();
    await fetchStatus();
  };

  const removeTeam = async (id) => {
    const res = await fetch(`${API_BASE}/api/teams/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (res.status === 401) return logout();
    await fetchTeams();
    await fetchStatus();
  };

  const resetTeams = async () => {
    const res = await fetch(`${API_BASE}/api/teams/reset`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (res.status === 401) return logout();
    await fetchTeams();
    await fetchStatus();
  };

  const randomize = async () => {
    setLoading(true);
    const response = await fetch(`${API_BASE}/api/randomize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    });
    if (response.status === 401) {
      setLoading(false);
      return logout();
    }
    const data = await response.json();
    if (!response.ok) {
      setLoading(false);
      throw new Error(data.message || "No teams remaining.");
    }
    setSelectedTeam(data.team);
    setRemainingCount(data.remainingCount);
    setLoading(false);
  };

  const resetRandomizer = async () => {
    const res = await fetch(`${API_BASE}/api/reset`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (res.status === 401) return logout();
    setSelectedTeam(null);
    await fetchTeams();
    await fetchStatus();
  };

  useEffect(() => {
    if (token) {
      fetchTeams();
      fetchStatus();
    }
  }, [token]);

  return (
    <TeamContext.Provider
      value={{
        teams,
        remainingCount,
        selectedTeam,
        loading,
        addTeam,
        removeTeam,
        resetTeams,
        randomize,
        resetRandomizer,
        fetchTeams,
        fetchStatus,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useTeams() {
  return useContext(TeamContext);
}