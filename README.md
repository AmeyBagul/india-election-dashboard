# India Election Live SVG Dashboard

This is a dependency-free local web app for showing India election results on an SVG election-area map.

The page now works as a live-result cockpit:

- party-wise won/leading cards
- SVG map colored by leading/winning party
- selected constituency detail panel
- close-contest watchlist
- searchable and filterable result explorer
- source and timestamp labels for trust
- sample data for development when no counting page is live

## Run

```powershell
npm start
```

Open `http://localhost:3000`.

If normal `node`/`npm` is blocked on this machine, run it with the bundled Codex Node runtime:

```powershell
& 'C:\Users\ameyb\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' server.js
```

By default the app uses `data/sample-results.json`, so the page works even when no counting is live.

## Connect to ECI results

Set `ECI_SOURCE_URL` to a public page from the Election Commission results website:

```powershell
$env:ECI_SOURCE_URL="https://results.eci.gov.in/ResultAcGenMar2023/search.htm"
npm start
```

The server fetches the ECI page, parses recognizable result tables, and exposes them to the browser at `/api/results`. The browser polls once per minute and colors matching SVG areas by party.

ECI pages and table structures can change between elections, so the parser is intentionally conservative. If a new election page has different columns, update `parseEciHtml` in `server.js`.

See `DATA_SOURCES.md` for the source priority, observed ECI URL patterns, sorting rules, and normalized data model.

## Deploy to Live Web

### Using Vercel (Recommended)

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/india-election-dashboard.git
   git push -u origin main
   ```

2. **Deploy on Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Sign up/login with GitHub
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect the Node.js app
   - Set environment variables if needed:
     - `ECI_SOURCE_URL` (optional, for live ECI data)
     - `TARGET_STATES` (optional, defaults to "West Bengal,Tamil Nadu")
   - Click "Deploy"

3. **Your live dashboard will be available at:** `https://your-project-name.vercel.app`

### Using Netlify

1. Push to GitHub as above
2. Go to [netlify.com](https://netlify.com)
3. Sign up/login with GitHub
4. Click "New site from Git"
5. Choose your repository
6. Set build command: `npm start`
7. Set publish directory: `.` (root)
8. Add environment variables in Netlify dashboard
9. Deploy

### Using Railway

1. Push to GitHub
2. Go to [railway.app](https://railway.app)
3. Connect GitHub repo
4. Railway auto-detects Node.js
5. Set environment variables
6. Deploy

## Environment Variables

- `ECI_SOURCE_URL`: URL to live ECI results page (optional)
- `TARGET_STATES`: Comma-separated state names (default: "West Bengal,Tamil Nadu")
- `FETCH_INTERVAL_MS`: Polling interval in milliseconds (default: 120000)
- `PORT`: Server port (default: 3000)

Each SVG shape needs a `data-seat` value that matches a normalized result area name. For example:

```html
<path data-seat="uttar-pradesh" d="..."></path>
```

Result names are normalized to lowercase ids with spaces changed to hyphens, so `Uttar Pradesh` maps to `uttar-pradesh`.

## Notes

- Use the official ECI results site as the source of truth.
- Keep the polling interval reasonable. The server currently caches source responses for at least 30 seconds.
- For production hosting, run this behind a proper Node process manager and add logging, retries, and a map SVG for the exact election area.
