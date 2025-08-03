let allSongs = [];
let currentDecade = null;
let currentSearchQuery = '';
let currentSortBy = 'title';
let ascending = true;
let activeTags = [];
let currentCountryFilter = '';

// Fetch songs.json data
async function fetchSongs() {
  const response = await fetch('songs.json');
  if (!response.ok) {
    throw new Error('Failed to load songs.json');
  }
  return await response.json();
}

// Create a tag button with count and toggle functionality
function createTagButton(tag, count) {
  const btn = document.createElement('button');
  btn.innerHTML = `${tag} <small>(${count})</small>`;
  btn.style.margin = '0 0.3em 0.3em 0';
  btn.className = 'tag-button';

  if (activeTags.includes(tag)) {
    btn.classList.add('active');
  }

  btn.addEventListener('click', () => {
    const idx = activeTags.indexOf(tag);
    if (idx > -1) {
      activeTags.splice(idx, 1);  // Remove tag
    } else {
      activeTags.push(tag);       // Add tag
    }
    applyFilters();
    renderTagButtons();           // Refresh tag buttons
  });

  return btn;
}

// Render all tag buttons with counts
function renderTagButtons() {
  const tagContainer = document.getElementById('tag-list');
  if (!tagContainer) return;

  // Count how many songs have each tag (from all songs)
  const tagCounts = {};

  allSongs.forEach(song => {
    if (Array.isArray(song.tags)) {
      song.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    }
  });

  tagContainer.innerHTML = '';

  const sortedTags = Object.keys(tagCounts).sort();

  sortedTags.forEach(tag => {
    const btn = createTagButton(tag, tagCounts[tag]);
    tagContainer.appendChild(btn);
  });
}

// Render individual song list item
function renderSong(song) {
  const li = document.createElement('li');

  const link = document.createElement('a');
  link.href = `song.html?id=${encodeURIComponent(song.id)}`;
  link.textContent = `${song.title} – ${song.artist}`;
  li.appendChild(link);

  const tagContainer = document.createElement('div');
  if (Array.isArray(song.tags)) {
    song.tags.forEach(tag => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = tag;
      tagContainer.appendChild(span);
    });
  }
  li.appendChild(tagContainer);

  return li;
}

// Populate the song list in the DOM
function loadSongList(songs) {
  const songList = document.getElementById('song-list');
  songList.innerHTML = '';
  songs.forEach(song => songList.appendChild(renderSong(song)));
}

// Extract decades from tags
function getDecades(songs) {
  const decades = new Set();
  for (const song of songs) {
    for (const tag of song.tags || []) {
      const match = tag.match(/^(\d{4})s$/);
      if (match) {
        decades.add(tag);
      }
    }
  }
  return Array.from(decades).sort();
}

// Render decade filter buttons
function renderDecadeFilters(decades) {
  const filterDiv = document.getElementById('decade-buttons');
  filterDiv.innerHTML = '';

  const allButton = document.createElement('button');
  allButton.textContent = 'All';
  allButton.addEventListener('click', () => {
    currentDecade = null;
    applyFilters();
  });
  filterDiv.appendChild(allButton);

  decades.forEach(decade => {
    const button = document.createElement('button');
    button.textContent = decade;
    button.addEventListener('click', () => {
      currentDecade = decade;
      applyFilters();
    });
    filterDiv.appendChild(button);
  });
}

// Display tag statistics list (optional)
function showTagStats(songs) {
  const tagCounts = {};
  for (const song of songs) {
    for (const tag of song.tags || []) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  const tagStatsList = document.getElementById('tag-counts');
  tagStatsList.innerHTML = '';

  const sortedTags = Object.keys(tagCounts).sort();
  for (const tag of sortedTags) {
    const li = document.createElement('li');
    li.textContent = `${tag}: ${tagCounts[tag]}`;
    tagStatsList.appendChild(li);
  }
}

// Setup search bar listener
function setupSearch() {
  const searchInput = document.getElementById('search-bar');
  searchInput.addEventListener('input', () => {
    currentSearchQuery = searchInput.value.toLowerCase();
    applyFilters();
  });
}

// Setup sorting controls
function setupSorting() {
  const sortSelect = document.getElementById('sort-select');
  const sortButton = document.getElementById('sort-direction');

  if (!sortButton) {
    console.error('Sort direction button not found in HTML');
    return;
  }

  sortSelect.addEventListener('change', () => {
    currentSortBy = sortSelect.value;
    applyFilters();
  });

  sortButton.addEventListener('click', () => {
    ascending = !ascending;
    sortButton.textContent = ascending ? '↑ Ascending' : '↓ Descending';
    applyFilters();
  });
}

// Populate country dropdown filter
function populateCountryFilter(songs) {
  const countries = new Set();
  for (const song of songs) {
    if (song.country) {
      countries.add(song.country);
    }
  }

  const countrySelect = document.getElementById('country-filter');
  if (!countrySelect) return;
  
  countrySelect.innerHTML = '<option value="">All</option>';
  countries.forEach(country => {
    const option = document.createElement('option');
    option.value = country;
    option.textContent = country;
    countrySelect.appendChild(option);
  });
}

// Setup advanced filters (country & clear tag button)
function setupAdvancedFilters() {
  const countrySelect = document.getElementById('country-filter');
  if (countrySelect) {
    countrySelect.addEventListener('change', () => {
      currentCountryFilter = countrySelect.value;
      applyFilters();
    });
  }
  
  const clearTagButton = document.getElementById('clear-tag-filter');
  if (clearTagButton) {
    clearTagButton.addEventListener('click', () => {
      activeTags = [];
      applyFilters();
      renderTagButtons();
    });
  }
}

// Apply all filters and sorting, then display songs
function applyFilters() {
  let filtered = allSongs;

  // Filter by decade
  if (currentDecade) {
    filtered = filtered.filter(song => (song.tags || []).includes(currentDecade));
  }

  // Filter by search query
  if (currentSearchQuery.trim() !== '') {
    filtered = filtered.filter(song =>
      song.title.toLowerCase().includes(currentSearchQuery) ||
      song.artist.toLowerCase().includes(currentSearchQuery)
    );
  }

  // Filter by multi-tag selection (AND logic)
  if (activeTags.length > 0) {
    filtered = filtered.filter(song => {
      const songTags = song.tags || [];
      return activeTags.every(tag => songTags.includes(tag));
    });
  }

  // Filter by country
  if (currentCountryFilter) {
    filtered = filtered.filter(song => song.country === currentCountryFilter);
  }

  // Sorting
  filtered.sort((a, b) => {
    let valA, valB;

    if (currentSortBy === 'title') {
      valA = a.title.toLowerCase();
      valB = b.title.toLowerCase();
    } else if (currentSortBy === 'artist') {
      valA = a.artist.toLowerCase();
      valB = b.artist.toLowerCase();
    } else if (currentSortBy === 'year') {
      valA = a.releaseYear || 0;
      valB = b.releaseYear || 0;
    }

    if (valA < valB) return ascending ? -1 : 1;
    if (valA > valB) return ascending ? 1 : -1;
    return 0;
  });

  loadSongList(filtered);
}

// Initialization
async function init() {
  allSongs = await fetchSongs();
  loadSongList(allSongs);
  const decades = getDecades(allSongs);
  renderDecadeFilters(decades);
  showTagStats(allSongs);
  populateCountryFilter(allSongs);
  setupSearch();
  setupSorting();
  setupAdvancedFilters();
  renderTagButtons();
}

init();
