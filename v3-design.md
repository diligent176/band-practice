# Band Practice Pro v2: Design or User experience problems

- Double authentication: user auths to Google Firebase for the main app, THEN ALSO to Spotify for music streaming
  (double auth is annoying)

- Lyric fetching - although it's working fairly well (scraping from Genius) - it's slow and somewhat unreliable/inaccurate at times.
  On a positive note, lyric section headings are pre-defined from Genius [Chorus] and [Verse] etc.

- BPM / song tempo fetching is unreliable and quite inaccurate

- Currently the BPM flasher indicator is independent / not linked to music

- The mobile / small screen experience is sub-optimal. Hardly usable on a phone or small tablet.

- Spotify API / oAuth has a limit of 25 app users and they must be PRE-NAMED by an Admin before they can authenticate.
  Spotify limitation makes the app completely non-scalable as a public/commercial app for wider use.

- The concept of "Collections" and sharing them is half-baked.
  Users may not intuitively understand the Collection/Playlist/Song relationship or the UI buttons.

- Relationship of Practice Notes to Lyrics sections is not obvious. Would like to improve the
  highlighting/navigating of Note sections and their related lyric section.
  Perhaps some type of coloring or callouts that don't require keyboarding to visualize the relationship.

- Google Firestore nosql database may not have appropriate security rules applied to prevent tampering.
  My colleague mentioned I should look into the database security to prevent someone from tampering with tables.
  (for example - setting themselves is_admin = true in the users collection)

# v3: Planned Improvements

- A unified / single authentication layer - Google only

- Spotify Playlists are "referenced" in a Collection.
  The app treats Spotify Playlists in a collection as the master source of songs.
  A "Collection" is simply a bunch of songs, where each song has a relationship to the Collection, and at least one Playlist (perhaps more than one).

- Nice to have: True BPM detection. Better yet - synced to the actual music heartbeat.
  (Syncing might be impossible, as songs often change tempo while playing).
  BPM indicator is currently started with 'i' key independent of music - useful as a metronome while practicing.

# v3: User Experience - the vision

- The User can install Band Practice Pro as a Progressive Web App, so it runs FULL SCREEN as an independent app from their web browser.
  The PWA install is advertised/encouraged on the Auth Gate, as a convenience for regular users.

- A user authenticates in the auth gate as their Google account (similar to v2, but cooler and flashier - more Reggae)

- The HOME screen is a FULL SCREEN view of Music Collections with two main sections:
  "Your Collections" (Owned by You) vs "Shared Collections" (Shared with you)

- HOME VIEW: Music Collections - where a user creates & manages their Collections.
  From this single view, Spotify playlists can be linked or unlinked to the Collections you Own.

- By linking a playlist to a collection, "Songs" are imported to that Collection.
  (database relationships are created between song, collection, and one or more linked playlist IDs)
  To link playlists, I must be an Owner of the Collection, or a Collaborator on a Shared Collection.

- The Playlist ORDER within your Owned collections can be managed from Collections (HOME) view.
  All details about your Owned Collections can be managed in HOME view.
  (Name, description, public visibility, Collaborators, delete/modify a collection)

- Lyrics are immediately fetched in the background for each song added to a Collection
  (lyrics saved in the firestore database for later customization)

- From the main Collections view, a user "Opens" a collection using their KEYBOARD (or mouse)

- The opened Collection now transforms to full screen SONGS VIEW (i.e. Song Chooser v3).
  From SONGS VIEW, a user quickly chooses a song from this Collection using the keyboard (or mouse).
  Any typing instantly filters the list, same as Song Chooser v2.
  The Up/Down arrows, Page Down/Page Up, or Home/End keys intuitively work to navigate the song list.
  ENTER key opens the song into SONG PLAYER view...

- In SONG PLAYER view - the lyrics and practice notes are viewed and edited, and music is played.
  This view optimizes for FITTING ALL LYRICS on the screen as the utmost priority.
  Practice Notes are second priority, along with song structure.
  The song info/metadata, tempo and BPM flasher are required, but must occupy MINIMAL space in PLAYER view.

- The music player and song artwork must be visible and functional, but unobtrusive in PLAYER view.
  Play/pause/restart/fast-forward music is required, but should not occupy much visual space.

- The 3-column view for Lyrics should be default. User can still toggle between 1-2-3 column view with 'c' key.

- The PLAYER view will ALWAYS self-optimize to FIT ALL LYRICS as the number one job.
  Meaning - the Font Size adjuster self-adjusts when a song is loaded to FIT all lyrics in the viewport.
  Practice Notes are secondary, especially when the available screen size is too small.
  In "small screen mode", user can TOGGLE between Lyric view or Notes view when both can't fit on the screen.

- Intuitive keyboard shortcuts exist so user can quickly edit the Lyric, or edit the Notes.
  The v2 app works well. Incorporate the same shortcuts to insert section headings, tighten, and save CTRL+ENTER

- The relationship of Practice Notes to Song Lyrics is still referenced by line numbering (same as v2).
  To improve the visual relationship, a subtle back-coloring will exist on each "Note block" that pairs with the related Lyric block.
  The user will still be able to 'keyboard through' the Note Blocks as it was in v2, but now with a permanent visual
  back-coloring that relates each Note Block to it's lyric part. This must be subtle, then highlight more when keyboarding through the notes.

- Navigating to NEXT SONG in a collection is easy and quick from the player view. (CTRL+SPACE?)
  Song ordering is determined by PLAYLIST natural order. Hierarchy is:
  Collection → Playlists (as ordered by the Collection Owner) → SONGS (in their natural playlist order)

# Technical / design / security requirements

- The app should be extremely snappy and responsive in client-side performance.
  Opening dialogs and screens should feel instant. Server-side data should be readily available on the client.
  (For example, while opening the list of songs in the current collection)

- Keyboard navigation for desktop users is the TOP priority, single intuitive keystrokes for all common functions.
  Navigation must be QUICK and smooth while practicing or performing on stage.
  (v2 has keyboard navigation pretty well done, but still room for improvement)

- Collection sharing requires more security features.
  A Collection can be either (1) Private, or (2) Shared with individuals, or (3) Public.
  Public Collections are Read-Only to ALL users. But a user can REQUEST to be Collaborators in a collection.
  This would set a flag/notification to that Collection OWNER to accept or deny their request.

- The CSS needs to be efficient and modern, it should emphasize HEAVY RE-USE of base classes
  Re-usable classes are a MUST HAVE in the UI design. I DO NOT WANT 5000 lines of snowflake CSS.

- The Google Firestore database must be properly secured from hackers.
  Authenticated Google users must not be able to browse or edit the firestore db through REST API.
  (Only the application is permitted to do this, of course.)

- Mobile experience is lower priority, but should support Pixel 6 or small/old iPad sized tablets.
  With reduced functionality depending on screen size.
  Mostly for on-stage prompting during performances, a reminder of song lyrics overall structure.

- On small screens
