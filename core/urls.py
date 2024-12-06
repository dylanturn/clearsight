from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard, name='dashboard'),
    path('sessions/', views.sessions_list, name='sessions_list'),
    path('sessions/<uuid:session_id>/', views.session_detail, name='session_detail'),
    path('sessions/<uuid:session_id>/replay/', views.session_replay, name='session_replay'),
    path('test/', views.test_page, name='test_page'),
]
