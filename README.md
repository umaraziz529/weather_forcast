# Atmos Weather — Weather website + consent-based location records

This project uses GitHub Pages (or Cloudflare Pages) for the static frontend, a Cloudflare Worker as the insert API, Open-Meteo for weather/geocoding, and Supabase for database/authentication.

## Files
- `index.html`, `styles.css`, `app.js`: public weather website.
- `admin.html`, `admin.js`: Supabase Auth admin login and record viewer.
- `config.js`: public frontend configuration (only Supabase URL + publishable/anon key).
- `worker.js`: Cloudflare Worker API that inserts consented location records.
- `schema.sql`: database schema and admin-only read/delete policies.

## 1. Supabase setup
1. Create a Supabase project.
2. Create an administrator user in Authentication > Users. Use a strong password and disable public signups if you do not need them.
3. Copy the user's UUID.
4. In `schema.sql`, replace `ADMIN_USER_UUID` with that UUID (keep the single quotes) and run the SQL in SQL Editor.
5. In project settings, copy the Project URL and publishable key (or legacy anon key). These are intended for frontend use; RLS is essential.
6. Keep your service-role/secret key private.

## 2. Frontend configuration
Edit `config.js`:
- `LOCATION_API_URL`: deployed Worker base URL, e.g. `https://weather-location-api.YOUR-SUBDOMAIN.workers.dev`
- `SUPABASE_URL`: your Supabase project URL.
- `SUPABASE_ANON_KEY`: your publishable/anon key.

Never place the Supabase secret/service-role key in `config.js`.

## 3. Deploy the Cloudflare Worker
1. Cloudflare Dashboard > Workers & Pages > Create > Worker.
2. Paste `worker.js` into the Worker editor and deploy.
3. Add encrypted Worker secrets:
   - `SUPABASE_URL`: Supabase project URL.
   - `SUPABASE_SECRET_KEY`: server-side Supabase secret/service-role key. Treat it like a password.
4. Add a Worker environment variable:
   - `ALLOWED_ORIGIN`: exact origin of your website, with no trailing slash. For GitHub Pages this is often `https://USERNAME.github.io` or `https://USERNAME.github.io/REPOSITORY` is a URL path, not an origin. For a project path, set only the origin `https://USERNAME.github.io`. If you use a custom domain, use `https://your-domain.example`.
5. Deploy again after setting variables/secrets. Copy the Worker URL into `config.js`.

The Worker checks the Origin header and validates the submitted fields. This is basic protection, not proof that a human genuinely clicked a consent checkbox: any public browser endpoint can be called by custom clients. Use platform rate limiting/WAF rules, monitor usage, and consider CAPTCHA or a stronger consent/session design before a public launch.

## 4. Deploy frontend
- GitHub Pages: upload the frontend files to your repository root, enable Pages in repository Settings, and wait for deployment.
- Cloudflare Pages: upload/connect the same frontend files and deploy.
- Edit `config.js` before deploying. The public website must use HTTPS for browser geolocation.

## 5. Test
1. Open the website over HTTPS.
2. Search a city; weather should load without location permission.
3. Click “Use my location”, then approve the browser's location prompt.
4. Leave the storage checkbox unchecked: weather works but no database record is sent.
5. Check the optional storage checkbox and continue: after browser location permission, the site posts coordinates to the Worker.
6. Open Supabase Table Editor > `location_records`.
7. Open `admin.html`, sign in with the Supabase admin user, and verify records are visible only to that user.

## Privacy and security
- This site stores location only after an explicit opt-in checkbox and browser location permission.
- A random session ID is not a real-world identity. Do not attempt to identify visitors without consent.
- Do not use location records to secretly track devices. Provide a privacy notice, retention period, and deletion/contact process.
- Admin dashboard shows up to 1,000 records per query in this starter implementation; pagination should be added for larger deployments.
- Restrict Supabase Auth signups and secure the admin account with a strong password/MFA where available.
- Add Worker rate limiting and abuse monitoring before broad public release.
- This is a starter implementation; review security and privacy requirements for your jurisdiction before production use.
