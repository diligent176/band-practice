"""
Band Practice Pro v3 - Collections Service
Manages collections (song groups) with auto-creation of Personal Collection
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional
from firebase_admin import firestore

logger = logging.getLogger(__name__)

class CollectionsService:
    """Service for managing collections in Firestore"""

    def __init__(self):
        self.db = firestore.client()
        self.collections = 'collections_v3'

    def get_or_create_personal_collection(self, user_id: str) -> Dict:
        """
        Get or create the Personal Collection for a user.
        The Personal Collection is auto-created for every user and cannot be deleted.

        Args:
            user_id: User's UID (from Firebase Auth)

        Returns:
            Dict containing collection data with 'id' field
        """
        try:
            # Query for existing Personal Collection
            query = (self.db.collection(self.collections)
                    .where('owner_uid', '==', user_id)
                    .where('is_personal', '==', True)
                    .limit(1))

            docs = list(query.stream())

            if docs:
                # Personal Collection exists
                collection_data = docs[0].to_dict()
                collection_data['id'] = docs[0].id
                logger.info(f"Found Personal Collection for user {user_id}")
                return collection_data

            # Create Personal Collection
            collection_data = {
                'owner_uid': user_id,
                'name': 'Personal Collection',
                'description': 'Your personal song collection',
                'is_personal': True,  # Flag to identify Personal Collection
                'is_public': False,
                'collaborators': [],  # Personal Collection cannot be shared
                'linked_playlists': [],  # Will store playlist references
                'song_count': 0,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }

            doc_ref = self.db.collection(self.collections).document()
            doc_ref.set(collection_data)

            collection_data['id'] = doc_ref.id
            logger.info(f"Created Personal Collection for user {user_id}")
            return collection_data

        except Exception as e:
            logger.error(f"Error getting/creating Personal Collection: {e}")
            raise

    def get_user_collections(self, user_id: str) -> Dict[str, List[Dict]]:
        """
        Get all collections for a user, organized by ownership.

        Args:
            user_id: User's UID

        Returns:
            Dict with 'owned' and 'shared' lists of collections
        """
        try:
            # Get owned collections (including Personal Collection)
            owned_query = (self.db.collection(self.collections)
                          .where('owner_uid', '==', user_id)
                          .order_by('name'))

            owned_docs = list(owned_query.stream())
            owned_collections = []

            for doc in owned_docs:
                collection_data = doc.to_dict()
                collection_data['id'] = doc.id
                owned_collections.append(collection_data)

            # Get shared collections (where user is a collaborator)
            shared_query = (self.db.collection(self.collections)
                           .where('collaborators', 'array_contains', user_id)
                           .order_by('name'))

            shared_docs = list(shared_query.stream())
            shared_collections = []

            for doc in shared_docs:
                collection_data = doc.to_dict()
                collection_data['id'] = doc.id
                shared_collections.append(collection_data)

            logger.info(f"Retrieved {len(owned_collections)} owned and {len(shared_collections)} shared collections for user {user_id}")

            return {
                'owned': owned_collections,
                'shared': shared_collections
            }

        except Exception as e:
            logger.error(f"Error getting user collections: {e}")
            raise

    def create_collection(self, user_id: str, name: str, description: str = '', is_public: bool = False) -> Dict:
        """
        Create a new collection.

        Args:
            user_id: Owner's UID
            name: Collection name
            description: Collection description (optional)
            is_public: Whether collection is publicly visible (default: False)

        Returns:
            Dict containing new collection data with 'id' field
        """
        try:
            collection_data = {
                'owner_uid': user_id,
                'name': name,
                'description': description,
                'is_personal': False,
                'is_public': is_public,
                'collaborators': [],
                'linked_playlists': [],
                'song_count': 0,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }

            doc_ref = self.db.collection(self.collections).document()
            doc_ref.set(collection_data)

            collection_data['id'] = doc_ref.id
            logger.info(f"Created collection '{name}' for user {user_id}")
            return collection_data

        except Exception as e:
            logger.error(f"Error creating collection: {e}")
            raise

    def update_collection(self, collection_id: str, user_id: str, updates: Dict) -> Dict:
        """
        Update a collection (only owner can update).

        Args:
            collection_id: Collection document ID
            user_id: User's UID (must be owner)
            updates: Dict of fields to update

        Returns:
            Dict containing updated collection data
        """
        try:
            doc_ref = self.db.collection(self.collections).document(collection_id)
            doc = doc_ref.get()

            if not doc.exists:
                raise ValueError(f"Collection not found: {collection_id}")

            collection_data = doc.to_dict()

            # Verify user is owner
            if collection_data['owner_uid'] != user_id:
                raise PermissionError("Only owner can update collection")

            # Prevent updating Personal Collection name or is_personal flag
            if collection_data.get('is_personal'):
                if 'name' in updates or 'is_personal' in updates:
                    raise ValueError("Cannot rename or modify Personal Collection")

            # Update allowed fields
            allowed_fields = ['name', 'description', 'is_public', 'collaborators']
            filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
            filtered_updates['updated_at'] = datetime.utcnow()

            doc_ref.update(filtered_updates)

            # Get updated data
            updated_doc = doc_ref.get()
            collection_data = updated_doc.to_dict()
            collection_data['id'] = collection_id

            logger.info(f"Updated collection {collection_id}")
            return collection_data

        except Exception as e:
            logger.error(f"Error updating collection: {e}")
            raise

    def delete_collection(self, collection_id: str, user_id: str) -> bool:
        """
        Delete a collection (only owner can delete, cannot delete Personal Collection).
        Also deletes all songs in the collection.

        Args:
            collection_id: Collection document ID
            user_id: User's UID (must be owner)

        Returns:
            True if deleted successfully
        """
        try:
            doc_ref = self.db.collection(self.collections).document(collection_id)
            doc = doc_ref.get()

            if not doc.exists:
                raise ValueError(f"Collection not found: {collection_id}")

            collection_data = doc.to_dict()

            # Verify user is owner
            if collection_data['owner_uid'] != user_id:
                raise PermissionError("Only owner can delete collection")

            # Prevent deleting Personal Collection
            if collection_data.get('is_personal'):
                raise ValueError("Cannot delete Personal Collection")

            # Delete all songs in this collection
            from services.songs_service_v3 import SongsService
            songs_service = SongsService()
            songs_deleted = songs_service.delete_songs_in_collection(collection_id)
            logger.info(f"Deleted {songs_deleted} songs from collection {collection_id}")

            # Delete the collection
            doc_ref.delete()
            logger.info(f"Deleted collection {collection_id}")
            return True

        except Exception as e:
            logger.error(f"Error deleting collection: {e}")
            raise

    def get_collection(self, collection_id: str, user_id: str) -> Optional[Dict]:
        """
        Get a single collection (user must be owner or collaborator).

        Args:
            collection_id: Collection document ID
            user_id: User's UID

        Returns:
            Dict containing collection data or None if not found/not authorized
        """
        try:
            doc_ref = self.db.collection(self.collections).document(collection_id)
            doc = doc_ref.get()

            if not doc.exists:
                return None

            collection_data = doc.to_dict()

            # Check authorization
            is_owner = collection_data['owner_uid'] == user_id
            is_collaborator = user_id in collection_data.get('collaborators', [])
            is_public = collection_data.get('is_public', False)

            if not (is_owner or is_collaborator or is_public):
                logger.warning(f"User {user_id} not authorized to access collection {collection_id}")
                return None

            collection_data['id'] = collection_id
            return collection_data

        except Exception as e:
            logger.error(f"Error getting collection: {e}")
            raise
