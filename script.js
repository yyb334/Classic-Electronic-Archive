let allSongs = [];
const selectedFilters = {
  tags: [],
  countries: [],
  artists: [],
  labels: [],
  genres: [],
  subgenres: [],
  moods: [],
  yearMin: null,
  yearMax: null,
};
let currentSearchQuery = '';
let currentSortBy = 'title';
let ascending = true;

// Map of tag variations to their canonical forms for consolidated filtering
// The keys are lower‑cased and stripped of punctuation for easier matching
const TAG_NORMALIZATION = {
  // United Kingdom
  'uk': 'UK',
  'united kingdom': 'UK',
  'great britain': 'UK',
  'britain': 'UK',
  'england': 'UK',
  'scotland': 'UK',
  'wales': 'UK',
  'northern ireland': 'UK',

  // United States
  'usa': 'USA',
  'us': 'USA',
  'u s a': 'USA',
  'u s': 'USA',
  'united states': 'USA',
  'united states of america': 'USA',
  'america': 'USA',
  'american': 'USA',

  // Germany
  'germany': 'Germany',
  'german': 'Germany',
  'deutschland': 'Germany',

  // Netherlands
  'netherlands': 'Netherlands',
  'holland': 'Netherlands',
  'dutch': 'Netherlands',

  // Belgium
  'belgium': 'Belgium',
  'belgian': 'Belgium',

  // France
  'france': 'France',
  'french': 'France',

  // Spain
  'spain': 'Spain',
  'spanish': 'Spain',

  // Italy
  'italy': 'Italy',
  'italian': 'Italy',

  // Russia
  'russia': 'Russia',
  'russian': 'Russia'
};

function normalizeTag(tag) {
  const lower = (tag || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
  return TAG_NORMALIZATION[lower] || tag;
}

// Basic mood detection keywords grouped into broader categories.
// This lightweight heuristic scans descriptions and tags to infer moods.
const MOOD_KEYWORDS = {
  energetic: ['energetic', 'high-energy', 'upbeat', 'driving', 'fast', 'lively'],
  dark: ['dark', 'moody', 'brooding', 'ominous'],
  uplifting: ['uplifting', 'euphoric', 'happy', 'joyful', 'positive'],
  melancholic: ['melancholic', 'melancholy', 'sad', 'nostalgic'],
  dreamy: ['dreamy', 'ambient', 'ethereal', 'soothing', 'chill'],
  aggressive: ['aggressive', 'hard', 'intense', 'gritty']
};

function deriveMoods(song) {
  const text = (
    (song.description || '') + ' ' +
    (Array.isArray(song.tags) ? song.tags.join(' ') : '') + ' ' +
    (song.subgenre || '')
  ).toLowerCase();
  const moods = new Set();
  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) moods.add(mood);
  }
  return Array.from(moods);
}

// Reduce tag noise for the filter view by grouping similar tags
// without altering how tags appear on individual song pages.
// Returns an array so a tag like "acid trance" contributes to
// both "acid" and "trance" buckets.
const FILTER_TAG_PATTERNS = [
  { canonical: 'acid', pattern: /acid/ },
  { canonical: 'trance', pattern: /trance/ },
  { canonical: 'house', pattern: /house/ },
  { canonical: 'techno', pattern: /techno/ },
  { canonical: 'hardcore', pattern: /hardcore/ },
  { canonical: 'breakbeat', pattern: /breakbeat|breakstep/ },
  { canonical: 'garage', pattern: /garage/ },
  { canonical: 'ambient', pattern: /ambient/ },
  { canonical: 'electro', pattern: /\belectro\b/ }
];

function consolidateTagForFilter(tag) {
  const norm = normalizeTag(tag);
  const lower = norm.toLowerCase();

  // Skip mix/version descriptors in the filter list
  if (/\b(mix|remix|edit|version|dub|cut)\b/.test(lower)) return [];

  // Collapse any explicit years or year ranges into decades
  const yearMatch = lower.match(/(19|20)\d{2}/);
  if (yearMatch) {
    const year = parseInt(yearMatch[0], 10);
    return [`${Math.floor(year / 10) * 10}s`];
  }

  const results = [];
  FILTER_TAG_PATTERNS.forEach(({ canonical, pattern }) => {
    if (pattern.test(lower)) results.push(canonical);
  });

  // Fall back to the normalized tag if no pattern matched
  if (results.length === 0) results.push(norm);
  return Array.from(new Set(results));
}

// Map of country variations to their canonical forms
const COUNTRY_NORMALIZATION = {
  uk: 'United Kingdom',
  uklabel: 'United Kingdom',
  unitedkingdom: 'United Kingdom'
};

function normalizeCountry(country) {
  const key = (country || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  return COUNTRY_NORMALIZATION[key] || country;
}

// Split a label string into individual clean label names
function parseLabels(labelStr) {
  return labelStr
    .split(/[\/,]/)
    .map(l =>
      l
        .replace(/\(.*?\)/g, '')
        .replace(/licensed to/gi, '')
        .trim()
    )
    .filter(Boolean);
}

// Fetch songs.json data
async function fetchSongs() {
  const response = await fetch('songs.json');
  if (!response.ok) throw new Error('Failed to load songs.json');
  return await response.json();
}

// Get unique consolidated tags for the filter view
function getUniqueTags() {
  const allTags = new Set();

  allSongs.forEach(song => {
    (song.filterTags || []).forEach(tag => allTags.add(tag));
  });

  return Array.from(allTags).sort();
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

// Filter songs with override values for a single group to calculate counts properly
function filterSongsWithOverride(group, overrideValues) {
  return allSongs.filter(song => {
    const tagsToCheck = group === 'tags' ? overrideValues : selectedFilters.tags;
    if (tagsToCheck.length && !tagsToCheck.some(t => (song.filterTags || []).includes(t))) return false;

    const countriesToCheck = group === 'countries' ? overrideValues : selectedFilters.countries;
    if (countriesToCheck.length) {
      const songCountries = Array.isArray(song.country) ? song.country : [song.country];
      if (!countriesToCheck.some(c => songCountries.includes(c))) return false;
    }

    const artistsToCheck = group === 'artists' ? overrideValues : selectedFilters.artists;
    if (artistsToCheck.length && !artistsToCheck.includes(song.artist)) return false;

    const labelsToCheck = group === 'labels' ? overrideValues : selectedFilters.labels;
    if (labelsToCheck.length) {
      const songLabels = Array.isArray(song.label) ? song.label : [song.label];
      if (!labelsToCheck.some(l => songLabels.includes(l))) return false;
    }

    const genresToCheck = group === 'genres' ? overrideValues : selectedFilters.genres;
    if (genresToCheck.length && !genresToCheck.some(g => (song.genre || []).includes(g))) return false;

    const subgenresToCheck = group === 'subgenres' ? overrideValues : selectedFilters.subgenres;
    if (subgenresToCheck.length && !subgenresToCheck.some(sg => (song.subgenre || []).includes(sg))) return false;

    const moodsToCheck = group === 'moods' ? overrideValues : selectedFilters.moods;
    if (moodsToCheck.length && !moodsToCheck.some(m => (song.moods || []).includes(m))) return false;

    if (selectedFilters.yearMin !== null && (song.releaseYear === undefined || song.releaseYear < selectedFilters.yearMin)) return false;
    if (selectedFilters.yearMax !== null && (song.releaseYear === undefined || song.releaseYear > selectedFilters.yearMax)) return false;

    return true;
  });
}

// Render checkbox filter options with dynamic counts, hiding incompatible options
function renderCheckboxFilterWithCounts(containerId, allValues, group) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  allValues.forEach(value => {
    const currentlySelected = selectedFilters[group];
    let override;

    if (currentlySelected.includes(value)) {
      // toggling off
      override = currentlySelected.filter(v => v !== value);
    } else {
      // toggling on
      override = [...currentlySelected, value];
    }

    const filteredSongs = filterSongsWithOverride(group, override);
    const count = filteredSongs.length;

    // Hide options that yield zero songs
    if (count === 0) return;

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

    // Append tag name text
    label.appendChild(document.createTextNode(' ' + value + ' '));

    // Append count inside a <small> tag
    const small = document.createElement('small');
    small.textContent = `(${count})`;
    label.appendChild(small);

    container.appendChild(label);
  });
}

// Render all filters (tags, country, artist, genre, subgenre)
function renderAllFilters() {
  renderCheckboxFilterWithCounts('tag-list', getUniqueTags(), 'tags');
  renderCheckboxFilterWithCounts('country-list', getUniqueValues('country'), 'countries');
  renderCheckboxFilterWithCounts('artist-list', getUniqueValues('artist'), 'artists');
  renderCheckboxFilterWithCounts('label-list', getUniqueValues('label'), 'labels');
  renderCheckboxFilterWithCounts('genre-list', getUniqueValues('genre'), 'genres');
  renderCheckboxFilterWithCounts('subgenre-list', getUniqueValues('subgenre'), 'subgenres');
  renderCheckboxFilterWithCounts('mood-list', getUniqueValues('moods'), 'moods');
}

// Render a single song item
function renderSong(song) {
  const li = document.createElement('li');

  const link = document.createElement('a');
  link.href = `song.html?id=${encodeURIComponent(song.id)}`;
  link.textContent = `${song.title} – ${song.artist}`;
  li.appendChild(link);

  const tagContainer = document.createElement('div');
  tagContainer.className = 'tag-container';
  if (Array.isArray(song.normalizedTags)) {
    song.normalizedTags.forEach(tag => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = tag;
      tagContainer.appendChild(span);
    });
  }
  if (Array.isArray(song.moods)) {
    song.moods.forEach(mood => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = mood;
      tagContainer.appendChild(span);
    });
  }
  li.appendChild(tagContainer);

  return li;
}

// Load filtered songs to the DOM
function loadSongList(songs) {
  const container = document.getElementById('song-list');
  container.innerHTML = '';

  if (songs.length === 0) {
    container.textContent = 'No songs match the current filters.';
    return;
  }

  songs.forEach(song => container.appendChild(renderSong(song)));
}

// Apply all filters and sorting, then update list
function applyFilters() {
  let filtered = allSongs.filter(song => {
    if (selectedFilters.tags.length && !selectedFilters.tags.some(t => (song.filterTags || []).includes(t))) return false;
    if (selectedFilters.countries.length) {
      const songCountries = Array.isArray(song.country) ? song.country : [song.country];
      if (!selectedFilters.countries.some(c => songCountries.includes(c))) return false;
    }
    if (selectedFilters.artists.length && !selectedFilters.artists.includes(song.artist)) return false;
    if (selectedFilters.labels.length) {
      const songLabels = Array.isArray(song.label) ? song.label : [song.label];
      if (!selectedFilters.labels.some(l => songLabels.includes(l))) return false;
    }
    if (selectedFilters.genres.length && !selectedFilters.genres.some(g => (song.genre || []).includes(g))) return false;
    if (selectedFilters.subgenres.length && !selectedFilters.subgenres.some(sg => (song.subgenre || []).includes(sg))) return false;
    if (selectedFilters.moods.length && !selectedFilters.moods.some(m => (song.moods || []).includes(m))) return false;
    if (selectedFilters.yearMin !== null && (song.releaseYear === undefined || song.releaseYear < selectedFilters.yearMin)) return false;
    if (selectedFilters.yearMax !== null && (song.releaseYear === undefined || song.releaseYear > selectedFilters.yearMax)) return false;

    if (currentSearchQuery) {
      const text = currentSearchQuery.toLowerCase();
      const inTitle = song.title.toLowerCase().includes(text);
      const inArtist = song.artist.toLowerCase().includes(text);
      let inKeywords = false;

      if (song.keywords) {
        if (Array.isArray(song.keywords)) {
          inKeywords = song.keywords.some(k => k.toLowerCase().includes(text));
        } else if (typeof song.keywords === 'string') {
          inKeywords = song.keywords.toLowerCase().includes(text);
        }
      }

      if (!inTitle && !inArtist && !inKeywords) return false;
    }

    return true;
  });

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

// Setup UI event listeners
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
  // Normalize tags and split combined values; split countries into arrays
  allSongs.forEach(song => {
    if (Array.isArray(song.tags)) {
      const tagSet = new Set();
      song.tags.forEach(tag => {
        if (typeof tag === 'string' && tag.includes('/')) {
          tag.split('/').forEach(part => {
            const norm = normalizeTag(part.trim());
            if (norm) tagSet.add(norm);
          });
        } else {
          const norm = normalizeTag(tag);
          if (norm) tagSet.add(norm);
        }
      });
      song.normalizedTags = Array.from(tagSet);
    } else {
      song.normalizedTags = [];
    }

    // Build tag set used solely for filtering
    song.filterTags = Array.from(
      new Set(song.normalizedTags.flatMap(consolidateTagForFilter))
    );

    // Parse record labels and remove them from filter tags
    if (song.label) {
      if (typeof song.label === 'string') song.label = parseLabels(song.label);
      else if (!Array.isArray(song.label)) song.label = [];

      // Build a set of lowercase label names for quick checks
      const labelSet = new Set(song.label.map(l => l.toLowerCase()));

      // Remove any tag that matches or contains a label name so labels only
      // appear in the dedicated Record Label filter.
      song.filterTags = song.filterTags.filter(tag => {
        const lower = tag.toLowerCase();
        return !Array.from(labelSet).some(label =>
          lower === label || lower.includes(label)
        );
      });
    } else {
      song.label = [];
    }

    if (typeof song.country === 'string') {
      song.country = song.country
        .split('/')
        .map(c => normalizeCountry(c.trim()))
        .filter(Boolean);
      song.country = [...new Set(song.country)];
    }

    // Derive moods from description, tags and subgenre
    song.moods = deriveMoods(song);
  });

  renderAllFilters();
  setupControls();
  applyFilters();
}

init();
