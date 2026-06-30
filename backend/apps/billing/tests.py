from django.test import TestCase


class BillingTestCase(TestCase):
    def test_itbis_calculation(self):
        subtotal = 1000.00
        itbis = round(subtotal * 0.18, 2)
        propina = round(subtotal * 0.10, 2)
        total = round(subtotal + itbis + propina, 2)
        self.assertEqual(itbis, 180.00)
        self.assertEqual(propina, 100.00)
        self.assertEqual(total, 1280.00)
