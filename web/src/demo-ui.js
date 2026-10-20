// Small drawing helpers shared by the dashboard demo (demo.js) and the
// dashboard preview on the home page (platform-preview.js). Everything they
// draw is SIMULATED sample data from demo-data.js.
import { ADSB, CLASSES, clock } from './demo-data.js';

const $ = (sel, root = document) => root.querySelector(sel);

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const clsShape = (cls) => `<span class="shape shape--${cls === 'drone' ? 'drone' : 'aircraft'}" aria-hidden="true"></span>`;
export const adsbShape = (adsb) => (adsb === 'none' ? '<span class="shape shape--no-adsb" aria-hidden="true"></span>' : '');
export const classPill = (cls) =>
  `<span class="status-pill status-pill--${cls === 'drone' ? 'drone' : 'aircraft'} mono">${clsShape(cls)}${esc(CLASSES[cls])}</span>`;
export const adsbText = (adsb) => `<span class="demo-adsb">${adsbShape(adsb)}${esc(ADSB[adsb])}</span>`;
const dayWord = (t) => {
  const d = new Date(t);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'today';
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  return d.toDateString() === y.toDateString() ? 'yesterday' : d.toLocaleDateString();
};
export const when = (t) => `${clock(t)} <span class="demo-day">${esc(dayWord(t))}</span>`;
export const meter = (v) => `<span class="demo-meter" aria-hidden="true"><i style="--v:${Math.round(v * 100)}"></i></span>`;
export const hourLabel = (t) => `${String(new Date(t).getHours()).padStart(2, '0')}:00`;
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;


export function hourlyChart(buckets, { label, showAxis = true } = {}) {
  const max = Math.max(1, ...buckets.map((b) => b.aircraft + b.drone));
  const top = Math.max(4, Math.ceil(max / 2) * 2);
  const cols = buckets
    .map((b, i) => {
      const total = b.aircraft + b.drone;
      const seg = (n, cls) => (n ? `<i class="dc-seg dc-seg--${cls}" style="--h:${((n / top) * 100).toFixed(2)}"></i>` : '');
      return `<div class="dc-col" data-i="${i}">${total ? `<div class="dc-stack">${seg(b.drone, 'drone')}${seg(b.aircraft, 'aircraft')}</div>` : ''}</div>`;
    })
    .join('');
  const ticks = [0, top / 2, top].map((v) => `<span style="--y:${(v / top) * 100}">${v}</span>`).join('');
  const last = buckets.length - 1;
  const xs = buckets
    .map((b, i) => (i % 6 === 0 || i === last ? `<span style="--x:${i}">${i === last ? 'now' : hourLabel(b.start)}</span>` : ''))
    .join('');
  return `<div class="dc" role="img" aria-label="${esc(label)}">
      <div class="dc-y mono" aria-hidden="true">${ticks}</div>
      <div class="dc-plot" style="--n:${buckets.length}" aria-hidden="true">${cols}</div>
      ${showAxis ? `<div class="dc-x mono" style="--n:${buckets.length}" aria-hidden="true">${xs}</div>` : ''}
      <div class="dc-tip mono" hidden></div>
    </div>`;
}

export function wireTip(root, buckets) {
  const plot = $('.dc-plot', root);
  const tip = $('.dc-tip', root);
  if (!plot || !tip) return;
  const show = (col) => {
    const b = buckets[Number(col.dataset.i)];
    tip.innerHTML = `<b>${esc(hourLabel(b.start))}</b><br>${plural(b.aircraft, 'aircraft', 'aircraft')} · ${plural(b.drone, 'possible drone', 'possible drones')}`;
    tip.hidden = false;
    const c = col.getBoundingClientRect();
    const r = root.getBoundingClientRect();
    tip.style.left = `${Math.min(Math.max(c.left - r.left + c.width / 2, 70), r.width - 70)}px`;
  };
  plot.addEventListener('pointerover', (e) => {
    const col = e.target.closest('.dc-col');
    if (col) show(col);
  });
  plot.addEventListener('pointerleave', () => (tip.hidden = true));
}

