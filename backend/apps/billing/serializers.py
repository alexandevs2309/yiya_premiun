import logging
from rest_framework import serializers
from .models import Payment, ECFDocument, NCFSequence
from .utils.rnc import validar_rnc

logger = logging.getLogger(__name__)


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['id', 'order', 'method', 'subtotal', 'itbis', 'propina',
                  'total', 'cash_received', 'change_given', 'processed_by', 'created_at']
        read_only_fields = ['processed_by']

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['processed_by'] = request.user
        payment = super().create(validated_data)
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
