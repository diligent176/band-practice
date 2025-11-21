"""
Band Practice Pro v3 - Authentication Service
Handles Firebase token verification and session management
"""

import firebase_admin
from firebase_admin import auth, credentials
import os
import logging
from functools import wraps
from flask import request, jsonify

logger = logging.getLogger(__name__)

# Initialize Firebase Admin SDK (singleton)
_firebase_app = None

def initialize_firebase_admin():
    """
    Initialize Firebase Admin SDK if not already initialized

    Uses Google Application Default Credentials (same as v2)
    This works automatically in local dev and production
    """
    global _firebase_app

    if _firebase_app is not None:
        return _firebase_app

    try:
        # Check if already initialized
        _firebase_app = firebase_admin.get_app()
        logger.info("Firebase Admin already initialized")
        return _firebase_app
    except ValueError:
        # Not initialized yet
        pass

    try:
        # Initialize with Application Default Credentials (same as v2)
        # This uses GOOGLE_APPLICATION_CREDENTIALS env var or gcloud auth
        _firebase_app = firebase_admin.initialize_app()
        logger.info("✅ Firebase Admin SDK initialized successfully")
        return _firebase_app
    except Exception as e:
        logger.error(f"Failed to initialize Firebase Admin: {e}")
        logger.error("Make sure GOOGLE_APPLICATION_CREDENTIALS is set or you're authenticated with gcloud")
        raise


class AuthService:
    """Service for handling authentication and token verification"""

    @staticmethod
    def verify_token(id_token):
        """
        Verify Firebase ID token

        Args:
            id_token (str): Firebase ID token from client

        Returns:
            dict: Decoded token with user info, or None if invalid
        """
        try:
            # Ensure Firebase Admin is initialized
            initialize_firebase_admin()

            # Verify the token
            decoded_token = auth.verify_id_token(id_token)

            logger.info(f"Token verified for user: {decoded_token.get('uid')}")
            return decoded_token

        except auth.InvalidIdTokenError:
            logger.warning("Invalid ID token provided")
            return None
        except auth.ExpiredIdTokenError:
            logger.warning("Expired ID token provided")
            return None
        except Exception as e:
            logger.error(f"Error verifying token: {e}")
            return None

    @staticmethod
    def get_user_from_token(id_token):
        """
        Extract user info from Firebase ID token

        Args:
            id_token (str): Firebase ID token

        Returns:
            dict: User info (uid, email, name, photo_url) or None
        """
        decoded = AuthService.verify_token(id_token)

        if not decoded:
            return None

        # Extract user info
        user_info = {
            'uid': decoded.get('uid'),
            'email': decoded.get('email'),
            'display_name': decoded.get('name'),
            'photo_url': decoded.get('picture'),
            'email_verified': decoded.get('email_verified', False)
        }

        return user_info

    @staticmethod
    def require_auth(request):
        """
        Decorator helper: Extract and verify token from request headers

        Args:
            request: Flask request object

        Returns:
            dict: User info if authenticated, None otherwise
        """
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')

        if not auth_header:
            logger.warning("No Authorization header provided")
            return None

        # Extract token (format: "Bearer <token>")
        parts = auth_header.split(' ')
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            logger.warning("Invalid Authorization header format")
            return None

        id_token = parts[1]
        return AuthService.get_user_from_token(id_token)

    @staticmethod
    def require_admin(user_info):
        """
        Check if user has admin privileges

        Args:
            user_info (dict): User info from token

        Returns:
            bool: True if user is admin, False otherwise
        """
        if not user_info:
            return False

        # Import here to avoid circular dependency
        from .user_service_v3 import UserService

        user = UserService.get_user(user_info['uid'])
        if not user:
            return False

        return user.get('is_admin', False)

def require_auth(f):
    """
    Decorator to require authentication on Flask routes
    Extracts user info from Authorization header and adds to request object
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')

        if not auth_header:
            logger.warning("No Authorization header provided")
            return jsonify({'error': 'Authentication required'}), 401

        # Extract token (format: "Bearer <token>")
        parts = auth_header.split(' ')
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            logger.warning("Invalid Authorization header format")
            return jsonify({'error': 'Invalid authorization header'}), 401

        id_token = parts[1]
        user_info = AuthService.get_user_from_token(id_token)

        if not user_info:
            logger.warning("Invalid or expired token")
            return jsonify({'error': 'Invalid or expired token'}), 401

        # Add user info to request object
        request.user_id = user_info['uid']
        request.user_email = user_info['email']
        request.user_info = user_info

        return f(*args, **kwargs)

    return decorated_function
