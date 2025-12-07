# SentinelCore


## 📝 Description

A Real-Time Security Tool to Detect Phishing URLs & Website-Linked QR Codes

SentinelCore is a lightweight but powerful full-stack (Frontend + Backend) security tool designed to instantly detect phishing websites and unsafe QR codes built under 24 hours for a hackathon.
It uses multi-layer phishing verification, scoring logic, and external threat-intel APIs to give fast, accurate, and actionable safety results

## ✨ Features

1) Phishing URL Scanner (Main Module)

 Paste ANY URL → SentinelCore instantly evaluates it using 8 different security checks.

- Phishing Score (0–100%)

 Calculated using our custom scoring engine.

- Domain Age Check

Uses WhoisFreak API to check age of the domain.
New domains are treated as suspicious.

- Typosquatting Detection

Detects look-alike fake domains:

amaz0n.com → amazon.com  
facebo0k.net → facebook.com

- HTTPS Validation

Checks if the URL uses secure https://.

- IP-Based URL Detection

Phishing websites commonly use raw IPs like:

http://192.134.23.90/login

- Blacklist Match (Local Database)

Checks if domain exists inside our curated file:

fake_urls.txt


If it exists → instantly 100% Dangerous.

= API-Based Malicious Score

We integrate:

* API	Purpose
- Phishark API	Returns malicious probability (used in scoring)
- URLert API	Deep scanning (not used in scoring, but added for extra verification)
📊 Visual Verdict Output

🟢 Safe

🟡 Suspicious

🔴 Dangerous

Along with a full reasoning list.

2)  QR Code Safety Scanner

Upload or scan any QR code →
We extract only the URL inside the QR and pass it through the entire phishing engine.

- Works only for website URLs embedded inside QR codes.
- Detects phishing redirects hidden inside QR


## Scoring System (Final Phishing Score)

* If domain exists in fake_urls.txt →
 Score = 100% (Dangerous)
(No other checks required)

If not found, apply scoring:

* Scoring Table

| Check | Condition | Score Increase |
| :--- | :--- | :--- |
| **Typosquatting** | `true` | +10 |
| **Missing HTTPS** | `true` | +5 |
| **IP-based URL** | `true` | +5 |
| **Phishark API Probability** | > 0.90 | +60 |
| | > 0.80 | +55 |
| | 0.50 – 0.80 | +45 |
| | 0.20 – 0.50 | +30 |
| **Domain Age** | < 100 days | +20% of current score |
| | 100 – 300 days | +17% |	


## 🛠️ Tech Stack

* Backend

- Node.js
- Express.js
- Axios
- path & fs module

- No Database (file-based storage only)

* Frontend

- React(vite)
- TailwindCss

* External APIs Used
 
- Phishark AP: URL malicious probability
- URLert API:	Deep phishing analysis
- WhoisFreak: API	Domain age lookup


## 📁 Project Structure

```
.
├── backend
│   ├── package.json
│   ├── routes
│   │   └── check.js
│   ├── server.js
│   ├── shortUrlDetecter.js
│   ├── urlChecker.js
│   └── utils
│       ├── checker.js
│       └── fake_urls.txt
└── client
    ├── eslint.config.js
    ├── index.html
    ├── package.json
    ├── public
    │   └── vite.svg
    ├── src
    │   ├── App.css
    │   ├── App.jsx
    │   ├── assets
    │   │   └── react.svg
    │   ├── index.css
    │   ├── main.jsx
    │   └── pages
    │       └── Dashboard.jsx
    └── vite.config.js
```

## Team Members

* Team Name: SIES2025
- Vinayak Andhere
- Aman Kalawati
- Manish Nadar

## How to Run Locally

1) Start Backend

- cd backend
- npm install
- npm start


* Backend will run on:

http://localhost:3000

2) Start Frontend

- cd client
- npm install
- npm run dev


* Frontend will run on:

http://localhost:5173





