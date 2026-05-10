# CodeAlpha_Job_Board

**CodeAlpha Backend Development Internship — Task 4**

A full-stack Job Board Platform built with **Express.js** and JWT authentication. Supports three user roles: candidates, employers, and admins.

## Features

- Three user roles: Candidate, Employer, Admin
- Browse and search jobs by keyword, category, type, location
- Candidates can upload resumes and apply with cover letters
- Candidates can track application status
- Employers can post, manage listings and update applicant status
- Admin dashboard with platform statistics
- 4 demo jobs seeded on first run

## Tech Stack

| Layer          | Technology          |
|----------------|---------------------|
| Runtime        | Node.js             |
| Framework      | Express.js          |
| Auth           | JWT (jsonwebtoken)  |
| Password hash  | bcryptjs            |
| Database       | JSON file (db.json) |
| Frontend       | Vanilla HTML/CSS/JS |

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start
# Server runs on http://localhost:3002
```

## Demo Accounts

Automatically created on first run via `POST /api/seed`:

| Role     | Email                      | Password     |
|----------|----------------------------|--------------|
| Admin    | admin@jobboard.dev         | admin123     |
| Employer | employer@techco.co.za      | employer123  |

Register as a Candidate via the UI.

## API Endpoints

### Auth
| Method | Endpoint              | Description          | Auth |
|--------|-----------------------|----------------------|------|
| POST   | /api/auth/register    | Register user        | No   |
| POST   | /api/auth/login       | Login, receive JWT   | No   |
| GET    | /api/auth/me          | Get current user     | Yes  |

### Jobs
| Method | Endpoint        | Description                        | Auth              |
|--------|-----------------|------------------------------------|-------------------|
| GET    | /api/jobs       | List/search jobs (?q=&category=)   | No                |
| GET    | /api/jobs/:id   | Job details                        | No                |
| POST   | /api/jobs       | Post a job                         | Employer/Admin    |
| PUT    | /api/jobs/:id   | Update a job                       | Employer/Admin    |
| DELETE | /api/jobs/:id   | Delete a job                       | Employer/Admin    |

### Resumes
| Method | Endpoint          | Description         | Auth      |
|--------|-------------------|---------------------|-----------|
| POST   | /api/resumes      | Upload resume       | Candidate |
| GET    | /api/resumes/my   | List my resumes     | Candidate |

### Applications
| Method | Endpoint                           | Description                  | Auth           |
|--------|------------------------------------|------------------------------|----------------|
| POST   | /api/applications                  | Apply for a job              | Candidate      |
| GET    | /api/applications/my               | My applications              | Candidate      |
| GET    | /api/applications/job/:jobId       | Applicants for a job         | Employer/Admin |
| PUT    | /api/applications/:id/status       | Update application status    | Employer/Admin |

### Admin
| Method | Endpoint           | Description          | Auth  |
|--------|--------------------|----------------------|-------|
| GET    | /api/admin/stats   | Platform statistics  | Admin |

## Application Status Flow

`pending` → `reviewed` → `shortlisted` → `accepted` / `rejected`

## Project Structure

```
CodeAlpha_Job_Board/
├── server.js          # Express server + all API routes
├── public/
│   └── index.html     # Full frontend (auth + jobs + employer + admin)
├── db.json            # Auto-created with seed data on first run
├── package.json
└── README.md
```

## Author

**Sizwe Sigubudu** — CodeAlpha Backend Development Intern
