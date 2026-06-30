from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InventoryItemViewSet, PurchaseOrderViewSet, MenuItemRecipeViewSet

router = DefaultRouter()
router.register(r'items', InventoryItemViewSet)
router.register(r'purchase-orders', PurchaseOrderViewSet)
router.register(r'recipes', MenuItemRecipeViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
