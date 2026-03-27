// ============================================
//  ResearchRadar — app.js  (Discover page)
//  APIs: OpenAlex (openalex.org) + REST Countries
// ============================================

const OPENALEX = 'https://api.openalex.org';
const COUNTRIES_API = 'https://restcountries.com/v3.1/all?fields=name,cca2';
const PER_PAGE = 10;

let currentQuery = '';
let currentPage = 1;
let totalResults = 0;
let isListView = true;

const paperCache = {};

// DOM refs
const searchInput   = document.getElementById('search-input');
const searchBtn     = document.getElementById('search-btn');
const resultsSection = document.getElementById('results-section');
const papersList    = document.getElementById('papers-list');
const loadingEl     = document.getElementById('loading');
const errorEl       = document.getElementById('error-state');
const emptyEl       = document.getElementById('empty-state');
const resultsCountEl = document.getElementById('results-count');
const resultsQueryEl = document.getElementById('results-query');
const paginationEl  = document.getElementById('pagination');
const modalOverlay  = document.getElementById('modal-overlay');
const modalContent  = document.getElementById('modal-content');
const radarGlow     = document.querySelector('.radar-glow');
const filtersPanel  = document.getElementById('filters-panel');

// ============================================
//  INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    loadCountries();
    bindEvents();

    // Glow follows mouse
    document.addEventListener('mousemove', (e) => {
        radarGlow.style.left = `${e.clientX}px`;
        radarGlow.style.top  = `${e.clientY}px`;
    });

    // Auto-search if arriving from trending page (?q=topic)
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) {
        searchInput.value = q;
        handleSearch();
    }
});

function bindEvents() {
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    document.getElementById('apply-filters').addEventListener('click', () => {
        currentPage = 1;
        performSearch(currentQuery, 1);
    });

    document.getElementById('clear-filters').addEventListener('click', clearFilters);

    document.getElementById('modal-close').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    document.getElementById('view-list').addEventListener('click', () => setView('list'));
    document.getElementById('view-grid').addEventListener('click', () => setView('grid'));

    // Mobile: filters drawer
    document.getElementById('filters-toggle').addEventListener('click', () => {
        filtersPanel.classList.add('open');
    });
    document.getElementById('filters-close').addEventListener('click', () => {
        filtersPanel.classList.remove('open');
    });

    // Mobile: nav menu
    document.getElementById('mobile-menu-btn').addEventListener('click', () => {
        document.getElementById('nav-links').classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (
            filtersPanel.classList.contains('open') &&
            !filtersPanel.contains(e.target) &&
            e.target !== document.getElementById('filters-toggle')
        ) {
            filtersPanel.classList.remove('open');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!modalOverlay.classList.contains('hidden')) closeModal();
            filtersPanel.classList.remove('open');
        }
    });
}

// ============================================
//  SEARCH
// ============================================
function handleSearch() {
    const query = searchInput.value.trim();
    if (!query) { searchInput.focus(); return; }
    currentQuery = query;
    currentPage  = 1;

    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    performSearch(query, 1);
}

async function performSearch(query, page) {
    showLoading();

    const params = new URLSearchParams({
        search: query,
        per_page: PER_PAGE,
        page,
        sort: document.getElementById('sort-by').value,
        mailto: 'researchradar@app.dev',
    });

    const filters = buildFilterString();
    if (filters) params.set('filter', filters);

    try {
        // Check network connectivity before attempting request
        if (!navigator.onLine) {
            throw new Error('OFFLINE');
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        let res;
        try {
            res = await fetch(`${OPENALEX}/works?${params}`, { signal: controller.signal });
        } finally {
            clearTimeout(timeout);
        }

        if (res.status === 429) throw new Error('RATE_LIMIT');
        if (res.status === 503 || res.status === 502) throw new Error('API_DOWN');
        if (!res.ok) throw new Error(`HTTP_${res.status}`);

        let data;
        try {
            data = await res.json();
        } catch {
            throw new Error('INVALID_JSON');
        }

        if (!data || typeof data !== 'object') throw new Error('INVALID_JSON');

        totalResults = data.meta?.count ?? 0;
        currentPage  = page;

        hideLoading();

        if (!data.results || data.results.length === 0) {
            showEmpty();
        } else {
            renderPapers(data.results);
            updateResultsMeta(query, totalResults);
            renderPagination(totalResults, page);
        }
    } catch (err) {
        hideLoading();
        showError(classifyError(err));
    }
}

function classifyError(err) {
    if (err.name === 'AbortError')        return 'Request timed out. The server took too long to respond.';
    if (err.message === 'OFFLINE')        return 'You appear to be offline. Check your internet connection and try again.';
    if (err.message === 'RATE_LIMIT')     return 'Too many requests. Please wait a moment and try again.';
    if (err.message === 'API_DOWN')       return 'The OpenAlex API is temporarily unavailable. Please try again shortly.';
    if (err.message === 'INVALID_JSON')   return 'Received an unexpected response from the server. Please try again.';
    if (err.message.startsWith('HTTP_'))  return `Server error (${err.message.replace('HTTP_', '')}). Please try again.`;
    if (err.message.includes('fetch'))    return 'Could not reach the server. Check your connection and try again.';
    return 'Something went wrong. Please try again.';
}

function buildFilterString() {
    const filters = [];

    const yearFrom = document.getElementById('year-from').value;
    const yearTo   = document.getElementById('year-to').value;
    if (yearFrom && yearTo) {
        filters.push(`publication_year:${yearFrom}-${yearTo}`);
    } else if (yearFrom) {
        filters.push(`publication_year:>${parseInt(yearFrom) - 1}`);
    } else if (yearTo) {
        filters.push(`publication_year:<${parseInt(yearTo) + 1}`);
    }

    if (document.getElementById('open-access-only').checked) filters.push('is_oa:true');

    const country = document.getElementById('country-filter').value;
    if (country) filters.push(`institutions.country_code:${country}`);

    const minCites = document.getElementById('min-citations').value;
    if (minCites && parseInt(minCites) > 0) filters.push(`cited_by_count:>${parseInt(minCites) - 1}`);

    return filters.join(',');
}

// ============================================
//  RENDER PAPERS
// ============================================
function renderPapers(papers) {
    emptyEl.classList.add('hidden');
    errorEl.classList.add('hidden');
    papersList.classList.remove('hidden');
    papersList.className = `papers-list ${isListView ? 'list-view' : 'grid-view'}`;

    papersList.innerHTML = papers.map((paper, i) => {
        const title      = paper.title || 'Untitled';
        const year       = paper.publication_year ?? '—';
        const citations  = paper.cited_by_count ?? 0;
        const isOA       = paper.open_access?.is_oa;
        const oaUrl      = paper.open_access?.oa_url;
        const doi        = paper.doi;

        const authorships = paper.authorships || [];
        const authors     = authorships.slice(0, 3).map(a => a.author?.display_name || 'Unknown').join(', ');
        const extraAuth   = authorships.length > 3 ? ` +${authorships.length - 3} more` : '';
        const venue       = paper.primary_location?.source?.display_name ?? '';
        const abstract    = paper.abstract_inverted_index
            ? decodeAbstract(paper.abstract_inverted_index)
            : 'No abstract available.';

        const conceptTags = (paper.concepts || []).slice(0, 3)
            .map(c => `<span class="concept-tag">${escHtml(c.display_name)}</span>`)
            .join('');

        const paperId = encodeURIComponent(paper.id || '');

        return `
        <article class="paper-card glass-box fade-up" style="animation-delay:${i * 0.04}s">
            <div class="paper-header">
                <div class="paper-badges">
                    ${isOA
                        ? '<span class="badge oa-badge">Open Access</span>'
                        : '<span class="badge closed-badge">Restricted</span>'}
                    ${year !== '—' ? `<span class="badge year-badge">${year}</span>` : ''}
                </div>
                <span class="citation-count" title="${citations.toLocaleString()} citations">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
                        <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
                    </svg>
                    ${citations.toLocaleString()}
                </span>
            </div>

            <h3 class="paper-title">${escHtml(title)}</h3>
            <p class="paper-authors">${escHtml(authors)}${escHtml(extraAuth)}</p>
            ${venue ? `<p class="paper-venue">${escHtml(venue)}</p>` : ''}
            <p class="paper-abstract">${escHtml(abstract)}</p>
            ${conceptTags ? `<div class="paper-concepts">${conceptTags}</div>` : ''}

            <div class="paper-footer">
                <button class="btn-details" onclick="openPaperModal('${paperId}')">View Details</button>
                ${isOA && oaUrl
                    ? `<a href="${oaUrl}" target="_blank" rel="noopener" class="btn-download">↓ Download PDF</a>`
                    : ''}
                ${doi ? `<a href="${doi}" target="_blank" rel="noopener" class="btn-doi">DOI ↗</a>` : ''}
            </div>
        </article>`;
    }).join('');
}

// Decode OpenAlex inverted-index abstract format
function decodeAbstract(invertedIndex) {
    if (!invertedIndex) return '';
    const pos = {};
    for (const [word, positions] of Object.entries(invertedIndex)) {
        for (const p of positions) pos[p] = word;
    }
    return Object.keys(pos).sort((a, b) => a - b).map(k => pos[k]).join(' ');
}

// ============================================
//  PAPER DETAIL MODAL
// ============================================
async function openPaperModal(encodedId) {
    const paperId = decodeURIComponent(encodedId);
    modalOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    modalContent.innerHTML = '<div class="modal-loading"><div class="radar-spinner"></div></div>';

    try {
        let paper = paperCache[paperId];
        if (!paper) {
            const res = await fetch(`${OPENALEX}/works/${encodeURIComponent(paperId)}`);
            if (!res.ok) throw new Error(`Status ${res.status}`);
            paper = await res.json();
            paperCache[paperId] = paper;
        }

        const abstract    = paper.abstract_inverted_index
            ? decodeAbstract(paper.abstract_inverted_index) : 'No abstract available.';
        const isOA        = paper.open_access?.is_oa;
        const oaUrl       = paper.open_access?.oa_url;
        const doi         = paper.doi;
        const year        = paper.publication_year;
        const citations   = paper.cited_by_count ?? 0;
        const venue       = paper.primary_location?.source?.display_name;
        const concepts    = (paper.concepts || []).slice(0, 8);
        const refCount    = paper.referenced_works?.length ?? 0;
        const lastYearCites = paper.counts_by_year?.[0];

        const authorsHtml = (paper.authorships || []).map(a => {
            const name = escHtml(a.author?.display_name || 'Unknown');
            const inst = a.institutions?.[0]?.display_name;
            return inst
                ? `${name} <em style="color:var(--text-muted)">(${escHtml(inst)})</em>`
                : name;
        }).join(', ');

        modalContent.innerHTML = `
            <div class="modal-badges">
                ${isOA
                    ? '<span class="badge oa-badge">Open Access</span>'
                    : '<span class="badge closed-badge">Restricted</span>'}
                ${year ? `<span class="badge year-badge">${year}</span>` : ''}
            </div>
            <h2 class="modal-title">${escHtml(paper.title || 'Untitled')}</h2>
            <p class="modal-authors">${authorsHtml}</p>
            ${venue ? `<p class="modal-venue">Published in: <strong>${escHtml(venue)}</strong></p>` : ''}

            <div class="modal-stats">
                <div class="modal-stat">
                    <span class="stat-n">${citations.toLocaleString()}</span>
                    <span class="stat-l">Citations</span>
                </div>
                ${refCount > 0 ? `
                <div class="modal-stat">
                    <span class="stat-n">${refCount.toLocaleString()}</span>
                    <span class="stat-l">References</span>
                </div>` : ''}
                ${lastYearCites ? `
                <div class="modal-stat">
                    <span class="stat-n">${lastYearCites.cited_by_count ?? 0}</span>
                    <span class="stat-l">Cites in ${lastYearCites.year}</span>
                </div>` : ''}
            </div>

            <div class="modal-abstract">
                <h4>Abstract</h4>
                <p>${escHtml(abstract)}</p>
            </div>

            ${concepts.length ? `
            <div class="modal-concepts">
                <h4>Topics</h4>
                <div class="concept-tags">
                    ${concepts.map(c => `<span class="concept-tag">${escHtml(c.display_name)}</span>`).join('')}
                </div>
            </div>` : ''}

            <div class="modal-actions">
                ${isOA && oaUrl
                    ? `<a href="${oaUrl}" target="_blank" rel="noopener" class="btn-primary-action">↓ Download PDF</a>`
                    : ''}
                ${doi
                    ? `<a href="${doi}" target="_blank" rel="noopener" class="btn-secondary-action">View DOI ↗</a>`
                    : ''}
                ${paper.id
                    ? `<a href="${paper.id}" target="_blank" rel="noopener" class="btn-secondary-action">OpenAlex ↗</a>`
                    : ''}
            </div>`;
    } catch (err) {
        modalContent.innerHTML = `<p class="error-text">Could not load paper details: ${escHtml(err.message)}</p>`;
    }
}

function closeModal() {
    modalOverlay.classList.add('hidden');
    document.body.style.overflow = '';
}

// ============================================
//  LOAD COUNTRIES (REST Countries API)
// ============================================
async function loadCountries() {
    const select = document.getElementById('country-filter');
    try {
        const res = await fetch(COUNTRIES_API);
        if (!res.ok) throw new Error('Countries API failed');

        const countries = await res.json();
        const sorted = countries
            .filter(c => c.cca2 && c.name?.common)
            .sort((a, b) => a.name.common.localeCompare(b.name.common));

        const fragment = document.createDocumentFragment();
        sorted.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.cca2;
            opt.textContent = c.name.common;
            fragment.appendChild(opt);
        });
        select.appendChild(fragment);
    } catch {
        // Not critical — country filter just stays empty
    }
}

// ============================================
//  PAGINATION
// ============================================
function renderPagination(total, page) {
    const totalPages = Math.min(Math.ceil(total / PER_PAGE), 200);
    if (totalPages <= 1) { paginationEl.innerHTML = ''; return; }

    const pages = buildPageRange(page, totalPages);

    paginationEl.innerHTML = `
        <button class="page-btn" ${page <= 1 ? 'disabled' : ''}
                onclick="goToPage(${page - 1})">← Prev</button>
        ${pages.map(p =>
            p === '…'
                ? `<span class="page-ellipsis">…</span>`
                : `<button class="page-btn ${p === page ? 'active' : ''}"
                          onclick="goToPage(${p})">${p}</button>`
        ).join('')}
        <button class="page-btn" ${page >= totalPages ? 'disabled' : ''}
                onclick="goToPage(${page + 1})">Next →</button>`;
}

function buildPageRange(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [1];
    if (current > 3) pages.push('…');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push('…');
    pages.push(total);
    return pages;
}

function goToPage(page) {
    currentPage = page;
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    performSearch(currentQuery, page);
}

// ============================================
//  UI HELPERS
// ============================================
function showLoading() {
    loadingEl.classList.remove('hidden');
    papersList.classList.add('hidden');
    emptyEl.classList.add('hidden');
    errorEl.classList.add('hidden');
    paginationEl.innerHTML = '';
    resultsCountEl.textContent = '';
    resultsQueryEl.textContent = '';
}

function hideLoading() { loadingEl.classList.add('hidden'); }

function showEmpty() {
    emptyEl.classList.remove('hidden');
    papersList.classList.add('hidden');
    paginationEl.innerHTML = '';
    resultsCountEl.textContent = '0 results';
    resultsQueryEl.textContent = '';
}

function showError(msg) {
    errorEl.classList.remove('hidden');
    document.getElementById('error-msg').textContent = msg || 'Something went wrong.';
    papersList.classList.add('hidden');
}

function updateResultsMeta(query, total) {
    resultsCountEl.textContent = `${total.toLocaleString()} papers`;
    resultsQueryEl.textContent = `for "${query}"`;
}

function setView(view) {
    isListView = view === 'list';
    document.getElementById('view-list').classList.toggle('active', isListView);
    document.getElementById('view-grid').classList.toggle('active', !isListView);
    if (!papersList.classList.contains('hidden')) {
        papersList.className = `papers-list ${isListView ? 'list-view' : 'grid-view'}`;
    }
}

function clearFilters() {
    document.getElementById('sort-by').value = 'relevance_score:desc';
    document.getElementById('year-from').value = '';
    document.getElementById('year-to').value = '';
    document.getElementById('open-access-only').checked = false;
    document.getElementById('country-filter').value = '';
    document.getElementById('min-citations').value = '';
    if (currentQuery) { currentPage = 1; performSearch(currentQuery, 1); }
    filtersPanel.classList.remove('open');
}

// XSS protection
function escHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
// renderPapers: maps API results to paper card HTML strings
// decodeAbstract: reconstructs plain text from OpenAlex inverted index format
// loadCountries: fetches all countries from REST Countries API (free, no key)
// showLoading: resets all states before showing spinner
// buildPageRange: generates page numbers capped at OpenAlex 200-page limit
// classifyError: maps fetch errors to specific user-friendly messages
// escHtml: sanitizes strings before DOM insertion to prevent XSS
