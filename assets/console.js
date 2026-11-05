/* SQL console: query this résumé with real SQL. Loaded on demand ("/" key, console links, #sql).
   Five tables are built from the page itself; a small hand-written engine runs
   SELECT [DISTINCT] … FROM … [WHERE …] [GROUP BY …] [ORDER BY …] [LIMIT n]
   with = != <> < > <= >= LIKE IN BETWEEN IS NULL AND OR NOT, and COUNT/MIN/MAX/SUM/AVG/LOWER/UPPER/LENGTH. */
(() => {
  'use strict';
  const SR = window.SR || (window.SR = {});
  if (SR.sql) return;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);

  /* ---------- tables, read from the DOM ---------- */
  function buildTables() {
    const roles = $$('.role').map((a) => {
      const g = $(`.g-row[href="#${a.id}"]`);
      return {
        company: txt($('.role-id h3', a)), title: txt($('.role-title', a)),
        start: g ? g.dataset.start : null, end: g && g.dataset.end ? g.dataset.end : null,
        lane: g && g.classList.contains('res') ? 'research' : 'industry',
        current: !!(g && !g.dataset.end), tools: (a.dataset.skills || '').split(' ').filter(Boolean).length,
      };
    });
    const catName = {};
    $$('.sk-tabs button[data-cat]').forEach((b) => { catName[b.dataset.cat] = txt(b.firstChild); });
    const skills = $$('.sk-cloud .chip[data-skill]').map((c) => {
      const n = $('.n', c);
      return { skill: txt(c.firstChild), category: catName[c.dataset.cat] || c.dataset.cat || null, roles: n && n.textContent ? +n.textContent : 0, core: c.classList.contains('core') };
    });
    const projects = $$('.cs, .proj').map((p) => ({
      name: txt($('h3', p)), kind: p.dataset.kind || null, grp: p.dataset.group || null,
      org: txt($('.cs-org', p)), tools: (p.dataset.skills || '').split(' ').filter(Boolean).length,
    }));
    const papers = $$('.r-item[data-type="paper"]').map((li) => {
      const v = txt($('.r-venue', li)) || '';
      return { title: txt($('.r-title', li)), publisher: txt($('.r-venue b', li)), venue: v.split(' · ').slice(1).join(' · ') || v, year: parseInt(txt($('.r-date b', li)), 10) || null };
    });
    const results = $$('.kpi').map((k) => ({ metric: txt($('.kpi-lab', k)), value: txt($('.kpi-val .sr', k)), source: txt($('.kpi-src a', k)) }));
    return { roles, skills, projects, papers, results };
  }

  /* ---------- tokenizer ---------- */
  const KW = new Set('SELECT DISTINCT FROM WHERE GROUP BY ORDER ASC DESC LIMIT AND OR NOT IN LIKE IS NULL AS BETWEEN TRUE FALSE'.split(' '));
  function lex(src) {
    const out = []; let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '-' && src[i + 1] === '-') { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (c === "'" || c === '"') {
        let j = i + 1, s = '';
        while (j < src.length && !(src[j] === c && src[j + 1] !== c)) { if (src[j] === c) j++; s += src[j++]; }
        if (j >= src.length) throw err(`unterminated string starting at position ${i + 1}`);
        out.push(c === '"' ? { t: 'id', v: s, p: i } : { t: 'str', v: s, p: i }); i = j + 1; continue;
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) { const m = /^[0-9]*\.?[0-9]+/.exec(src.slice(i)); out.push({ t: 'num', v: +m[0], p: i }); i += m[0].length; continue; }
      if (/[A-Za-z_]/.test(c)) { const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i)); const u = m[0].toUpperCase(); out.push(KW.has(u) ? { t: 'kw', v: u, p: i } : { t: 'id', v: m[0], p: i }); i += m[0].length; continue; }
      const two = src.slice(i, i + 2);
      if (['<=', '>=', '<>', '!='].includes(two)) { out.push({ t: 'op', v: two === '<>' ? '!=' : two, p: i }); i += 2; continue; }
      if ('=<>(),*;.'.includes(c)) { out.push({ t: 'op', v: c, p: i }); i++; continue; }
      throw err(`unexpected character "${c}" at position ${i + 1}`);
    }
    return out;
  }
  function err(m) { const e = new Error(m); e.sql = true; return e; }

  /* ---------- parser ---------- */
  function parse(src) {
    const tk = lex(src); let k = 0;
    const peek = () => tk[k], next = () => tk[k++];
    const is = (t, v) => tk[k] && tk[k].t === t && (v === undefined || tk[k].v === v);
    const near = () => (tk[k] ? `near "${tk[k].v}"` : 'at the end of the query');
    const want = (t, v, what) => { if (!is(t, v)) throw err(`expected ${what || v} ${near()}`); return next(); };
    const AGG = ['COUNT', 'MIN', 'MAX', 'SUM', 'AVG'], FN = AGG.concat(['LOWER', 'UPPER', 'LENGTH']);
    function primary() {
      if (is('op', '(')) { next(); const e = expr(); want('op', ')', '")"'); return e; }
      if (is('num')) return { k: 'lit', v: next().v };
      if (is('str')) return { k: 'lit', v: next().v };
      if (is('kw', 'NULL')) { next(); return { k: 'lit', v: null }; }
      if (is('kw', 'TRUE') || is('kw', 'FALSE')) return { k: 'lit', v: next().v === 'TRUE' };
      if (is('id')) {
        const name = next().v;
        if (is('op', '(')) {
          const f = name.toUpperCase();
          if (!FN.includes(f)) throw err(`unknown function ${name}(). Available: ${FN.join(', ')}`);
          next();
          let arg = null, star = false, distinct = false;
          if (is('op', '*')) { next(); star = true; } else { if (is('kw', 'DISTINCT')) { next(); distinct = true; } arg = expr(); }
          want('op', ')', '")"');
          if (star && f !== 'COUNT') throw err(`${f}(*) is not allowed; use a column`);
          return { k: AGG.includes(f) ? 'agg' : 'fn', f, arg, star, distinct };
        }
        if (is('op', '.')) { next(); return { k: 'col', v: want('id', undefined, 'a column name').v }; }
        return { k: 'col', v: name };
      }
      throw err(`expected a value or column ${near()}`);
    }
    function cmp() {
      const l = primary();
      let neg = false;
      if (is('kw', 'NOT') && tk[k + 1] && tk[k + 1].t === 'kw' && ['IN', 'LIKE', 'BETWEEN'].includes(tk[k + 1].v)) { next(); neg = true; }
      if (is('op') && ['=', '!=', '<', '>', '<=', '>='].includes(peek().v)) { const op = next().v; return { k: 'bin', op, l, r: primary() }; }
      if (is('kw', 'LIKE')) { next(); return { k: 'like', l, r: primary(), neg }; }
      if (is('kw', 'IN')) { next(); want('op', '(', '"(" after IN'); const list = [primary()]; while (is('op', ',')) { next(); list.push(primary()); } want('op', ')', '")"'); return { k: 'in', l, list, neg }; }
      if (is('kw', 'BETWEEN')) { next(); const a = primary(); want('kw', 'AND', 'AND in BETWEEN'); return { k: 'btw', l, a, b: primary(), neg }; }
      if (is('kw', 'IS')) { next(); let n = false; if (is('kw', 'NOT')) { next(); n = true; } want('kw', 'NULL', 'NULL after IS'); return { k: 'isnull', l, neg: n }; }
      return l;
    }
    function not() { if (is('kw', 'NOT')) { next(); return { k: 'not', e: not() }; } return cmp(); }
    function and() { let l = not(); while (is('kw', 'AND')) { next(); l = { k: 'and', l, r: not() }; } return l; }
    function expr() { let l = and(); while (is('kw', 'OR')) { next(); l = { k: 'or', l, r: and() }; } return l; }

    want('kw', 'SELECT', 'SELECT at the start (or try: help)');
    const q = { distinct: false, cols: [], where: null, group: [], order: [], limit: null };
    if (is('kw', 'DISTINCT')) { next(); q.distinct = true; }
    if (is('op', '*')) { next(); q.star = true; } else {
      do { if (q.cols.length) next(); const e = expr(); let as = null; if (is('kw', 'AS')) { next(); as = want('id', undefined, 'an alias after AS').v; } else if (is('id')) as = next().v; q.cols.push({ e, as }); } while (is('op', ','));
    }
    want('kw', 'FROM', 'FROM');
    q.from = want('id', undefined, 'a table name after FROM').v.toLowerCase();
    if (is('kw', 'WHERE')) { next(); q.where = expr(); }
    if (is('kw', 'GROUP')) { next(); want('kw', 'BY', 'BY after GROUP'); do { if (q.group.length) next(); q.group.push(expr()); } while (is('op', ',')); }
    if (is('kw', 'ORDER')) { next(); want('kw', 'BY', 'BY after ORDER'); do { if (q.order.length) next(); const e = expr(); let desc = false; if (is('kw', 'ASC')) next(); else if (is('kw', 'DESC')) { next(); desc = true; } q.order.push({ e, desc }); } while (is('op', ',')); }
    if (is('kw', 'LIMIT')) { next(); q.limit = want('num', undefined, 'a number after LIMIT').v; }
    if (is('op', ';')) next();
    if (k < tk.length) throw err(`unexpected ${near()}`);
    return q;
  }

  /* ---------- evaluator ---------- */
  const lc = (v) => (typeof v === 'string' ? v.toLowerCase() : v);
  const cmpv = (a, b) => { if (a == null || b == null) return null; a = lc(a); b = lc(b); return a < b ? -1 : a > b ? 1 : 0; };
  function run(q, T) {
    const rows = T[q.from];
    if (!rows) throw err(`table "${q.from}" does not exist. Tables: ${Object.keys(T).join(', ')}`);
    const cols = Object.keys(rows[0] || {});
    const colOf = (name) => { const c = cols.find((x) => x.toLowerCase() === name.toLowerCase()); if (!c) throw err(`column "${name}" does not exist in ${q.from}. Try \\d ${q.from}`); return c; };
    const hasAgg = (e) => !!e && (e.k === 'agg' || ['l', 'r', 'e', 'arg', 'a', 'b'].some((p) => e[p] && typeof e[p] === 'object' && hasAgg(e[p])) || (e.list || []).some(hasAgg));
    function ev(e, row, group) {
      switch (e.k) {
        case 'lit': return e.v;
        case 'col': return row ? row[colOf(e.v)] : null;
        case 'fn': { const v = ev(e.arg, row, group); if (v == null) return null; return e.f === 'LOWER' ? String(v).toLowerCase() : e.f === 'UPPER' ? String(v).toUpperCase() : String(v).length; }
        case 'agg': {
          const g = group || (row ? [row] : []);
          if (e.star) return g.length;
          let vals = g.map((r) => ev(e.arg, r)).filter((v) => v != null);
          if (e.distinct) vals = Array.from(new Set(vals.map(lc)));
          if (e.f === 'COUNT') return vals.length;
          if (!vals.length) return null;
          if (e.f === 'MIN') return vals.reduce((a, b) => (cmpv(a, b) <= 0 ? a : b));
          if (e.f === 'MAX') return vals.reduce((a, b) => (cmpv(a, b) >= 0 ? a : b));
          const nums = vals.map(Number).filter((n) => !isNaN(n));
          const s = nums.reduce((a, b) => a + b, 0);
          return e.f === 'SUM' ? s : Math.round((s / nums.length) * 100) / 100;
        }
        case 'bin': { const c = cmpv(ev(e.l, row, group), ev(e.r, row, group)); if (c === null) return null; return { '=': c === 0, '!=': c !== 0, '<': c < 0, '>': c > 0, '<=': c <= 0, '>=': c >= 0 }[e.op]; }
        case 'like': { const v = ev(e.l, row, group), p = ev(e.r, row, group); if (v == null || p == null) return null; const re = new RegExp('^' + String(p).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i'); return re.test(String(v)) !== e.neg; }
        case 'in': { const v = ev(e.l, row, group); if (v == null) return null; return e.list.some((x) => cmpv(v, ev(x, row, group)) === 0) !== e.neg; }
        case 'btw': { const v = ev(e.l, row, group); const a = cmpv(v, ev(e.a, row, group)), b = cmpv(v, ev(e.b, row, group)); if (a === null || b === null) return null; return (a >= 0 && b <= 0) !== e.neg; }
        case 'isnull': return (ev(e.l, row, group) == null) !== e.neg;
        case 'not': { const v = ev(e.e, row, group); return v == null ? null : !v; }
        case 'and': return !!ev(e.l, row, group) && !!ev(e.r, row, group);
        case 'or': return !!ev(e.l, row, group) || !!ev(e.r, row, group);
      }
      return null;
    }
    const label = (c) => c.as || (c.e.k === 'col' ? colOf(c.e.v) : c.e.k === 'agg' ? `${c.e.f.toLowerCase()}` : c.e.k === 'fn' ? c.e.f.toLowerCase() : '?column?');
    let src = q.where ? rows.filter((r) => ev(q.where, r) === true) : rows.slice();
    const sel = q.star ? cols.map((c) => ({ e: { k: 'col', v: c }, as: null })) : q.cols;
    if (q.star && q.group.length) throw err('SELECT * cannot be used with GROUP BY; name the columns');
    const heads = sel.map(label);
    let out;
    const grouped = q.group.length || sel.some((c) => hasAgg(c.e));
    if (grouped) {
      const groups = new Map();
      src.forEach((r) => { const key = JSON.stringify(q.group.map((g) => lc(ev(g, r)))); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r); });
      if (!q.group.length && !groups.size) groups.set('[]', []);
      out = Array.from(groups.values()).map((g) => ({ vals: sel.map((c) => ev(c.e, g[0], g)), rep: g[0], g }));
    } else out = src.map((r) => ({ vals: sel.map((c) => ev(c.e, r)), rep: r }));
    if (q.distinct) { const seen = new Set(); out = out.filter((o) => { const k = JSON.stringify(o.vals.map(lc)); if (seen.has(k)) return false; seen.add(k); return true; }); }
    if (q.order.length) {
      const key = (o, e) => {
        if (e.k === 'lit' && typeof e.v === 'number') return o.vals[e.v - 1];
        if (e.k === 'col') { const i = heads.findIndex((h) => h.toLowerCase() === e.v.toLowerCase()); if (i >= 0) return o.vals[i]; }
        return ev(e, o.rep, o.g);
      };
      out.sort((a, b) => { for (const s of q.order) { const x = key(a, s.e), y = key(b, s.e); if (x == null && y == null) continue; if (x == null) return 1; if (y == null) return -1; const c = cmpv(x, y); if (c) return s.desc ? -c : c; } return 0; });
    }
    if (q.limit != null) out = out.slice(0, Math.max(0, q.limit));
    return { heads, rows: out.map((o) => o.vals) };
  }

  /* ---------- UI ---------- */
  const SUGGEST = [
    'SELECT company, title, start FROM roles ORDER BY start DESC',
    'SELECT category, COUNT(*) AS tools FROM skills GROUP BY category ORDER BY tools DESC',
    'SELECT skill, roles FROM skills WHERE core ORDER BY roles DESC LIMIT 5',
    'SELECT metric, value, source FROM results',
    'SELECT title, publisher, year FROM papers ORDER BY year DESC',
    "SELECT name, org FROM projects WHERE kind = 'Case study'",
  ];
  let dlg, log, input, T, opener, hist = [], hp = 0;
  const html = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cell = (v) => (v === null || v === undefined ? '<span class="q-null">NULL</span>' : typeof v === 'boolean' ? (v ? 't' : 'f') : html(v));
  function print(node) { log.appendChild(node); log.scrollTop = log.scrollHeight; }
  function block(cls, inner) { const d = document.createElement('div'); d.className = cls; d.innerHTML = inner; print(d); return d; }
  function table(heads, rows, ms) {
    const cap = `${rows.length} ${rows.length === 1 ? 'row' : 'rows'} · ${ms < 1 ? '<1' : ms.toFixed(1)} ms`;
    block('q-res', `<div class="q-scroll"><table><caption>${cap}</caption><thead><tr>${heads.map((h) => `<th scope="col">${html(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td title="${v == null ? 'NULL' : html(v)}">${cell(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    SR.say && SR.say(cap.replace('·', ','));
  }
  function exec(q) {
    q = q.trim();
    if (!q) return;
    hist.push(q); hp = hist.length;
    block('q-echo', `<span class="q-ps" aria-hidden="true">sariya=#</span> ${html(q)}`);
    const low = q.toLowerCase().replace(/;$/, '');
    if (low === 'clear') { log.innerHTML = ''; return; }
    if (low === 'help' || low === '\\?' || low === '\\h') { help(); return; }
    if (low === '\\dt') { table(['table', 'rows'], Object.keys(T).map((k) => [k, T[k].length]), 0.1); return; }
    const d = /^\\d\s+(\w+)$/.exec(low);
    if (d) { const t = T[d[1]]; if (!t) { block('q-err', `ERROR: table "${html(d[1])}" does not exist. Tables: ${Object.keys(T).join(', ')}`); return; } const first = t[0] || {}; table(['column', 'type', 'example'], Object.keys(first).map((c) => [c, typeof first[c] === 'number' ? 'number' : typeof first[c] === 'boolean' ? 'boolean' : 'text', first[c]]), 0.1); return; }
    if (low === '\\q' || low === 'exit' || low === 'quit') { dlg.close(); return; }
    const t0 = performance.now();
    try { const r = run(parse(q), T); table(r.heads, r.rows, performance.now() - t0); }
    catch (e) { if (!e.sql) throw e; block('q-err', `ERROR: ${html(e.message)}`); SR.say && SR.say('Error: ' + e.message); }
  }
  function help() {
    block('q-help', `<p>Five tables built from this page: <b>roles</b>, <b>skills</b>, <b>projects</b>, <b>papers</b>, <b>results</b>. Type <code>\\dt</code> to list them, <code>\\d roles</code> for columns, <code>clear</code> to clear, <kbd>Esc</kbd> to close.</p><p>Supported: SELECT, DISTINCT, WHERE (= != &lt; &gt; LIKE IN BETWEEN IS NULL AND OR NOT), GROUP BY with COUNT, MIN, MAX, SUM, AVG, ORDER BY, LIMIT.</p>`);
  }
  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'sql';
    dlg.setAttribute('aria-labelledby', 'sql-h');
    dlg.innerHTML = `
      <div class="q-top"><p class="q-k"><span aria-hidden="true">●</span> resume.db · read-only</p><h2 class="q-h" id="sql-h">Query my <em>résumé</em></h2><button class="icon-btn sm q-x" type="button" aria-label="Close the SQL console"><svg class="ico" aria-hidden="true"><use href="#i-x"/></svg></button></div>
      <div class="q-sug" role="group" aria-label="Example queries">${SUGGEST.map((s) => `<button type="button" class="q-chip">${html(s)}</button>`).join('')}</div>
      <div class="q-log" tabindex="0" aria-label="Query output"></div>
      <form class="q-form"><label class="q-ps" for="q-in">sariya=#</label><input id="q-in" class="q-in" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="SELECT * FROM roles"><button class="btn btn-primary q-run" type="submit">Run<span class="bi">↵</span></button></form>`;
    document.body.appendChild(dlg);
    log = $('.q-log', dlg); input = $('.q-in', dlg);
    $('.q-x', dlg).addEventListener('click', () => dlg.close());
    $('.q-form', dlg).addEventListener('submit', (e) => { e.preventDefault(); const q = input.value; input.value = ''; exec(q); input.focus(); });
    $('.q-sug', dlg).addEventListener('click', (e) => { const b = e.target.closest('.q-chip'); if (!b) return; input.value = b.textContent; exec(b.textContent); input.value = ''; input.focus(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' && hist.length) { e.preventDefault(); hp = Math.max(0, hp - 1); input.value = hist[hp]; }
      else if (e.key === 'ArrowDown' && hist.length) { e.preventDefault(); hp = Math.min(hist.length, hp + 1); input.value = hist[hp] || ''; }
    });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => { document.documentElement.classList.remove('q-lock'); if (opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true }); if (location.hash === '#sql') history.replaceState(null, '', location.pathname + location.search); });
    block('q-help', '<p>Welcome to the résumé database. It is built live from this page, so it is always current. Pick an example above or type your own query; <code>help</code> lists what works.</p>');
  }
  SR.sql = {
    open(from) {
      T = buildTables();
      if (!dlg) build();
      opener = from || document.activeElement;
      if (!dlg.open) { dlg.showModal(); document.documentElement.classList.add('q-lock'); }
      input.focus();
    },
    run: (q) => run(parse(q), buildTables()),
  };
})();
