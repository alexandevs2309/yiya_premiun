import logging
from django.db import models
from apps.inventory.models import MenuItemRecipe

logger = logging.getLogger(__name__)

def deduct_order_stock(order):
    """
    Descuenta del inventario los ingredientes requeridos según la receta de cada ítem no cancelado de la orden.
    Utiliza F('stock') para evitar colisiones de concurrencia.
    """
    # Filtrar solo ítems que no estén cancelados
    active_items = order.items.exclude(status='cancelled')
    
    for item in active_items:
        if not item.menu_item:
            continue
            
        # Buscar recetas asociadas al platillo
        recipes = MenuItemRecipe.objects.filter(menu_item=item.menu_item)
        if not recipes.exists():
            continue
            
        for recipe in recipes:
            inv_item = recipe.inventory_item
            deduct_qty = recipe.quantity * item.quantity
            
            logger.info(f"Descontando {deduct_qty} {inv_item.unit} de {inv_item.name} por {item.quantity}x {item.name}")
            
            inv_item.stock = models.F('stock') - deduct_qty
            inv_item.save(update_fields=['stock'])
