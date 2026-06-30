import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser


class TimeStampedMixin(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Administrador'),
        ('cashier', 'Cajero'),
        ('waiter', 'Mesero'),
        ('cook', 'Cocinero'),
    ]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='waiter')
    pin = models.CharField(max_length=6, blank=True, null=True, help_text='PIN de 4-6 dígitos para meseros')
    phone = models.CharField(max_length=15, blank=True)

    class Meta:
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'

    def __str__(self):
        return f'{self.get_full_name() or self.username} ({self.get_role_display()})'


class Customer(TimeStampedMixin):
    rnc = models.CharField(max_length=11, unique=True, verbose_name='RNC/Cédula')
    business_name = models.CharField(max_length=200, verbose_name='Razón social')
    commercial_name = models.CharField(max_length=200, blank=True, verbose_name='Nombre comercial')
    phone = models.CharField(max_length=15, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Cliente'
        verbose_name_plural = 'Clientes'
        ordering = ['business_name']

    def __str__(self):
        return f'{self.business_name} ({self.rnc})'


class AuditLog(TimeStampedMixin):
    ACTION_CHOICES = [
        ('create', 'Creación'),
        ('update', 'Actualización'),
        ('delete', 'Eliminación'),
        ('login', 'Inicio de sesión'),
        ('payment', 'Pago'),
    ]
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    model_name = models.CharField(max_length=50)
    object_id = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)

    class Meta:
        verbose_name = 'Registro de Auditoría'
        verbose_name_plural = 'Registros de Auditoría'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.get_action_display()} - {self.model_name} ({self.user or "—"})'
