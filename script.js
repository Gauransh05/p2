/* ---------- Data ---------- */
const CATS = {Home:'#3F5BD9', Food:'#F2A33A', Transport:'#18A58A', Fun:'#E8527F', Bills:'#7A5AE0', Other:'#8795A6'};
const KEY = 'tally-v1';
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const esc = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Pick a starting currency from the browser's locale
function localeCurrency() {
  try {
    const region = new Intl.Locale(navigator.language).region;
    return {IN:'INR', GB:'GBP', DE:'EUR', FR:'EUR', ES:'EUR', IT:'EUR', JP:'JPY'}[region] || 'USD';
  } catch (e) { return 'USD'; }
}

// Sample expenses dated relative to today, so the dashboard is never empty on first open
function seed() {
  const cur = localeCurrency(), k = {INR:80, JPY:150}[cur] || 1, now = new Date();
  const rows = [[0,6.5,'Morning coffee','Food'],[1,54.2,'Groceries','Food'],[2,12,'Transit pass top-up','Transport'],
    [3,38,'Movie night','Fun'],[4,64,'Electricity','Bills'],[5,18.75,'Lunch with Sam','Food'],[6,420,'Rent share','Home'],
    [8,29.99,'Phone plan','Bills'],[9,47,'Concert tickets','Fun'],[11,22,'Pharmacy','Other'],[13,35.4,'Fuel','Transport'],
    [15,88,'Weekly groceries','Food'],[18,140,'New desk lamp','Home']];
  const items = rows.map(([ago, amt, note, cat], i) => {
    const day = Math.max(1, now.getDate() - Math.min(ago, now.getDate() - 1));
    return {id:i + 1, amt:Math.round(amt * k * 100) / 100, note, cat, date:iso(new Date(now.getFullYear(), now.getMonth(), day))};
  });
  return {items, budget:1500 * k, cur};
}

function load() {
  try { const r = JSON.parse(localStorage.getItem(KEY)); if (r && Array.isArray(r.items)) return r; } catch (e) {}
  return seed();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

let S = load(), filter = null, view = new Date();
view.setDate(1);

const f = (n, d) => new Intl.NumberFormat(undefined, {
  style:'currency', currency:S.cur,
  minimumFractionDigits:d && n % 1 ? 2 : 0, maximumFractionDigits:d ? 2 : 0
}).format(n);

/* ---------- Render ---------- */
function render() {
  const key = `${view.getFullYear()}-${pad(view.getMonth() + 1)}`;
  const all = S.items.filter(i => i.date.startsWith(key));
  const total = all.reduce((a, i) => a + i.amt, 0);
  const by = {};
  all.forEach(i => by[i.cat] = (by[i.cat] || 0) + i.amt);
  const rows = Object.entries(by).sort((a, b) => b[1] - a[1]);
  if (filter && !by[filter]) filter = null;

  $('#month').textContent = view.toLocaleDateString(undefined, {month:'long', year:'numeric'});
  $('#heroTitle').textContent = 'Spent in ' + view.toLocaleDateString(undefined, {month:'long'});
  $('#cur').value = S.cur;
  $('#total').textContent = f(total);
  $('#budget').value = S.budget;

  const left = S.budget - total;
  $('#left').textContent = left >= 0 ? `${f(left)} left` : `${f(-left)} over`;
  $('#left').className = left < 0 ? 'over' : '';

  // Segmented bar: each category's share of the budget (or of the total, once over budget)
  const denom = Math.max(S.budget, total) || 1;
  $('#bar').innerHTML = rows.map(([c, v]) =>
    `<i style="flex:${v / denom};background:${CATS[c]}" title="${c}: ${f(v, 1)}"></i>`).join('')
    + (total < S.budget ? `<i style="flex:${(S.budget - total) / denom}"></i>` : '');

  $('#cats').innerHTML = rows.map(([c, v]) =>
    `<li><button class="cat" data-c="${c}" aria-pressed="${filter === c}" style="--c:${CATS[c]}">
      <span class="sw"></span><span>${c}</span><span>${f(v)}</span><span class="pc">${Math.round(v / total * 100)}%</span>
    </button></li>`).join('');

  const list = all.filter(i => !filter || i.cat === filter)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  $('#listTitle').textContent = filter ? `${filter} expenses` : 'All expenses';
  $('#clear').hidden = !filter;
  $('#list').innerHTML = list.map(i => {
    const d = new Date(i.date + 'T00:00');
    return `<li style="--c:${CATS[i.cat]}">
      <time datetime="${i.date}">${d.toLocaleDateString(undefined, {day:'numeric', month:'short'})}</time>
      <span class="note">${esc(i.note)}<small>${i.cat}</small></span>
      <b>${f(i.amt, 1)}</b>
      <button class="del" data-id="${i.id}" aria-label="Delete ${esc(i.note)}">×</button>
    </li>`;
  }).join('');
  $('#empty').hidden = all.length > 0;
  $('#sample').hidden = S.items.length > 0;
}

/* ---------- Events ---------- */
$('#prev').onclick = () => { view.setMonth(view.getMonth() - 1); render(); };
$('#next').onclick = () => { view.setMonth(view.getMonth() + 1); render(); };
$('#cats').onclick = e => {
  const b = e.target.closest('[data-c]');
  if (b) { filter = filter === b.dataset.c ? null : b.dataset.c; render(); }
};
$('#clear').onclick = () => { filter = null; render(); };
$('#list').onclick = e => {
  const b = e.target.closest('[data-id]');
  if (b) { S.items = S.items.filter(i => i.id !== +b.dataset.id); save(); render(); }
};
$('#budget').onchange = e => { S.budget = Math.max(0, +e.target.value || 0); save(); render(); };
$('#cur').onchange = e => { S.cur = e.target.value; save(); render(); };
$('#sample').onclick = $('#reset').onclick = () => { S = seed(); filter = null; save(); render(); };

$('#form').onsubmit = e => {
  e.preventDefault();
  const amt = Math.round(parseFloat($('#amt').value) * 100) / 100;
  const cat = $('#cat').value, date = $('#date').value;
  if (!(amt > 0) || !date) return;
  S.items.push({id:Date.now(), amt, note:$('#note').value.trim() || cat, cat, date});
  view = new Date(date + 'T00:00'); view.setDate(1);   // jump to the month that was just edited
  $('#amt').value = ''; $('#note').value = ''; $('#amt').focus();
  save(); render();
};

/* ---------- Init ---------- */
$('#cat').innerHTML = Object.keys(CATS).map(c => `<option>${c}</option>`).join('');
$('#date').value = iso(new Date());
render();
