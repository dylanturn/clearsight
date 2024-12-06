from django.shortcuts import render
from django.utils import timezone
from .models import Session, Event
import json
from uuid import UUID

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
    session = Session.objects.get(id=session_id)
    events = list(session.events.all().values())
    
    # Convert datetime objects to ISO format and handle UUID serialization
    for event in events:
        event['timestamp'] = event['timestamp'].isoformat()
        event['session_id'] = str(event['session_id'])  # Convert UUID to string
    
    session_data = {
        'window_width': session.window_width,
        'window_height': session.window_height,
        'page_url': session.page_url,
        'page_title': session.page_title,
    }
    
    context = {
        'session': session,
        'session_data': json.dumps(session_data),
        'events_json': json.dumps(events, cls=UUIDEncoder),
    }
    return render(request, 'core/session_replay.html', context)

def test_page(request):
    return render(request, 'core/test.html')
