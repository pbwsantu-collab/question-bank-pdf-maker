(function () {
  const { jsPDF } = window.jspdf;

  const titleEl = document.getElementById('title');
  const questionsEl = document.getElementById('questions');
  const fontSizeEl = document.getElementById('fontSize');
  const marginEl = document.getElementById('margin');
  const colGapEl = document.getElementById('colGap');
  const lineHeightEl = document.getElementById('lineHeight');
  const generateBtn = document.getElementById('generateBtn');
  const statusEl = document.getElementById('status');
  const offlineBadge = document.getElementById('offlineBadge');
  const installBanner = document.getElementById('installBanner');
  const installBtn = document.getElementById('installBtn');

  // Offline indicator
  function updateOnlineStatus() {
    offlineBadge.style.display = navigator.onLine ? 'none' : 'inline-flex';
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  // Install prompt
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBanner.classList.add('show');
  });
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBanner.classList.remove('show');
  });
  window.addEventListener('appinstalled', () => {
    installBanner.classList.remove('show');
    deferredPrompt = null;
  });

  // Parse questions: prefer blank-line blocks so multi-line questions stay intact
  function parseQuestions(raw) {
    const text = raw.replace(/\r\n/g, '\n').trim();
    if (!text) return [];

    const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    if (blocks.length > 1) return blocks;

    // Fallback: one question per non-empty line
    return text.split('\n').map(l => l.trim()).filter(Boolean);
  }

  function generatePDF() {
    const title = (titleEl.value || 'Question Bank').trim();
    const raw = questionsEl.value;
    const questions = parseQuestions(raw);

    if (questions.length === 0) {
      statusEl.textContent = 'Please enter at least one question.';
      statusEl.className = 'status err';
      return;
    }

    const fontSize = parseFloat(fontSizeEl.value) || 8;
    const marginMm = parseFloat(marginEl.value) || 10;
    const colGapMm = parseFloat(colGapEl.value) || 6;
    const lineHeightMult = parseFloat(lineHeightEl.value) || 1.25;

    generateBtn.disabled = true;
    statusEl.textContent = 'Generating…';
    statusEl.className = 'status';

    setTimeout(() => {
      try {
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        const pageW = doc.internal.pageSize.getWidth();   // 210
        const pageH = doc.internal.pageSize.getHeight();  // 297

        const margin = marginMm;
        const usableW = pageW - 2 * margin;
        const colGap = colGapMm;
        const colW = (usableW - colGap) / 2;

        const leftX = margin;
        const rightX = margin + colW + colGap;
        const midX = margin + colW + colGap / 2; // for vertical divider

        // ---- Title (compact, centered) ----
        doc.setFont('helvetica', 'bold');
        const titleSize = Math.max(fontSize + 1.5, 9);
        doc.setFontSize(titleSize);
        const titleLines = doc.splitTextToSize(title, usableW);
        let y = margin;
        titleLines.forEach(line => {
          doc.text(line, pageW / 2, y, { align: 'center' });
          y += titleSize * 0.38;
        });
        y += 1.5;

        // thin separator under title
        doc.setDrawColor(160);
        doc.setLineWidth(0.25);
        doc.line(margin, y, pageW - margin, y);
        y += 2.5;

        const bodyFontSize = fontSize;
        // 1 pt ≈ 0.352778 mm
        const lineHeightMm = bodyFontSize * 0.352778 * lineHeightMult;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(bodyFontSize);
        doc.setTextColor(0);

        // ============================================================
        // TRUE 2-COLUMN FLOW (newspaper style)
        // Fill left column top→bottom, then right column, then next page.
        // Prefer keeping a whole question in one column when possible.
        // ============================================================

        let currentCol = 0;               // 0 = left, 1 = right
        let colY = [y, y];                // current Y for each column
        const bottomLimit = pageH - margin - 4; // leave room for page number

        function drawColumnDivider() {
          // subtle vertical line between columns
          doc.setDrawColor(200);
          doc.setLineWidth(0.15);
          const top = (doc.internal.getNumberOfPages() === 1) ? y : margin;
          doc.line(midX, top, midX, bottomLimit);
        }

        function newPage() {
          drawColumnDivider(); // finish previous page
          doc.addPage();
          colY = [margin, margin];
          currentCol = 0;
          // divider will be drawn at end of this page or when leaving
        }

        // Pre-draw divider for first page
        drawColumnDivider();

        questions.forEach((q, qIdx) => {
          // Number the question for clarity (optional but useful)
          const numbered = (qIdx + 1) + '. ' + q;
          const lines = doc.splitTextToSize(numbered, colW - 0.5);

          const needed = lines.length * lineHeightMm + lineHeightMm * 0.3; // + small gap
          const remaining = bottomLimit - colY[currentCol];

          // If the whole question does not fit and we have almost no room left,
          // move to the other column / next page first.
          if (needed > remaining && remaining < lineHeightMm * 1.8) {
            if (currentCol === 0) {
              currentCol = 1;
            } else {
              newPage();
              drawColumnDivider();
            }
          }

          // Write every line of this question
          lines.forEach((line) => {
            // Still not enough room for even one more line?
            if (colY[currentCol] + lineHeightMm > bottomLimit) {
              if (currentCol === 0) {
                currentCol = 1;
              } else {
                newPage();
                drawColumnDivider();
              }
            }

            const x = currentCol === 0 ? leftX : rightX;
            doc.text(line, x, colY[currentCol]);
            colY[currentCol] += lineHeightMm;
          });

          // small breathing space after each question
          colY[currentCol] += lineHeightMm * 0.35;
        });

        // Final divider on last page
        drawColumnDivider();

        // ---- Page numbers ----
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(110);
          doc.text(i + ' / ' + totalPages, pageW / 2, pageH - 4, { align: 'center' });
          doc.setTextColor(0);
        }

        const safeName = title.replace(/[^\w\s-]/g, '').trim().slice(0, 40) || 'question-bank';
        doc.save(safeName + '.pdf');

        statusEl.textContent = `Done — ${questions.length} questions • ${totalPages} page(s) • 2-column`;
        statusEl.className = 'status ok';
      } catch (err) {
        console.error(err);
        statusEl.textContent = 'Error: ' + (err.message || 'generation failed');
        statusEl.className = 'status err';
      } finally {
        generateBtn.disabled = false;
      }
    }, 40);
  }

  generateBtn.addEventListener('click', generatePDF);

  // Load any previously saved draft
  try {
    const saved = localStorage.getItem('qb-draft');
    if (saved) {
      const data = JSON.parse(saved);
      if (data.title) titleEl.value = data.title;
      if (data.questions) questionsEl.value = data.questions;
    }
  } catch (_) {}

  // Auto-save draft
  function saveDraft() {
    try {
      localStorage.setItem('qb-draft', JSON.stringify({
        title: titleEl.value,
        questions: questionsEl.value
      }));
    } catch (_) {}
  }
  titleEl.addEventListener('input', saveDraft);
  questionsEl.addEventListener('input', saveDraft);
})();
