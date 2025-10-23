"""
Audit Log Service - Track user actions for admin oversight
"""

from google.cloud import firestore
from datetime import datetime
import os
import logging

logger = logging.getLogger(__name__)


class AuditService:
    """Service for logging user actions"""

    def __init__(self):
        """Initialize Firestore client"""
        project_id = os.getenv('GCP_PROJECT_ID')
        self.db = firestore.Client(project=project_id) if project_id else firestore.Client()
        self.audit_collection = 'audit_logs'

    def log_action(self, user_id, user_email, action, resource_type, resource_id,
                   resource_name=None, collection_id=None, changes=None, metadata=None):
        """
        Log a user action to the audit log

        Args:
            user_id: UID of the user performing the action
            user_email: Email of the user
            action: Action type (e.g., 'update_lyrics', 'update_notes', 'update_bpm', 'delete_song')
            resource_type: Type of resource (e.g., 'song', 'collection', 'playlist')
            resource_id: ID of the resource being modified
            resource_name: Human-readable name of the resource (e.g., song title)
            collection_id: ID of the parent collection (for songs)
            changes: Dict describing what changed (e.g., {'field': 'lyrics', 'old_value': '...', 'new_value': '...'})
            metadata: Additional metadata about the action

        Returns:
            Document reference for the created audit log entry
        """
        try:
            audit_entry = {
                'timestamp': datetime.utcnow(),
                'user_id': user_id,
                'user_email': user_email,
                'action': action,
                'resource_type': resource_type,
                'resource_id': resource_id,
            }

            # Add optional fields
            if resource_name:
                audit_entry['resource_name'] = resource_name

            if collection_id:
                audit_entry['collection_id'] = collection_id

            if changes:
                # Truncate long values to avoid excessive storage
                truncated_changes = {}
                for key, value in changes.items():
                    if isinstance(value, str) and len(value) > 500:
                        truncated_changes[key] = value[:500] + '... [truncated]'
                    else:
                        truncated_changes[key] = value
                audit_entry['changes'] = truncated_changes

            if metadata:
                audit_entry['metadata'] = metadata

            doc_ref = self.db.collection(self.audit_collection).add(audit_entry)

            logger.info(f"📝 Audit log: {action} on {resource_type} {resource_id} by {user_email}")

            return doc_ref

        except Exception as e:
            # Don't fail the main operation if audit logging fails
            logger.error(f"Failed to write audit log: {e}", exc_info=True)
            return None

    def get_logs(self, limit=100, offset=0, user_id=None, action=None,
                 resource_type=None, start_date=None, end_date=None):
        """
        Retrieve audit logs with optional filtering

        Args:
            limit: Maximum number of logs to return
            offset: Number of logs to skip (for pagination)
            user_id: Filter by user ID
            action: Filter by action type
            resource_type: Filter by resource type
            start_date: Filter logs after this date
            end_date: Filter logs before this date

        Returns:
            List of audit log entries
        """
        query = self.db.collection(self.audit_collection)

        # Apply filters
        if user_id:
            query = query.where('user_id', '==', user_id)

        if action:
            query = query.where('action', '==', action)

        if resource_type:
            query = query.where('resource_type', '==', resource_type)

        if start_date:
            query = query.where('timestamp', '>=', start_date)

        if end_date:
            query = query.where('timestamp', '<=', end_date)

        # Order by timestamp descending (most recent first)
        query = query.order_by('timestamp', direction=firestore.Query.DESCENDING)

        # Apply pagination
        if offset:
            query = query.offset(offset)

        query = query.limit(limit)

        # Execute query
        docs = query.stream()

        logs = []
        for doc in docs:
            log_data = doc.to_dict()
            log_data['id'] = doc.id

            # Convert timestamp to ISO string for JSON serialization
            if 'timestamp' in log_data and log_data['timestamp']:
                log_data['timestamp'] = log_data['timestamp'].isoformat()

            logs.append(log_data)

        return logs

    def get_logs_for_song(self, song_id, limit=50):
        """
        Get audit logs for a specific song

        Args:
            song_id: ID of the song
            limit: Maximum number of logs to return

        Returns:
            List of audit log entries for this song
        """
        return self.get_logs(
            resource_type='song',
            limit=limit
        )

    def get_logs_for_user(self, user_id, limit=100):
        """
        Get audit logs for a specific user

        Args:
            user_id: UID of the user
            limit: Maximum number of logs to return

        Returns:
            List of audit log entries for this user
        """
        return self.get_logs(
            user_id=user_id,
            limit=limit
        )

    def get_recent_logs(self, limit=100):
        """
        Get the most recent audit logs across all users

        Args:
            limit: Maximum number of logs to return

        Returns:
            List of recent audit log entries
        """
        return self.get_logs(limit=limit)


# Global audit service instance
audit_service = AuditService()
