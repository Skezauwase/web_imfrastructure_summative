# ResearchRadar

A free academic paper discovery tool that lets students and researchers search 250M+ scholarly works — no account, no paywall, no API key required.

## Live URLs

| Server | Address |
|--------|---------|
| Load Balancer (main entry point) | http://lb-01.skeza.tech |
| Web Server 01 | http://54.166.88.241 |
| Web Server 02 | http://3.80.189.90 |

---

## Features

- **Search** — full-text search across 250M+ papers via OpenAlex
- **Filter** — by year range, open access status, author country, and minimum citations
- **Sort** — by relevance, most cited, newest, or oldest
- **Paper Details** — modal view with full abstract, all authors, institutions, citation stats
- **Open Access Links** — direct PDF download when a paper is freely available
- **Trending Topics** — curated list of hot research fields, each linking to a live search
- **List / Grid View** — toggle between display modes
- **Pagination** — navigate through thousands of results
- **Responsive** — works on mobile, tablet, and desktop

---

## APIs Used

### 1. OpenAlex API
- **URL:** https://api.openalex.org
- **Docs:** https://docs.openalex.org
- **Purpose:** Search papers, fetch abstracts, authors, citation counts, open access URLs
- **Auth:** None required — completely free and open
- **Rate limit:** Polite pool (unlimited) when a `mailto` param is included

### 2. REST Countries API
- **URL:** https://restcountries.com/v3.1/all
- **Docs:** https://restcountries.com
- **Purpose:** Populate the "Author Country" filter dropdown with country names and ISO codes
- **Auth:** None required — completely free and open

> No API keys are needed. There are no secrets to configure.

---

## Running Locally

### Requirements
- Node.js 18+
- npm

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO/researchradar

# 2. Install dependencies
npm install

# 3. Start the server
npm start

# 4. Open in browser
# http://localhost:3000
```

For development with auto-reload:
```bash
npm run dev
```

---

## Deployment

The app is deployed on two Ubuntu web servers behind an Nginx load balancer.

### Architecture

```
User → Lb01 (Nginx load balancer) → Web01 (Node.js + Nginx)
                                  → Web02 (Node.js + Nginx)
```

### Step 1 — Deploy on Web01 and Web02

SSH into each web server and run the setup script:

```bash
# On Web01 (54.166.88.241)
ssh ubuntu@54.166.88.241
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO/researchradar
bash scripts/deploy-web.sh

# Repeat on Web02 (3.80.189.90)
ssh ubuntu@3.80.189.90
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO/researchradar
bash scripts/deploy-web.sh
```

The script does the following automatically:
1. Installs Node.js 18 and Nginx
2. Installs PM2 (keeps the Node.js app running after reboots)
3. Runs the app on port 3000
4. Configures Nginx to proxy port 80 → port 3000
5. Enables Nginx and PM2 on system startup

### Step 2 — Configure Load Balancer on Lb01

```bash
ssh ubuntu@13.218.49.63
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO/researchradar
bash scripts/deploy-lb.sh
```

The script configures Nginx on Lb01 with an upstream block pointing to both web servers using **round-robin** load balancing. It also configures automatic failover — if one server is down, all traffic is routed to the other.

### Step 3 — Verify

```bash
# Check load balancer is routing correctly
curl http://13.218.49.63

# Check individual servers are up
curl http://54.166.88.241
curl http://3.80.189.90

# Check load balancer health endpoint
curl http://lb-01.skeza.tech/health
```

### Load Balancer Configuration

Nginx on Lb01 uses the default **round-robin** algorithm. Each new request goes to the next server in the pool alternately:

```nginx
upstream researchradar_backend {
    server 54.166.88.241:80;   # Web01
    server 3.80.189.90:80;     # Web02
}
```

`proxy_next_upstream` is configured so that if one web server fails (error, timeout, 5xx), Nginx automatically retries the request on the other server — ensuring zero downtime for users.

### Keeping the App Updated

To redeploy after pushing new code:

```bash
# On each web server
ssh ubuntu@54.166.88.241
cd /var/www/researchradar/researchradar
git pull origin main
npm install --production
pm2 restart researchradar
```

---

## Project Structure

```
researchradar/
├── public/
│   ├── index.html        # Discover page
│   ├── trending.html     # Trending topics page
│   ├── about.html        # About page
│   ├── css/
│   │   └── style.css     # All styles (shared across pages)
│   └── js/
│       ├── app.js        # Discover page logic + API calls
│       ├── trending.js   # Trending page logic
│       └── about.js      # About page logic
├── scripts/
│   ├── deploy-web.sh     # Web server setup script
│   └── deploy-lb.sh      # Load balancer setup script
├── server.js             # Express static file server
├── package.json
└── README.md
```

---

## Error Handling

The application handles the following failure scenarios:

| Scenario | User Feedback |
|----------|--------------|
| No internet connection | "You appear to be offline. Check your internet connection." |
| Request timeout (>10s) | "Request timed out. The server took too long to respond." |
| API rate limit (429) | "Too many requests. Please wait a moment and try again." |
| API unavailable (502/503) | "The OpenAlex API is temporarily unavailable." |
| Unexpected server error | "Server error (code). Please try again." |
| Malformed response | "Received an unexpected response from the server." |
| No results found | Empty state with suggestion to adjust keywords or filters |

All user-facing text is HTML-escaped to prevent XSS attacks.

---

## Security

- All API data rendered to the DOM is passed through `escHtml()` — preventing XSS injection
- No API keys or secrets exist in this project (both APIs are fully public)
- The `.gitignore` excludes `node_modules/` and `.env` files

---

## Challenges

**1. Abstract format** — OpenAlex stores paper abstracts as an inverted index (`{ word: [position1, position2] }`) rather than plain text. Decoding this required reconstructing the word order by sorting positions.

**2. Deep pagination** — OpenAlex caps results at page 200. The pagination component clamps to this limit to prevent invalid API requests.

**3. Responsive filters** — On mobile, the filters sidebar converts to a slide-in drawer using CSS transforms and a JavaScript toggle, keeping the UI usable on small screens.

---

## Credits

- **OpenAlex** — https://openalex.org — Priem, J., Piwowar, H., & Orr, R. (2022). OpenAlex: A fully-open index of the world's research literature. arXiv. https://arxiv.org/abs/2205.01833
- **REST Countries** — https://restcountries.com — Fayder Rojas and contributors
- **Google Fonts (Outfit)** — https://fonts.google.com/specimen/Outfit
- **Express.js** — https://expressjs.com
