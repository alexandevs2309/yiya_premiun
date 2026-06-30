from datetime import timedelta
from django.db.models import Sum, Count
from django.db.models.functions import TruncHour
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.pos.models import Table, Order
from apps.billing.models import Payment, ECFDocument, NCFSequence


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard(request):
    today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    payments_today = Payment.objects.filter(created_at__gte=today_start, created_at__lt=today_end)
    orders_today = Order.objects.filter(created_at__gte=today_start, created_at__lt=today_end)

    totals = payments_today.aggregate(
        total_ventas=Sum('total') or 0,
        total_itbis=Sum('itbis') or 0,
        total_propina=Sum('propina') or 0,
        total_pagos=Count('id'),
    )

    mesas_ocupadas = Table.objects.filter(status='occupied').count()
    mesas_con_cuenta = Table.objects.filter(status='bill').count()
    ordenes_en_cocina = Order.objects.filter(status='in_kitchen').count()
    ticket_promedio = round(totals['total_ventas'] / totals['total_pagos'], 2) if totals['total_pagos'] else 0

    ecf_pendientes = ECFDocument.objects.filter(status='pending').count()
    ecf_fallidos = ECFDocument.objects.filter(status__in=('failed', 'rejected')).count()

    ncf_sequences = NCFSequence.objects.filter(is_active=True).values('ncf_type', 'current_sequence', 'valid_to')

    hourly_qs = (
        orders_today
        .annotate(hour=TruncHour('created_at'))
        .values('hour')
        .annotate(total=Count('id'))
        .order_by('hour')
    )
    hourly = []
    for entry in hourly_qs:
        h = entry['hour']
        if h:
            hourly.append({'hour': h.hour, 'orders': entry['total']})
    if not hourly:
        hourly = [{'hour': h, 'orders': 0} for h in range(8, 23)]

    recent_orders = (
        Order.objects.select_related('table', 'waiter')
        .filter(created_at__gte=today_start)
        .order_by('-created_at')[:10]
    )
    recent_payments = (
        Payment.objects.select_related('order__table', 'processed_by')
        .filter(created_at__gte=today_start)
        .order_by('-created_at')[:10]
    )

    activity = []
    for o in recent_orders:
        activity.append({
            'type': 'order',
            'description': f'Mesa {o.table.number} — {o.get_status_display()}',
            'table': o.table.number,
            'amount': None,
            'user': o.waiter.get_full_name() or o.waiter.username,
            'time': o.created_at.isoformat(),
        })
    for p in recent_payments:
        activity.append({
            'type': 'payment',
            'description': f'Mesa {p.order.table.number} — {p.get_method_display()} ${float(p.total):.2f}',
            'table': p.order.table.number,
            'amount': float(p.total),
            'user': p.processed_by.get_full_name() or p.processed_by.username if p.processed_by else '—',
            'time': p.created_at.isoformat(),
        })
    activity.sort(key=lambda x: x['time'], reverse=True)

    return Response({
        'ventas_hoy': float(totals['total_ventas']),
        'itbis_hoy': float(totals['total_itbis']),
        'propina_hoy': float(totals['total_propina']),
        'total_transacciones': totals['total_pagos'],
        'ticket_promedio': ticket_promedio,
        'mesas_ocupadas': mesas_ocupadas,
        'mesas_con_cuenta': mesas_con_cuenta,
        'total_mesas': Table.objects.count(),
        'ordenes_en_cocina': ordenes_en_cocina,
        'ecf_pendientes': ecf_pendientes,
        'ecf_fallidos': ecf_fallidos,
        'ncf_sequences': list(ncf_sequences),
        'hourly_orders': hourly,
        'activity': activity[:20],
    })
