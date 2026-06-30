import logging
from rest_framework import serializers
from .models import Payment, ECFDocument, NCFSequence
from .utils.rnc import validar_rnc

logger = logging.getLogger(__name__)


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['id', 'order', 'method', 'subtotal', 'itbis', 'propina',
                  'total', 'cash_received', 'change_given', 'processed_by', 'items_json',
                  'employee', 'deduct_from_payroll', 'created_at']
        read_only_fields = ['processed_by']

    def validate(self, data):
        subtotal = data.get('subtotal')
        itbis = data.get('itbis')
        propina = data.get('propina')
        total = data.get('total')
        if subtotal is not None and itbis is not None and propina is not None and total is not None:
            from decimal import Decimal, ROUND_HALF_UP
            expected_itbis = (subtotal * Decimal('0.18')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            expected_propina = (subtotal * Decimal('0.10')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            expected_total = subtotal + expected_itbis + expected_propina
            tolerance = Decimal('0.02')
            if abs(itbis - expected_itbis) > tolerance:
                raise serializers.ValidationError({'itbis': f'ITBIS incorrecto. Esperado: {expected_itbis}'})
            if abs(propina - expected_propina) > tolerance:
                raise serializers.ValidationError({'propina': f'Propina incorrecta. Esperada: {expected_propina}'})
            if abs(total - expected_total) > tolerance:
                raise serializers.ValidationError({'total': f'Total incorrecto. Esperado: {expected_total}'})
        return data

    def create(self, validated_data):
        from django.db import transaction
        from decimal import Decimal
        from apps.pos.models import Order
        from apps.core.models import AuditLog

        request = self.context.get('request')
        order = validated_data['order']

        if order.status in ('paid', 'cancelled'):
            raise serializers.ValidationError({'order': 'La orden ya está cerrada o cancelada.'})

        if request and request.user.is_authenticated:
            validated_data['processed_by'] = request.user

        with transaction.atomic():
            payment = Payment.objects.create(**validated_data)

            # Sumar todos los pagos asociados a esta orden
            existing_payments_total = sum(p.total for p in order.payments.all())

            # Calcular el total de la orden basándonos en los ítems activos (no cancelados)
            active_items = order.items.exclude(status='cancelled')
            order_subtotal = sum(item.price * item.quantity for item in active_items)
            order_total = order_subtotal + (order_subtotal * Decimal('0.18')) + (order_subtotal * Decimal('0.10'))

            # Si el total acumulado cubre el costo de la orden, la cerramos
            if existing_payments_total >= (order_total - Decimal('0.05')):
                order.status = 'paid'
                order.save(update_fields=['status'])
                order.table.status = 'available'
                order.table.save(update_fields=['status'])

                try:
                    from apps.inventory.utils.stock_helper import deduct_order_stock
                    deduct_order_stock(order)
                except Exception as e:
                    logger.warning(f'No se pudo descontar stock de inventario para orden {order.id}: {e}')

            if request and request.user.is_authenticated:
                AuditLog.objects.create(
                    user=request.user,
                    action='payment',
                    model_name='Payment',
                    object_id=str(payment.id),
                    description=f'Pago registrado: Mesa {order.table.number} — {payment.get_method_display()} ${float(payment.total):.2f}',
                )

            try:
                from .utils.ecf import generar_ecf
                generar_ecf(payment)
            except Exception as e:
                logger.warning(f'No se pudo generar e-CF automático para pago {payment.id.hex[:8]}: {e}')

        return payment


class NCFSequenceSerializer(serializers.ModelSerializer):
    next_ncf = serializers.SerializerMethodField()

    class Meta:
        model = NCFSequence
        fields = ['id', 'ncf_type', 'prefix', 'current_sequence', 'next_ncf',
                  'valid_from', 'valid_to', 'is_active']
        read_only_fields = ['current_sequence', 'next_ncf']

    def get_next_ncf(self, obj):
        return str(obj)


class ECFDocumentSerializer(serializers.ModelSerializer):
    order_id = serializers.SerializerMethodField()
    table_number = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()

    class Meta:
        model = ECFDocument
        fields = ['id', 'payment', 'order_id', 'table_number', 'ncf', 'ncf_type',
                  'rnc_cliente', 'razon_social_cliente', 'status', 'attempts',
                  'last_error', 'total', 'created_at', 'sent_at']
        read_only_fields = ['status', 'attempts', 'last_error', 'created_at', 'sent_at']

    def get_order_id(self, obj):
        return str(obj.payment.order_id)

    def get_table_number(self, obj):
        return obj.payment.order.table.number

    def get_total(self, obj):
        return float(obj.payment.total)


class ECFDocumentCreateSerializer(serializers.Serializer):
    rnc_cliente = serializers.CharField(max_length=11, required=False, default='')
    razon_social_cliente = serializers.CharField(max_length=150, required=False, default='')
    ncf_type = serializers.ChoiceField(choices=NCFSequence.NCF_TYPES, default='B01')

    def validate_rnc_cliente(self, value):
        if value and not validar_rnc(value):
            raise serializers.ValidationError('RNC inválido')
        return value
