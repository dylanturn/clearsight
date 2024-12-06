from django.core.management.base import BaseCommand
from core.models import Session, Event
from django.db import transaction
from django.utils import timezone

class Command(BaseCommand):
    help = 'Clears all telemetry data (Sessions and Events) from the database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--before',
            type=str,
            help='Clear data before this date (YYYY-MM-DD)',
            required=False
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting',
        )

    def handle(self, *args, **options):
        with transaction.atomic():
            # Get initial counts
            total_sessions = Session.objects.count()
            total_events = Event.objects.count()

            # Filter by date if specified
            if options['before']:
                try:
                    before_date = timezone.datetime.strptime(options['before'], '%Y-%m-%d')
                    before_date = timezone.make_aware(before_date)
                    sessions_to_delete = Session.objects.filter(start_time__lt=before_date)
                    events_to_delete = Event.objects.filter(timestamp__lt=before_date)
                except ValueError:
                    self.stdout.write(self.style.ERROR('Invalid date format. Use YYYY-MM-DD'))
                    return
            else:
                sessions_to_delete = Session.objects.all()
                events_to_delete = Event.objects.all()

            # Get counts of what will be deleted
            sessions_count = sessions_to_delete.count()
            events_count = events_to_delete.count()

            if options['dry_run']:
                self.stdout.write(self.style.WARNING(
                    f'Would delete {sessions_count} sessions and {events_count} events'
                ))
                return

            # Delete the data
            events_to_delete.delete()
            sessions_to_delete.delete()

            self.stdout.write(self.style.SUCCESS(
                f'Successfully deleted {sessions_count} sessions and {events_count} events'
            ))
