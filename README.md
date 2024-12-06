# Clearsight

Clearsight is a web application that allows users to collect and replay user session telemetry. It is built using HTMX, Tailwind CSS, and Flowbite Components. The application is designed to be simple and easy to use, with a focus on user experience and accessibility.

## Tech Stack

- **Frontend**
  - HTMX
  - Tailwind CSS
  - Flowbite Components
  - Dark mode theming support
- **Backend**
  - Django
  - Django REST Framework
  - Django Channels (WebSocket support)
  - Daphne (ASGI server)
  - SQLite database
  - OpenSearch database

## Features

- Real-time telemetry collection via WebSocket:
    - Reliable WebSocket connection with automatic reconnection
    - Session-based data collection
    - Real-time event tracking
    - Silent failure handling for middleware unavailability
    - Collects:
      - Initial page DOM
      - Page styles
      - Page scripts
      - Page DOM
      - Page DOM mutations
      - Page events
      - Page load
      - Page unload
      - Page navigation
      - Page URL
      - Page title
      - User agent
      - Screen resolution
      - Browser window size
      - Time spent on page
      - Time spent on site
      - Mouse movement
      - Mouse clicks
      - Keyboard input
      - Scroll position
      - Network requests
      - Network responses
      - Errors
      - Console logs
      - Custom events

- Session Management and Analysis:
    - Comprehensive session list view with:
        - Session status tracking (Active/Inactive)
        - Event count per session
        - Session timeline view
        - Quick access to session details
    - Detailed session replay capabilities
    - Real-time session monitoring

- Data Storage and API:
    - WebSocket-based data ingestion
    - OpenSearch-powered data storage
    - RESTful API for data queries
    - Session-based data organization

- Modern Dashboard Interface:
    - Clean, responsive design with Tailwind CSS
    - Real-time session monitoring
    - Interactive session replay
    - Session statistics and analytics
    - Dark mode support