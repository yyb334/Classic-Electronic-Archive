// Global state for all songs and selected filters
let allSongs = [];
const selectedFilters = {
  tags: [],
  countries: [],
  artists: [],
  genres: [],
  subgenres: [],
  yearMin: null,
  yearMax: null,
};
let currentSearchQuery = '';
let currentSortBy = 'title';
let ascending = true;

// Fetch songs.json data
async function fetchSongs() {
  const response = await fetch('songs.json');
  if (!response.ok) throw new Error('Failed to load songs.json');
  return await response.json();
}

// Utility: Get unique values for a field (handles arrays or single values)
function getUniqueValues(field) {
  const values = new Set();
  allSongs.forEach(song => {
    let val = song[field];
    if (!val) return;
    if (Array.isArray(val)) val.forEach(v => values.add(v));
    else values.add(val);
  });
  return Array.from(values).sort();
}

// Core filtering function with group override to calculate dynamic counts
function filterSongsWithOverride(group, overrideValues) {
  return allSongs.filter(song => {
    // Tags
    const tagsToCheck = group === 'tags' ? overrideValues : selectedFilters.tags;
    if (tagsToCheck.length && !tagsToCheck.some(t => (song.tags || []).includes(t))) return false;

    // Countries
    const countriesToCheck = group === 'countries' ? overrideValues : selectedFilters.countries;
    if (countriesToCheck.length && !countriesToCheck.includes(song.country)) return false;

    // Artists
    const artistsToCheck = group === 'artists' ? overrideValues : selectedFilters.artists;
    if (artistsToCheck.length && !artistsToCheck.includes(song.artist)) return false;

    // Genres
    const genresToCheck = group === 'genres' ? overrideValues : selectedFilters.genres;
    if (genresToCheck.length && !genresToCheck.some(g => (song.genre || []).includes(g))) return false;

    // Subgenres
    const subgenresToCheck = group === 'subgenres' ? overrideValues : selectedFilters.subgenres;
    if (subgenresToCheck.length && !subgenresToCheck.some(sg => (song.subgenre || []).includes(sg))) return false;

    // Year range (always uses selectedFilters for year filtering)
    if (selectedFilters.yearMin !== null && (song.releaseYear === undefined || song.releaseYear < selectedFilters.yearMin)) return false;
    if (selectedFilters.yearMax !== null && (song.releaseYear === undefined || song.releaseYear > selectedFilters.yearMax)) return false;

    return true;
  });
}

// Render checkbox filter options with dynamic counts
function renderCheckboxFilterWithCounts(containerId, allValues, group) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  allValues.forEach(value => {
    // Calculate count if this filter option toggled ON/OFF
    const currentlySelected = selectedFilters[group];
    let override;

    if (currentlySelected.includes(value)) {
      // Count if toggled OFF
      override = currentlySelected.filter(v => v !== value);
    } else {
      // Count if toggled ON
      override = [...currentlySelected, value];
    }

    const filteredSongs = filterSongsWithOverride(group, override);
    const count = filteredSongs.length;

    const label = document.createElement('label');
    label.style.marginRight = '1em';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = value;
    checkbox.checked = currentlySelected.includes(value);

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedFilters[group].push(value);
      } else {
        selectedFilters[group] = selectedFilters[group].filter(v => v !== value);
      }
      applyFilters();
      renderAllFilters();
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(`${value} (${count})`));
    container.appendChild(label);
  });
}

// Render all filters (tags, country, artist, genre, subgenre)
function renderAllFilters() {
  renderCheckboxFilterWithCounts('tag-list', getUniqueValues('tags'), 'tags');
  renderCheckboxFilterWithCounts('country-list', getUniqueValues('country'), 'countries');
  renderCheckboxFilterWithCounts('artist-list', getUniqueValues('artist'), 'artists');
  renderCheckboxFilterWithCounts('genre-list', getUniqueValues('genre'), 'genres');
  renderCheckboxFilterWithCounts('subgenre-list', getUniqueValues('subgenre'), 'subgenres');
}

// Render single song list item
function renderSong(song) {
  const li = document.createElement('li');

  const link = document.createElement('a');
  link.href = `song.html?id=${encodeURIComponent(song.id)}`;
  link.textContent = `${song.title} – ${song.artist}`;
  li.appendChild(link);

  const tagContainer = document.createElement('div');
  tagContainer.className = 'tag-container';
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

// Populate song list in DOM
function loadSongList(songs) {
  const container = document.getElementById('song-list');
  container.innerHTML = '';

  if (songs.length === 0) {
    container.textContent = 'No songs match the current filters.';
    return;
  }

  songs.forEach(song => container.appendChild(renderSong(song)));
}

// Apply all filters and sorting, then update song list
function applyFilters() {
  let filtered = allSongs.filter(song => {
    // Tags (OR within selected tags)
    if (selectedFilters.tags.length && !selectedFilters.tags.some(tag => (song.tags || []).includes(tag))) return false;
    // Countries
    if (selectedFilters.countries.length && !selectedFilters.countries.includes(song.country)) return false;
    // Artists
    if (selectedFilters.artists.length && !selectedFilters.artists.includes(song.artist)) return false;
    // Genres
    if (selectedFilters.genres.length && !selectedFilters.genres.some(g => (song.genre || []).includes(g))) return false;
    // Subgenres
    if (selectedFilters.subgenres.length && !selectedFilters.subgenres.some(sg => (song.subgenre || []).includes(sg))) return false;
    // Year range
    if (selectedFilters.yearMin !== null && (song.releaseYear === undefined || song.releaseYear < selectedFilters.yearMin)) return false;
    if (selectedFilters.yearMax !== null && (song.releaseYear === undefined || song.releaseYear > selectedFilters.yearMax)) return false;

    // Search text
    if (currentSearchQuery) {
      const text = currentSearchQuery.toLowerCase();
      const inTitle = song.title.toLowerCase().includes(text);
      const inArtist = song.artist.toLowerCase().includes(text);
      if (!inTitle && !inArtist) return false;
    }

    return true;
  });

  // Sort results
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

// Setup event listeners for search, sort, year inputs, clear filters
function setupControls() {
  const searchInput = document.getElementById('search-bar');
  searchInput.addEventListener('input', () => {
    currentSearchQuery = searchInput.value.trim();
    applyFilters();
    renderAllFilters();
  });

  const sortSelect = document.getElementById('sort-select');
  sortSelect.addEventListener('change', () => {
    currentSortBy = sortSelect.value;
    applyFilters();
  });

  const sortButton = document.getElementById('sort-direction');
  sortButton.addEventListener('click', () => {
    ascending = !ascending;
    sortButton.textContent = ascending ? '↑ Ascending' : '↓ Descending';
    applyFilters();
  });

  const yearMinInput = document.getElementById('year-min');
  yearMinInput.addEventListener('input', () => {
    const val = parseInt(yearMinInput.value);
    selectedFilters.yearMin = isNaN(val) ? null : val;
    applyFilters();
    renderAllFilters();
  });

  const yearMaxInput = document.getElementById('year-max');
  yearMaxInput.addEventListener('input', () => {
    const val = parseInt(yearMaxInput.value);
    selectedFilters.yearMax = isNaN(val) ? null : val;
    applyFilters();
    renderAllFilters();
  });

  const clearFiltersBtn = document.getElementById('clear-filters');
  clearFiltersBtn.addEventListener('click', () => {
    // Clear all selected filters and inputs
    Object.keys(selectedFilters).forEach(key => {
      if (Array.isArray(selectedFilters[key])) selectedFilters[key] = [];
      else selectedFilters[key] = null;
    });
    currentSearchQuery = '';
    document.getElementById('search-bar').value = '';
    document.getElementById('year-min').value = '';
    document.getElementById('year-max').value = '';
    document.getElementById('sort-select').value = 'title';
    ascending = true;
    document.getElementById('sort-direction').textContent = '↑ Ascending';

    applyFilters();
    renderAllFilters();
  });
}

// Initialize app
async function init() {
  allSongs = await fetchSongs();

  renderAllFilters();
  setupControls();
  applyFilters();
}

init();
