const DATA_URL = 'output.json'; // file location (same folder)
let allEntries = [];
let activeLetter = null;   // "A" .. "Z" or null
let searchQuery = '';
let initialRandom = [];    // store random 15 entries
let firstLoad = true;      // flag to control first render

const alphabetEl = document.getElementById('alphabet');
const resultsEl = document.getElementById('results');
const summaryEl = document.getElementById('summary');
const noResultsEl = document.getElementById('no-results');
const loadingEl = document.getElementById('loading');

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const clearBtn = document.getElementById('clearBtn');

/* ---------- Utilities ---------- */

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeForCompare(s) {
  if (!s) return '';
  try {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch (e) {
    return s;
  }
}

function getNom(entry) {
  return entry && (entry['Nom Japonais'] || entry.Nom || '') + '';
}

function extractTags(entry) {
  const raw = entry && entry.Tags;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(t => String(t).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [String(raw)];
}

/* ---------- Rendering ---------- */

function renderAlphabet() {
  alphabetEl.innerHTML = '';
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  letters.forEach(letter => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = letter;
    btn.setAttribute('data-letter', letter);
    btn.setAttribute('aria-pressed', String(activeLetter === letter));
    if (activeLetter === letter) btn.classList.add('active');
    btn.addEventListener('click', () => {
      activeLetter = activeLetter === letter ? null : letter;
      searchInput.value = '';
      firstLoad = false; // user is filtering now
      renderAlphabet();
      renderResults();
    });
    alphabetEl.appendChild(btn);
  });
}

function renderResults() {
  noResultsEl.classList.add('hidden');
  resultsEl.innerHTML = '';
  loadingEl.classList.add('hidden');

  let filtered;

  // ✅ On very first load, show random 15 items
  if (firstLoad && initialRandom.length) {
    filtered = initialRandom;
    summaryEl.textContent = `Showing 15 random entries out of ${allEntries.length} total.`;
  } else {
    const q = (searchInput.value || '').trim();
    searchQuery = q;
    const qLower = q.toLowerCase();

    filtered = allEntries.filter(entry => {
      const rawName = (getNom(entry) || '').trim();
      if (!rawName) return false;

      if (activeLetter) {
        const firstChar = rawName.charAt(0);
        const normalizedFirst = normalizeForCompare(firstChar).toUpperCase();
        if (normalizedFirst !== activeLetter) return false;
      }

      if (qLower) {
        const nameMatch = rawName.toLowerCase().includes(qLower);
        const tags = extractTags(entry);
        const tagMatch = tags.some(t => t.toLowerCase().includes(qLower));
        return nameMatch || tagMatch;
      }
      return true;
    });

    summaryEl.textContent = `${filtered.length} result${filtered.length !== 1 ? 's' : ''} found.`;
  }

  if (!filtered.length) {
    resultsEl.innerHTML = '';
    noResultsEl.classList.remove('hidden');
    return;
  }

  filtered.forEach(entry => {
    const card = document.createElement('article');
    card.className = 'card';
    card.style.cursor = "pointer";

    const rawName = (getNom(entry) || '').trim();
    const h3 = document.createElement('h3');

    if (searchQuery) {
      const escapedName = escapeHtml(rawName);
      try {
        const re = new RegExp(escapeRegex(searchQuery), 'gi');
        const highlighted = escapedName.replace(re, match => `<mark class="highlight">${match}</mark>`);
        h3.innerHTML = highlighted;
      } catch (e) {
        h3.textContent = rawName;
      }
    } else {
      h3.textContent = rawName;
    }

    const desc = document.createElement('p');
    desc.textContent = (entry.Description || '').trim();

    const meta = document.createElement('div');
    meta.className = 'meta';
    const tags = extractTags(entry);
    tags.forEach(t => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = t;
      // highlight tags if search matches
      if (searchQuery && t.toLowerCase().includes(searchQuery.toLowerCase())) {
        chip.innerHTML = chip.textContent.replace(
          new RegExp(escapeRegex(searchQuery), 'gi'),
          match => `<mark class="highlight">${match}</mark>`
        );
      }
      meta.appendChild(chip);
    });

    card.appendChild(h3);
    card.appendChild(desc);
    if (tags.length) card.appendChild(meta);

    card.addEventListener('click', () => {
      const nom = encodeURIComponent(rawName);
      window.location.href = `details.html?word=${nom}`;
    });

    resultsEl.appendChild(card);
  });
}

/* ---------- Data loading ---------- */

function showError(msg) {
  summaryEl.textContent = msg;
  resultsEl.innerHTML = '';
  noResultsEl.classList.remove('hidden');
}

async function loadData() {
  loadingEl.classList.remove('hidden');
  summaryEl.textContent = 'Loading data…';
  try {
    const resp = await fetch(DATA_URL, {cache: "no-store"});
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (Array.isArray(data)) {
      allEntries = data;
    } else if (Array.isArray(data.items)) {
      allEntries = data.items;
    } else if (Array.isArray(data.data)) {
      allEntries = data.data;
    } else {
      const arr = Object.values(data).find(v => Array.isArray(v));
      if (arr) allEntries = arr;
      else throw new Error('JSON does not contain an array at top level.');
    }

    // ✅ choose random 15 on load
    initialRandom = allEntries
      .slice()
      .sort(() => 0.5 - Math.random())
      .slice(0, 15);

    summaryEl.textContent = `${allEntries.length} entries loaded.`;
    renderAlphabet();
    renderResults();
  } catch (err) {
    console.error('Failed to load data:', err);
    showError('Failed to load output.json. Use a local server (e.g. `python -m http.server`) and visit http://localhost:8000');
  } finally {
    loadingEl.classList.add('hidden');
  }
}

/* ---------- Events ---------- */
searchBtn.addEventListener('click', () => {
  firstLoad = false;
  renderResults();
});
searchInput.addEventListener('keyup', e => {
  firstLoad = false;
  renderResults();
});
clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  activeLetter = null;
  firstLoad = false;
  renderAlphabet();
  renderResults();
});

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', loadData);
