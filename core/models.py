from django.db import models
import uuid

# Create your models here.

class Session(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    page_url = models.URLField()
    page_title = models.CharField(max_length=255)
    user_agent = models.TextField()
    screen_width = models.IntegerField()
    screen_height = models.IntegerField()
    window_width = models.IntegerField()
    window_height = models.IntegerField()
    is_active = models.BooleanField(default=True)
    page_html = models.TextField(null=True, blank=True)  # Store the page HTML
    page_styles = models.TextField(null=True, blank=True)  # Store computed styles

    @property
    def duration(self):
        if self.end_time:
            return self.end_time - self.start_time
        return None

    def __str__(self):
        return f"Session {self.id} - {self.page_title}"

class Event(models.Model):
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='events')
    type = models.CharField(max_length=50)
    timestamp = models.DateTimeField()
    data = models.JSONField()

    def __str__(self):
        return f"{self.type} at {self.timestamp}"

    class Meta:
        ordering = ['timestamp']
