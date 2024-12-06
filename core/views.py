from django.shortcuts import render, get_object_or_404
from django.utils import timezone
from .models import Session, Event
import json
from uuid import UUID
from django.core.serializers.json import DjangoJSONEncoder
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods

logger = logging.getLogger(__name__)

# Create your views here.

class UUIDEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, UUID):
            return str(obj)
        return super().default(obj)

def dashboard(request):
    context = {
        'active_sessions': Session.objects.filter(is_active=True).count(),
        'total_sessions': Session.objects.count(),
        'total_events': Event.objects.count(),
        'recent_sessions': Session.objects.order_by('-start_time')[:10],
        'disable_telemetry': True
    }
    return render(request, 'core/dashboard.html', context)

def session_detail(request, session_id):
    session = Session.objects.get(id=session_id)
    events = session.events.all()
    
    context = {
        'session': session,
        'events': events,
        'disable_telemetry': True
    }
    return render(request, 'core/session_detail.html', context)

def sessions_list(request):
    sessions = Session.objects.order_by('-start_time')
    context = {
        'sessions': sessions,
        'disable_telemetry': True
    }
    return render(request, 'core/sessions_list.html', context)

@require_http_methods(['GET'])
def session_replay(request, session_id):
    try:
        session = get_object_or_404(Session, id=session_id)
        events = list(session.events.order_by('timestamp').values())
        
        # Convert timestamps to milliseconds since epoch
        for event in events:
            event['timestamp'] = int(event['timestamp'].timestamp() * 1000)
            event['session_id'] = str(event['session_id'])
        
        # Clean up the HTML content
        page_html = session.page_html or '<html><body><p>No content captured</p></body></html>'
        
        # Extract body content and clean it
        import re
        from html import escape, unescape
        
        # First unescape any already escaped HTML (to prevent double escaping)
        page_html = unescape(page_html)
        
        # Extract body content
        body_match = re.search(r'<body[^>]*>(.*?)</body>', page_html, re.DOTALL | re.IGNORECASE)
        body_content = body_match.group(1) if body_match else page_html
        
        # Clean up whitespace while preserving structure
        body_content = re.sub(r'[ \t]+', ' ', body_content)  # Collapse spaces and tabs
        body_content = re.sub(r'\n\s*\n+', '\n', body_content)  # Collapse multiple newlines
        body_content = body_content.strip()
        
        # Create a clean HTML structure
        clean_html = ''.join([
            '<!DOCTYPE html>',
            '<html>',
            '<head>',
            '<meta charset="UTF-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
            '<style id="base-styles">',
            'body { margin: 0; padding: 0; }',
            '* { cursor: none !important; }',
            'a, button, input, textarea, select { pointer-events: none !important; }',
            '</style>',
            '</head>',
            '<body>',
            body_content,
            '</body>',
            '</html>'
        ])
        
        # Prepare session data
        session_data = {
            'id': str(session.id),
            'page_html': clean_html,
            'page_styles': session.page_styles or '',
            'events': events,
            'metadata': {
                'timestamp': int(session.start_time.timestamp() * 1000),
                'duration': len(events),
                'url': session.page_url,
                'title': session.page_title,
                'userAgent': session.user_agent,
                'viewport': {
                    'screen': {
                        'width': session.screen_width,
                        'height': session.screen_height
                    },
                    'window': {
                        'width': session.window_width,
                        'height': session.window_height
                    }
                }
            }
        }
        
        # Convert to JSON with proper encoding
        try:
            # Use a custom JSON encoder for better error handling
            class SessionEncoder(json.JSONEncoder):
                def default(self, obj):
                    if isinstance(obj, UUID):
                        return str(obj)
                    return super().default(obj)
            
            session_json = json.dumps(
                session_data,
                cls=SessionEncoder,
                ensure_ascii=False,
                separators=(',', ':')
            )
        except Exception as e:
            logger.error(f"Error encoding session data: {e}")
            return JsonResponse({
                'error': 'Failed to encode session data',
                'message': str(e)
            }, status=500)
        
        context = {
            'session': session,
            'session_data': session_json,
            'disable_telemetry': True  # Disable telemetry on replay page
        }
        
        response = render(request, 'core/session_replay.html', context)
        
        # Add CSP header to allow external resources
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' "
            "https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.tailwindcss.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com "
            "https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.tailwindcss.com; "
            "img-src 'self' data: blob: https:; "
            "font-src 'self' data: https://fonts.gstatic.com; "
            "connect-src 'self' https:; "
            "frame-src 'self'; "
            "object-src 'none'"
        )
        response['Content-Security-Policy'] = csp
        
        return response
        
    except Exception as e:
        logger.error(f"Error in session_replay view: {e}")
        return JsonResponse({
            'error': 'Failed to prepare session replay',
            'message': str(e)
        }, status=500)

@csrf_protect
@require_http_methods(['POST'])
def telemetry(request):
    try:
        logger.info('Received telemetry request')
        logger.debug(f'Request body: {request.body.decode()}')
        
        data = json.loads(request.body)
        event_type = data.get('type')
        logger.info(f'Processing telemetry event type: {event_type}')
        logger.debug(f'Telemetry data: {json.dumps(data, indent=2)}')
        
        if event_type == 'session_start':
            # Create new session
            session = Session.objects.create(
                page_url=data.get('pageUrl', ''),
                page_title=data.get('pageTitle', ''),
                user_agent=data.get('userAgent', ''),
                screen_width=data.get('screenResolution', {}).get('width', 0),
                screen_height=data.get('screenResolution', {}).get('height', 0),
                window_width=data.get('windowSize', {}).get('width', 0),
                window_height=data.get('windowSize', {}).get('height', 0),
                page_html=data.get('pageHtml', ''),
                page_styles=data.get('pageStyles', '')
            )
            logger.info(f'Created new session: {session.id}')
            return JsonResponse({'status': 'success', 'session_id': str(session.id)})
            
        # Handle all event types (click, mousemove, keypress, etc.)
        elif event_type in ['click', 'mousemove', 'keypress', 'scroll', 'resize', 'input', 'fetch', 'xhr', 'form_submit', 'dom_mutation', 'visibility_change', 'window_resize', 'error']:
            session_id = data.get('session_id')
            if not session_id:
                logger.error('No session ID provided in event data')
                return JsonResponse({
                    'status': 'error',
                    'message': 'No session ID provided',
                    'received_data': data
                }, status=400)
                
            try:
                session = Session.objects.get(id=session_id)
            except (Session.DoesNotExist, ValueError):
                logger.error(f'Session not found: {session_id}')
                return JsonResponse({
                    'status': 'error',
                    'message': f'Session not found: {session_id}',
                    'received_data': data
                }, status=404)
                
            # Create event with optional HTML diff
            event_data = {
                'session': session,
                'type': event_type,
                'timestamp': timezone.now(),
                'data': data.get('data', {}),
                'html_diff': data.get('data', {}).get('htmlDiff')
            }
            
            event = Event.objects.create(**event_data)
            logger.info(f'Created new event: {event.type} for session {session_id}')
            
            if event.html_diff:
                logger.info(f'Stored HTML diff for event {event.id}, size: {len(event.html_diff)} bytes')
                
            return JsonResponse({'status': 'success'})
            
        else:
            logger.warning(f'Unknown event type: {event_type}')
            return JsonResponse({
                'status': 'error',
                'message': f'Unknown event type: {event_type}',
                'received_data': data
            }, status=400)
            
    except json.JSONDecodeError as e:
        logger.error(f'Invalid JSON received: {str(e)}')
        return JsonResponse({
            'status': 'error',
            'message': f'Invalid JSON: {str(e)}',
            'received_body': request.body.decode()
        }, status=400)
    except Exception as e:
        logger.error(f'Error processing telemetry: {str(e)}')
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)

def test_page(request):
    return render(request, 'core/test.html', {'disable_telemetry': False})
