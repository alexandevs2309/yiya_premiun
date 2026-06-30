import uuid
from django.db import models
from django.conf import settings


class MenuCategory(models.Model):
    name = models.CharField(max_length=100)
    order = models.IntegerField(default=0)

    class Meta:
        verbose_name = 'Categoría de menú'
        verbose_name_plural = 'Categorías'
        ordering = ['order']

    def __str__(self):
        return self.name


class MenuItem(models.Model):
    ITBIS_CHOICES = [
        ('gravado', 'Gravado 18%'),
        ('exento', 'Exento'),
        ('reducido', 'Tasa Reducida'),
    ]
    name = models.CharField(max_length=200)
    category = models.ForeignKey(MenuCategory, on_delete=models.CASCADE, related_name='items')
    price = models.DecimalField(max_digits=10, decimal_places=2)
    itbis_type = models.CharField(max_length=10, choices=ITBIS_CHOICES, default='gravado')
    preparation_time = models.IntegerField(default=10, help_text='Minutos estimados')
    is_available = models.BooleanField(default=True)
    image = models.ImageField(upload_to='menu/', blank=True, null=True)
    has_modifiers = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Item del menú'
        verbose_name_plural = 'Items del menú'
        ordering = ['category__order', 'name']

    def __str__(self):
        return self.name


class ModifierGroup(models.Model):
    name = models.CharField(max_length=100)
    menu_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE, related_name='modifier_groups')
    is_required = models.BooleanField(default=True)
    max_selections = models.IntegerField(default=1)

    def __str__(self):
        return f'{self.name} ({self.menu_item.name})'


class ModifierOption(models.Model):
    group = models.ForeignKey(ModifierGroup, on_delete=models.CASCADE, related_name='options')
    name = models.CharField(max_length=100)
    price_adjustment = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def __str__(self):
        return f'{self.name} ({self.group.name})'


class Table(models.Model):
    STATUS_CHOICES = [
        ('available', 'Disponible'),
        ('occupied', 'Ocupada'),
        ('bill', 'Cuenta lista'),
        ('reserved', 'Reservada'),
    ]
    number = models.CharField(max_length=5, unique=True)
    section = models.CharField(max_length=50, default='Interior')
    capacity = models.IntegerField(default=4)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='available')
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    class Meta:
        verbose_name = 'Mesa'
        verbose_name_plural = 'Mesas'
        ordering = ['number']

    def __str__(self):
        return f'Mesa {self.number} ({self.section})'


class Order(models.Model):
    STATUS_CHOICES = [
        ('open', 'Abierta'),
        ('in_kitchen', 'En cocina'),
        ('ready', 'Lista para pagar'),
        ('paid', 'Pagada'),
        ('cancelled', 'Cancelada'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    table = models.ForeignKey(Table, on_delete=models.CASCADE, related_name='orders')
    waiter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='orders')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='open')
    guests = models.IntegerField(default=1)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Orden'
        verbose_name_plural = 'Ordenes'
        ordering = ['-created_at']

    def __str__(self):
        return f'Orden {self.id.hex[:8]} - Mesa {self.table.number}'


class OrderItem(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('in_kitchen', 'En cocina'),
        ('ready', 'Listo'),
        ('served', 'Servido'),
        ('cancelled', 'Cancelado'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    menu_item = models.ForeignKey(MenuItem, on_delete=models.SET_NULL, null=True)
    name = models.CharField(max_length=200)
    quantity = models.IntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    seat = models.IntegerField(default=1)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='pending')
    modifiers_json = models.JSONField(default=list, blank=True)

    class Meta:
        verbose_name = 'Item de orden'
        verbose_name_plural = 'Items de orden'

    def total_price(self):
        mod_price = sum(m.get('price_adjustment', 0) for m in self.modifiers_json)
        return (self.price + mod_price) * self.quantity


class OrderItemModifier(models.Model):
    order_item = models.ForeignKey(OrderItem, on_delete=models.CASCADE, related_name='modifiers')
    modifier_option = models.ForeignKey(ModifierOption, on_delete=models.SET_NULL, null=True)
    name = models.CharField(max_length=100)
    price_adjustment = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def __str__(self):
        return self.name
