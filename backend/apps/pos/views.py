from rest_framework import viewsets, permissions, status, parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import MenuCategory, MenuItem, Table, Order, OrderItem
from .serializers import (
    MenuCategorySerializer, MenuItemSerializer, TableSerializer,
    OrderSerializer, OrderItemSerializer,
)

from apps.core.views import IsAdminUser


class MenuCategoryViewSet(viewsets.ModelViewSet):
    queryset = MenuCategory.objects.prefetch_related('items__modifier_groups__options').all()
    serializer_class = MenuCategorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]


class MenuItemViewSet(viewsets.ModelViewSet):
    queryset = MenuItem.objects.select_related('category').prefetch_related('modifier_groups__options').all()
    serializer_class = MenuItemSerializer
    filterset_fields = ['category', 'is_available']
    search_fields = ['name']
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'upload_image'):
            return [permissions.IsAuthenticated(), IsAdminUser()]
        return [permissions.IsAuthenticated()]

    @action(detail=True, methods=['post'], parser_classes=[parsers.MultiPartParser, parsers.FormParser])
    def upload_image(self, request, pk=None):
        item = self.get_object()
        if 'image' not in request.FILES:
            return Response({'error': 'No se envió ninguna imagen'}, status=status.HTTP_400_BAD_REQUEST)
        item.image = request.FILES['image']
        item.save(update_fields=['image'])
        serializer = self.get_serializer(item)
        return Response(serializer.data)


class TableViewSet(viewsets.ModelViewSet):
    queryset = Table.objects.all()
    serializer_class = TableSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=['post'])
    def open(self, request, pk=None):
        table = self.get_object()
        if table.status != 'available':
            return Response({'error': 'La mesa no está disponible'}, status=status.HTTP_400_BAD_REQUEST)
        guests = request.data.get('guests', 1)
        table.status = 'occupied'
        table.save()
        
        # Permitir id de cliente para sincronización offline
        order_id = request.data.get('id')
        create_kwargs = {'table': table, 'waiter': request.user, 'guests': guests}
        if order_id:
            create_kwargs['id'] = order_id
            
        order = Order.objects.create(**create_kwargs)
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        table = self.get_object()
        table.status = 'available'
        table.save()
        return Response({'status': 'ok'})

    @action(detail=True, methods=['post'])
    def request_bill(self, request, pk=None):
        table = self.get_object()
        if table.status != 'occupied':
            return Response({'error': 'La mesa no está ocupada'}, status=status.HTTP_400_BAD_REQUEST)
        table.status = 'bill'
        table.save()
        return Response({'status': 'ok', 'table_status': 'bill'})


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.prefetch_related('items').select_related('table', 'waiter').all()
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'table']

    @action(detail=True, methods=['post'])
    def add_item(self, request, pk=None):
        order = self.get_object()
        if order.status != 'open':
            return Response({'error': 'La orden no está abierta'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = OrderItemSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Permitir id de cliente para sincronización offline
        item_id = request.data.get('id')
        if item_id:
            serializer.save(order=order, id=item_id)
        else:
            serializer.save(order=order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def _broadcast_kds(self, order, event_type: str):
        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                'kds',
                {'type': 'kds_message', 'data': {'type': event_type, 'order': OrderSerializer(order).data}},
            )
        except Exception:
            pass

    @action(detail=False, methods=['get'])
    def pending_kds(self, request):
        orders = Order.objects.filter(
            status__in=('in_kitchen',),
        ).prefetch_related('items').select_related('table', 'waiter')[:50]
        return Response(OrderSerializer(orders, many=True).data)

    @action(detail=True, methods=['post'])
    def send_to_kitchen(self, request, pk=None):
        order = self.get_object()
        with transaction.atomic():
            pending_items = list(order.items.filter(status='pending'))
            order.items.filter(status='pending').update(status='in_kitchen')
            order.status = 'in_kitchen'
            order.save()
        order.refresh_from_db()
        self._broadcast_kds(order, 'new_order')

        # Imprimir comanda de cocina automáticamente
        try:
            from .utils.print_service import imprimir_comanda_cocina
            imprimir_comanda_cocina(order, pending_items)
        except Exception:
            pass

        return Response({'status': 'ok', 'sent': order.items.filter(status='in_kitchen').count()})

    @action(detail=True, methods=['post'])
    def complete_item(self, request, pk=None):
        order = self.get_object()
        item_pk = request.data.get('item_pk')
        if not item_pk:
            return Response({'error': 'item_pk requerido'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            item = order.items.get(pk=item_pk)
        except OrderItem.DoesNotExist:
            return Response({'error': 'Item no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        item.status = 'ready'
        item.save()
        order.refresh_from_db()
        self._broadcast_kds(order, 'order_update')
        return Response({'status': 'ok', 'item_status': 'ready'})

    @action(detail=True, methods=['patch'])
    def update_item(self, request, pk=None):
        order = self.get_object()
        item_pk = request.data.get('item_pk')
        if not item_pk:
            return Response({'error': 'item_pk requerido'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            item = order.items.get(pk=item_pk)
        except OrderItem.DoesNotExist:
            return Response({'error': 'Item no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        quantity = request.data.get('quantity')
        if quantity is not None:
            if quantity < 1:
                return Response({'error': 'Cantidad debe ser al menos 1'}, status=status.HTTP_400_BAD_REQUEST)
            item.quantity = quantity
        modifiers = request.data.get('modifiers_json')
        if modifiers is not None:
            item.modifiers_json = modifiers
        item.save(update_fields=['quantity', 'modifiers_json'])
        serializer = OrderItemSerializer(item)
        order.refresh_from_db()
        self._broadcast_kds(order, 'order_update')
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def print_receipt(self, request, pk=None):
        order = self.get_object()
        payment = getattr(order, 'payment', None)
        if not payment:
            return Response({'error': 'La orden no tiene pago registrado'}, status=status.HTTP_400_BAD_REQUEST)

        from django.conf import settings
        return Response({
            'restaurant': settings.RESTAURANT_NAME,
            'rnc': settings.DGII_RNC,
            'direccion': 'Samaná, República Dominicana',
            'ncf': payment.ecf_documents.first().ncf if payment.ecf_documents.exists() else '',
            'metodo_pago': payment.get_method_display(),
            'mesa': order.table.number if order.table else '',
            'mesero': order.waiter.get_full_name() or order.waiter.username,
            'fecha': order.updated_at.isoformat(),
            'items': [
                {
                    'cantidad': i.quantity,
                    'nombre': i.name,
                    'precio': float(i.price),
                    'total': float(i.price * i.quantity),
                    'modificadores': [m['name'] for m in (i.modifiers_json or [])],
                }
                for i in order.items.all()
            ],
            'subtotal': float(payment.subtotal),
            'itbis': float(payment.itbis),
            'propina': float(payment.propina),
            'total': float(payment.total),
            'efectivo': float(payment.cash_received) if payment.cash_received else None,
            'cambio': float(payment.change_given) if payment.change_given else None,
        })

    @action(detail=True, methods=['post'])
    def print_hardware(self, request, pk=None):
        order = self.get_object()
        payment = getattr(order, 'payment', None)
        if not payment:
            return Response({'error': 'La orden no tiene pago registrado'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from .utils.print_service import imprimir_ticket_pago
            imprimir_ticket_pago(payment, order)
        except Exception as e:
            return Response({'error': f'Falló la impresión física: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'status': 'ok'})

    @action(detail=True, methods=['delete'], url_path='remove_item/(?P<item_pk>[^/.]+)')
    def remove_item(self, request, pk=None, item_pk=None):
        order = self.get_object()
        try:
            item = order.items.get(pk=item_pk)
        except OrderItem.DoesNotExist:
            return Response({'error': 'Item no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        if order.status in ('paid', 'cancelled'):
            return Response({'error': 'La orden ya está cerrada'}, status=status.HTTP_400_BAD_REQUEST)
        item.delete()
        order.refresh_from_db()
        if order.items.count() == 0:
            order.status = 'open'
            order.save(update_fields=['status'])
        self._broadcast_kds(order, 'order_update')
        return Response({'status': 'ok'}, status=status.HTTP_200_OK)
