"""
Authentication Service - Firebase Authentication
"""

import os
from functools import wraps
from flask import request, jsonify, g
import firebase_admin
from firebase_admin import auth, credentials
import logging

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

        allowed_users_str = os.getenv('ALLOWED_USERS', '')
        if allowed_users_str:
            self.allowed_users = [email.strip() for email in allowed_users_str.split(',')]
        else:
            self.allowed_users = []
            logger.warning("ALLOWED_USERS environment variable not set - no users will be authorized!")
        logger.info(f"AuthService initialized. Allowed users: {self.allowed_users}")

    def verify_token(self, id_token):
        """Verify Firebase ID token and check if user is allowed"""
        try:
            logger.info(f"=== VERIFYING TOKEN ===")
            logger.info(f"Token (first 50 chars): {id_token[:50] if id_token else 'None'}...")

            # Allow up to 60 seconds of clock skew (Firebase's maximum allowed value)
            decoded_token = auth.verify_id_token(id_token, clock_skew_seconds=60)
            email = decoded_token.get('email')

            logger.info(f"Token verified for email: {email}")
            logger.info(f"Allowed users: {self.allowed_users}")
            logger.info(f"Email in allowed users? {email in self.allowed_users}")

            # Check if user is in allowed list
            if email not in self.allowed_users:
                logger.warning(f"Unauthorized user attempted access: {email}. Allowed: {self.allowed_users}")
                return None

            logger.info(f"User {email} authorized successfully")
            return {
                'email': email,
                'uid': decoded_token.get('uid'),
                'name': decoded_token.get('name'),
                'verified': decoded_token.get('email_verified', False)
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