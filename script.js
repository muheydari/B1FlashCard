// script.js - Flashcard Trainer logic with progress saving
// Load flashcards from CSV, provide random learning mode, list view, and tracking

const CSV_PATH = 'flashcards.csv';
// Prompt for user name (only Rebin or Badri) and store in currentUser
const allowedUsers = ['Rebin', 'Badri'];
function askUserName() {
  let name = null;
  while (true) {
    name = prompt('Enter your name (Rebin or Badri):');
    if (name === null) {
      return null;
    }
    if (allowedUsers.includes(name)) {
      return name;
    }
    alert('Invalid name. Please enter Rebin or Badri.');
  }
}
const currentUser = askUserName();
if (!currentUser) {
  document.body.innerHTML = '<h2>Access denied</h2>';
  throw new Error('Access denied');
}
// helper to build per‑user localStorage keys
const getKey = base => `${currentUser}_${base}`;
let cards = [];
let currentCard = null;
let knownIndices = JSON.parse(localStorage.getItem(getKey('flash_known')) || '[]');
let readCounts = JSON.parse(localStorage.getItem(getKey('flash_readCounts')) || '[]');
let currentSort = null; // 'most', 'least', or null

function loadCSV() {
  fetch(CSV_PATH)
    .then(res => res.text())
    .then(text => {
      // CSV format: Def,Example,Persian,English (may contain commas, but assume simple split by commas respecting quotes)
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // Simple split - handle quoted fields
        const parts = parseCSVLine(line);
        if (parts.length >= 4) {
          const [def, example, persian, english] = parts;
          cards.push({ front: def.trim(), example: example.trim(), back: persian.trim() });
        }
      }
      // Initialize counts
      initCounts();
      // Initialize progress UI after cards are loaded
      updateProgress();
    })
    .catch(err => console.error('Failed to load flashcards:', err));
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function initCounts() {
  const today = new Date().toISOString().slice(0, 10);
  const storedDate = localStorage.getItem(getKey('flash_lastDate'));
    if (storedDate !== today) {
      localStorage.setItem(getKey('flash_dailyCount'), '0');
      localStorage.setItem(getKey('flash_lastDate'), today);
    }
  updateStats();
}

function updateStats() {
  const daily = localStorage.getItem(getKey('flash_dailyCount')) || '0';
  const total = localStorage.getItem(getKey('flash_totalCount')) || '0';
  document.getElementById('daily-count').textContent = `Today: ${daily}`;
  document.getElementById('total-count').textContent = `Total: ${total}`;
}

function incrementCounts() {
  const dailyKey = getKey('flash_dailyCount');
  const totalKey = getKey('flash_totalCount');
  const daily = Number(localStorage.getItem(dailyKey) || '0') + 1;
  const total = Number(localStorage.getItem(totalKey) || '0') + 1;
  localStorage.setItem(dailyKey, daily);
  localStorage.setItem(totalKey, total);
  updateStats();
  // also update progress display for total cards known
  updateProgress();
}
function incrementReadCount(idx) {
  readCounts[idx] = (readCounts[idx] || 0) + 1;
  localStorage.setItem(getKey('flash_readCounts'), JSON.stringify(readCounts));
}
function updateProgress() {
  const knownCount = knownIndices.length;
  const total = cards.length;
  const progDiv = document.getElementById('progress');
  if (progDiv) {
    progDiv.textContent = `Known: ${knownCount}/${total}`;
  }
}

function showRandomCard() {
  if (!cards.length) return;
  // filter out known cards if any remain
  const unknown = cards.filter((c,i) => !knownIndices.includes(i));
  const pool = unknown.length ? unknown : cards;
  const idx = Math.floor(Math.random() * pool.length);
  // find actual index in cards array
  const actualIdx = cards.indexOf(pool[idx]);
  currentCard = pool[idx];
  currentCard._idx = actualIdx; // store for marking
  // update read counter for this card
  incrementReadCount(actualIdx);

  // Render the selected random card
  renderCard(currentCard);
  // Increment counters (each view counts as learning step)
  incrementCounts();
  // Update progress UI
  updateProgress();
}

function toggleFlip() {
  document.getElementById('card').classList.toggle('flipped');
}

// Render a card into the main view without counting it as a learning step
function renderCard(card) {
  const frontDiv = document.getElementById('front');
  const backDiv = document.getElementById('back');
  frontDiv.innerHTML = `${card.front}<br><span class="example">${card.example}</span>`;
  backDiv.textContent = card.back;
  // Ensure the card is face‑up
  document.getElementById('card').classList.remove('flipped');
}

function markKnown() {
  if (currentCard && typeof currentCard._idx === 'number') {
    if (!knownIndices.includes(currentCard._idx)) {
      knownIndices.push(currentCard._idx);
      localStorage.setItem(getKey('flash_known'), JSON.stringify(knownIndices));
      updateProgress();
    }
  }
}

function showList() {
  const listSection = document.getElementById('listSection');
  const ul = document.getElementById('cardList');
  // Ensure progress is up‑to‑date before showing list
  updateProgress();
  ul.innerHTML = '';

  // Build an array of card indices
  let indices = cards.map((_, i) => i);
  if (currentSort === 'most') {
    // Most read first
    indices.sort((a, b) => (readCounts[b] || 0) - (readCounts[a] || 0));
  } else if (currentSort === 'least') {
    // Least read first
    indices.sort((a, b) => (readCounts[a] || 0) - (readCounts[b] || 0));
  }

  // Render list according to sorted indices
  indices.forEach(i => {
    const c = cards[i];
    const li = document.createElement('li');
    if (knownIndices.includes(i)) { li.classList.add('known'); }
    const starCount = readCounts[i] || 0;
    const stars = '★'.repeat(starCount);
    const ratio = Math.min(starCount, 10) / 10;
    const hueStart = 210;
    const hueEnd = 120;
    const hue = hueStart + (hueEnd - hueStart) * ratio;
    li.style.color = `hsl(${hue}, 60%, 80%)`;
    li.textContent = `${c.front} ${stars}`;
    li.addEventListener('click', () => {
      currentCard = c;
      currentCard._idx = i; // store index for marking known
      incrementReadCount(i);
      renderCard(currentCard);
      listSection.classList.add('hidden');
    });
    ul.appendChild(li);
  });

  listSection.classList.remove('hidden');
}

function resetDaily() {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(getKey('flash_dailyCount'), '0');
  localStorage.setItem(getKey('flash_lastDate'), today);
  updateStats();
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadCSV();
  document.getElementById('nextBtn').addEventListener('click', showRandomCard);
  document.getElementById('listBtn').addEventListener('click', showList);
  document.getElementById('card').addEventListener('click', toggleFlip);
  // sorting buttons\n  document.getElementById('mostBtn').addEventListener('click', () => {\n    currentSort = 'most';\n    showList();\n  });\n  document.getElementById('leastBtn').addEventListener('click', () => {\n    currentSort = 'least';\n    showList();\n  });\n  document.getElementById('resetSortBtn').addEventListener('click', () => {\n    currentSort = null;\n    showList();\n  });
  document.getElementById('resetBtn').addEventListener('click', resetDaily);
  document.getElementById('knownBtn').addEventListener('click', markKnown);
  // progress counters
  updateProgress();
});
