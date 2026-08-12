from django.urls import path
from . import views
from . import chat_view

app_name = "analytics"

urlpatterns = [
    path("summary/",             views.analytics_summary,             name="summary"),
    path("risk-scores/",         views.analytics_risk_scores,         name="risk-scores"),
    path("predictions/",         views.analytics_predictions,         name="predictions"),
    path("user-activity/",       views.analytics_user_activity,       name="user-activity"),
    path("action-distribution/", views.analytics_action_distribution, name="action-distribution"),
    path("daily-trend/",         views.analytics_daily_trend,         name="daily-trend"),
    path("extraction-log/",      views.analytics_extraction_log,      name="extraction-log"),
    path("chat/",                chat_view.analytics_chat,            name="chat"),
]

