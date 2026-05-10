const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3002;
const DB_FILE = path.join(__dirname, "db.json");
const JWT_SECRET = process.env.JWT_SECRET || "codealpha-jobboard-secret-2025";

// ─── Database ────────────────────────────────────────────────────────────────
function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = {
      users: {},        // id -> { id, name, email, password, role: candidate|employer|admin }
      employers: {},    // id -> { id, userId, company, website, industry, about }
      jobs: {},         // id -> { id, employerId, title, company, ... }
      resumes: {},      // id -> { id, userId, filename, content, uploadedAt }
      applications: {}  // id -> { id, jobId, candidateId, resumeId, status, ... }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "2mb" })); // allow resume text upload
app.use(express.static(path.join(__dirname, "public")));

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Authentication required" });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access restricted to: ${roles.join(", ")}` });
    }
    next();
  };
}

// ─── AUTH ────────────────────────────────────────────────────────────────────

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, role = "candidate", company, industry, website } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "name, email and password are required" });
  if (!["candidate", "employer"].includes(role)) return res.status(400).json({ error: "role must be 'candidate' or 'employer'" });

  const db = loadDB();
  if (Object.values(db.users).find(u => u.email === email)) {
    return res.status(400).json({ error: "Email already in use" });
  }

  const id = uuidv4();
  const hash = await bcrypt.hash(password, 10);
  db.users[id] = { id, name, email, password: hash, role, createdAt: new Date().toISOString() };

  if (role === "employer") {
    const empId = uuidv4();
    db.employers[empId] = { id: empId, userId: id, company: company || name + "'s Company", industry: industry || "Technology", website: website || "", about: "", createdAt: new Date().toISOString() };
    db.users[id].employerId = empId;
  }

  saveDB(db);
  const token = jwt.sign({ id, name, email, role, employerId: db.users[id].employerId }, JWT_SECRET, { expiresIn: "7d" });
  res.status(201).json({ token, user: { id, name, email, role } });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });
  const db = loadDB();
  const user = Object.values(db.users).find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role, employerId: user.employerId }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.get("/api/auth/me", authenticate, (req, res) => res.json({ user: req.user }));

// Seed default data
app.post("/api/seed", async (req, res) => {
  const db = loadDB();
  if (Object.keys(db.jobs).length > 0) {
    return res.json({ message: "Already seeded." });
  }

  // Admin
  const adminId = uuidv4();
  db.users[adminId] = { id: adminId, name: "Admin", email: "admin@jobboard.dev", password: await bcrypt.hash("admin123", 10), role: "admin", createdAt: new Date().toISOString() };

  // Employer
  const empUserId = uuidv4();
  const empId = uuidv4();
  db.users[empUserId] = { id: empUserId, name: "Thabo Mokoena", email: "employer@techco.co.za", password: await bcrypt.hash("employer123", 10), role: "employer", employerId: empId, createdAt: new Date().toISOString() };
  db.employers[empId] = { id: empId, userId: empUserId, company: "TechCo SA", industry: "Software", website: "https://techco.co.za", about: "We build innovative software solutions.", createdAt: new Date().toISOString() };

  // Jobs
  const jobs = [
    { title: "Junior Frontend Developer", type: "Full-Time", location: "Durban, KZN", salary: "R18,000 – R25,000/month", description: "We are looking for a passionate junior frontend developer to join our team. You will work with React and TypeScript.", requirements: "React, HTML/CSS, JavaScript, Git", category: "Frontend" },
    { title: "Backend Node.js Developer", type: "Remote", location: "Remote (SA)", salary: "R25,000 – R35,000/month", description: "Build scalable REST APIs and microservices using Node.js and Express. Experience with PostgreSQL required.", requirements: "Node.js, Express, PostgreSQL, REST APIs", category: "Backend" },
    { title: "Android Developer (Kotlin)", type: "Hybrid", location: "Johannesburg, GP", salary: "R20,000 – R30,000/month", description: "Develop Android applications using Kotlin and Jetpack Compose. Work on user-facing features for our mobile app.", requirements: "Kotlin, Jetpack Compose, Android SDK, RoomDB", category: "Mobile" },
    { title: "Full Stack Developer", type: "Full-Time", location: "Cape Town, WC", salary: "R30,000 – R45,000/month", description: "Own features end-to-end across our React frontend and Django backend. Strong SQL skills required.", requirements: "React, Django, Python, PostgreSQL, Docker", category: "Full Stack" }
  ];

  for (const job of jobs) {
    const id = uuidv4();
    db.jobs[id] = { id, employerId: empId, company: "TechCo SA", ...job, status: "open", postedAt: new Date().toISOString(), applications: 0 };
  }

  saveDB(db);
  res.json({ message: "Seeded successfully. employer@techco.co.za / employer123 | admin@jobboard.dev / admin123" });
});

// ─── JOBS ────────────────────────────────────────────────────────────────────

// GET /api/jobs — search & filter
app.get("/api/jobs", (req, res) => {
  const { q, category, type, location } = req.query;
  const db = loadDB();
  let jobs = Object.values(db.jobs).filter(j => j.status === "open");

  if (q) {
    const qLower = q.toLowerCase();
    jobs = jobs.filter(j =>
      j.title.toLowerCase().includes(qLower) ||
      j.company.toLowerCase().includes(qLower) ||
      j.description.toLowerCase().includes(qLower) ||
      j.requirements.toLowerCase().includes(qLower)
    );
  }
  if (category) jobs = jobs.filter(j => j.category.toLowerCase() === category.toLowerCase());
  if (type) jobs = jobs.filter(j => j.type.toLowerCase() === type.toLowerCase());
  if (location) jobs = jobs.filter(j => j.location.toLowerCase().includes(location.toLowerCase()));

  // Add application count
  jobs = jobs.map(j => ({
    ...j,
    applicationCount: Object.values(db.applications).filter(a => a.jobId === j.id).length
  }));

  res.json(jobs.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt)));
});

// GET /api/jobs/:id
app.get("/api/jobs/:id", (req, res) => {
  const db = loadDB();
  const job = db.jobs[req.params.id];
  if (!job) return res.status(404).json({ error: "Job not found" });
  const applicationCount = Object.values(db.applications).filter(a => a.jobId === job.id).length;
  res.json({ ...job, applicationCount });
});

// POST /api/jobs — employer posts job
app.post("/api/jobs", authenticate, requireRole("employer", "admin"), (req, res) => {
  const { title, description, requirements, type, location, salary, category } = req.body;
  if (!title || !description || !type || !location) {
    return res.status(400).json({ error: "title, description, type, and location are required" });
  }
  const db = loadDB();
  const employer = Object.values(db.employers).find(e => e.userId === req.user.id);
  if (!employer && req.user.role !== "admin") return res.status(400).json({ error: "No employer profile found for this account" });

  const id = uuidv4();
  const job = {
    id, employerId: employer?.id || "admin", company: employer?.company || "Admin Co",
    title, description, requirements: requirements || "", type, location,
    salary: salary || "Negotiable", category: category || "General",
    status: "open", postedAt: new Date().toISOString()
  };
  db.jobs[id] = job;
  saveDB(db);
  res.status(201).json(job);
});

// PUT /api/jobs/:id — update job
app.put("/api/jobs/:id", authenticate, requireRole("employer", "admin"), (req, res) => {
  const db = loadDB();
  const job = db.jobs[req.params.id];
  if (!job) return res.status(404).json({ error: "Job not found" });
  const allowed = ["title", "description", "requirements", "type", "location", "salary", "category", "status"];
  allowed.forEach(k => { if (req.body[k] !== undefined) job[k] = req.body[k]; });
  saveDB(db);
  res.json(job);
});

// DELETE /api/jobs/:id
app.delete("/api/jobs/:id", authenticate, requireRole("employer", "admin"), (req, res) => {
  const db = loadDB();
  if (!db.jobs[req.params.id]) return res.status(404).json({ error: "Job not found" });
  delete db.jobs[req.params.id];
  saveDB(db);
  res.json({ message: "Job deleted" });
});

// ─── RESUMES ─────────────────────────────────────────────────────────────────

// POST /api/resumes — upload resume (text/base64 content)
app.post("/api/resumes", authenticate, requireRole("candidate"), (req, res) => {
  const { filename, content } = req.body;
  if (!filename || !content) return res.status(400).json({ error: "filename and content are required" });
  const db = loadDB();
  const id = uuidv4();
  db.resumes[id] = { id, userId: req.user.id, filename, content, uploadedAt: new Date().toISOString() };
  saveDB(db);
  res.status(201).json({ id, filename, uploadedAt: db.resumes[id].uploadedAt });
});

// GET /api/resumes/my — get my resumes
app.get("/api/resumes/my", authenticate, requireRole("candidate"), (req, res) => {
  const db = loadDB();
  const resumes = Object.values(db.resumes).filter(r => r.userId === req.user.id).map(r => ({
    id: r.id, filename: r.filename, uploadedAt: r.uploadedAt
  }));
  res.json(resumes);
});

// ─── APPLICATIONS ─────────────────────────────────────────────────────────────

// POST /api/applications — apply for a job
app.post("/api/applications", authenticate, requireRole("candidate"), (req, res) => {
  const { jobId, resumeId, coverLetter } = req.body;
  if (!jobId) return res.status(400).json({ error: "jobId is required" });
  const db = loadDB();
  if (!db.jobs[jobId]) return res.status(404).json({ error: "Job not found" });

  const duplicate = Object.values(db.applications).find(a => a.jobId === jobId && a.candidateId === req.user.id);
  if (duplicate) return res.status(400).json({ error: "You have already applied for this job" });

  if (resumeId && !db.resumes[resumeId]) return res.status(400).json({ error: "Resume not found" });
  if (resumeId && db.resumes[resumeId]?.userId !== req.user.id) return res.status(403).json({ error: "That is not your resume" });

  const id = uuidv4();
  const app = {
    id, jobId, candidateId: req.user.id, candidateName: req.user.name, candidateEmail: req.user.email,
    resumeId: resumeId || null, coverLetter: coverLetter || "",
    status: "pending", appliedAt: new Date().toISOString()
  };
  db.applications[id] = app;
  saveDB(db);
  res.status(201).json({ ...app, job: db.jobs[jobId] });
});

// GET /api/applications/my — candidate's applications
app.get("/api/applications/my", authenticate, requireRole("candidate"), (req, res) => {
  const db = loadDB();
  const apps = Object.values(db.applications)
    .filter(a => a.candidateId === req.user.id)
    .map(a => ({ ...a, job: db.jobs[a.jobId] }));
  res.json(apps);
});

// GET /api/applications/job/:jobId — employer views applications for a job
app.get("/api/applications/job/:jobId", authenticate, requireRole("employer", "admin"), (req, res) => {
  const db = loadDB();
  const apps = Object.values(db.applications)
    .filter(a => a.jobId === req.params.jobId)
    .map(a => ({ ...a, resume: a.resumeId ? db.resumes[a.resumeId] : null }));
  res.json(apps);
});

// PUT /api/applications/:id/status — employer updates application status
app.put("/api/applications/:id/status", authenticate, requireRole("employer", "admin"), (req, res) => {
  const { status } = req.body;
  const validStatuses = ["pending", "reviewed", "shortlisted", "rejected", "accepted"];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
  const db = loadDB();
  if (!db.applications[req.params.id]) return res.status(404).json({ error: "Application not found" });
  db.applications[req.params.id].status = status;
  db.applications[req.params.id].updatedAt = new Date().toISOString();
  saveDB(db);
  res.json(db.applications[req.params.id]);
});

// ─── ADMIN STATS ─────────────────────────────────────────────────────────────
app.get("/api/admin/stats", authenticate, requireRole("admin"), (req, res) => {
  const db = loadDB();
  res.json({
    totalUsers: Object.keys(db.users).length,
    totalJobs: Object.keys(db.jobs).length,
    totalApplications: Object.keys(db.applications).length,
    totalEmployers: Object.keys(db.employers).length,
    applicationsByStatus: Object.values(db.applications).reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {})
  });
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Job Board Platform running at http://localhost:${PORT}`);
  console.log("Tip: POST /api/seed to populate with demo data.");
});

module.exports = app;
