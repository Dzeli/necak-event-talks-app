// App State
let releaseNotes = [];
let filteredNotes = [];
let selectedNote = null;
let currentCategory = 'all';
let searchQuery = '';

// DOM Elements
const notesList = document.getElementById('notes-list');
const searchInput = document.getElementById('search-input');
const categoryPills = document.getElementById('category-pills');
const refreshBtn = document.getElementById('refresh-btn');
const refreshSvg = document.getElementById('refresh-svg');
const syncTimeText = document.getElementById('sync-time-text');
const statusIndicator = document.getElementById('status-indicator');

// Loading/Empty/Error States
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const emptyState = document.getElementById('empty-state');
const retryBtn = document.getElementById('retry-btn');

// Stats Elements
const statAllNum = document.getElementById('stat-all-num');
const statFeaturesNum = document.getElementById('stat-features-num');
const statAnnouncementsNum = document.getElementById('stat-announcements-num');
const statBreakingNum = document.getElementById('stat-breaking-num');

// Tabs
const tabComposer = document.getElementById('tab-composer');
const tabTimeline = document.getElementById('tab-timeline');
const composerTabContent = document.getElementById('composer-tab');
const timelineTabContent = document.getElementById('timeline-tab');

// Composer / Preview Elements
const tweetTextarea = document.getElementById('tweet-textarea');
const charCount = document.getElementById('char-count');
const progressRingIndicator = document.getElementById('progress-ring-indicator');
const tweetWebIntentBtn = document.getElementById('tweet-web-intent-btn');
const postMockBtn = document.getElementById('post-mock-btn');
const previewEmpty = document.getElementById('preview-empty');
const previewContentBox = document.getElementById('preview-content-box');
const previewBadge = document.getElementById('preview-badge');
const previewDate = document.getElementById('preview-date');
const previewDescription = document.getElementById('preview-description');
const previewLink = document.getElementById('preview-link');

// Timeline Elements
const timelineList = document.getElementById('timeline-list');
const timelineEmpty = document.getElementById('timeline-empty');
const tweetCount = document.getElementById('tweet-count');

// Progress Ring Configuration
const ringRadius = 12;
const ringCircumference = 2 * Math.PI * ringRadius; // ~75.4
progressRingIndicator.style.strokeDasharray = `${ringCircumference} ${ringCircumference}`;
progressRingIndicator.style.strokeDashoffset = ringCircumference;

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    fetchNotes();
    fetchTweets();
    setupEventListeners();
});

function setupEventListeners() {
    // Search
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        applyFilters();
    });

    // Category pills filter
    categoryPills.addEventListener('click', (e) => {
        if (e.target.classList.contains('pill')) {
            document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
            e.target.classList.add('active');
            currentCategory = e.target.getAttribute('data-category');
            applyFilters();
        }
    });

    // Refresh
    refreshBtn.addEventListener('click', () => fetchNotes(true));
    retryBtn.addEventListener('click', () => fetchNotes(true));

    // Composer Input
    tweetTextarea.addEventListener('input', handleComposerInput);

    // Share Options
    tweetWebIntentBtn.addEventListener('click', handleRealTweet);
    postMockBtn.addEventListener('click', handlePostMockTweet);

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const activeTab = e.target.getAttribute('data-tab');
            if (activeTab === 'composer-tab') {
                composerTabContent.classList.remove('hidden');
                timelineTabContent.classList.add('hidden');
            } else {
                composerTabContent.classList.add('hidden');
                timelineTabContent.classList.remove('hidden');
                fetchTweets(); // Refresh history when switching
            }
        });
    });
}

// Fetch Notes from API
async function fetchNotes(refresh = false) {
    toggleLoading(true);
    refreshSvg.classList.add('spinning');
    refreshBtn.disabled = true;
    statusIndicator.className = 'status-indicator syncing';
    syncTimeText.textContent = refresh ? 'Syncing...' : 'Fetching...';

    try {
        const response = await fetch(`/api/notes?refresh=${refresh}`);
        const data = await response.json();
        
        if (data.success) {
            releaseNotes = data.notes;
            updateStats();
            applyFilters();
            
            // Format last synced date
            const syncTime = new Date(data.last_fetched);
            syncTimeText.textContent = `Synced: ${syncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            statusIndicator.className = 'status-indicator online';
            toggleError(false);
        } else {
            throw new Error(data.error || 'Server failed to parse notes.');
        }
    } catch (err) {
        console.error(err);
        errorMessage.textContent = err.message || 'Check your internet connection or the server logs.';
        toggleError(true);
        statusIndicator.className = 'status-indicator offline';
        syncTimeText.textContent = 'Sync Failed';
    } finally {
        toggleLoading(false);
        refreshSvg.classList.remove('spinning');
        refreshBtn.disabled = false;
    }
}

// Fetch simulated Tweets
async function fetchTweets() {
    try {
        const response = await fetch('/api/tweets');
        const data = await response.json();
        if (data.success) {
            renderTimeline(data.tweets);
        }
    } catch (err) {
        console.error('Failed to fetch mock tweets', err);
    }
}

// Filter and Search Logic
function applyFilters() {
    filteredNotes = releaseNotes.filter(note => {
        const matchesCategory = (currentCategory === 'all' || note.category === currentCategory);
        const matchesSearch = (note.text.toLowerCase().includes(searchQuery) || 
                               note.date.toLowerCase().includes(searchQuery) ||
                               note.category.toLowerCase().includes(searchQuery));
        return matchesCategory && matchesSearch;
    });

    renderNotes();
}

// Stats counter
function updateStats() {
    statAllNum.textContent = releaseNotes.length;
    
    const features = releaseNotes.filter(n => n.category === 'Feature').length;
    const announcements = releaseNotes.filter(n => n.category === 'Announcement').length;
    const breakingAndIssues = releaseNotes.filter(n => n.category === 'Breaking' || n.category === 'Issue').length;
    
    statFeaturesNum.textContent = features;
    statAnnouncementsNum.textContent = announcements;
    statBreakingNum.textContent = breakingAndIssues;
}

// Render Release Notes Grid
function renderNotes() {
    notesList.innerHTML = '';
    
    if (filteredNotes.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    filteredNotes.forEach(note => {
        const card = document.createElement('article');
        card.className = `note-card ${selectedNote && selectedNote.id === note.id ? 'selected' : ''}`;
        card.setAttribute('aria-selected', selectedNote && selectedNote.id === note.id ? 'true' : 'false');
        card.setAttribute('tabindex', '0');
        
        const badgeClass = note.category.toLowerCase();
        
        card.innerHTML = `
            <div class="note-card-header">
                <div class="note-meta">
                    <span class="badge ${badgeClass}">${note.category}</span>
                    <span class="note-date">${note.date}</span>
                </div>
                <div class="note-check-box" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2005/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
            </div>
            <div class="note-desc-snippet">${note.text}</div>
            <div class="note-card-actions">
                <button class="btn-card-draft" aria-label="Draft tweet for this note">
                    <svg xmlns="http://www.w3.org/2005/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path></svg>
                    <span>Draft Tweet</span>
                </button>
            </div>
        `;
        
        // Select logic
        const selectAction = () => {
            selectNoteCard(note);
            document.querySelectorAll('.note-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        };

        card.addEventListener('click', (e) => {
            // Prevent double triggers if clicked inside card draft button
            if (e.target.closest('.btn-card-draft')) return;
            selectAction();
        });

        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectAction();
            }
        });

        // Draft Button Click Handler
        card.querySelector('.btn-card-draft').addEventListener('click', (e) => {
            e.stopPropagation();
            selectNoteCard(note, true);
            document.querySelectorAll('.note-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
        
        notesList.appendChild(card);
    });
}

// Select Note and update Draft Composer
function selectNoteCard(note, autoFocusComposer = false) {
    selectedNote = note;
    
    // Update Preview Panel
    previewEmpty.classList.add('hidden');
    previewContentBox.classList.remove('hidden');
    
    previewBadge.className = `preview-category-badge ${note.category.toLowerCase()}`;
    previewBadge.textContent = note.category;
    previewDate.textContent = note.date;
    previewDescription.innerHTML = note.description;
    previewLink.href = note.link;
    
    // Build Tweet Text Draft
    const draftedText = buildTweetDraftText(note);
    tweetTextarea.value = draftedText;
    handleComposerInput();
    
    if (autoFocusComposer) {
        tweetTextarea.focus();
        // Scroll to the top of composer if on mobile layout
        tweetTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Smart Tweet Draft Generator (forces fit within 280 characters)
function buildTweetDraftText(note) {
    const icon = getCategoryIcon(note.category);
    const header = `${icon} BQ ${note.category} (${note.date}):\n`;
    
    // Custom formatted short link: Twitter converts all links to 23 chars internally, 
    // but in local count we will just treat it realistically.
    const linkText = `\n\nNotes: ${note.link}`;
    
    // 280 max characters. Leave safety margins
    const maxDescLength = 280 - header.length - linkText.length;
    
    let description = note.text;
    if (description.length > maxDescLength) {
        description = description.substring(0, maxDescLength - 3) + "...";
    }
    
    return `${header}${description}${linkText}`;
}

// Helper to choose emoji for type
function getCategoryIcon(category) {
    switch (category) {
        case 'Feature': return '🚀';
        case 'Announcement': return '📢';
        case 'Issue': return '⚠️';
        case 'Breaking': return '🚨';
        case 'Change': return '🔄';
        default: return '💡';
    }
}

// Composer Input Event (Length calculations and visual states)
function handleComposerInput() {
    const text = tweetTextarea.value;
    const len = text.length;
    const remaining = 280 - len;
    
    charCount.textContent = remaining;
    
    // Calculate progress offset
    const percentage = Math.min(len / 280, 1);
    const dashOffset = ringCircumference - (percentage * ringCircumference);
    progressRingIndicator.style.strokeDashoffset = dashOffset;
    
    // Progress Color States
    if (remaining < 0) {
        progressRingIndicator.style.stroke = '#ef4444'; // Red
        charCount.style.color = '#ef4444';
        tweetWebIntentBtn.disabled = true;
        postMockBtn.disabled = true;
    } else if (remaining <= 20) {
        progressRingIndicator.style.stroke = '#f59e0b'; // Amber
        charCount.style.color = '#f59e0b';
        tweetWebIntentBtn.disabled = false;
        postMockBtn.disabled = false;
    } else {
        progressRingIndicator.style.stroke = '#4285f4'; // Google Blue
        charCount.style.color = 'var(--text-secondary)';
        
        // Disable buttons if textarea is completely empty
        const isDraftEmpty = text.trim().length === 0;
        tweetWebIntentBtn.disabled = isDraftEmpty;
        postMockBtn.disabled = isDraftEmpty;
    }
}

// Trigger standard Twitter Web Intent
function handleRealTweet() {
    const tweetText = tweetTextarea.value;
    if (!tweetText) return;
    
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(intentUrl, '_blank');
}

// Trigger simulated/mock post
async function handlePostMockTweet() {
    const tweetText = tweetTextarea.value;
    if (!tweetText) return;
    
    postMockBtn.disabled = true;
    
    try {
        const response = await fetch('/api/tweets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: tweetText,
                note_id: selectedNote ? selectedNote.id : ''
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Success animation/transition
            showSuccessNotification();
            
            // Switch tabs to timeline log
            tabTimeline.click();
            
            // Clear composer input
            tweetTextarea.value = '';
            handleComposerInput();
        } else {
            alert(`Error posting tweet: ${data.error}`);
        }
    } catch (err) {
        console.error('Failed to post tweet', err);
        alert('Server connection error. Failed to post simulated tweet.');
    } finally {
        postMockBtn.disabled = false;
    }
}

// Success indicator
function showSuccessNotification() {
    const indicator = document.querySelector('.draft-indicator');
    const originalText = indicator.textContent;
    indicator.textContent = 'Post Sent!';
    indicator.style.background = 'rgba(16, 185, 129, 0.1)';
    indicator.style.color = '#10b981';
    indicator.style.borderColor = 'rgba(16, 185, 129, 0.2)';
    
    setTimeout(() => {
        indicator.textContent = originalText;
        indicator.style.background = '';
        indicator.style.color = '';
        indicator.style.borderColor = '';
    }, 2500);
}

// Render Twitter timeline simulator
function renderTimeline(tweets) {
    timelineList.innerHTML = '';
    tweetCount.textContent = tweets.length;
    
    if (tweets.length === 0) {
        timelineEmpty.classList.remove('hidden');
        return;
    }
    
    timelineEmpty.classList.add('hidden');
    
    tweets.forEach(tweet => {
        const el = document.createElement('div');
        el.className = 'tweet-item';
        
        const tweetTime = formatTweetDate(tweet.timestamp);
        
        el.innerHTML = `
            <div class="tweet-item-header">
                <div class="tweet-avatar">BQ</div>
                <div class="tweet-name">BigQuery Broadcaster</div>
                <div class="tweet-handle">@bq_release_hub</div>
                <div class="tweet-time">${tweetTime}</div>
            </div>
            <div class="tweet-body">${escapeHTML(tweet.text)}</div>
        `;
        timelineList.appendChild(el);
    });
}

function formatTweetDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 6000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// Utility View toggles
function toggleLoading(show) {
    if (show) {
        loadingState.classList.remove('hidden');
        notesList.classList.add('hidden');
        emptyState.classList.add('hidden');
        errorState.classList.add('hidden');
    } else {
        loadingState.classList.add('hidden');
        notesList.classList.remove('hidden');
    }
}

function toggleError(show) {
    if (show) {
        errorState.classList.remove('hidden');
        notesList.classList.add('hidden');
        loadingState.classList.add('hidden');
        emptyState.classList.add('hidden');
    } else {
        errorState.classList.add('hidden');
    }
}
