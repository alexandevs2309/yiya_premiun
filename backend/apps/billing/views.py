from rest_framework import viewsets, permissions, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from .models import Payment, ECFDocument, NCFSequence
from .serializers import (
    PaymentSerializer, ECFDocumentSerializer,
    ECFDocumentCreateSerializer, NCFSequenceSerializer,
)
from .utils.ecf import generar_ecf
from .utils.rnc import validar_rnc


class PaymentViewSet(mixins.CreateModelMixin,
                     mixins.RetrieveModelMixin,
                     mixins.ListModelMixin,
                     viewsets.GenericViewSet):
    queryset = Payment.objects.select_related('order', 'processed_by').all()
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['method', 'order']

    @action(detail=True, methods=['post'])
    def generate_ecf(self, request, pk=None):
        payment = self.get_object()
        serializer = ECFDocumentCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            with transaction.atomic():
                ncf_type = serializer.validated_data.get('ncf_type', 'B01')
                doc = generar_ecf(
                    payment,
                    rnc_cliente=serializer.validated_data.get('rnc_cliente', ''),
                    razon_social=serializer.validated_data.get('razon_social_cliente', ''),
                    ncf_type=ncf_type,
                )
                if ncf_type == 'B04':
                    order = payment.order
                    order.status = 'cancelled'
                    order.save(update_fields=['status'])
            return Response(ECFDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def print_receipt(self, request, pk=None):
        payment = self.get_object()
        order = payment.order
        ecf = payment.ecf_documents.first()
        from django.conf import settings
        
        items = []
        if payment.items_json:
            for i in payment.items_json:
                items.append({
                    'cantidad': int(i['cantidad']),
                    'nombre': i['nombre'],
                    'precio': float(i['precio']),
                    'total': float(i['precio'] * i['cantidad']),
                    'modificadores': i.get('modificadores') or [],
                })
        else:
            for i in order.items.exclude(status='cancelled').all():
                items.append({
                    'cantidad': i.quantity,
                    'nombre': i.name,
                    'precio': float(i.price),
                    'total': float(i.price * i.quantity),
                    'modificadores': [m['name'] for m in (i.modifiers_json or [])],
                })
                
        return Response({
            'restaurant': settings.RESTAURANT_NAME,
            'rnc': settings.DGII_RNC,
            'direccion': 'Samaná, República Dominicana',
            'ncf': ecf.ncf if (ecf and ecf.ncf) else '',
            'metodo_pago': payment.get_method_display(),
            'mesa': order.table.number if order.table else '',
            'mesero': order.waiter.get_full_name() or order.waiter.username,
            'fecha': payment.created_at.isoformat(),
            'items': items,
            'subtotal': float(payment.subtotal),
            'itbis': float(payment.itbis),
            'propina': float(payment.propina),
            'total': float(payment.total),
            'efectivo': float(payment.cash_received) if payment.cash_received else None,
            'cambio': float(payment.change_given) if payment.change_given else None,
        })

    @action(detail=True, methods=['post'])
    def print_hardware(self, request, pk=None):
        payment = self.get_object()
        order = payment.order
        try:
            from apps.pos.utils.print_service import imprimir_ticket_pago
            imprimir_ticket_pago(payment, order)
        except Exception as e:
            return Response({'error': f'Falló la impresión física: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response({'status': 'ok'})


class ECFDocumentViewSet(mixins.RetrieveModelMixin,
                         mixins.ListModelMixin,
                         viewsets.GenericViewSet):
    queryset = ECFDocument.objects.select_related('payment__order__table', 'payment__order__waiter').all()
    serializer_class = ECFDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'ncf_type']

    @action(detail=True, methods=['post'])
    def retry(self, request, pk=None):
        doc = self.get_object()
        if doc.status not in ('rejected', 'failed'):
            return Response({'error': 'Solo se pueden reintentar documentos rechazados o fallidos'},
                            status=status.HTTP_400_BAD_REQUEST)
        doc.status = 'pending'
        doc.attempts = 0
        doc.last_error = ''
        doc.sent_at = None
        doc.save(update_fields=['status', 'attempts', 'last_error', 'sent_at'])
        return Response({'status': 'ok'})

    @action(detail=True, methods=['patch'])
    def update_rnc(self, request, pk=None):
        doc = self.get_object()
        rnc = request.data.get('rnc_cliente', '')
        if rnc and not validar_rnc(rnc):
            return Response({'error': 'RNC inválido'}, status=status.HTTP_400_BAD_REQUEST)
        doc.rnc_cliente = rnc
        doc.razon_social_cliente = request.data.get('razon_social_cliente', '')
        doc.save(update_fields=['rnc_cliente', 'razon_social_cliente'])
        return Response(ECFDocumentSerializer(doc).data)


class NCFSequenceViewSet(mixins.CreateModelMixin,
                         mixins.RetrieveModelMixin,
                         mixins.ListModelMixin,
                         mixins.UpdateModelMixin,
                         viewsets.GenericViewSet):
    queryset = NCFSequence.objects.all()
    serializer_class = NCFSequenceSerializer
    permission_classes = [permissions.IsAdminUser]
