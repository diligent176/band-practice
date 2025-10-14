"""
Migration Script: Assign all songs without collection_id to user's Default collection

This script:
1. Gets your user email from environment variable
2. Gets or creates your Default collection
3. Finds all songs without a collection_id
4. Assigns them to your Default collection

Usage:
    python migrate_songs_to_default_collection.py
"""

import os
import sys
from pathlib import Path

# Add the webapp directory to the path so we can import our services
sys.path.insert(0, str(Path(__file__).parent / 'webapp'))

from dotenv import load_dotenv
from services.firestore_service import FirestoreService

# Load environment variables
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)


def migrate_songs_to_default_collection():
    """Migrate all songs without collection_id to user's Default collection"""
    
    # Get user email from environment or prompt
    user_email = os.getenv('USER_EMAIL')
    if not user_email:
        user_email = input("Enter your email address: ").strip()
        if not user_email:
            print("❌ Error: Email address is required")
            return
    
    print(f"🔧 Starting migration for user: {user_email}")
    print("-" * 60)
    
    # Initialize Firestore service
    firestore = FirestoreService()
    
    # Get or create Default collection for this user
    print("📁 Getting Default collection...")
    default_collection = firestore.get_or_create_default_collection(user_email)
    print(f"✅ Default collection ID: {default_collection['id']}")
    print(f"   Name: {default_collection['name']}")
    print()
    
    # Get all songs (no filter)
    print("🎵 Loading all songs...")
    all_songs = firestore.get_all_songs()
    print(f"✅ Found {len(all_songs)} total songs in database")
    print()
    
    # Find songs without collection_id
    songs_to_migrate = [song for song in all_songs if not song.get('collection_id')]
    
    print(f"📊 Songs without collection_id: {len(songs_to_migrate)}")
    print(f"📊 Songs already in collections: {len(all_songs) - len(songs_to_migrate)}")
    print()
    
    if not songs_to_migrate:
        print("✅ All songs already have a collection_id. Nothing to migrate!")
        return
    
    # Confirm migration
    print(f"⚠️  About to migrate {len(songs_to_migrate)} songs to Default collection")
    confirm = input("Continue? (yes/no): ").strip().lower()
    if confirm not in ['yes', 'y']:
        print("❌ Migration cancelled")
        return
    
    print()
    print("🚀 Starting migration...")
    print("-" * 60)
    
    # Migrate each song
    migrated_count = 0
    failed_count = 0
    
    for i, song in enumerate(songs_to_migrate, 1):
        song_id = song['id']
        title = song.get('title', 'Unknown')
        artist = song.get('artist', 'Unknown')
        
        try:
            # Update the song with collection_id
            firestore.db.collection('songs').document(song_id).update({
                'collection_id': default_collection['id']
            })
            
            migrated_count += 1
            print(f"✅ [{i}/{len(songs_to_migrate)}] {artist} - {title}")
            
        except Exception as e:
            failed_count += 1
            print(f"❌ [{i}/{len(songs_to_migrate)}] Failed: {artist} - {title}")
            print(f"   Error: {e}")
    
    # Summary
    print()
    print("=" * 60)
    print("📊 MIGRATION SUMMARY")
    print("=" * 60)
    print(f"✅ Successfully migrated: {migrated_count} songs")
    if failed_count > 0:
        print(f"❌ Failed: {failed_count} songs")
    print(f"📁 All songs are now in: {default_collection['name']} collection")
    print()
    print("🎉 Migration complete!")


if __name__ == '__main__':
    try:
        migrate_songs_to_default_collection()
    except KeyboardInterrupt:
        print("\n\n❌ Migration cancelled by user")
    except Exception as e:
        print(f"\n\n❌ Migration failed with error:")
        print(f"   {e}")
        import traceback
        traceback.print_exc()
