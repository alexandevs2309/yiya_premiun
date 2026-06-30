from rest_framework import viewsets, permissions
from .models import InventoryItem, PurchaseOrder, MenuItemRecipe
from .serializers import InventoryItemSerializer, PurchaseOrderSerializer, MenuItemRecipeSerializer


class InventoryItemViewSet(viewsets.ModelViewSet):
    queryset = InventoryItem.objects.all()
    serializer_class = InventoryItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['category']
    search_fields = ['name']


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.all()
    serializer_class = PurchaseOrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status']


class MenuItemRecipeViewSet(viewsets.ModelViewSet):
    queryset = MenuItemRecipe.objects.all()
    serializer_class = MenuItemRecipeSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['menu_item']
