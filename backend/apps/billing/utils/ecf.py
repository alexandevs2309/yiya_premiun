import logging
from decimal import Decimal
from datetime import datetime
from django.conf import settings
from apps.billing.models import Payment, ECFDocument, NCFSequence

logger = logging.getLogger(__name__)


def generar_ecf(payment: Payment, rnc_cliente: str = '', razon_social: str = '', ncf_type: str = 'B01') -> ECFDocument:
    order = payment.order
    seq = NCFSequence.objects.filter(ncf_type=ncf_type, is_active=True).first()
    if not seq:
        raise ValueError(f'No hay secuencia NCF activa para {ncf_type}')

    ncf = seq.next_ncf()

    items = []
    for oi in order.items.select_related('menu_item').all():
        gravado = oi.price * Decimal('0.18')
        items.append({
            'cantidad': oi.quantity,
            'descripcion': oi.name,
            'precio_unitario': float(oi.price),
            'monto': float(oi.price * oi.quantity),
            'itbis': float(gravado * oi.quantity),
            'itbis_type': getattr(oi.menu_item, 'itbis_type', 'gravado') if oi.menu_item else 'gravado',
        })

    payload = {
        'encabezado': {
            'rnc_emisor': settings.DGII_RNC,
            'rnc_comprador': rnc_cliente or '000000000',
            'razon_social_comprador': razon_social or 'Consumidor Final',
            'ncf': ncf,
            'ncf_type': ncf_type,
            'fecha_emision': datetime.now().isoformat(),
            'moneda': 'DOP',
            'tipo_cambio': 1,
        },
        'detalles': items,
        'totales': {
            'subtotal': float(payment.subtotal),
            'itbis': float(payment.itbis),
            'propina': float(payment.propina),
            'total': float(payment.total),
        },
    }

    doc = ECFDocument.objects.create(
        payment=payment,
        ncf=ncf,
        ncf_type=ncf_type,
        rnc_cliente=rnc_cliente,
        razon_social_cliente=razon_social,
        json_payload=payload,
        status='pending',
    )
    logger.info(f'e-CF creado: {ncf} para pago {payment.id.hex[:8]}')
    return doc
