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

  // Parse questions: preserve every word.
  // Strategy: split on double newlines for multi-line blocks,
  // otherwise treat consecutive non-empty lines as one question if they look like continuation,
  // but simplest reliable way: split by \n\n first, then single lines that remain.
  function parseQuestions(raw) {
    const text = raw.replace(/\r\n/g, '\n').trim();
    if (!text) return [];

    // Prefer blank-line separated blocks (preserves multi-line questions)
    const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    if (blocks.length > 1) {
      return blocks;
    }

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

    // Use setTimeout so UI can update
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

        // Compact title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(Math.max(fontSize + 2, 10));
        const titleLines = doc.splitTextToSize(title, usableW);
        let y = margin;
        titleLines.forEach(line => {
          doc.text(line, pageW / 2, y, { align: 'center' });
          y += (fontSize + 2) * 0.4;
        });
        y += 2; // small gap after title

        // thin line
        doc.setDrawColor(180);
        doc.setLineWidth(0.2);
        doc.line(margin, y, pageW - margin, y);
        y += 3;

        const bodyFontSize = fontSize;
        const lineH = bodyFontSize * 0.352778 * lineHeightMult; // pt to mm approx * multiplier
        // more accurate: 1 pt = 0.352778 mm
        const lineHeightMm = bodyFontSize * 0.352778 * lineHeightMult;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(bodyFontSize);

        // Two columns: we fill left then right, page by page
        // Collect all text lines first with their source question index for numbering optional

        // We will flow text continuously across columns and pages
        let currentCol = 0; // 0 = left, 1 = right
        let colY = [y, y];  // y position for each column on current page

        function newPage() {
          doc.addPage();
          colY = [margin, margin];
          currentCol = 0;
        }

        function ensureSpace(needed) {
          if (colY[currentCol] + needed > pageH - margin) {
            if (currentCol === 0) {
              currentCol = 1;
              // right column starts at same top as left did on this page? No – continue from top of right
              // Actually for newspaper style we usually fill left completely then right.
              // Simple approach: when left is full, switch to right; when right full, new page + left.
            } else {
              newPage();
            }
          }
        }

        // Better algorithm: process question by question, place each question's lines into current column,
        // if a question doesn't fit, move to next column / page (avoid splitting mid-question if possible,
        // but for very long questions allow split).

        questions.forEach((q, idx) => {
          // Prepare lines for this question
          const lines = doc.splitTextToSize(q, colW);

          // Check if whole question fits in remaining space of current column
          const needed = lines.length * lineHeightMm;
          const remaining = pageH - margin - colY[currentCol];

          if (needed > remaining && remaining < lineHeightMm * 2) {
            // almost empty remaining → switch column/page
            if (currentCol === 0) {
              currentCol = 1;
            } else {
              newPage();
            }
          }

          // Now write lines, splitting across columns/pages if necessary
          lines.forEach((line, lineIdx) => {
            if (colY[currentCol] + lineHeightMm > pageH - margin) {
              if (currentCol === 0) {
                currentCol = 1;
              } else {
                newPage();
              }
            }
            const x = currentCol === 0 ? leftX : rightX;
            doc.text(line, x, colY[currentCol]);
            colY[currentCol] += lineHeightMm;
          });

          // small gap after each question
          colY[currentCol] += lineHeightMm * 0.35;
        });

        // Footer page numbers
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFontSize(7);
          doc.setTextColor(120);
          doc.text(String(i) + ' / ' + totalPages, pageW / 2, pageH - 5, { align: 'center' });
          doc.setTextColor(0);
        }

        const safeName = title.replace(/[^\w\s-]/g, '').trim().slice(0, 40) || 'question-bank';
        doc.save(safeName + '.pdf');

        statusEl.textContent = `Done — ${questions.length} questions • ${totalPages} page(s)`;
        statusEl.className = 'status ok';
      } catch (err) {
        console.error(err);
        statusEl.textContent = 'Error: ' + (err.message || 'generation failed');
        statusEl.className = 'status err';
      } finally {
        generateBtn.disabled = false;
      }
    }, 50);
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
