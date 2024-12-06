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
  - SQLite database
  - OpenSearch database

## Features

- A simple JS script designed to collect user session telemetry:
    - Will be added to a page using a `<script>` tag.
    - Will store the data in a JSON object.
    - Will send the data to a middleware service.
    - If the middleware service isn't available, the the websocket should fail silently.
    - Will collect the following data:
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
- A simple middleware service designed to receive user session telemetry.
    - Will receive the data from the JS script.
    - Will store the data in an OpenSearch cluster.
    - Will provide an API for querying the data.
- A simple dashboard designed to replay user session telemetry.
    - Will query the middleware service for the data.
    - Will display the data in a user-friendly format.
    - Will allow the dashboard users to replay the session.