const express = require("express");
const cors = require("cors");
const baseTeams = require("./teams.json");

const app = express();
const port = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

const state = {
  teams: baseTeams.map((team) => ({ ...team })),
  remainingIds: new Set(baseTeams.map((team) => team.id)),
  lastSelected: null,
};

const resetRandomizer = () => {
  state.remainingIds = new Set(state.teams.map((team) => team.id));
  state.lastSelected = null;
};

const resetTeams = () => {
  state.teams = baseTeams.map((team) => ({ ...team }));
  resetRandomizer();
};

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/teams", (req, res) => {
  res.json({ teams: state.teams });
});

app.get("/api/status", (req, res) => {
  const remainingCount = state.remainingIds.size;
  res.json({
    remainingCount,
    lastSelected: state.lastSelected,
  });
});

app.post("/api/randomize", (req, res) => {
  if (state.remainingIds.size === 0) {
    return res.status(409).json({
      message: "No teams remaining. Reset to start again.",
    });
  }
  const remaining = state.teams.filter((team) => state.remainingIds.has(team.id));
  const index = Math.floor(Math.random() * remaining.length);
  const selected = remaining[index];
  state.remainingIds.delete(selected.id);
  state.lastSelected = selected;

  return res.json({
    team: selected,
    remainingCount: state.remainingIds.size,
  });
});

app.post("/api/reset", (req, res) => {
  resetRandomizer();
  res.json({ message: "Randomizer reset.", remainingCount: state.teams.length });
});

app.post("/api/teams", (req, res) => {
  const { name, members, topic } = req.body || {};
  if (!name) {
    return res.status(400).json({ message: "Team name is required." });
  }
  const id = `team-${Date.now()}`;
  const newTeam = {
    id,
    name,
    members: Array.isArray(members) ? members : [],
    topic: topic || "TBD",
  };
  state.teams.push(newTeam);
  state.remainingIds.add(id);
  res.status(201).json({ team: newTeam });
});

app.delete("/api/teams/:id", (req, res) => {
  const { id } = req.params;
  const index = state.teams.findIndex((team) => team.id === id);
  if (index === -1) {
    return res.status(404).json({ message: "Team not found." });
  }
  const [removed] = state.teams.splice(index, 1);
  state.remainingIds.delete(id);
  if (state.lastSelected && state.lastSelected.id === id) {
    state.lastSelected = null;
  }
  return res.json({ team: removed });
});

app.post("/api/teams/reset", (req, res) => {
  resetTeams();
  res.json({ teams: state.teams });
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
