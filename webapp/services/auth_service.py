"""
Authentication Service for Google Cloud Run
Handles IAP token verification and user authentication
"""

import json
import os
from functools import wraps
from flask import request, jsonify, g
from google.auth.transport import requests
from google.oauth2 import id_token
import logging

logger = logging.getLogger(__name__)


class AuthService:
    """Service for handling Google Cloud Run authentication"""

    def __init__(self):
        self.project_id = os.getenv('GCP_PROJECT_ID')
        allowed_users_str = os.getenv('ALLOWED_USERS', 'jcbellis@gmail.com')
        self.allowed_users = [email.strip() for email in allowed_users_str.split(',')]
        
    def verify_identity_token(self, token):
        """
        Verify Google ID token from Cloud Run authentication
        """
        try:
            # Verify the token (Cloud Run adds this when allAuthenticatedUsers is set)
            decoded_token = id_token.verify_oauth2_token(
                token,
                requests.Request()
            )

            email = decoded_token.get('email')

            # Check if user is in allowed list
            if email not in self.allowed_users:
                logger.warning(f"Unauthorized user attempted access: {email}")
                return None

            return {
                'email': email,
                'user_id': decoded_token.get('sub'),
                'name': decoded_token.get('name'),
                'verified': True
            }

        except ValueError as e:
            logger.error(f"Token verification failed: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error during token verification: {e}")
            return None
    
    def get_user_from_headers(self):
        """
        Extract user information from Cloud Run authentication headers
        When allAuthenticatedUsers is set, Cloud Run provides the ID token
        """
        try:
            # Cloud Run includes the Authorization header with Bearer token
            auth_header = request.headers.get('Authorization', '')

            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
                return self.verify_identity_token(token)

            # Also check X-Serverless-Authorization header
            serverless_auth = request.headers.get('X-Serverless-Authorization', '')
            if serverless_auth.startswith('Bearer '):
                token = serverless_auth.split(' ')[1]
                return self.verify_identity_token(token)

            return None

        except Exception as e:
            logger.error(f"Error extracting user info: {e}")
            return None
    
    def is_development_mode(self):
        """Check if running in development mode (local testing)"""
        return os.getenv('FLASK_ENV') == 'development' or os.getenv('DEVELOPMENT') == 'true'


# Global auth service instance
auth_service = AuthService()


def require_auth(f):
    """
    Decorator to require authentication for a route
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Skip authentication in development mode
        if auth_service.is_development_mode():
            logger.info("Running in dev mode - using mock user")
            g.user = {
                'email': 'dev@localhost.com',
                'user_id': 'dev-user',
                'name': 'Development User',
                'verified': True
            }
            return f(*args, **kwargs)

        # Get user info from Cloud Run auth headers
        user_info = auth_service.get_user_from_headers()

        if not user_info or not user_info.get('verified'):
            return jsonify({
                'error': 'Authentication required',
                'message': 'You must be logged in with an authorized Google account to access this resource'
            }), 401

        # Store user info in Flask's g object for use in the route
        g.user = user_info
        return f(*args, **kwargs)

    return decorated_function


def optional_auth(f):
    """
    Decorator that adds user info if available but doesn't require it
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Try to get user info but don't fail if not available
        if auth_service.is_development_mode():
            g.user = {
                'email': 'dev@localhost.com',
                'user_id': 'dev-user',
                'name': 'Development User',
                'verified': True
            }
        else:
            g.user = auth_service.get_user_from_headers()
        
        return f(*args, **kwargs)
    
    return decorated_function