import os
import re
import json
import datetime
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_FILE = "notes_cache.json"
TWEETS_FILE = "sent_tweets.json"

# In-memory cache fallback
_cached_notes = None
_last_fetched = None

def parse_html_content(html_content, entry_id, date_title, updated, link):
    """
    Parses the Atom entry HTML content and splits it into individual release note items by <h3> category.
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    h3s = soup.find_all('h3')
    
    parsed_items = []
    
    if not h3s:
        # If there are no <h3> headings, treat the entire entry as one general update
        clean_text = soup.get_text(separator=' ').strip()
        clean_text = re.sub(r'\s+', ' ', clean_text)
        parsed_items.append({
            'id': f"{entry_id}_item_0",
            'date': date_title,
            'updated': updated,
            'link': link,
            'category': 'General',
            'description': html_content,
            'text': clean_text
        })
        return parsed_items

    for i, h3 in enumerate(h3s):
        category = h3.get_text().strip()
        
        # Collect all subsequent siblings until the next <h3>
        desc_parts = []
        curr = h3.next_sibling
        while curr and curr.name != 'h3':
            desc_parts.append(str(curr))
            curr = curr.next_sibling
            
        desc_html = "".join(desc_parts).strip()
        
        # Clean text for Twitter
        item_soup = BeautifulSoup(desc_html, 'html.parser')
        clean_text = item_soup.get_text(separator=' ').strip()
        clean_text = re.sub(r'\s+', ' ', clean_text)
        
        # Build a safe unique ID
        safe_id = f"{entry_id}_item_{i}"
        
        parsed_items.append({
            'id': safe_id,
            'date': date_title,
            'updated': updated,
            'link': link,
            'category': category,
            'description': desc_html,
            'text': clean_text
        })
        
    return parsed_items

def get_release_notes(force_refresh=False):
    global _cached_notes, _last_fetched
    
    now = datetime.datetime.now()
    if not force_refresh and _cached_notes and _last_fetched and (now - _last_fetched).total_seconds() < 3600:
        return _cached_notes, _last_fetched
        
    # Check file cache if in-memory is empty
    if not force_refresh and os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                _cached_notes = data['notes']
                _last_fetched = datetime.datetime.fromisoformat(data['last_fetched'])
                # If cached data is less than an hour old, return it
                if (now - _last_fetched).total_seconds() < 3600:
                    return _cached_notes, _last_fetched
        except Exception:
            pass # Fall back to fetching if file reading fails
            
    # Fetch from Google Cloud Feed URL
    try:
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
        
        root = ET.fromstring(response.content)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        all_notes = []
        for entry in root.findall('atom:entry', ns):
            entry_id = entry.find('atom:id', ns).text
            date_title = entry.find('atom:title', ns).text
            updated = entry.find('atom:updated', ns).text
            
            # Safe link parsing
            links = entry.findall('atom:link', ns)
            link = ""
            for l in links:
                if l.attrib.get('rel') == 'alternate':
                    link = l.attrib.get('href', '')
                    break
            if not link and links:
                link = links[0].attrib.get('href', '')
            
            content_elem = entry.find('atom:content', ns)
            if content_elem is None:
                continue
                
            html_content = content_elem.text or ""
            items = parse_html_content(html_content, entry_id, date_title, updated, link)
            all_notes.extend(items)
            
        _cached_notes = all_notes
        _last_fetched = now
        
        # Save to file cache
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump({
                'notes': _cached_notes,
                'last_fetched': _last_fetched.isoformat()
            }, f, indent=2, ensure_ascii=False)
            
    except Exception as e:
        # If fetch fails but we have some cache, fall back to it
        if _cached_notes:
            return _cached_notes, _last_fetched
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    _cached_notes = data['notes']
                    _last_fetched = datetime.datetime.fromisoformat(data['last_fetched'])
                    return _cached_notes, _last_fetched
            except Exception:
                pass
        raise e
        
    return _cached_notes, _last_fetched

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/notes', methods=['GET'])
def api_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        notes, last_fetched = get_release_notes(force_refresh=force_refresh)
        return jsonify({
            'success': True,
            'notes': notes,
            'last_fetched': last_fetched.isoformat()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/tweets', methods=['GET', 'POST'])
def api_tweets():
    if request.method == 'POST':
        data = request.json or {}
        text = data.get('text', '').strip()
        note_id = data.get('note_id', '').strip()
        
        if not text:
            return jsonify({'success': False, 'error': 'Tweet text cannot be empty'}), 400
            
        tweet = {
            'id': datetime.datetime.now().strftime('%Y%m%d%H%M%S%f'),
            'text': text,
            'note_id': note_id,
            'timestamp': datetime.datetime.now().isoformat()
        }
        
        # Load existing tweets
        tweets = []
        if os.path.exists(TWEETS_FILE):
            try:
                with open(TWEETS_FILE, 'r', encoding='utf-8') as f:
                    tweets = json.load(f)
            except Exception:
                pass
                
        tweets.insert(0, tweet) # Newest tweet first
        
        # Keep only the last 100 tweets
        tweets = tweets[:100]
        
        try:
            with open(TWEETS_FILE, 'w', encoding='utf-8') as f:
                json.dump(tweets, f, indent=2, ensure_ascii=False)
        except Exception as e:
            return jsonify({'success': False, 'error': f'Failed to write database: {str(e)}'}), 500
            
        return jsonify({'success': True, 'tweet': tweet})
        
    else: # GET
        tweets = []
        if os.path.exists(TWEETS_FILE):
            try:
                with open(TWEETS_FILE, 'r', encoding='utf-8') as f:
                    tweets = json.load(f)
            except Exception:
                pass
        return jsonify({'success': True, 'tweets': tweets})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
