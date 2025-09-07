/* Onboarding single-question flow: validation, repeaters, autosave, and review */
(function () {
  const form = document.getElementById('onboardingForm');
  const copyJsonBtn = document.getElementById('copyJsonBtn');
  const downloadJsonBtn = document.getElementById('downloadJsonBtn');
  const reviewContainer = document.getElementById('reviewContainer');

  const STORAGE_KEY = 'ally.onboarding.v1';
  let currentIndex = 0;
  let questions = [];
  let host;
  let btnPrev;
  let btnNext;
  let navEl;
  const progressBar = document.getElementById('progressBar');
  const progressBarValue = document.getElementById('progressBarValue');

  function serializeForm() {
    const fd = new FormData(form);
    const data = {};
    for (const [key, value] of fd.entries()) {
      if (key.endsWith('[]')) {
        const k = key.slice(0, -2);
        if (!Array.isArray(data[k])) data[k] = [];
        data[k].push(value);
      } else if (data[key] !== undefined) {
        // convert to array if multiple
        if (!Array.isArray(data[key])) data[key] = [data[key]];
        data[key].push(value);
      } else {
        data[key] = value;
      }
    }
    // Include repeater blocks that are not native inputs
    data['safety.contacts'] = collectRepeater('contactsList');
    data['safety.medications'] = collectRepeater('medicationsList');
    return data;
  }

  function saveDraft() {
    const data = serializeForm();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'safety.contacts' || key === 'safety.medications') return; // handled separately
        const els = form.querySelectorAll(`[name="${cssEscape(key)}"]`);
        if (!els.length) return;
        els.forEach(el => {
          if (el.type === 'checkbox' || el.type === 'radio') {
            if (Array.isArray(value)) {
              el.checked = value.includes(el.value);
            } else {
              el.checked = `${value}` === el.value || value === true;
            }
          } else {
            if (Array.isArray(value)) {
              el.value = value[0];
            } else {
              el.value = value ?? '';
            }
          }
        });
      });
      // Repeaters
      (data['safety.contacts'] || []).forEach(addContactItem);
      (data['safety.medications'] || []).forEach(addMedicationItem);
    } catch (_) {}
  }

  function cssEscape(s) {
    return s.replace(/[\"\n\r\t\[\]\.:]/g, '\\$&');
  }

  function validateQuestion(index) {
    const node = questions[index];
    if (!node) return true;
    const required = Array.from(node.querySelectorAll('[required]'));
    let valid = true;
    required.forEach(el => {
      if (el.type === 'checkbox' || el.type === 'radio') {
        const name = el.name;
        const group = node.querySelectorAll(`input[name="${cssEscape(name)}"]`);
        const anyChecked = Array.from(group).some(g => g.checked);
        if (!anyChecked) valid = false;
      } else {
        if (!el.value) valid = false;
      }
    });
    if (!valid) {
      node.querySelectorAll('[required]').forEach(el => el.classList.add('invalid'));
    }
    return valid;
  }

  // Repeater helpers
  const contactsList = document.getElementById('contactsList');
  const medicationsList = document.getElementById('medicationsList');

  function addContactItem(prefill) {
    const wrap = document.createElement('div');
    wrap.className = 'repeater__item';
    wrap.innerHTML = `
      <div class="repeater__row">
        <label class="field"><span>Name</span><input type="text" data-key="name" placeholder="e.g., Sarah Khan" required></label>
        <label class="field"><span>Relationship</span><input type="text" data-key="relationship" placeholder="e.g., Daughter" required></label>
      </div>
      <div class="repeater__row">
        <label class="field"><span>Phone number</span><input type="tel" data-key="phone" placeholder="e.g., +44 7700 900123" required></label>
        <label class="field"><span>Email (optional)</span><input type="email" data-key="email" placeholder="e.g., sarah@example.com"></label>
      </div>
      <div class="repeater__actions">
        <button type="button" class="btn danger" data-action="remove">Remove</button>
      </div>
    `;
    if (prefill) {
      wrap.querySelector('[data-key="name"]').value = prefill.name || '';
      wrap.querySelector('[data-key="relationship"]').value = prefill.relationship || '';
      wrap.querySelector('[data-key="phone"]').value = prefill.phone || '';
      wrap.querySelector('[data-key="email"]').value = prefill.email || '';
    }
    contactsList.appendChild(wrap);
  }

  function addMedicationItem(prefill) {
    const wrap = document.createElement('div');
    wrap.className = 'repeater__item';
    wrap.innerHTML = `
      <div class="repeater__row">
        <label class="field"><span>Medication</span><input type="text" data-key="name" placeholder="e.g., Metformin"></label>
        <label class="field"><span>Dosage</span><input type="text" data-key="dosage" placeholder="e.g., 500mg"></label>
      </div>
      <div class="repeater__row">
        <label class="field"><span>Schedule</span><input type="text" data-key="schedule" placeholder="e.g., Morning and evening"></label>
        <label class="field"><span>Notes</span><input type="text" data-key="notes" placeholder="Optional notes"></label>
      </div>
      <div class="repeater__actions">
        <button type="button" class="btn danger" data-action="remove">Remove</button>
      </div>
    `;
    if (prefill) {
      wrap.querySelector('[data-key="name"]').value = prefill.name || '';
      wrap.querySelector('[data-key="dosage"]').value = prefill.dosage || '';
      wrap.querySelector('[data-key="schedule"]').value = prefill.schedule || '';
      wrap.querySelector('[data-key="notes"]').value = prefill.notes || '';
    }
    medicationsList.appendChild(wrap);
  }

  function collectRepeater(listId) {
    const root = document.getElementById(listId);
    return Array.from(root.querySelectorAll('.repeater__item')).map(item => {
      const obj = {};
      item.querySelectorAll('[data-key]').forEach(input => {
        obj[input.getAttribute('data-key')] = input.value;
      });
      return obj;
    });
  }

  function renderReview() {
    const data = serializeForm();
    const pretty = JSON.stringify(data, null, 2);
    reviewContainer.innerHTML = '';
    const pre = document.createElement('pre');
    pre.textContent = pretty;
    reviewContainer.appendChild(pre);
  }

  function handleCopy() {
    const data = JSON.stringify(serializeForm(), null, 2);
    navigator.clipboard.writeText(data).catch(() => {});
  }

  function handleDownload() {
    const blob = new Blob([JSON.stringify(serializeForm(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'onboarding.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Build single-question flow
  function buildQuestionsFlow() {
    host = document.createElement('div');
    host.className = 'questions';

    // Insert host at top of form
    form.insertBefore(host, form.firstElementChild);

    const allSections = Array.from(form.querySelectorAll('section.step'));
    const reviewSection = null; // review removed

    const collected = [];
    allSections.forEach(sec => {
      if (sec === reviewSection) return;
      // Collect repeaters first, then fieldsets, then standalone fields
      const repeaters = Array.from(sec.querySelectorAll('.repeater'));
      const fieldsets = Array.from(sec.querySelectorAll('fieldset.fieldset'));
      const fields = Array.from(sec.querySelectorAll('label.field'))
        .filter(el => !el.closest('fieldset.fieldset') && !el.closest('.repeater'));

      collected.push(...repeaters, ...fieldsets, ...fields);
    });

    // Move collected elements into host as individual questions
    collected.forEach(node => {
      const wrap = document.createElement('div');
      wrap.className = 'question';
      wrap.appendChild(node);
      host.appendChild(wrap);
    });

    // Prepare review as the last question
    if (reviewSection) {
      const wrap = document.createElement('div');
      wrap.className = 'question';
      // Keep only review body, remove its nav if any
      const reviewBody = document.createElement('div');
      // Move review content (except its nav) into reviewBody
      Array.from(reviewSection.children).forEach(ch => {
        if (ch.classList.contains('nav')) return;
        reviewBody.appendChild(ch);
      });
      wrap.appendChild(reviewBody);
      host.appendChild(wrap);
    }

    // Hide original sections
    allSections.forEach(s => s.style.display = 'none');

    // Global navigation
    const nav = document.createElement('div');
    nav.className = 'nav';
    btnPrev = document.createElement('button');
    btnPrev.type = 'button';
    btnPrev.className = 'btn ghost';
    btnPrev.textContent = 'Back';
    btnNext = document.createElement('button');
    btnNext.type = 'button';
    btnNext.className = 'btn primary';
    btnNext.textContent = 'Next';
    nav.appendChild(btnPrev);
    nav.appendChild(btnNext);
    form.appendChild(nav);
    navEl = nav;

    // Finalize
    questions = Array.from(host.querySelectorAll('.question'));
    // Set container height to first question for smooth layout
    requestAnimationFrame(() => adjustHostHeight(0));
    goTo(0, 1, true);

    // Wire nav events
    btnPrev.addEventListener('click', () => {
      if (currentIndex === 0) return;
      goTo(currentIndex - 1, -1);
    });
    btnNext.addEventListener('click', () => {
      const isLast = currentIndex === questions.length - 1;
      if (isLast) {
        // submit
        form.requestSubmit();
        return;
      }
      if (!validateQuestion(currentIndex)) return;
      // Render review right before entering it
      goTo(currentIndex + 1, 1);
    });
  }

  function goTo(index, direction, initial = false) {
    const prev = questions[currentIndex];
    const next = questions[index];
    if (!next) return;

    if (!initial && prev) {
      prev.classList.remove('is-active');
      prev.classList.add(direction > 0 ? 'exit-left' : 'exit-right');
      setTimeout(() => prev.classList.remove('exit-left', 'exit-right'), 280);
    }
    next.classList.add('is-active');
    currentIndex = index;
    adjustHostHeight(index);
    updateProgress();

    // Update buttons
    btnPrev.disabled = currentIndex === 0;
    const isLast = currentIndex === questions.length - 1;
    btnNext.textContent = isLast ? 'Finish' : 'Next';
  }

  function updateProgress() {
    if (!progressBarValue) return;
    const pct = Math.round(((currentIndex + 1) / questions.length) * 100);
    progressBar.setAttribute('aria-valuenow', String(pct));
    progressBarValue.style.width = pct + '%';
    progressBarValue.classList.add('is-animated');
  }

  function adjustHostHeight(index) {
    if (!host) return;
    const node = questions[index];
    if (!node) return;
    // Measure natural content height by switching to static flow temporarily
    node.classList.add('measure');
    const h = node.scrollHeight;
    node.classList.remove('measure');
    const extra = 12; // slight breathing room
    host.style.height = (h + extra) + 'px';
  }

  // Event wiring for dynamic buttons inside repeaters
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute('data-action');
    if (action === 'add-contact') { addContactItem(); saveDraft(); adjustHostHeight(currentIndex); }
    if (action === 'add-medication') { addMedicationItem(); saveDraft(); adjustHostHeight(currentIndex); }
    if (action === 'remove') { target.closest('.repeater__item')?.remove(); saveDraft(); adjustHostHeight(currentIndex); }
  });

  form.addEventListener('input', () => saveDraft());
  form.addEventListener('change', () => saveDraft());

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveDraft();
    window.location.href = 'index.html';
  });

  // Recalculate on viewport change
  window.addEventListener('resize', () => adjustHostHeight(currentIndex));

  copyJsonBtn?.addEventListener('click', handleCopy);
  downloadJsonBtn?.addEventListener('click', handleDownload);

  // Init
  buildQuestionsFlow();
  loadDraft();
  if (contactsList && contactsList.children.length === 0) addContactItem();
})();


