from django.db import models
import uuid
from django.contrib.auth.models import User

# =========================
# PROFILE (table: profiles)
# =========================
import uuid

class Profile(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    service = models.CharField(max_length=100)
    role = models.CharField(max_length=100)

    date_embauche = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'profiles'
# =========================
# PLANNING (table: planning)
# =========================
class Planning(models.Model):

    TYPE_CHOICES = [
        ('TRAVAIL', 'Travail'),
        ('CONGE', 'Congé'),
        ('REPOS', 'Repos'),
        ('ABSENT', 'Absent'),
    ]

    SOURCE_CHOICES = [
        ('MANUEL', 'Manuel'),
        ('DEMANDE', 'Demande'),
    ]

    id = models.BigAutoField(primary_key=True)

    utilisateur = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        null=True,
        db_column='utilisateur_id',
        related_name='plannings'
    )

    date_debut = models.DateTimeField()
    date_fin = models.DateTimeField()
    commentaire = models.TextField(null=True, blank=True)

    type_planning = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES
    )

    source = models.CharField(
        max_length=20,
        choices=SOURCE_CHOICES
    )

    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    def __str__(self):
        # Affiche nom employé et type de congé
        return f"{self.user.username} - {self.type}"

#forum d'échange et planning
class Schedule(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    is_tradable = models.BooleanField(default=False)

    def __str__(self):
        # Affiche nom employé et heure de début
        return f"Planning de {self.user.username} ({self.start_time})"