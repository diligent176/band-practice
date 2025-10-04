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
    """Service for handling Google IAP authentication"""
    
    def __init__(self):
        self.project_id = os.getenv('GCP_PROJECT_ID')
        self.project_number = os.getenv('GCP_PROJECT_NUMBER')  # You'll need to add this
        
    def verify_iap_token(self, iap_jwt):
        """
        Verify the IAP JWT token and extract user information
        """
        try:
            # Construct the expected audience for IAP
            # Format: /projects/{PROJECT_NUMBER}/global/backendServices/{BACKEND_SERVICE_ID}
            expected_audience = f"/projects/{self.project_number}/global/backendServices/{self.project_id}"
            
            # Verify the token
            decoded_token = id_token.verify_oauth2_token(
                iap_jwt,
                requests.Request(),
                audience=expected_audience
            )
            
            return {
                'email': decoded_token.get('email'),
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
        Extract user information from IAP headers
        When running behind IAP, Google provides user info in headers
        """
        try:
            # IAP provides user email in this header
            user_email = request.headers.get('X-Goog-Authenticated-User-Email')
            user_id = request.headers.get('X-Goog-Authenticated-User-ID')
            
            if user_email:
                # Remove the "accounts.google.com:" prefix if present
                if user_email.startswith('accounts.google.com:'):
                    user_email = user_email.replace('accounts.google.com:', '')
                
                return {
                    'email': user_email,
                    'user_id': user_id,
                    'verified': True
                }
            
            # Fallback to JWT token verification
            iap_jwt = request.headers.get('X-Goog-IAP-JWT-Assertion')
            if iap_jwt:
                return self.verify_iap_token(iap_jwt)
                
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
            g.user = {
                'email': 'dev@localhost.com',
                'user_id': 'dev-user',
                'name': 'Development User',
                'verified': True
            }
            return f(*args, **kwargs)
        
        # Get user info from IAP headers
        user_info = auth_service.get_user_from_headers()
        
        if not user_info or not user_info.get('verified'):
            return jsonify({
                'error': 'Authentication required',
                'message': 'You must be logged in to access this resource'
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