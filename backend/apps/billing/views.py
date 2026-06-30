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
                doc = generar_ecf(
                    payment,
                    rnc_cliente=serializer.validated_data.get('rnc_cliente', ''),
                    razon_social=serializer.validated_data.get('razon_social_cliente', ''),
                    ncf_type=serializer.validated_data.get('ncf_type', 'B01'),
                )
            return Response(ECFDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


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
