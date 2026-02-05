require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 5001;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("JWT_SECRET is required. Set it in .env or your deployment environment.");
  process.exit(1);
}

app.use(cors());
app.use(express.json());

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ message: "Email already registered." });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash },
    select: { id: true, email: true },
  });
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
  res.status(201).json({ user: { id: user.id, email: user.email }, token });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: "Invalid email or password." });
  }
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ user: { id: user.id, email: user.email }, token });
});

app.get("/api/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true },
  });
  if (!user) return res.status(404).json({ message: "User not found." });
  res.json(user);
});

async function getOrCreateSession(userId) {
  let session = await prisma.sessionState.findUnique({ where: { userId } });
  if (!session) {
    session = await prisma.sessionState.create({
      data: { userId, remainingTeamIds: "[]" },
    });
  }
  return session;
}

app.get("/api/teams", requireAuth, async (req, res) => {
  const teams = await prisma.team.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "asc" },
  });
  const normalized = teams.map((t) => ({
    id: t.id,
    name: t.name,
    topic: t.topic,
    members: JSON.parse(t.members || "[]"),
    notes: t.notes || "",
  }));
  res.json({ teams: normalized });
});

app.get("/api/status", requireAuth, async (req, res) => {
  const session = await getOrCreateSession(req.userId);
  const remainingIds = JSON.parse(session.remainingTeamIds || "[]");
  let lastSelected = null;
  if (session.lastSelectedTeamId) {
    const team = await prisma.team.findFirst({
      where: { id: session.lastSelectedTeamId, userId: req.userId },
    });
    if (team) {
      lastSelected = {
        id: team.id,
        name: team.name,
        topic: team.topic,
        members: JSON.parse(team.members || "[]"),
        notes: team.notes || "",
      };
    }
  }
  res.json({
    remainingCount: remainingIds.length,
    lastSelected,
  });
});

app.post("/api/randomize", requireAuth, async (req, res) => {
  const session = await getOrCreateSession(req.userId);
  const remainingIds = JSON.parse(session.remainingTeamIds || "[]");
  if (remainingIds.length === 0) {
    return res.status(409).json({ message: "No teams remaining. Reset to start again." });
  }
  const index = Math.floor(Math.random() * remainingIds.length);
  const selectedId = remainingIds[index];
  remainingIds.splice(index, 1);
  await prisma.sessionState.update({
    where: { userId: req.userId },
    data: {
      lastSelectedTeamId: selectedId,
      remainingTeamIds: JSON.stringify(remainingIds),
    },
  });
  const team = await prisma.team.findFirst({
    where: { id: selectedId, userId: req.userId },
  });
  if (!team) return res.status(500).json({ message: "Team not found." });
  const selected = {
    id: team.id,
    name: team.name,
    topic: team.topic,
    members: JSON.parse(team.members || "[]"),
    notes: team.notes || "",  
  };
  res.json({ team: selected, remainingCount: remainingIds.length });
});

app.post("/api/teams/:id/notes", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  
  const team = await prisma.team.findFirst({
    where: { id, userId: req.userId },
  });
  
  if (!team) {
    return res.status(404).json({ message: "Team not found." });
  }
  
  const updatedTeam = await prisma.team.update({
    where: { id },
    data: { notes: notes || "" },
  });
  
  res.json({
    team: {
      id: updatedTeam.id,
      name: updatedTeam.name,
      topic: updatedTeam.topic,
      members: JSON.parse(updatedTeam.members || "[]"),
      notes: updatedTeam.notes || "",
    },
  });
});

app.post("/api/reset", requireAuth, async (req, res) => {
  const teams = await prisma.team.findMany({
    where: { userId: req.userId },
    select: { id: true },
  });
  const allIds = teams.map((t) => t.id);
  await prisma.sessionState.upsert({
    where: { userId: req.userId },
    create: { userId: req.userId, remainingTeamIds: JSON.stringify(allIds) },
    update: { remainingTeamIds: JSON.stringify(allIds), lastSelectedTeamId: null },
  });
  res.json({ message: "Randomizer reset.", remainingCount: allIds.length });
});

app.post("/api/teams", requireAuth, async (req, res) => {
  const { name, members, topic } = req.body || {};
  if (!name) {
    return res.status(400).json({ message: "Team name is required." });
  }
  const membersArr = Array.isArray(members) ? members : [];
  const team = await prisma.team.create({
    data: {
      userId: req.userId,
      name,
      topic: topic || "TBD",
      members: JSON.stringify(membersArr),
    },
  });
  const session = await getOrCreateSession(req.userId);
  const remainingIds = JSON.parse(session.remainingTeamIds || "[]");
  remainingIds.push(team.id);
  await prisma.sessionState.update({
    where: { userId: req.userId },
    data: { remainingTeamIds: JSON.stringify(remainingIds) },
  });
  res.status(201).json({
    team: {
      id: team.id,
      name: team.name,
      topic: team.topic,
      members: JSON.parse(team.members || "[]"),
    },
  });
});

app.delete("/api/teams/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const team = await prisma.team.findFirst({
    where: { id, userId: req.userId },
  });
  if (!team) return res.status(404).json({ message: "Team not found." });
  await prisma.team.delete({ where: { id } });
  const session = await prisma.sessionState.findUnique({ where: { userId: req.userId } });
  if (session) {
    const remainingIds = JSON.parse(session.remainingTeamIds || "[]").filter((x) => x !== id);
    const lastSelected = session.lastSelectedTeamId === id ? null : session.lastSelectedTeamId;
    await prisma.sessionState.update({
      where: { userId: req.userId },
      data: { remainingTeamIds: JSON.stringify(remainingIds), lastSelectedTeamId: lastSelected },
    });
  }
  res.json({
    team: { 
      id: team.id, 
      name: team.name, 
      topic: team.topic, 
      members: JSON.parse(team.members || "[]"),
      notes: team.notes || "",  
    },
  });
});

app.post("/api/teams/reset", requireAuth, async (req, res) => {
  await prisma.team.deleteMany({ where: { userId: req.userId } });
  await prisma.sessionState.deleteMany({ where: { userId: req.userId } });
  res.json({ teams: [] });
});

app.post("/api/teams/:teamId/presentation", requireAuth, async (req, res) => {
  const { teamId } = req.params;
  const { presentationSeconds, qaSeconds } = req.body || {};
  
  // Validate ownership
  const team = await prisma.team.findFirst({
    where: { id: teamId, userId: req.userId }
  });
  if (!team) {
    return res.status(404).json({ message: "Team not found." });
  }
  
  // Validate input
  if (typeof presentationSeconds !== 'number' || typeof qaSeconds !== 'number') {
    return res.status(400).json({ message: "Invalid timing data." });
  }
  
  // Record presentation
  const presentation = await prisma.teamPresentation.create({
    data: {
      teamId,
      presentationSeconds,
      qaSeconds
    }
  });
  
  res.status(201).json({ 
    presentation: {
      id: presentation.id,
      presentationSeconds: presentation.presentationSeconds,
      qaSeconds: presentation.qaSeconds,
      presentedAt: presentation.presentedAt
    }
  });
});

app.get("/api/teams/:teamId/presentations", requireAuth, async (req, res) => {
  const { teamId } = req.params;
  
  // Validate ownership
  const team = await prisma.team.findFirst({
    where: { id: teamId, userId: req.userId }
  });
  if (!team) {
    return res.status(404).json({ message: "Team not found." });
  }
  
  const presentations = await prisma.teamPresentation.findMany({
    where: { teamId },
    orderBy: { presentedAt: 'desc' }
  });
  
  res.json({ presentations });
});

app.get("/api/export", requireAuth, async (req, res) => {
  const format = req.query.format || 'json';
  
  // Fetch all teams with presentations
  const teams = await prisma.team.findMany({
    where: { userId: req.userId },
    include: {
      presentations: {
        orderBy: { presentedAt: 'desc' }
      }
    },
    orderBy: { createdAt: 'asc' }
  });
  
  if (format === 'csv') {
    // Generate CSV
    const rows = [];
    rows.push([
      'Team Name',
      'Topic',
      'Members',
      'Notes', 
      'Created At',
      'Presentation Time (min)',
      'Q&A Time (min)',
      'Total Time (min)',
      'Presented At'
    ]);
    
    teams.forEach(team => {
      const members = JSON.parse(team.members || '[]').join('; ');
      const notes = team.notes || '';
      
      if (team.presentations.length === 0) {
        // Team hasn't presented yet
        rows.push([
          team.name,
          team.topic,
          members,
          notes,
          team.createdAt.toISOString(),
          'N/A',
          'N/A',
          'N/A',
          'N/A'
        ]);
      } else {
        team.presentations.forEach(p => {
          const presMin = (p.presentationSeconds / 60).toFixed(2);
          const qaMin = (p.qaSeconds / 60).toFixed(2);
          const totalMin = ((p.presentationSeconds + p.qaSeconds) / 60).toFixed(2);
          
          rows.push([
            team.name,
            team.topic,
            members,
            notes,
            team.createdAt.toISOString(),
            presMin,
            qaMin,
            totalMin,
            p.presentedAt.toISOString()
          ]);
        });
      }
    });
    
    // Convert to CSV string
    const csv = rows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="teams-export-${Date.now()}.csv"`);
    res.send(csv);
    
  } else {
    // JSON format
    const data = teams.map(team => ({
      id: team.id,
      name: team.name,
      topic: team.topic,
      members: JSON.parse(team.members || '[]'),
      notes: team.notes || "",  
      createdAt: team.createdAt,
      presentations: team.presentations.map(p => ({
        presentationMinutes: (p.presentationSeconds / 60).toFixed(2),
        qaMinutes: (p.qaSeconds / 60).toFixed(2),
        totalMinutes: ((p.presentationSeconds + p.qaSeconds) / 60).toFixed(2),
        presentedAt: p.presentedAt
      }))
    }));
    
    res.json({ teams: data });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Backend listening on http://0.0.0.0:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
});

