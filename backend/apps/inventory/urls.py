from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InventoryItemViewSet, PurchaseOrderViewSet

router = DefaultRouter()
router.register(r'items', InventoryItemViewSet)
router.register(r'purchase-orders', PurchaseOrderViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
