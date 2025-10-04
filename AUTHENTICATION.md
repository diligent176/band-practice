# Authentication Setup for Band Practice App

This document explains the authentication configuration for the Band Practice web application.

## Overview

The application has been configured to require Google authentication for all users. This means:

- Users must have a Google account to access the application
- The application is no longer publicly accessible
- User access is logged for security auditing

## Authentication Components

### 1. Terraform Configuration

The Terraform configuration has been updated with the following authentication features:

- **Cloud Run IAM**: Removed public access (`allUsers`) and restricted to `allAuthenticatedUsers`
- **Identity-Aware Proxy (IAP)**: Enabled IAP APIs for enhanced authentication
- **Service APIs**: Added required APIs (`iap.googleapis.com`, `compute.googleapis.com`)

### 2. Flask Application

The Flask application now includes:

- **Authentication Service**: `services/auth_service.py` handles Google IAP token verification
- **Route Protection**: All API endpoints require authentication using the `@require_auth` decorator
- **User Context**: User information is available in Flask's `g.user` object
- **Development Mode**: Authentication is bypassed in development for local testing

### 3. Frontend Updates

The web interface now:

- Displays the authenticated user's email address in the header
- Loads user information on page load
- Handles authentication errors gracefully

## Configuration Requirements

### Environment Variables

Add these environment variables to your deployment:

```bash
GCP_PROJECT_ID=your-project-id
GCP_PROJECT_NUMBER=123456789012  # Your numeric project number
```

### Terraform Variables

Update your `terraform.tfvars` file:

```hcl
project_id     = "your-gcp-project-id"
project_number = "123456789012"  # Your numeric project number
```

To find your project number:

```bash
gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)"
```

## User Access Management

### Current Configuration

By default, the application allows access to `allAuthenticatedUsers`, meaning any user with a Google account can access the application.

### Restricting to Specific Users

To restrict access to specific users or groups, modify the Terraform configuration:

1. **Individual Users**:

```hcl
resource "google_cloud_run_service_iam_member" "authenticated_access" {
  service  = google_cloud_run_service.band_practice.name
  location = google_cloud_run_service.band_practice.location
  role     = "roles/run.invoker"
  member   = "user:someone@example.com"
}
```

2. **Google Groups**:

```hcl
resource "google_cloud_run_service_iam_member" "group_access" {
  service  = google_cloud_run_service.band_practice.name
  location = google_cloud_run_service.band_practice.location
  role     = "roles/run.invoker"
  member   = "group:band-members@example.com"
}
```

3. **Multiple Users**:

```hcl
variable "authorized_users" {
  description = "List of users authorized to access the application"
  type        = list(string)
  default     = [
    "user:member1@example.com",
    "user:member2@example.com",
    "group:band-members@example.com"
  ]
}

resource "google_cloud_run_service_iam_member" "user_access" {
  for_each = toset(var.authorized_users)
  service  = google_cloud_run_service.band_practice.name
  location = google_cloud_run_service.band_practice.location
  role     = "roles/run.invoker"
  member   = each.value
}
```

## Deployment Steps

1. **Update Dependencies**:

   ```bash
   # The requirements.txt has been updated with authentication dependencies
   pip install -r requirements.txt
   ```

2. **Update Terraform Configuration**:

   ```bash
   cd terraform
   # Update your terraform.tfvars with project_number
   terraform plan
   terraform apply
   ```

3. **Deploy Application**:
   ```bash
   # Your existing deployment process will include the new authentication code
   ./deploy.sh
   ```

## Development and Testing

### Local Development

For local development, set the environment variable:

```bash
export FLASK_ENV=development
# OR
export DEVELOPMENT=true
```

This bypasses authentication and uses a mock user for testing.

### Testing Authentication

1. **Access the Application**: Navigate to your Cloud Run URL
2. **Google Sign-In**: You'll be redirected to Google's sign-in page
3. **Authorization**: After signing in, you'll be redirected back to the application
4. **User Display**: Your email should appear in the top-right corner

## Security Notes

- **Logging**: All user actions are now logged with user email addresses
- **Session Management**: Authentication is handled by Google IAP, not Flask sessions
- **Token Verification**: IAP tokens are verified on each request
- **HTTPS Required**: Authentication only works over HTTPS (automatic with Cloud Run)

## Troubleshooting

### Common Issues

1. **"Authentication required" errors**:

   - Ensure user has proper IAM permissions
   - Check that IAP is properly configured
   - Verify project number is correct

2. **Token verification failures**:

   - Confirm `GCP_PROJECT_NUMBER` environment variable is set
   - Ensure IAP APIs are enabled
   - Check Cloud Run service configuration

3. **Development mode issues**:
   - Set `FLASK_ENV=development` or `DEVELOPMENT=true`
   - Check application logs for authentication bypass messages

### Useful Commands

```bash
# Get project number
gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)"

# Check Cloud Run IAM policies
gcloud run services get-iam-policy band-practice-pro --region=us-west1

# View application logs
gcloud logs read "resource.type=cloud_run_revision" --limit=50
```
