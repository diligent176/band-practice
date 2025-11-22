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
                'collaboration_requests': [],  # No requests for personal collections
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
                'collaboration_requests': [],
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

    def get_public_collections(self, user_id: str, limit: int = 50) -> List[Dict]:
        """
        Get all public collections (excluding user's own collections and ones they're already collaborating on).

        Args:
            user_id: User's UID (to exclude their own collections)
            limit: Maximum number of collections to return

        Returns:
            List of public collection dictionaries with owner information
        """
        try:
            from .user_service_v3 import UserService
            
            # Get public collections that are not owned by this user
            query = (self.db.collection(self.collections)
                    .where('is_public', '==', True)
                    .order_by('name')
                    .limit(limit))

            docs = list(query.stream())
            public_collections = []

            for doc in docs:
                collection_data = doc.to_dict()
                collection_data['id'] = doc.id

                # Exclude user's own collections and ones they're already collaborating on
                if collection_data['owner_uid'] != user_id and user_id not in collection_data.get('collaborators', []):
                    # Check if user has already requested access
                    requests = collection_data.get('collaboration_requests', [])
                    collection_data['access_requested'] = any(req['user_uid'] == user_id for req in requests)
                    
                    # Fetch owner information
                    owner_uid = collection_data.get('owner_uid')
                    if owner_uid:
                        owner_user = UserService.get_user(owner_uid)
                        if owner_user:
                            collection_data['owner_name'] = owner_user.get('display_name', 'Unknown')
                            collection_data['owner_email'] = owner_user.get('email', '')
                            collection_data['owner_photo_url'] = owner_user.get('photo_url', None)
                    
                    public_collections.append(collection_data)

            logger.info(f"Retrieved {len(public_collections)} public collections for user {user_id}")
            return public_collections

        except Exception as e:
            logger.error(f"Error getting public collections: {e}")
            raise

    def request_collaboration(self, collection_id: str, user_id: str, user_email: str, user_name: str) -> bool:
        """
        Request collaboration access to a public collection.

        Args:
            collection_id: Collection document ID
            user_id: Requesting user's UID
            user_email: Requesting user's email
            user_name: Requesting user's display name

        Returns:
            True if request was added successfully
        """
        try:
            doc_ref = self.db.collection(self.collections).document(collection_id)
            doc = doc_ref.get()

            if not doc.exists:
                raise ValueError(f"Collection not found: {collection_id}")

            collection_data = doc.to_dict()

            # Verify collection is public
            if not collection_data.get('is_public', False):
                raise ValueError("Cannot request collaboration on non-public collection")

            # Verify user is not the owner
            if collection_data['owner_uid'] == user_id:
                raise ValueError("Owner cannot request collaboration on their own collection")

            # Verify user is not already a collaborator
            if user_id in collection_data.get('collaborators', []):
                raise ValueError("User is already a collaborator")

            # Check if request already exists
            requests = collection_data.get('collaboration_requests', [])
            if any(req['user_uid'] == user_id for req in requests):
                raise ValueError("Collaboration request already exists")

            # Add request
            new_request = {
                'user_uid': user_id,
                'user_email': user_email,
                'user_name': user_name,
                'requested_at': datetime.utcnow()
            }

            requests.append(new_request)
            doc_ref.update({
                'collaboration_requests': requests,
                'updated_at': datetime.utcnow()
            })

            logger.info(f"User {user_id} requested collaboration on collection {collection_id}")
            return True

        except Exception as e:
            logger.error(f"Error requesting collaboration: {e}")
            raise

    def accept_collaboration_request(self, collection_id: str, owner_uid: str, requester_uid: str) -> bool:
        """
        Accept a collaboration request (owner only).

        Args:
            collection_id: Collection document ID
            owner_uid: Owner's UID (must match collection owner)
            requester_uid: UID of user who requested access

        Returns:
            True if request was accepted
        """
        try:
            doc_ref = self.db.collection(self.collections).document(collection_id)
            doc = doc_ref.get()

            if not doc.exists:
                raise ValueError(f"Collection not found: {collection_id}")

            collection_data = doc.to_dict()

            # Verify user is owner
            if collection_data['owner_uid'] != owner_uid:
                raise PermissionError("Only owner can accept collaboration requests")

            # Find and remove the request
            requests = collection_data.get('collaboration_requests', [])
            request_to_accept = None

            for req in requests:
                if req['user_uid'] == requester_uid:
                    request_to_accept = req
                    break

            if not request_to_accept:
                raise ValueError("Collaboration request not found")

            # Remove from requests and add to collaborators
            requests.remove(request_to_accept)
            collaborators = collection_data.get('collaborators', [])

            if requester_uid not in collaborators:
                collaborators.append(requester_uid)

            doc_ref.update({
                'collaborators': collaborators,
                'collaboration_requests': requests,
                'updated_at': datetime.utcnow()
            })

            logger.info(f"Owner {owner_uid} accepted collaboration request from {requester_uid} for collection {collection_id}")
            return True

        except Exception as e:
            logger.error(f"Error accepting collaboration request: {e}")
            raise

    def deny_collaboration_request(self, collection_id: str, owner_uid: str, requester_uid: str) -> bool:
        """
        Deny a collaboration request (owner only).

        Args:
            collection_id: Collection document ID
            owner_uid: Owner's UID (must match collection owner)
            requester_uid: UID of user who requested access

        Returns:
            True if request was denied
        """
        try:
            doc_ref = self.db.collection(self.collections).document(collection_id)
            doc = doc_ref.get()

            if not doc.exists:
                raise ValueError(f"Collection not found: {collection_id}")

            collection_data = doc.to_dict()

            # Verify user is owner
            if collection_data['owner_uid'] != owner_uid:
                raise PermissionError("Only owner can deny collaboration requests")

            # Find and remove the request
            requests = collection_data.get('collaboration_requests', [])
            request_to_deny = None

            for req in requests:
                if req['user_uid'] == requester_uid:
                    request_to_deny = req
                    break

            if not request_to_deny:
                raise ValueError("Collaboration request not found")

            # Remove from requests
            requests.remove(request_to_deny)

            doc_ref.update({
                'collaboration_requests': requests,
                'updated_at': datetime.utcnow()
            })

            logger.info(f"Owner {owner_uid} denied collaboration request from {requester_uid} for collection {collection_id}")
            return True

        except Exception as e:
            logger.error(f"Error denying collaboration request: {e}")
            raise

    def check_user_access_level(self, collection_id: str, user_id: str) -> str:
        """
        Check user's access level for a collection.

        Args:
            collection_id: Collection document ID
            user_id: User's UID

        Returns:
            'owner', 'collaborator', 'viewer', or 'none'
        """
        try:
            doc_ref = self.db.collection(self.collections).document(collection_id)
            doc = doc_ref.get()

            if not doc.exists:
                return 'none'

            collection_data = doc.to_dict()

            # Check owner
            if collection_data['owner_uid'] == user_id:
                return 'owner'

            # Check collaborator
            if user_id in collection_data.get('collaborators', []):
                return 'collaborator'

            # Check public viewer
            if collection_data.get('is_public', False):
                return 'viewer'

            return 'none'

        except Exception as e:
            logger.error(f"Error checking user access level: {e}")
            raise
