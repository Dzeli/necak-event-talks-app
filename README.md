# BigQuery Release Notes Tracker & Social Hub

A premium, dark-themed web application built with **Python Flask** and **Vanilla HTML5, CSS3, and JavaScript**. The application parses the official Google Cloud BigQuery release notes Atom feed, presents them in an interactive dashboard, and enables you to compose and share updates directly to Twitter or record them in a local broadcasting history log.

---

## 🚀 Key Features

*   **Granular Change Separation**: Automatically parses XML entries and breaks them down into individual cards categorized by change types (*Feature*, *Announcement*, *Issue*, *Breaking*, *Change*, *General*).
*   **Dual Cache System**: Implements both in-memory and disk-based caching (`notes_cache.json`) to guarantee sub-millisecond response times and reduce API call load on Google Cloud feeds.
*   **Instant Query Filters**: Search release logs by keywords or filter by category pills.
*   **Twitter Hub & Auto-Drafter**:
    *   Clicking **"Draft Tweet"** automatically generates a tailored tweet (complete with category emojis and the source link) trimmed to fit within the 280-character limit.
    *   **Twitter Web Intent Integration**: Opens the composer window on Twitter/X in a new tab pre-populated with your text.
    *   **Timeline Simulator**: Allows you to simulate posts ("Post Mock") which saves them to a local database (`sent_tweets.json`) and shows them in an in-app broadcasting history log.
*   **Cloud Analytics Aesthetic**: A glassmorphic dark theme styled with responsive CSS grids, CSS variables, Google Fonts (`Outfit`), custom icons, and fluid transition animations.

---

## 📁 Directory Structure

```text
bq-releases-notes/
│
├── app.py                  # Flask server and XML/BeautifulSoup parser
├── .gitignore              # Ignores byte caches, environments, and local data
├── README.md               # Project documentation (this file)
│
├── templates/
│   └── index.html          # Semantic HTML5 frontend template
│
└── static/
    ├── css/
    │   └── style.css       # Design tokens, layouts, and animations
    └── js/
        └── app.js          # State management, filter mechanics, and API connections
```

---

## 🛠️ Prerequisites

*   **Python 3.8+** (Using the standard `py` launcher on Windows)
*   **Required Python Packages**:
    *   `flask` (Web framework)
    *   `requests` (HTTP requests)
    *   `beautifulsoup4` (DOM parser)

---

## 🏃 Getting Started

### 1. Install Dependencies
Ensure you have the required packages installed in your Python environment:
```bash
py -m pip install flask requests beautifulsoup4
```

### 2. Launch the Application
Run the Flask server:
```bash
py app.py
```
By default, the application runs in debug mode on port **5000**.

### 3. View in Browser
Open your browser and navigate to:
**[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 🧩 API Endpoints

*   `GET /`: Serves the HTML frontend interface.
*   `GET /api/notes`: Fetches and parses release notes. Use `?refresh=true` to force a new feed fetch.
*   `GET /api/tweets`: Returns the history of mock-sent tweets.
*   `POST /api/tweets`: Saves a new mock tweet to the simulated timeline.
