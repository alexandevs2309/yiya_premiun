from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PaymentViewSet, ECFDocumentViewSet, NCFSequenceViewSet

router = DefaultRouter()
router.register(r'payments', PaymentViewSet)
router.register(r'ecf-documents', ECFDocumentViewSet)
router.register(r'ncf-sequences', NCFSequenceViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
