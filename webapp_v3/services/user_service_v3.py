"""
Band Practice Pro v3 - User Service
Handles user CRUD operations in Firestore
"""

from google.cloud import firestore
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Initialize Firestore client (singleton)
_db_client = None

def get_db():
    """Get Firestore database client"""
    global _db_client

    if _db_client is None:
        _db_client = firestore.Client()
        logger.info("Firestore client initialized")

    return _db_client


class UserService:
    """Service for managing users in Firestore"""

    COLLECTION = 'users_v3'

    @staticmethod
    def get_user(uid):
        """
        Get user by UID

        Args:
            uid (str): User ID

        Returns:
            dict: User data or None if not found
        """
        try:
            db = get_db()
            user_ref = db.collection(UserService.COLLECTION).document(uid)
            user_doc = user_ref.get()

            if user_doc.exists:
                return user_doc.to_dict()

            return None

        except Exception as e:
            logger.error(f"Error getting user {uid}: {e}")
            return None

    @staticmethod
    def create_user(uid, email, display_name=None, photo_url=None):
        """
        Create new user in Firestore

        Args:
            uid (str): User ID from Firebase Auth
            email (str): User email
            display_name (str): User's display name
            photo_url (str): User's profile photo URL

        Returns:
            dict: Created user data
        """
        try:
            db = get_db()
            user_ref = db.collection(UserService.COLLECTION).document(uid)

            # Check if user already exists
            if user_ref.get().exists:
                logger.info(f"User {uid} already exists")
                return UserService.get_user(uid)

            # Create new user document
            user_data = {
                'uid': uid,
                'email': email,
                'display_name': display_name or email.split('@')[0],
                'photo_url': photo_url,
                'is_admin': False,
                'spotify_connected': False,
                'spotify_token_ref': None,
                'preferences': {
                    'default_font_size': 16,
                    'default_column_mode': 3,
                    'theme': 'dark',
                    'email_notifications': True
                },
                'created_at': firestore.SERVER_TIMESTAMP,
                'last_login_at': firestore.SERVER_TIMESTAMP
            }

            user_ref.set(user_data)
            logger.info(f"✅ Created new user: {uid} ({email})")

            # Return the created user (with server timestamp resolved)
            return UserService.get_user(uid)

        except Exception as e:
            logger.error(f"Error creating user {uid}: {e}")
            raise

    @staticmethod
    def update_last_login(uid):
        """
        Update user's last login timestamp

        Args:
            uid (str): User ID
        """
        try:
            db = get_db()
            user_ref = db.collection(UserService.COLLECTION).document(uid)
            user_ref.update({
                'last_login_at': firestore.SERVER_TIMESTAMP
            })
            logger.info(f"Updated last login for user: {uid}")

        except Exception as e:
            logger.error(f"Error updating last login for {uid}: {e}")

    @staticmethod
    def update_user(uid, updates):
        """
        Update user data

        Args:
            uid (str): User ID
            updates (dict): Fields to update

        Returns:
            dict: Updated user data
        """
        try:
            db = get_db()
            user_ref = db.collection(UserService.COLLECTION).document(uid)

            # Add updated_at timestamp
            updates['updated_at'] = firestore.SERVER_TIMESTAMP

            # Prevent updating sensitive fields
            sensitive_fields = ['uid', 'created_at', 'is_admin']
            for field in sensitive_fields:
                if field in updates:
                    del updates[field]
                    logger.warning(f"Attempted to update sensitive field: {field}")

            user_ref.update(updates)
            logger.info(f"Updated user: {uid}")

            return UserService.get_user(uid)

        except Exception as e:
            logger.error(f"Error updating user {uid}: {e}")
            raise

    @staticmethod
    def get_or_create_user(uid, email, display_name=None, photo_url=None):
        """
        Get existing user or create new one

        Args:
            uid (str): User ID
            email (str): User email
            display_name (str): Display name
            photo_url (str): Profile photo URL

        Returns:
            dict: User data
        """
        user = UserService.get_user(uid)

        if user:
            # Update last login
            UserService.update_last_login(uid)

            # Update display name or photo if changed
            updates = {}
            if display_name and user.get('display_name') != display_name:
                updates['display_name'] = display_name
            if photo_url and user.get('photo_url') != photo_url:
                updates['photo_url'] = photo_url

            if updates:
                user = UserService.update_user(uid, updates)

            return user

        # Create new user
        return UserService.create_user(uid, email, display_name, photo_url)

    @staticmethod
    def delete_user(uid):
        """
        Delete user (admin only)

        Args:
            uid (str): User ID
        """
        try:
            db = get_db()
            user_ref = db.collection(UserService.COLLECTION).document(uid)
            user_ref.delete()
            logger.info(f"Deleted user: {uid}")

        except Exception as e:
            logger.error(f"Error deleting user {uid}: {e}")
            raise
