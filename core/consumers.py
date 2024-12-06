import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from .models import Session, Event

class TelemetryConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        self.session = None

    async def disconnect(self, close_code):
        if self.session:
            await self.end_session()

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            
            if not self.session and data.get('type') == 'session_start':
                # Create new session
                self.session = await self.create_session(data)
                # Send confirmation
                await self.send(json.dumps({
                    'type': 'session_started',
                    'session_id': str(self.session.id)
                }))
            elif self.session:
                # Record event for existing session
                await self.create_event(data)
                # Send confirmation
                await self.send(json.dumps({
                    'type': 'event_recorded',
                    'event_type': data.get('type')
                }))
        except json.JSONDecodeError:
            await self.send(json.dumps({
                'type': 'error',
                'message': 'Invalid JSON data'
            }))
        except Exception as e:
            await self.send(json.dumps({
                'type': 'error',
                'message': str(e)
            }))

    @database_sync_to_async
    def create_session(self, data):
        session = Session.objects.create(
            page_url=data.get('pageUrl', ''),
            page_title=data.get('pageTitle', ''),
            user_agent=data.get('userAgent', ''),
            screen_width=data.get('screenResolution', {}).get('width', 0),
            screen_height=data.get('screenResolution', {}).get('height', 0),
            window_width=data.get('windowSize', {}).get('width', 0),
            window_height=data.get('windowSize', {}).get('height', 0)
        )
        return session

    @database_sync_to_async
    def create_event(self, data):
        if self.session:
            Event.objects.create(
                session=self.session,
                type=data.get('type', 'unknown'),
                timestamp=timezone.now(),
                data=data.get('data', {})
            )

    @database_sync_to_async
    def end_session(self):
        if self.session:
            self.session.end_time = timezone.now()
            self.session.is_active = False
            self.session.save()
