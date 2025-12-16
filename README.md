# MICDS Assessment (Full)

Built from the MICDS assessment sheet structure.  [oai_citation:18‡Example%20middle%20school%20assessment%20sheet.pdf.pdf](sediment://file_00000000808471f5a9b08afe30fcedb7)

## Features
- Google Sign-in
- Restricted to @micds.org
- Teacher role via whitelist
  - prosen@micds.org
- Student vs Teacher edit-locking
- Standards 1–4 scoring using the sheet's green/red/bright-green conversion logic
- Reassessment fields unlock only when teacher score is 1–2
- IndexedDB storage (no Google Sheets, no database required)
- Export/Import JSON backups

## Setup (Firebase)
1. Firebase Console → Create project
2. Authentication → Sign-in method → Enable Google
3. Authentication → Settings → Authorized domains
   - Add your Netlify/Vercel domain after deploy

## Deploy (Netlify recommended)
- Drag-and-drop the repo folder OR connect GitHub repo in Netlify
- Netlify will host HTTPS automatically (required for Google login)

## Restrict to MICDS
This project enforces @micds.org in code. (Optionally, also enforce via Google Workspace settings if you control them.)
