# Band Practice Pro v3: Design prompt

My app called "Band Practice Pro" version 2 (BPPv2) is very useful to my band.
I want to enhance this application further in a major re-write for version 3 (BPPv3).

My plan is to re-use the Google Infrastructure from BPPv2 as much as possible.
I do NOT need any data conversions from BPPv2. We can reuse the firestore database, but create all new tables for BPPv3.
This is a re-write from ground up with major improvements.

However, there are some good features in BPPv2 that must be preserved "conceptually" in the new BPPv3.
I do NOT want to re-use code, because BPPv2 was not built thoughtfully, it was hacked into shape.
We will only REFER to BPPv2 code in the /webapp_v2/ folder, not reuse or change it.

BPPv3 should be built from the ground up with thoughtful intent.
For example: CSS base classes that are re-usable for common elements.

The app design should be dark and classy. It's being used on large TV screens in dark rooms.
We want a dark modern look, easy on the eyes, very readable without being "bright".

First, I need you to analyze my current problems, and proposed v3 design.
Is this idea feasible, in particular the idea that Youtube Music OR Spotify Playlists could be linked to a Collection.
The problem might be a lack of any common identifiers for "songs" between two platforms.

Before we get into detailed design, how feasible is the overall architecture change here?
