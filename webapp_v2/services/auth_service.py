"""
Authentication Service - Firebase Authentication
"""

import os
from functools import wraps
from flask import request, jsonify, g
import firebase_admin
from firebase_admin import auth, credentials
import logging
from services.user_service import user_service

logger = logging.getLogger(__name__)


class AuthService:
    """Service for handling Firebase authentication"""

    def __init__(self):
        # Initialize Firebase Admin SDK
        # When running on Cloud Run, Application Default Credentials are used
        try:
            firebase_admin.get_app()
            logger.info("Firebase app already initialized")
        except ValueError:
            # No app exists, initialize it
            logger.info("Initializing Firebase app...")
            if os.getenv('FLASK_ENV') == 'development':
                # For local development, use a service account key if available
                cred_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
                if cred_path and os.path.exists(cred_path):
                    cred = credentials.Certificate(cred_path)
                    firebase_admin.initialize_app(cred)
                    logger.info("Firebase initialized with service account")
                else:
                    # Initialize without credentials for dev mode
                    firebase_admin.initialize_app()
                    logger.info("Firebase initialized without credentials (dev mode)")
            else:
                # On Cloud Run, use Application Default Credentials
                firebase_admin.initialize_app()
                logger.info("Firebase initialized with ADC")

        # Multi-user collaboration enabled - any Google user can log in
        logger.info("AuthService initialized with multi-user collaboration enabled (no allowlist)")

    def verify_token(self, id_token):
        """Verify Firebase ID token - any verified Google user is allowed"""
        try:
            logger.info(f"=== VERIFYING TOKEN ===")
            logger.info(f"Token (first 50 chars): {id_token[:50] if id_token else 'None'}...")

            # Allow up to 60 seconds of clock skew (Firebase's maximum allowed value)
            decoded_token = auth.verify_id_token(id_token, clock_skew_seconds=60)
            email = decoded_token.get('email')
            email_verified = decoded_token.get('email_verified', False)

            logger.info(f"Token verified for email: {email} (verified: {email_verified})")

            # Multi-user collaboration: allow any verified Google user
            if not email_verified:
                logger.warning(f"User {email} has unverified email")
                return None

            logger.info(f"User {email} authorized successfully")

            # Extract all available user data from token
            user_data = {
                'uid': decoded_token.get('uid'),
                'email': email,
                'email_verified': email_verified,
                'name': decoded_token.get('name'),
                'display_name': decoded_token.get('name'),
                'picture': decoded_token.get('picture'),
                'photo_url': decoded_token.get('picture'),
                'locale': decoded_token.get('locale')
            }

            # Create or update user in Firestore
            try:
                user_service.create_or_update_user(user_data)
            except Exception as user_err:
                # Log but don't fail authentication if user profile update fails
                logger.error(f"Failed to update user profile: {user_err}", exc_info=True)

            # Return user info for request context
            return {
                'email': email,
                'uid': decoded_token.get('uid'),
                'name': decoded_token.get('name'),
                'picture': decoded_token.get('picture'),
                'verified': email_verified
            }
        except Exception as e:
            logger.error(f"Token verification failed: {e}", exc_info=True)
            return None


# Global auth service instance
auth_service = AuthService()


def require_auth(f):
    """
    Decorator to require authentication for a route
    Expects Firebase ID token in Authorization header
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        logger.info(f"🔐 require_auth decorator called for {request.path}")

        # Get token from Authorization header
        auth_header = request.headers.get('Authorization', '')
        logger.info(f"📋 Auth header present: {bool(auth_header)}")

        if not auth_header.startswith('Bearer '):
            logger.error(f"❌ Missing or invalid auth header. Headers: {dict(request.headers)}")
            return jsonify({
                'error': 'Authentication required',
                'message': 'Missing or invalid authorization header',
                'headers': dict(request.headers)
            }), 401

        token = auth_header.split('Bearer ')[1]
        logger.info(f"🎫 Token extracted (first 30 chars): {token[:30]}...")

        user_info = auth_service.verify_token(token)

        if not user_info:
            logger.error(f"❌ Token verification failed or user not authorized")
            return jsonify({
                'error': 'Authentication failed',
                'message': 'Invalid token or unauthorized user'
            }), 401

        logger.info(f"✅ User authenticated: {user_info.get('email')}")
        g.user = user_info
        return f(*args, **kwargs)

    return decorated_function


def optional_auth(f):
    """
    Decorator that adds user info if available but doesn't require it
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split('Bearer ')[1]
            g.user = auth_service.verify_token(token)
        else:
            g.user = None

        return f(*args, **kwargs)

    return decorated_function


def require_admin(f):
    """
    Decorator to require admin privileges for a route
    First authenticates the user, then checks if they have admin flag
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        logger.info(f"🔐 require_admin decorator called for {request.path}")

        # Get token from Authorization header
        auth_header = request.headers.get('Authorization', '')
        logger.info(f"📋 Auth header present: {bool(auth_header)}")

        if not auth_header.startswith('Bearer '):
            logger.error(f"❌ Missing or invalid auth header")
            return jsonify({
                'error': 'Authentication required',
                'message': 'Missing or invalid authorization header'
            }), 401

        token = auth_header.split('Bearer ')[1]
        user_info = auth_service.verify_token(token)

        if not user_info:
            logger.error(f"❌ Token verification failed")
            return jsonify({
                'error': 'Authentication failed',
                'message': 'Invalid token or unauthorized user'
            }), 401

        # Check if user is admin
        uid = user_info.get('uid')
        if not user_service.is_admin(uid):
            logger.warning(f"❌ User {user_info.get('email')} attempted to access admin route without privileges")
            return jsonify({
                'error': 'Admin access required',
                'message': 'You do not have permission to access this resource'
            }), 403

        logger.info(f"✅ Admin authenticated: {user_info.get('email')}")
        g.user = user_info
        return f(*args, **kwargs)

    return decorated_function