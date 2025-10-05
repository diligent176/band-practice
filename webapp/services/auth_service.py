"""
Authentication Service - Firebase Authentication
"""

import os
from functools import wraps
from flask import request, jsonify, g, redirect, url_for
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

        allowed_users_str = os.getenv('ALLOWED_USERS')
        self.allowed_users = [email.strip() for email in allowed_users_str.split(',')]
        logger.info(f"AuthService initialized. Allowed users: {self.allowed_users}")

    def verify_token(self, id_token):
        """Verify Firebase ID token and check if user is allowed"""
        try:
            logger.info(f"=== VERIFYING TOKEN ===")
            logger.info(f"Token (first 50 chars): {id_token[:50] if id_token else 'None'}...")

            decoded_token = auth.verify_id_token(id_token)
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

    def is_development_mode(self):
        """Check if running in development mode (local testing)"""
        return os.getenv('FLASK_ENV') == 'development' or os.getenv('DEVELOPMENT') == 'true'


# Global auth service instance
auth_service = AuthService()


def require_auth(f):
    """
    Decorator to require authentication for a route
    Expects Firebase ID token in Authorization header
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Skip authentication in development mode
        if auth_service.is_development_mode():
            logger.info("Running in dev mode - using mock user")
            g.user = {
                'email': 'dev@localhost.com',
                'verified': True
            }
            return f(*args, **kwargs)

        # Get token from Authorization header
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({
                'error': 'Authentication required',
                'message': 'Missing or invalid authorization header'
            }), 401

        token = auth_header.split('Bearer ')[1]
        user_info = auth_service.verify_token(token)

        if not user_info:
            return jsonify({
                'error': 'Authentication failed',
                'message': 'Invalid token or unauthorized user'
            }), 401

        g.user = user_info
        return f(*args, **kwargs)

    return decorated_function


def optional_auth(f):
    """
    Decorator that adds user info if available but doesn't require it
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if auth_service.is_development_mode():
            g.user = {
                'email': 'dev@localhost.com',
                'verified': True
            }
        else:
            auth_header = request.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                token = auth_header.split('Bearer ')[1]
                g.user = auth_service.verify_token(token)
            else:
                g.user = None

        return f(*args, **kwargs)

    return decorated_function