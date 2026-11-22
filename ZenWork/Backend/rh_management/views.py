from django.shortcuts import render
from .models import Planning


def dashboard_rh(request):
    plannings_to_approve = Planning.objects.filter(
        type_planning='CONGE',
        source='DEMANDE'
    )


    return render(request, 'rh/dashboard.html', {
        'plannings': plannings_to_approve
    }
    )
