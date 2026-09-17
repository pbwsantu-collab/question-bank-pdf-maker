# Question Bank PDF Maker

Offline-capable Progressive Web App that creates **print-ready, space-efficient 2-column question bank PDFs**.

## Features

- 2-column A4 layout with compact typography
- Minimal margins & padding
- Preserves every word of your questions
- Fully offline after first load (Service Worker caches app + jsPDF)
- Installable on mobile and desktop
- Client-side only — no data leaves your device
- Adjustable font size, margins, column gap, line height
- Auto-saves draft to localStorage

## Live

**https://pbwsantu-collab.github.io/question-bank-pdf-maker/**

1. Open the link above (or open `index.html` locally)
2. Paste / type your questions (separate questions with a blank line)
3. Adjust settings if needed
4. Click **Generate PDF**

For full PWA install + offline support, serve over HTTPS (GitHub Pages does this) or localhost.

## Deploy with GitHub Pages

Already configured. If you fork:

1. Go to **Settings → Pages**
2. Source: Deploy from a branch → `main` → `/ (root)`
3. App available at `https://<your-username>.github.io/question-bank-pdf-maker/`

## Offline usage

On first visit the Service Worker caches:
- The app files
- jsPDF library (from CDN)

Afterwards the app works fully offline, including PDF generation.

## Local / Zip

You can also download the full package (includes a local copy of jsPDF) from the artifacts if available.

## Tech

- Vanilla HTML/CSS/JS
- [jsPDF 2.5.1](https://github.com/parallax/jspdf) for PDF generation
- Web App Manifest + Service Worker
