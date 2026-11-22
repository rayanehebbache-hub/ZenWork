from django.contrib import admin
from .models import Profile, Planning
#PlanningEmployee


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('prenom', 'nom', 'service', 'role')


@admin.register(Planning)
class PlanningAdmin(admin.ModelAdmin):
    list_display = (
        'utilisateur',
        'type_planning',
        'date_debut',
        'date_fin',
        'source'
    )
    list_filter = ('type_planning', 'source')


#@admin.register(PlanningEmployee)
#class PlanningEmployeeAdmin(admin.ModelAdmin):
 #   list_display = ('planning', 'utilisateur')