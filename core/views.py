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
        'recent_sessions': Session.objects.order_by('-start_time')[:10]
    }
    return render(request, 'core/dashboard.html', context)

def session_detail(request, session_id):
    session = Session.objects.get(id=session_id)
    events = session.events.all()
    
    context = {
        'session': session,
        'events': events,
    }
    return render(request, 'core/session_detail.html', context)

def sessions_list(request):
    sessions = Session.objects.order_by('-start_time')
    context = {
        'sessions': sessions,
    }
    return render(request, 'core/sessions_list.html', context)

def session_replay(request, session_id):
    try:
        session = get_object_or_404(Session, id=session_id)
        events = list(session.events.order_by('timestamp').values())
        
        # Convert timestamps to milliseconds since epoch
        for event in events:
            event['timestamp'] = int(event['timestamp'].timestamp() * 1000)
            event['session_id'] = str(event['session_id'])  # Convert UUID to string
        
        # Prepare session data for the template
        session_data = {
            'id': str(session.id),
            'page_html': session.page_html or '<html><body><p>No content captured</p></body></html>',
            'page_styles': session.page_styles or '',
            'events': events
        }
        
        # Log debug information
        logger.debug(f"Session replay data prepared: {len(events)} events, HTML size: {len(session_data['page_html'])} bytes")
        
        context = {
            'session': session,
            'session_data_json': json.dumps(session_data, cls=DjangoJSONEncoder),
        }
        
        return render(request, 'core/session_replay.html', context)
        
    except Exception as e:
        logger.error(f"Error preparing session replay: {e}")
        raise  # Re-raise the exception to show the error page

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
        elif event_type in ['click', 'mousemove', 'keypress', 'scroll', 'resize', 'input']:
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
                
            event = Event.objects.create(
                session=session,
                type=event_type,
                timestamp=timezone.now(),
                data=data.get('data', {})
            )
            logger.info(f'Created new event: {event.type} for session {session_id}')
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
    return render(request, 'core/test.html')
