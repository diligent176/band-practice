// Band Practice Pro v3 POC - JavaScript functionality

console.log('🎸 Band Practice Pro v3 POC loaded');
console.log('This demonstrates Spotify playback without the 25-user OAuth limit');

// Dynamic track loading
function loadTrack() {
    const trackId = document.getElementById('track-id-input').value.trim();
    const dynamicPlayer = document.getElementById('dynamic-player');

    if (!trackId) {
        alert('Please enter a Spotify Track ID');
        return;
    }

    console.log('Loading track:', trackId);

    // Create embed iframe
    const iframe = document.createElement('iframe');
    iframe.src = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;
    iframe.width = '100%';
    iframe.height = '152';
    iframe.frameBorder = '0';
    iframe.allowfullscreen = true;
    iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    iframe.loading = 'lazy';

    // Clear previous player and add new one
    dynamicPlayer.innerHTML = '';
    dynamicPlayer.appendChild(iframe);

    console.log('✅ Track loaded successfully - no authentication needed!');
}

// Hybrid player functions
function showUpgradeOption() {
    alert('🎧 Connect Spotify Premium\n\n' +
          'This would open a Spotify authentication popup where users can:\n' +
          '1. Login with their Spotify Premium account\n' +
          '2. Grant access to Web Playback SDK\n' +
          '3. Get enhanced playback controls\n\n' +
          'Key: This uses user-initiated OAuth, NOT your app\'s 25-user quota!');
    console.log('Upgrade option clicked - would initialize Web Playback SDK');
}

function openInSpotify() {
    const trackId = '3n3Ppam7vgaVa1iaRUc9Lp';
    const spotifyUrl = `https://open.spotify.com/track/${trackId}`;
    window.open(spotifyUrl, '_blank');
    console.log('Opening in Spotify app/web:', spotifyUrl);
}

// Web Playback SDK Demo (placeholder - needs Spotify Client ID)
function initializeWebPlaybackSDK() {
    console.log('Web Playback SDK initialization would happen here');
    console.log('Requires: Spotify Client ID (from your developer dashboard)');
    console.log('User flow: Popup authentication → Premium account required → Full control');

    document.getElementById('sdk-status').textContent =
        'Status: Requires Spotify Client ID in production. See console for details.';
}

// Simulate what BPPv3 would do
console.log('\n🎯 BPPv3 Implementation Strategy:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('1. User logs in with Google (Firebase) ✅');
console.log('2. User pastes Spotify playlist URL');
console.log('3. Backend fetches tracks via Spotify API (Client Credentials)');
console.log('4. Store track IDs in Firestore');
console.log('5. Frontend loads Spotify embeds - NO USER AUTH NEEDED! ✅');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Example: How to get track IDs from playlist URL
async function getPlaylistTracks(playlistId) {
    console.log('\n📋 Example: Fetching playlist tracks');
    console.log('Playlist ID:', playlistId);
    console.log('This would use Spotify Web API with Client Credentials flow');
    console.log('No user authentication needed for public playlists!');

    // Pseudo-code for BPPv3 backend:
    const exampleCode = `
# Backend (Python/Flask)
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials

# Use Client Credentials (your app credentials)
auth_manager = SpotifyClientCredentials(
    client_id='YOUR_CLIENT_ID',
    client_secret='YOUR_CLIENT_SECRET'
)
sp = spotipy.Spotify(auth_manager=auth_manager)

# Get playlist tracks - NO USER AUTH NEEDED
results = sp.playlist_tracks('${playlistId}')
tracks = []
for item in results['items']:
    track = item['track']
    tracks.append({
        'id': track['id'],
        'name': track['name'],
        'artist': track['artists'][0]['name'],
        'album_art': track['album']['images'][0]['url']
    })

# Store in Firestore
# Then frontend just uses embed: spotify:track:{track_id}
    `;

    console.log(exampleCode);
    return exampleCode;
}

// Test it
console.log('Try calling: getPlaylistTracks("37i9dQZF1DXcBWIGoYBM5M")');

// Demo of how BPPv3 would store songs
const exampleSongData = {
    collection_id: 'rock-classics',
    spotify_track_id: '3n3Ppam7vgaVa1iaRUc9Lp',
    spotify_playlist_uri: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M',
    title: 'Mr. Brightside',
    artist: 'The Killers',
    album: 'Hot Fuss',
    album_art_url: 'https://i.scdn.co/image/ab67616d00001e02ccdddd46119a4ff53eaf1f5d',
    lyrics: '(Fetched from Genius API)',
    practice_notes: [
        { line_number: 5, note: 'Key change here - watch for it!' }
    ],
    bpm: 148,
    created_at: new Date(),
    updated_at: new Date()
};

console.log('\n📊 Example BPPv3 Song Document (Firestore):');
console.log(JSON.stringify(exampleSongData, null, 2));

// Comparison with v2
console.log('\n📈 v2 vs v3 Comparison:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('v2: User logs in → Google Auth ✅');
console.log('    User logs in → Spotify OAuth ❌ (25 user limit)');
console.log('    Playback → Full control via Spotify API');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('v3: User logs in → Google Auth ✅');
console.log('    No Spotify user auth needed! ✅');
console.log('    Playback → Spotify Embed (unlimited users)');
console.log('    Optional → Premium users can connect for more control');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Key insight
console.log('💡 KEY INSIGHT:');
console.log('You don\'t need users to authenticate with Spotify if you:');
console.log('1. Use embed players (works for all public tracks)');
console.log('2. Use Client Credentials for reading playlists (backend only)');
console.log('3. Store track IDs in your database');
console.log('4. Let users play via embeds (no auth needed!)');
console.log('\n✅ This solves your 25-user problem!\n');

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    console.log('POC ready! Try the examples above.');
    console.log('Press F12 to see this console output.');
});

// Allow Enter key in track input
document.getElementById('track-id-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        loadTrack();
    }
});

// Example track IDs for testing
const exampleTracks = {
    'Mr. Brightside': '3n3Ppam7vgaVa1iaRUc9Lp',
    'Bohemian Rhapsody': '6l8GvAyoUZwWDgF1e4822w',
    'Sweet Child O\' Mine': '7o2CTH4ctstm8TNelqjb51',
    'Hotel California': '40riOy7x9W7GXjyGp4pjAv',
    'Stairway to Heaven': '5CQ30WqJwcep0pYcV4AMNc'
};

console.log('\n🎵 Example track IDs to test:');
console.log(JSON.stringify(exampleTracks, null, 2));
console.log('\nPaste any of these IDs into the input box above!');
