from django.shortcuts import render
from django.utils import timezone
from .models import Session, Event

# Create your views here.

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

def test_page(request):
    return render(request, 'core/test.html')
