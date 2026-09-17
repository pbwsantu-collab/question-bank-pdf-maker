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

  // Prefer blank-line blocks so multi-line questions stay intact
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
    const colGap = parseFloat(colGapEl.value) || 8;
    const lhMult = parseFloat(lineHeightEl.value) || 1.35;

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

        const pageW = 210;
        const pageH = 297;

        // --- Layout constants ---
        const usableW = pageW - 2 * margin;
        const colW = (usableW - colGap) / 2;
        const pad = 1.5;                    // inner padding inside each column
        const textW = colW - pad * 2;       // actual width available for text

        const leftX  = margin + pad;
        const rightX = margin + colW + colGap + pad;
        const midX   = margin + colW + colGap / 2;

        // --- Title ---
        doc.setFont('helvetica', 'bold');
        const titleSize = Math.min(Math.max(fontSize + 2, 10), 13);
        doc.setFontSize(titleSize);
        const titleLines = doc.splitTextToSize(title, usableW - 4);
        let yPos = margin + 2;
        titleLines.forEach(line => {
          doc.text(line, pageW / 2, yPos, { align: 'center' });
          yPos += titleSize * 0.42;
        });
        yPos += 1.5;

        // separator line under title
        doc.setDrawColor(140);
        doc.setLineWidth(0.3);
        doc.line(margin, yPos, pageW - margin, yPos);
        yPos += 3;

        // --- Body setup ---
        // 1 point = 0.352778 mm
        const lineH = Math.max(fontSize * 0.352778 * lhMult, fontSize * 0.42);
        const bottomLimit = pageH - margin - 6;
        const qGap = lineH * 0.45;          // space after each question

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor(15);

        // =====================================================
        // Column state
        // =====================================================
        let col = 0;                        // 0 = left, 1 = right
        let colY = [yPos, yPos];            // current baseline Y for each column

        function xOf(c) {
          return c === 0 ? leftX : rightX;
        }

        function drawVLine(top) {
          doc.setDrawColor(180);
          doc.setLineWidth(0.2);
          doc.line(midX, top, midX, bottomLimit);
        }

        // Draw divider for the first page
        drawVLine(yPos);

        function goNextColumnOrPage() {
          if (col === 0) {
            col = 1;
            // right column starts at the same top as left
          } else {
            doc.addPage();
            col = 0;
            colY = [margin, margin];
            drawVLine(margin);
          }
        }

        // Pre-wrap every question to the exact text width of one column
        const blocks = questions.map((q, i) => {
          const txt = (i + 1) + '. ' + q;
          return doc.splitTextToSize(txt, textW);
        });

        // ---- Main placement loop ----
        blocks.forEach((lines) => {
          const needed = lines.length * lineH + qGap;

          // If the whole question does not fit in the remaining space of
          // the current column, move to the next column / page first.
          if (colY[col] + needed > bottomLimit) {
            goNextColumnOrPage();
          }

          // Write the lines of this question
          lines.forEach(line => {
            // Safety: if somehow still no room, force next column
            if (colY[col] + lineH > bottomLimit) {
              goNextColumnOrPage();
            }
            doc.text(line, xOf(col), colY[col]);
            colY[col] += lineH;
          });

          colY[col] += qGap;
        });

        // ---- Page numbers ----
        const totalPages = doc.internal.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
          doc.setPage(p);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(110);
          doc.text(String(p) + ' / ' + totalPages, pageW / 2, pageH - 4, { align: 'center' });
        }

        const safeName = title.replace(/[^\w\s\-]/g, '').trim().slice(0, 45) || 'question-bank';
        doc.save(safeName + '.pdf');

        statusEl.textContent = `Done — ${questions.length} questions • ${totalPages} page(s) • 2-column`;
        statusEl.className = 'status ok';
      } catch (err) {
        console.error(err);
        statusEl.textContent = 'Error: ' + (err.message || 'PDF generation failed');
        statusEl.className = 'status err';
      } finally {
        generateBtn.disabled = false;
      }
    }, 40);
  }

  generateBtn.addEventListener('click', generatePDF);

  // Restore draft
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
