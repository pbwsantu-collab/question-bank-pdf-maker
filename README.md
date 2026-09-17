# Question Bank PDF Maker

Offline-capable Progressive Web App that creates **print-ready, space-efficient 2-column question bank PDFs**.

## Features

- 2-column A4 layout with compact typography
- Minimal margins & padding
- Preserves every word of your questions
- Fully offline after first load (Service Worker)
- Installable on mobile and desktop
- Client-side only — no data leaves your device
- Adjustable font size, margins, column gap, line height

## Live / Use

1. Open `index.html` in a modern browser, **or**
2. Host the folder on any static host (GitHub Pages, Netlify, Vercel, etc.)
3. Click **Generate PDF** after pasting your questions

For full PWA install + offline support, serve over HTTPS or localhost.

## Deploy with GitHub Pages

1. Go to **Settings → Pages**
2. Source: Deploy from a branch → `main` → `/ (root)`
3. Your app will be available at `https://pbwsantu-collab.github.io/question-bank-pdf-maker/`

## Tech

- Vanilla HTML/CSS/JS
- [jsPDF](https://github.com/parallax/jspdf) for PDF generation
- Web App Manifest + Service Worker
