(function () {
  const { jsPDF } = window.jspdf;

  const titleEl = document.getElementById('title');
  const questionsEl = document.getElementById('questions');
  const fontSizeEl = document.getElementById('fontSize');
  const marginEl = document.getElementById('margin');
  const colGapEl = document.getElementById('colGap');
  const lineHeightEl = document.getElementById('lineHeight');
  const layoutEl = document.getElementById('layout');
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
    const layout = (layoutEl && layoutEl.value) || 'double';

    if (questions.length === 0) {
      statusEl.textContent = 'Please enter at least one question.';
      statusEl.className = 'status err';
      return;
    }

    const fontSize = parseFloat(fontSizeEl.value) || 8;
    const margin = parseFloat(marginEl.value) || 12;
    const colGap = parseFloat(colGapEl.value) || 8;
    const lhMult = parseFloat(lineHeightEl.value) || 1.4;

    generateBtn.disabled = true;
    statusEl.textContent = 'Generating…';
    statusEl.className = 'status';

    setTimeout(() => {
      try {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = 210;
        const pageH = 297;

        // Title
        doc.setFont('helvetica', 'bold');
        const titleSize = Math.min(Math.max(fontSize + 2, 10), 13);
        doc.setFontSize(titleSize);
        const titleLines = doc.splitTextToSize(title, pageW - 2 * margin - 4);
        let yPos = margin + 1;
        titleLines.forEach(line => {
          doc.text(line, pageW / 2, yPos, { align: 'center' });
          yPos += titleSize * 0.42;
        });
        yPos += 1.5;
        doc.setDrawColor(130);
        doc.setLineWidth(0.3);
        doc.line(margin, yPos, pageW - margin, yPos);
        yPos += 3;

        const lineH = Math.max(fontSize * 0.352778 * lhMult, fontSize * 0.48);
        const bottomLimit = pageH - margin - 7;
        const qGap = lineH * 0.55;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor(20);

        if (layout === 'single') {
          // ===================== SINGLE COLUMN =====================
          const textW = pageW - 2 * margin - 4;
          let y = yPos;

          questions.forEach((q, i) => {
            const txt = (i + 1) + '. ' + q;
            const lines = doc.splitTextToSize(txt, textW);
            const needed = lines.length * lineH + qGap;

            if (y + needed > bottomLimit) {
              doc.addPage();
              y = margin;
            }

            lines.forEach(line => {
              if (y + lineH > bottomLimit) {
                doc.addPage();
                y = margin;
              }
              doc.text(line, margin + 2, y);
              y += lineH;
            });
            y += qGap;
          });

        } else {
          // ===================== DOUBLE COLUMN (two boxes) =====================
          const usableW = pageW - 2 * margin;
          const boxW = (usableW - colGap) / 2;
          // Very conservative: plenty of padding + 15% safety on text width
          const boxPad = 4;
          const textW = (boxW - 2 * boxPad) * 0.85;

          const leftBoxX = margin;
          const rightBoxX = margin + boxW + colGap;

          let col = 0;
          let colY = [yPos + boxPad, yPos + boxPad];
          let pageTop = yPos;

          function xOf(c) {
            return (c === 0 ? leftBoxX : rightBoxX) + boxPad;
          }

          function drawBoxes(top) {
            const h = bottomLimit - top;
            doc.setDrawColor(150);
            doc.setLineWidth(0.4);
            doc.rect(leftBoxX, top, boxW, h);
            doc.rect(rightBoxX, top, boxW, h);
          }

          drawBoxes(pageTop);

          function advance() {
            if (col === 0) {
              col = 1;
            } else {
              doc.addPage();
              pageTop = margin;
              col = 0;
              colY = [pageTop + boxPad, pageTop + boxPad];
              drawBoxes(pageTop);
            }
          }

          const blocks = questions.map((q, i) => {
            const txt = (i + 1) + '. ' + q;
            return doc.splitTextToSize(txt, textW);
          });

          blocks.forEach(lines => {
            const needed = lines.length * lineH + qGap;
            if (colY[col] + needed > bottomLimit - boxPad) {
              advance();
            }
            lines.forEach(line => {
              if (colY[col] + lineH > bottomLimit - boxPad) {
                advance();
              }
              doc.text(line, xOf(col), colY[col]);
              colY[col] += lineH;
            });
            colY[col] += qGap;
          });
        }

        // Page numbers
        const totalPages = doc.internal.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
          doc.setPage(p);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(110);
          doc.text(p + ' / ' + totalPages, pageW / 2, pageH - 4, { align: 'center' });
        }

        const safeName = title.replace(/[^\w\s\-]/g, '').trim().slice(0, 45) || 'question-bank';
        doc.save(safeName + '.pdf');

        const mode = layout === 'single' ? '1-column' : '2-boxes';
        statusEl.textContent = `Done — ${questions.length} questions • ${totalPages} page(s) • ${mode}`;
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

  try {
    const saved = localStorage.getItem('qb-draft');
    if (saved) {
      const d = JSON.parse(saved);
      if (d.title) titleEl.value = d.title;
      if (d.questions) questionsEl.value = d.questions;
      if (d.layout && layoutEl) layoutEl.value = d.layout;
    }
  } catch (_) {}

  function saveDraft() {
    try {
      localStorage.setItem('qb-draft', JSON.stringify({
        title: titleEl.value,
        questions: questionsEl.value,
        layout: layoutEl ? layoutEl.value : 'double'
      }));
    } catch (_) {}
  }
  titleEl.addEventListener('input', saveDraft);
  questionsEl.addEventListener('input', saveDraft);
  if (layoutEl) layoutEl.addEventListener('change', saveDraft);
})();
