"""
User Service - Manage user profiles in Firestore
"""

from google.cloud import firestore
from datetime import datetime
import os
import logging

logger = logging.getLogger(__name__)


class UserService:
    """Service for managing user profiles in Firestore"""

    def __init__(self):
        """Initialize Firestore client"""
        project_id = os.getenv('GCP_PROJECT_ID')
        self.db = firestore.Client(project=project_id) if project_id else firestore.Client()
        self.users_collection = 'users'

    def create_or_update_user(self, user_data):
        """
        Create or update a user document in Firestore.
        Uses upsert pattern - creates if doesn't exist, updates if it does.

        Args:
            user_data: Dict containing user information from Firebase Auth token:
                - uid: Firebase user ID (required, used as document ID)
                - email: User's email address
                - display_name: Full name from OAuth
                - photo_url: Profile picture URL from OAuth
                - email_verified: Whether email is verified
                - spotify_email: Spotify account email (optional)
                - spotify_product: Spotify product type (free/premium/open) (optional)
                - spotify_country: Spotify account country (optional)
                - spotify_display_name: Spotify display name (optional)
                - spotify_id: Spotify user ID (optional)
                - spotify_uri: Spotify user URI (optional)

        Returns:
            Dict containing the user document data with 'uid' field
        """
        uid = user_data.get('uid')
        if not uid:
            raise ValueError("User UID is required")

        doc_ref = self.db.collection(self.users_collection).document(uid)
        existing = doc_ref.get()

        now = datetime.utcnow()

        if existing.exists:
            # Update existing user - preserve created_at, is_admin, update last_login_at
            existing_data = existing.to_dict()

            update_data = {
                'email': user_data.get('email'),
                'display_name': user_data.get('display_name') or user_data.get('name'),
                'photo_url': user_data.get('photo_url') or user_data.get('picture'),
                'email_verified': user_data.get('email_verified', False),
                'last_login_at': now,
                'updated_at': now
            }

            # Update locale if provided
            if 'locale' in user_data:
                update_data['locale'] = user_data.get('locale')

            # Update Spotify fields if provided
            spotify_fields = ['spotify_email', 'spotify_product', 'spotify_country',
                            'spotify_display_name', 'spotify_id', 'spotify_uri',
                            'spotify_profile_photo', 'spotify_followers', 'spotify_profile_url']
            for field in spotify_fields:
                if field in user_data:
                    update_data[field] = user_data.get(field)

            # Explicitly preserve is_admin field if it exists (don't overwrite)
            # This field is set manually in Firestore console or via admin API
            if 'is_admin' in existing_data:
                # Don't include is_admin in update_data - it's already in the document
                # and update() won't remove it
                pass

            doc_ref.update(update_data)

            logger.info(f"✅ Updated user profile for {user_data.get('email')}")

            # Return merged data
            result = existing_data.copy()
            result.update(update_data)
            result['uid'] = uid
            return result
        else:
            # Create new user document
            new_user_data = {
                'uid': uid,
                'email': user_data.get('email'),
                'display_name': user_data.get('display_name') or user_data.get('name'),
                'photo_url': user_data.get('photo_url') or user_data.get('picture'),
                'email_verified': user_data.get('email_verified', False),
                'locale': user_data.get('locale'),
                'is_admin': False,  # New users are not admins by default
                'created_at': now,
                'last_login_at': now,
                'updated_at': now
            }

            # Add Spotify fields if provided
            spotify_fields = ['spotify_email', 'spotify_product', 'spotify_country',
                            'spotify_display_name', 'spotify_id', 'spotify_uri',
                            'spotify_profile_photo', 'spotify_followers', 'spotify_profile_url']
            for field in spotify_fields:
                if field in user_data:
                    new_user_data[field] = user_data.get(field)

            doc_ref.set(new_user_data)

            logger.info(f"✅ Created new user profile for {user_data.get('email')}")

            return new_user_data

    def get_user(self, uid):
        """
        Get a user by their UID

        Args:
            uid: Firebase user ID

        Returns:
            Dict containing user data, or None if not found
        """
        doc = self.db.collection(self.users_collection).document(uid).get()

        if not doc.exists:
            return None

        user_data = doc.to_dict()
        user_data['uid'] = doc.id
        return user_data

    def get_user_by_email(self, email):
        """
        Get a user by their email address

        Args:
            email: User's email address

        Returns:
            Dict containing user data, or None if not found
        """
        docs = (self.db.collection(self.users_collection)
                .where('email', '==', email)
                .limit(1)
                .stream())

        for doc in docs:
            user_data = doc.to_dict()
            user_data['uid'] = doc.id
            return user_data

        return None

    def get_user_display_info(self, uid):
        """
        Get display info for a user (for showing in UI, audit logs, etc.)

        Args:
            uid: Firebase user ID

        Returns:
            Dict with display_name, email, photo_url, or None if not found
        """
        user = self.get_user(uid)

        if not user:
            return None

        return {
            'uid': uid,
            'display_name': user.get('display_name', 'Unknown User'),
            'email': user.get('email', ''),
            'photo_url': user.get('photo_url', '')
        }

    def search_users_by_email(self, email_query, limit=10):
        """
        Search for users by email (useful for adding collaborators)

        Args:
            email_query: Email address or partial email to search
            limit: Maximum number of results to return

        Returns:
            List of user objects with basic info
        """
        # Firestore doesn't support LIKE queries, so we need to do prefix matching
        # For more advanced search, consider using Algolia or similar
        docs = (self.db.collection(self.users_collection)
                .where('email', '>=', email_query)
                .where('email', '<=', email_query + '\uf8ff')
                .limit(limit)
                .stream())

        users = []
        for doc in docs:
            user_data = doc.to_dict()
            users.append({
                'uid': doc.id,
                'email': user_data.get('email'),
                'display_name': user_data.get('display_name'),
                'photo_url': user_data.get('photo_url')
            })

        return users

    def get_all_users(self, order_by='created_at', limit=1000):
        """
        Get all users (admin function)

        Args:
            order_by: Field to order by (default: created_at)
            limit: Maximum number of users to return

        Returns:
            List of user objects
        """
        docs = (self.db.collection(self.users_collection)
                .order_by(order_by, direction=firestore.Query.DESCENDING)
                .limit(limit)
                .stream())

        users = []
        for doc in docs:
            user_data = doc.to_dict()
            user_data['uid'] = doc.id
            users.append(user_data)

        return users

    def is_admin(self, uid):
        """
        Check if a user is an admin

        Args:
            uid: Firebase user ID

        Returns:
            Boolean indicating if user is admin
        """
        user = self.get_user(uid)
        if not user:
            return False

        return user.get('is_admin', False)

    def set_admin(self, uid, is_admin):
        """
        Set or remove admin privileges for a user

        Args:
            uid: Firebase user ID
            is_admin: Boolean indicating admin status

        Returns:
            Boolean indicating success
        """
        doc_ref = self.db.collection(self.users_collection).document(uid)

        if not doc_ref.get().exists:
            return False

        doc_ref.update({
            'is_admin': is_admin,
            'updated_at': datetime.utcnow()
        })

        logger.info(f"{'✅ Granted' if is_admin else '❌ Revoked'} admin privileges for user {uid}")
        return True


# Global user service instance
user_service = UserService()
