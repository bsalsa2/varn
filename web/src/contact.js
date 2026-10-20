// Contact form: sends through a form service when one is configured
// (data-endpoint), otherwise opens the visitor's email app, pre-filled.
export function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const status = form.querySelector('.contact-status');
  const button = form.querySelector('button[type="submit"]');
  const label = button.querySelector('.btn-label');
  const idle = label.textContent;
  const say = (text, bad = false) => {
    status.hidden = false;
    status.textContent = text;
    status.classList.toggle('is-error', bad);
    // On a phone the message can land below the fold, under the keyboard.
    status.scrollIntoView({ block: 'nearest' });
  };
  // aria-disabled, not disabled: a disabled button drops keyboard focus to
  // the page. The flag stops a second send while one is in flight.
  let sending = false;

  // ---- Validation: one clear message per field, in text (not just colour).
  const fields = {
    name: { el: form.elements.name, test: (v) => v.trim().length > 0, msg: 'Enter your name.' },
    email: {
      el: form.elements.email,
      test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
      msg: 'Enter an email address I can reply to, like name@example.com.',
    },
    message: {
      el: form.elements.message,
      test: (v) => v.trim().length >= 10,
      msg: 'Write a message of at least 10 characters.',
    },
  };
  const errorOf = (f) => document.getElementById(`${f.el.id}-err`);
  const setError = (f, text) => {
    const out = errorOf(f);
    out.textContent = text || '';
    out.hidden = !text;
    if (text) f.el.setAttribute('aria-invalid', 'true');
    else f.el.removeAttribute('aria-invalid');
  };
  const validate = () => {
    let first = null;
    for (const f of Object.values(fields)) {
      const bad = !f.test(f.el.value);
      setError(f, bad ? f.msg : '');
      if (bad && !first) first = f.el;
    }
    return first;
  };
  // Clear a field's message as soon as it is fixed; re-check when leaving it.
  for (const f of Object.values(fields)) {
    f.el.addEventListener('input', () => f.test(f.el.value) && setError(f, ''));
    f.el.addEventListener('blur', () => f.el.value && setError(f, f.test(f.el.value) ? '' : f.msg));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    status.hidden = true;
    const firstBad = validate();
    if (firstBad) {
      say('Please fix the highlighted fields and send again.', true);
      firstBad.focus();
      return;
    }
    const data = new FormData(form);
    if (data.get('company')) return; // honeypot: bots fill hidden fields
    const name = String(data.get('name')).trim();
    const from = String(data.get('email')).trim();
    const message = String(data.get('message')).trim();
    const endpoint = form.dataset.endpoint;

    if (!endpoint) {
      const subject = `Varn website question from ${name}`;
      const body = `${message}\n\n${name}\n${from}`;
      window.location.href = `mailto:${form.dataset.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      say(form.dataset.mailto);
      return;
    }

    sending = true;
    button.setAttribute('aria-disabled', 'true');
    label.textContent = form.dataset.sending;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name, email: from, message, _replyto: from }),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      say(form.dataset.success);
    } catch {
      say(form.dataset.error, true);
    } finally {
      sending = false;
      button.removeAttribute('aria-disabled');
      label.textContent = idle;
    }
  });
}
