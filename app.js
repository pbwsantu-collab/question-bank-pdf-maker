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
        let yPos = margin + 1;
        doc.splitTextToSize(title, pageW - 2 * margin - 4).forEach(line => {
          doc.text(line, pageW / 2, yPos, { align: 'center' });
          yPos += titleSize * 0.42;
        });
        yPos += 1.5;
        doc.setDrawColor(130);
        doc.setLineWidth(0.3);
        doc.line(margin, yPos, pageW - margin, yPos);
        yPos += 3;

        const lineH = Math.max(fontSize * 0.352778 * lhMult, fontSize * 0.5);
        const bottomLimit = pageH - margin - 8;
        const qGap = lineH * 0.5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor(20);

        // ========== SINGLE COLUMN ==========
        if (layout === 'single') {
          const textW = pageW - 2 * margin - 6;
          let y = yPos;

          questions.forEach((q, i) => {
            const lines = doc.splitTextToSize((i + 1) + '. ' + q, textW);
            if (y + lines.length * lineH + qGap > bottomLimit) {
              doc.addPage();
              y = margin;
            }
            lines.forEach(line => {
              if (y + lineH > bottomLimit) {
                doc.addPage();
                y = margin;
              }
              doc.text(line, margin + 3, y);
              y += lineH;
            });
            y += qGap;
          });

        // ========== DOUBLE COLUMN (split questions in half) ==========
        } else {
          const usableW = pageW - 2 * margin;
          const boxW = (usableW - colGap) / 2;
          const pad = 3.5;
          const textW = Math.floor((boxW - 2 * pad) * 0.88);
          const leftX = margin + pad;
          const rightX = margin + boxW + colGap + pad;

          // Split the question list into two halves
          const mid = Math.ceil(questions.length / 2);
          const leftList = questions.slice(0, mid);
          const rightList = questions.slice(mid);

          function makeBlocks(list, startNum) {
            return list.map((q, i) =>
              doc.splitTextToSize((startNum + i) + '. ' + q, textW)
            );
          }
          const leftBlocks = makeBlocks(leftList, 1);
          const rightBlocks = makeBlocks(rightList, mid + 1);

          let lIdx = 0;
          let rIdx = 0;
          let pageTop = yPos;

          function drawBoxes(top) {
            const h = bottomLimit - top;
            doc.setDrawColor(140);
            doc.setLineWidth(0.35);
            doc.rect(margin, top, boxW, h);
            doc.rect(margin + boxW + colGap, top, boxW, h);
          }

          while (lIdx < leftBlocks.length || rIdx < rightBlocks.length) {
            drawBoxes(pageTop);
            let ly = pageTop + pad;
            let ry = pageTop + pad;

            // Fill left box on this page
            while (lIdx < leftBlocks.length) {
              const lines = leftBlocks[lIdx];
              const needed = lines.length * lineH + qGap;
              if (ly + needed > bottomLimit) break;
              lines.forEach(line => {
                doc.text(line, leftX, ly);
                ly += lineH;
              });
              ly += qGap;
              lIdx++;
            }

            // Fill right box on this page
            while (rIdx < rightBlocks.length) {
              const lines = rightBlocks[rIdx];
              const needed = lines.length * lineH + qGap;
              if (ry + needed > bottomLimit) break;
              lines.forEach(line => {
                doc.text(line, rightX, ry);
                ry += lineH;
              });
              ry += qGap;
              rIdx++;
            }

            if (lIdx < leftBlocks.length || rIdx < rightBlocks.length) {
              doc.addPage();
              pageTop = margin;
            } else {
              break;
            }
          }
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
