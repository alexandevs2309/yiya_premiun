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
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text='Sueldo base por hora')
    commission_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text='Porcentaje de comisión por ventas')

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


class EmployeeShift(TimeStampedMixin):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shifts')
    clock_in = models.DateTimeField(auto_now_add=True)
    clock_out = models.DateTimeField(null=True, blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Turno de empleado'
        verbose_name_plural = 'Turnos de empleados'
        ordering = ['-clock_in']

    def __str__(self):
        status = "Activo" if self.active else f"Finalizado"
        return f'{self.user.username} - {self.clock_in.strftime("%d/%m %H:%M")} ({status})'


class PayrollPayment(TimeStampedMixin):
    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('paid', 'Pagado'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payroll_payments')
    period_start = models.DateField()
    period_end = models.DateField()
    wages_earned = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    commissions_earned = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tips_earned = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text='Deducción por consumo de empleado')
    net_pay = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')

    class Meta:
        verbose_name = 'Pago de nómina'
        verbose_name_plural = 'Pagos de nóminas'
        ordering = ['-period_end']

    def __str__(self):
        return f'Nómina {self.user.username} ({self.period_start} a {self.period_end}) - {self.get_status_display()}'
