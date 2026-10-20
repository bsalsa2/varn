// "From sky to sighting": the five steps of the explainer. The visitor picks a
// step and the simulated panel shows its scene. Nothing moves on scroll.
//
// Without JavaScript the steps are a plain numbered list and the panel is
// left out, so this file only adds to a page that already reads in full.
const SMALL = '(max-width: 900px)';

export function initStory() {
  const root = document.getElementById('story');
  if (!root) return;
  const steps = [...root.querySelectorAll('.story-step')];
  const scenes = [...root.querySelectorAll('.scene')];
  const dots = [...root.querySelectorAll('.rail-dot')];
  const lines = [...root.querySelectorAll('.rail-line')];
  const counter = root.querySelector('#story-step');
  const device = root.querySelector('.story-device');
  const body = root.querySelector('.story-body');
  if (!steps.length || !device) return;

  // Each step title becomes the button that opens it.
  const buttons = steps.map((step, i) => {
    const head = step.querySelector('.story-step-head');
    const panel = step.querySelector('.story-panel');
    panel.id = `story-panel-${i}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'story-btn';
    button.setAttribute('aria-controls', panel.id);
    while (head.firstChild) button.append(head.firstChild);
    head.append(button);
    button.addEventListener('click', () => show(i));
    return button;
  });

  // Phones show the panel inside the open step, right under its text, so the
  // scene changes where the finger is. Wider screens keep it beside the list.
  const small = window.matchMedia(SMALL);
  let current = -1;
  const place = () => {
    const home = small.matches ? steps[Math.max(current, 0)].querySelector('.story-panel') : body;
    if (device.parentElement !== home) home.append(device);
  };

  function show(i) {
    const first = current < 0; // the markup already has step 1 open: no reflow needed
    current = i;
    steps.forEach((step, k) => {
      step.classList.toggle('is-active', k === i);
      buttons[k].setAttribute('aria-expanded', String(k === i));
    });
    scenes.forEach((scene, k) => {
      // Restart the scene's CSS animation each time it is chosen.
      if (k === i && !first) {
        scene.classList.remove('is-active');
        void scene.offsetWidth;
      }
      scene.classList.toggle('is-active', k === i);
    });
    dots.forEach((dot, k) => {
      dot.classList.toggle('is-active', k === i);
      dot.classList.toggle('is-done', k < i);
    });
    lines.forEach((line, k) => line.firstElementChild.style.setProperty('--fill', k < i ? '1' : '0'));
    if (counter) counter.textContent = `0${i + 1} / 0${steps.length}`;
    place();
  }

  // Up and Down move between the step buttons, like an accordion.
  root.querySelector('.story-steps').addEventListener('keydown', (e) => {
    const at = buttons.indexOf(document.activeElement);
    if (at < 0) return;
    const next = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: buttons.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    buttons[(next + buttons.length) % buttons.length].focus();
  });
  small.addEventListener?.('change', place);

  root.classList.add('story--live');
  show(0);
}
