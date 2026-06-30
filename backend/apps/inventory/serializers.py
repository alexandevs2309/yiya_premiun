from rest_framework import serializers
from .models import InventoryItem, PurchaseOrder


class InventoryItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryItem
        fields = ['id', 'name', 'category', 'unit', 'stock', 'min_stock', 'cost_per_unit', 'is_low', 'total_value']


class PurchaseOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOrder
        fields = ['id', 'supplier', 'status', 'notes', 'created_at', 'updated_at']
