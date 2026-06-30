import uuid
from django.db import models


class InventoryItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=50, default='Otros')
    unit = models.CharField(max_length=20, default='unidad')
    stock = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    min_stock = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    cost_per_unit = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Item de inventario'
        verbose_name_plural = 'Items de inventario'
        ordering = ['name']

    def __str__(self):
        return self.name

    @property
    def is_low(self):
        return self.stock <= self.min_stock

    @property
    def total_value(self):
        return self.stock * self.cost_per_unit


class PurchaseOrder(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('partial', 'Parcial'),
        ('completed', 'Completada'),
        ('cancelled', 'Cancelada'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supplier = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Orden de compra'
        verbose_name_plural = 'Ordenes de compra'
        ordering = ['-created_at']

    def __str__(self):
        return f'PO-{self.id.hex[:8]} ({self.get_status_display()})'


class MenuItemRecipe(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    menu_item = models.ForeignKey('pos.MenuItem', on_delete=models.CASCADE, related_name='recipes')
    inventory_item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='recipes')
    quantity = models.DecimalField(max_digits=10, decimal_places=4, help_text='Cantidad consumida por plato')

    class Meta:
        verbose_name = 'Receta de item'
        verbose_name_plural = 'Recetas de items'
        unique_together = ('menu_item', 'inventory_item')

    def __str__(self):
        return f'{self.menu_item.name} <- {self.quantity} {self.inventory_item.unit} de {self.inventory_item.name}'
