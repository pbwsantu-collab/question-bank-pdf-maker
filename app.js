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

        // ---- Title ----
        doc.setFont('helvetica', 'bold');
        const titleSize = Math.min(Math.max(fontSize + 2, 10), 13);
        doc.setFontSize(titleSize);
        let yPos = margin + 2;
        doc.splitTextToSize(title, pageW - 2 * margin - 4).forEach(line => {
          doc.text(line, pageW / 2, yPos, { align: 'center' });
          yPos += Math.round(titleSize * 0.4 * 10) / 10;
        });
        yPos += 2;
        doc.setDrawColor(120);
        doc.setLineWidth(0.25);
        doc.line(margin, yPos, pageW - margin, yPos);
        yPos += 3;

        // Fixed, rounded line height for even spacing (no fractional jitter)
        const lineH = Math.round(fontSize * 0.352778 * lhMult * 10) / 10;
        const bottomLimit = pageH - margin - 8;
        const qGap = Math.round(lineH * 0.45 * 10) / 10;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor(0);

        // ========== SINGLE COLUMN ==========
        if (layout === 'single') {
          const textW = pageW - 2 * margin - 8;
          let y = yPos;

          questions.forEach((q, i) => {
            const lines = doc.splitTextToSize((i + 1) + '. ' + q, textW);
            const blockH = lines.length * lineH + qGap;
            if (y + blockH > bottomLimit) {
              doc.addPage();
              y = margin;
            }
            lines.forEach(line => {
              doc.text(line, margin + 4, y);
              y += lineH;
            });
            y += qGap;
          });

        // ========== DOUBLE COLUMN ==========
        } else {
          const usableW = pageW - 2 * margin;
          const boxW = (usableW - colGap) / 2;
          const pad = 4;
          // Conservative width so letters never crowd the border
          const textW = Math.floor((boxW - 2 * pad) * 0.90);
          const leftX = margin + pad;
          const rightX = margin + boxW + colGap + pad;

          // Pre-wrap every question
          const allBlocks = questions.map((q, i) => ({
            num: i + 1,
            lines: doc.splitTextToSize((i + 1) + '. ' + q, textW),
            height: 0
          }));
          allBlocks.forEach(b => {
            b.height = b.lines.length * lineH + qGap;
          });

          // Balance by height (not just count) so both columns look even
          const leftBlocks = [];
          const rightBlocks = [];
          let leftH = 0, rightH = 0;
          allBlocks.forEach(b => {
            if (leftH <= rightH) {
              leftBlocks.push(b);
              leftH += b.height;
            } else {
              rightBlocks.push(b);
              rightH += b.height;
            }
          });

          let lIdx = 0, rIdx = 0;
          let pageTop = yPos;

          function drawBoxes(top) {
            const h = bottomLimit - top;
            doc.setDrawColor(130);
            doc.setLineWidth(0.3);
            doc.rect(margin, top, boxW, h);
            doc.rect(margin + boxW + colGap, top, boxW, h);
          }

          while (lIdx < leftBlocks.length || rIdx < rightBlocks.length) {
            drawBoxes(pageTop);
            let ly = pageTop + pad;
            let ry = pageTop + pad;

            while (lIdx < leftBlocks.length) {
              const b = leftBlocks[lIdx];
              if (ly + b.height > bottomLimit + 0.5) break;
              b.lines.forEach(line => {
                doc.text(line, leftX, ly);
                ly += lineH;
              });
              ly += qGap;
              lIdx++;
            }

            while (rIdx < rightBlocks.length) {
              const b = rightBlocks[rIdx];
              if (ry + b.height > bottomLimit + 0.5) break;
              b.lines.forEach(line => {
                doc.text(line, rightX, ry);
                ry += lineH;
              });
              ry += qGap;
              rIdx++;
            }

            if (lIdx < leftBlocks.length || rIdx < rightBlocks.length) {
              doc.addPage();
              pageTop = margin;
            } else break;
          }
        }

        // Page numbers
        const totalPages = doc.internal.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
          doc.setPage(p);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(100);
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
