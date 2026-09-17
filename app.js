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

  function updateOnlineStatus() {
    offlineBadge.style.display = navigator.onLine ? 'none' : 'inline-flex';
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBanner.classList.add('show');
  });
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBanner.classList.remove('show');
  });
  window.addEventListener('appinstalled', () => {
    installBanner.classList.remove('show');
    deferredPrompt = null;
  });

  // Split on blank lines first (keeps multi-line questions together)
  function parseQuestions(raw) {
    const text = (raw || '').replace(/\r\n/g, '\n').trim();
    if (!text) return [];
    const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    if (blocks.length > 1) return blocks;
    return text.split('\n').map(l => l.trim()).filter(Boolean);
  }

  function generatePDF() {
    const title = (titleEl.value || 'Question Bank').trim();
    const questions = parseQuestions(questionsEl.value);

    if (questions.length === 0) {
      statusEl.textContent = 'Please enter at least one question.';
      statusEl.className = 'status err';
      return;
    }

    const fontSize = parseFloat(fontSizeEl.value) || 8;
    const margin = parseFloat(marginEl.value) || 10;
    const colGap = parseFloat(colGapEl.value) || 6;
    const lhMult = parseFloat(lineHeightEl.value) || 1.25;

    generateBtn.disabled = true;
    statusEl.textContent = 'Generating…';
    statusEl.className = 'status';

    setTimeout(() => {
      try {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();   // 210
        const pageH = doc.internal.pageSize.getHeight();  // 297

        const usableW = pageW - 2 * margin;
        const colW = (usableW - colGap) / 2;
        const leftX = margin;
        const rightX = margin + colW + colGap;
        const midX = margin + colW + colGap / 2;

        // ---- Title ----
        doc.setFont('helvetica', 'bold');
        const titleSize = Math.min(Math.max(fontSize + 2, 9), 12);
        doc.setFontSize(titleSize);
        const titleLines = doc.splitTextToSize(title, usableW);
        let titleBottom = margin;
        titleLines.forEach(line => {
          doc.text(line, pageW / 2, titleBottom, { align: 'center' });
          titleBottom += titleSize * 0.4;
        });
        titleBottom += 1.2;

        doc.setDrawColor(150);
        doc.setLineWidth(0.2);
        doc.line(margin, titleBottom, pageW - margin, titleBottom);
        titleBottom += 2.2;

        // Body metrics
        const lineH = fontSize * 0.352778 * lhMult; // pt → mm
        const bottomLimit = pageH - margin - 5;     // leave space for page nº
        const gapAfterQ = lineH * 0.4;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor(20);

        // =====================================================
        // Reliable 2-column cursor
        // =====================================================
        let col = 0;                    // 0 = left, 1 = right
        let y = [titleBottom, titleBottom];

        function colX() { return col === 0 ? leftX : rightX; }

        function drawDivider(pageTop) {
          doc.setDrawColor(190);
          doc.setLineWidth(0.12);
          doc.line(midX, pageTop, midX, bottomLimit);
        }

        // first page divider
        drawDivider(titleBottom);

        function advanceColumnOrPage() {
          if (col === 0) {
            col = 1;
            // right column starts at same top as left did on this page
          } else {
            // finish current page divider already drawn
            doc.addPage();
            col = 0;
            y = [margin, margin];
            drawDivider(margin);
          }
        }

        // Pre-split every question into lines that fit the column width
        const prepared = questions.map((q, i) => {
          const text = (i + 1) + '. ' + q;
          return doc.splitTextToSize(text, colW - 1);
        });

        prepared.forEach((lines) => {
          const blockH = lines.length * lineH + gapAfterQ;

          // Does the whole block fit in the remaining space of the current column?
          if (y[col] + blockH > bottomLimit + 0.5) {
            // try the other column / next page
            advanceColumnOrPage();
          }

          // Now write line by line (in case a single question is extremely long)
          lines.forEach(line => {
            if (y[col] + lineH > bottomLimit) {
              advanceColumnOrPage();
            }
            doc.text(line, colX(), y[col]);
            y[col] += lineH;
          });

          y[col] += gapAfterQ;
        });

        // ---- Page numbers ----
        const total = doc.internal.getNumberOfPages();
        for (let p = 1; p <= total; p++) {
          doc.setPage(p);
          doc.setFontSize(7);
          doc.setTextColor(120);
          doc.text(p + ' / ' + total, pageW / 2, pageH - 3.5, { align: 'center' });
        }

        const safe = title.replace(/[^\w\s\-]/g, '').trim().slice(0, 40) || 'question-bank';
        doc.save(safe + '.pdf');

        statusEl.textContent = `Done — ${questions.length} questions • ${total} page(s) • 2-column`;
        statusEl.className = 'status ok';
      } catch (err) {
        console.error(err);
        statusEl.textContent = 'Error: ' + (err.message || 'generation failed');
        statusEl.className = 'status err';
      } finally {
        generateBtn.disabled = false;
      }
    }, 30);
  }

  generateBtn.addEventListener('click', generatePDF);

  // Draft persistence
  try {
    const saved = localStorage.getItem('qb-draft');
    if (saved) {
      const d = JSON.parse(saved);
      if (d.title) titleEl.value = d.title;
      if (d.questions) questionsEl.value = d.questions;
    }
  } catch (_) {}

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
