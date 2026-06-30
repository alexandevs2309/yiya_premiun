import random
from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from django.db import transaction
from datetime import date, timedelta
from apps.core.models import User
from apps.pos.models import MenuCategory, MenuItem, Table
from apps.billing.models import NCFSequence


USERS = [
    {'username': 'admin', 'password': 'admin123', 'role': 'admin', 'first_name': 'Admin', 'last_name': 'Principal', 'email': 'admin@dyiya.do'},
    {'username': 'cajero', 'password': 'cajero123', 'role': 'cashier', 'first_name': 'María', 'last_name': 'Cajera', 'email': 'cajero@dyiya.do'},
    {'username': 'mesero1', 'password': 'mesero123', 'role': 'waiter', 'first_name': 'Carlos', 'last_name': 'Mesero', 'pin': '1234', 'email': 'mesero1@dyiya.do'},
    {'username': 'mesero2', 'password': 'mesero123', 'role': 'waiter', 'first_name': 'Ana', 'last_name': 'Mesera', 'pin': '5678', 'email': 'mesero2@dyiya.do'},
    {'username': 'cocinero', 'password': 'cocinero123', 'role': 'cook', 'first_name': 'José', 'last_name': 'Cocina', 'email': 'cocinero@dyiya.do'},
]

SECTIONS = ['Interior', 'Terraza', 'Barra', 'VIP']

TABLES = [
    *[{'number': f'{i}', 'section': 'Interior', 'capacity': 2} for i in range(1, 5)],
    *[{'number': f'{i}', 'section': 'Interior', 'capacity': 4} for i in range(5, 11)],
    *[{'number': f'{i}', 'section': 'Interior', 'capacity': 6} for i in range(11, 13)],
    *[{'number': f'{i}', 'section': 'Terraza', 'capacity': 2} for i in range(13, 16)],
    *[{'number': f'{i}', 'section': 'Terraza', 'capacity': 4} for i in range(16, 20)],
    *[{'number': f'{i}', 'section': 'Barra', 'capacity': 1} for i in range(20, 26)],
    *[{'number': f'{i}', 'section': 'VIP', 'capacity': 8} for i in range(26, 28)],
    {'number': '28', 'section': 'VIP', 'capacity': 12},
]

CATEGORIES_AND_ITEMS = [
    {
        'name': 'Entradas',
        'order': 1,
        'items': [
            {'name': 'Ceviche de Camarones', 'price': 350, 'preparation_time': 10, 'itbis_type': 'gravado'},
            {'name': 'Tostones con Mojo', 'price': 180, 'preparation_time': 8, 'itbis_type': 'gravado'},
            {'name': 'Empanadas de Cangrejo (4 uds)', 'price': 280, 'preparation_time': 12, 'itbis_type': 'gravado'},
            {'name': 'Casabe con Pate de Langosta', 'price': 320, 'preparation_time': 8, 'itbis_type': 'gravado'},
            {'name': 'Sopa de Pescado', 'price': 250, 'preparation_time': 15, 'itbis_type': 'gravado'},
        ],
    },
    {
        'name': 'Pescados',
        'order': 2,
        'items': [
            {'name': 'Pescado Entero Frito (Cichla)', 'price': 650, 'preparation_time': 25, 'itbis_type': 'gravado'},
            {'name': 'Chillo al Ajillo', 'price': 720, 'preparation_time': 20, 'itbis_type': 'gravado'},
            {'name': 'Filete de Pargo a la Plancha', 'price': 580, 'preparation_time': 18, 'itbis_type': 'gravado'},
            {'name': 'Pescado al Coco', 'price': 680, 'preparation_time': 22, 'itbis_type': 'gravado'},
            {'name': 'Bacalao Guisado', 'price': 450, 'preparation_time': 15, 'itbis_type': 'gravado'},
        ],
    },
    {
        'name': 'Mariscos',
        'order': 3,
        'items': [
            {'name': 'Camaron Rebosado (10 uds)', 'price': 420, 'preparation_time': 15, 'itbis_type': 'gravado'},
            {'name': 'Langosta Thermidor', 'price': 1200, 'preparation_time': 30, 'itbis_type': 'gravado'},
            {'name': 'Pulpeta de Camarones', 'price': 380, 'preparation_time': 12, 'itbis_type': 'gravado'},
            {'name': 'Parrillada de Mariscos', 'price': 950, 'preparation_time': 25, 'itbis_type': 'gravado'},
            {'name': 'Conchitas Rellenas (6 uds)', 'price': 350, 'preparation_time': 15, 'itbis_type': 'gravado'},
        ],
    },
    {
        'name': 'Criolla',
        'order': 4,
        'items': [
            {'name': 'Moro de Guandules con Coco', 'price': 200, 'preparation_time': 15, 'itbis_type': 'exento'},
            {'name': 'Mangú con Los Tres Golpes', 'price': 280, 'preparation_time': 12, 'itbis_type': 'gravado'},
            {'name': 'Sancocho de Pescado', 'price': 350, 'preparation_time': 20, 'itbis_type': 'gravado'},
            {'name': 'La Bandera (Arroz, Habichuela, Carne)', 'price': 320, 'preparation_time': 15, 'itbis_type': 'gravado'},
            {'name': 'Yuca Frita con Mojo', 'price': 180, 'preparation_time': 10, 'itbis_type': 'exento'},
        ],
    },
    {
        'name': 'Bebidas',
        'order': 5,
        'items': [
            {'name': 'Presidente (Cerveza)', 'price': 120, 'preparation_time': 2, 'itbis_type': 'gravado'},
            {'name': 'Cuba Libre', 'price': 250, 'preparation_time': 3, 'itbis_type': 'gravado'},
            {'name': 'Piña Colada', 'price': 280, 'preparation_time': 5, 'itbis_type': 'gravado'},
            {'name': 'Jugo de Fruta Natural', 'price': 150, 'preparation_time': 3, 'itbis_type': 'exento'},
            {'name': 'Coco Frío', 'price': 100, 'preparation_time': 1, 'itbis_type': 'exento'},
            {'name': 'Agua (Botella 500ml)', 'price': 60, 'preparation_time': 1, 'itbis_type': 'exento'},
            {'name': 'Soda Nacional', 'price': 50, 'preparation_time': 1, 'itbis_type': 'exento'},
        ],
    },
    {
        'name': 'Postres',
        'order': 6,
        'items': [
            {'name': 'Flan de Coco', 'price': 180, 'preparation_time': 5, 'itbis_type': 'gravado'},
            {'name': 'Tres Leches', 'price': 200, 'preparation_time': 5, 'itbis_type': 'gravado'},
            {'name': 'Dulce de Coco', 'price': 150, 'preparation_time': 3, 'itbis_type': 'gravado'},
            {'name': 'Helado de Frutas Tropicales', 'price': 160, 'preparation_time': 2, 'itbis_type': 'gravado'},
        ],
    },
]


class Command(BaseCommand):
    help = 'Pobla la base de datos con datos iniciales (usuarios, mesas, menú)'

    def handle(self, *args, **options):
        with transaction.atomic():
            self._create_users()
            self._create_tables()
            self._create_menu()
            self._create_ncf_sequences()

        self.stdout.write(self.style.SUCCESS('Seed completado exitosamente'))
        self.stdout.write(f'  - {User.objects.count()} usuarios')
        self.stdout.write(f'  - {Table.objects.count()} mesas')
        self.stdout.write(f'  - {MenuCategory.objects.count()} categorías')
        self.stdout.write(f'  - {MenuItem.objects.count()} items en el menú')
        self.stdout.write(f'  - {NCFSequence.objects.count()} secuencias NCF')

    def _create_users(self):
        for data in USERS:
            password = data.pop('password')
            User.objects.update_or_create(
                username=data['username'],
                defaults={**data, 'password': make_password(password)},
            )
            self.stdout.write(f'  ✓ Usuario: {data["username"]} ({data["role"]})')

    def _create_tables(self):
        for data in TABLES:
            Table.objects.update_or_create(
                number=data['number'],
                defaults=data,
            )
        self.stdout.write(f'  ✓ {len(TABLES)} mesas creadas')

    def _create_menu(self):
        for cat_data in CATEGORIES_AND_ITEMS:
            items = cat_data.pop('items')
            category, _ = MenuCategory.objects.update_or_create(
                name=cat_data['name'],
                defaults=cat_data,
            )
            for item_data in items:
                MenuItem.objects.update_or_create(
                    name=item_data['name'],
                    defaults={**item_data, 'category': category},
                )
        self.stdout.write(f'  ✓ {len(CATEGORIES_AND_ITEMS)} categorías con items')

    def _create_ncf_sequences(self):
        today = date.today()
        defaults = [
            ('B01', 'A01', today, today + timedelta(days=365)),
            ('B04', 'A01', today, today + timedelta(days=365)),
            ('B14', 'A01', today, today + timedelta(days=365)),
        ]
        for ncf_type, prefix, valid_from, valid_to in defaults:
            NCFSequence.objects.get_or_create(
                ncf_type=ncf_type,
                defaults={'prefix': prefix, 'valid_from': valid_from, 'valid_to': valid_to},
            )
        self.stdout.write(f'  ✓ 3 secuencias NCF (B01, B04, B14)')
