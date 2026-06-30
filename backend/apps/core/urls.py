from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import UserViewSet, CustomerViewSet, AuditLogViewSet, EmployeeShiftViewSet, PayrollPaymentViewSet, pin_login
from .health import health

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'customers', CustomerViewSet)
router.register(r'audit-logs', AuditLogViewSet)
router.register(r'shifts', EmployeeShiftViewSet)
router.register(r'payroll', PayrollPaymentViewSet)

urlpatterns = [
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('pin-login/', pin_login, name='pin_login'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('health/', health, name='health'),
    path('', include(router.urls)),
]
