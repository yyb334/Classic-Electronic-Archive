let allSongs = [];
let currentDecade = null;
let currentSearchQuery = '';
let currentSortBy = 'title';
let ascending = true;
let currentTagFilter = null;
let currentCountryFilter = '';

async function fetchSongs() {
  const response = await fetch('songs.json');
  if (!response.ok) {
    throw new Error('Failed to load songs.json');
  }
  return await response.json();
}

function createTagElement(tag) {
  const span = document.createElement('span');
  span.className = 'tag';
  span.textContent = tag;

  // Clickable tag filter
  span.addEventListener('click', () => {
    currentTagFilter = tag;
    applyFilters();
  });

  return span;
}

function renderSong(song) {
  const li = document.createElement('li');

  const link = document.createElement('a');
  link.href = `song.html?id=${encodeURIComponent(song.id)}`;
  link.textContent = `${song.title} – ${song.artist}`;
  li.appendChild(link);

  const tagContainer = document.createElement('div');
  song.tags.forEach(tag => tagContainer.appendChild(createTagElement(tag)));
  li.appendChild(tagContainer);

  return li;
}

function loadSongList(songs) {
  const songList = document.getElementById('song-list');
  songList.innerHTML = '';
  songs.forEach(song => songList.appendChild(renderSong(song)));
}

function getDecades(songs) {
  const decades = new Set();
  for (const song of songs) {
    for (const tag of song.tags) {
      const match = tag.match(/^(\d{4})s$/);
      if (match) {
        decades.add(tag);
      }
    }
  }
  return Array.from(decades).sort();
}

function renderDecadeFilters(decades, songs) {
  const filterDiv = document.getElementById('decade-buttons');
  filterDiv.innerHTML = '';

  const allButton = document.createElement('button');
  allButton.textContent = 'All';
  allButton.addEventListener('click', () => {
    currentDecade = null;
    applyFilters();
  });
  filterDiv.appendChild(allButton);

  for (const decade of decades) {
    const button = document.createElement('button');
    button.textContent = decade;
    button.addEventListener('click', () => {
      currentDecade = decade;
      applyFilters();
    });
    filterDiv.appendChild(button);
  }
}

function showTagStats(songs) {
  const tagCounts = {};
  for (const song of songs) {
    for (const tag of song.tags) {
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

function setupSearch() {
  const searchInput = document.getElementById('search-bar');
  searchInput.addEventListener('input', () => {
    currentSearchQuery = searchInput.value.toLowerCase();
    applyFilters();
  });
}

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

// Populate country dropdown
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
      currentTagFilter = null;
      applyFilters();
    });
  }
}

function applyFilters() {
  let filtered = allSongs;

  // Filter by decade
  if (currentDecade) {
    filtered = filtered.filter(song => song.tags.includes(currentDecade));
  }

  // Filter by search
  if (currentSearchQuery.trim() !== '') {
    filtered = filtered.filter(song =>
      song.title.toLowerCase().includes(currentSearchQuery) ||
      song.artist.toLowerCase().includes(currentSearchQuery)
    );
  }

  // Filter by tag
  if (currentTagFilter) {
    filtered = filtered.filter(song => song.tags.includes(currentTagFilter));
  }

  // Filter by country
  if (currentCountryFilter) {
    filtered = filtered.filter(song => song.country === currentCountryFilter);
  }

  // Sort
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

async function init() {
  allSongs = await fetchSongs();
  loadSongList(allSongs);
  const decades = getDecades(allSongs);
  renderDecadeFilters(decades, allSongs);
  showTagStats(allSongs);
  populateCountryFilter(allSongs);
  setupSearch();
  setupSorting();
  setupAdvancedFilters();
}

init();
