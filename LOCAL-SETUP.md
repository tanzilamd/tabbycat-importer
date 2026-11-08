# Tabbycat Sheet Importer — Local Setup

## Requirements
- Windows, macOS or Linux.
- Node.js 22.13 or newer (Node.js 24 LTS is suitable), with npm.
- Internet access to download dependencies and contact Google Sheets / Tabbycat.
- Your tournament URL and a Tabbycat API token with permission to create teams/adjudicators. Enable the tournament API in Tabbycat.

## First run
1. Extract this ZIP. Open a terminal in the tabbycat-importer folder containing package.json.
2. Install the project's pinned package manager:

   npm install --global pnpm@11.25.0

3. Install dependencies:

   pnpm install --frozen-lockfile

4. Start the app:

   pnpm dev --hostname 127.0.0.1

5. Open http://127.0.0.1:5173/signin-with-chatgpt?return_to=%2F in your browser.
   This signs you into the local development app with a simulated identity.
   It does not require a real ChatGPT login or a Plus subscription.
   Use the exact address printed by the terminal if the port differs.

## Import
1. Paste the full HTTPS tournament URL (including its slug) and the site's API token.
2. Click Test connection.
3. Choose Teams or Adjudicators; use Download template to prepare your data.
4. For Google Sheets, enable Anyone with the link can view and copy the correct tab's link. Click Load sheet. Private sheets can be exported as CSV and uploaded instead.
5. Review the full-sheet check and column mapping. Columns can be in any order.
6. Blank institution_code is allowed. For a nonblank code, the institution must already exist in Tabbycat. Add missing codes there, then Recheck institutions & full sheet.
7. Approve the import and click Import / retry. These are real writes to the specified Tabbycat tournament.
8. Download the results report. Keep the browser tab and terminal open until the import finishes.

Each active speaker/adjudicator needs a name and valid email. Leave all Speaker 3 fields empty for a two-speaker team. Blank phone becomes 1234567890, blank gender becomes O, and blank adjudicator base_score becomes 5.5. Existing names and duplicate names are skipped. Blank institutions import as null.

Recheck uses the currently loaded rows in this version. After editing the Google Sheet, click Load sheet again; for CSV, upload the updated file.

## Later runs
Open the same project folder and run:

   pnpm dev --hostname 127.0.0.1

Open http://127.0.0.1:5173 and sign in through the local sign-in link if needed. Re-enter your API token. Stop the server with Ctrl+C. Do not use pnpm start for this workflow: the built Worker preview does not provide simulated sign-in.

## Troubleshooting
- pnpm is not recognized: close and reopen the terminal after installing it.
- Node version error: check node --version and upgrade Node.js to satisfy the requirements.
- Sign in with ChatGPT / HTTP 401 from the local app: open the local sign-in URL above and use the same hostname (127.0.0.1) for the app.
- HTTP 401/403 from Tabbycat: check the token, API setting and permissions for this site/tournament.
- Cannot read Google Sheet: ensure link-view sharing is enabled or upload its CSV export.
- Sheet changes are missing: Load sheet again, or upload a fresh CSV.
- A row fails: read its reason and download Rows to fix. Fix the source and reload it.
- An uncertain write: check Tabbycat before retrying; the row might already have been created.

This package contains the current hosted source, including its Tabbycat theme and action loader. Dependency downloads are required on first setup. Local execution needs no OpenAI API key. Keep the server on your own computer's loopback address.
