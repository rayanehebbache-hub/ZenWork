from django.urls import path
from . import views

app_name = "psychobot"

urlpatterns = [
    path("questionnaire/",              views.analyze_questionnaire,  name="questionnaire"),
    path("chat/message/",               views.send_chat_message,      name="chat_message"),
    path("chat/fermer/",                views.close_chat_session,     name="chat_fermer"),
]
