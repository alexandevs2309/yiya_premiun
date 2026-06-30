from rest_framework import viewsets, permissions, status, mixins
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, Customer, AuditLog
from .serializers import (
    UserSerializer, UserCreateSerializer, UserUpdateSerializer, CustomerSerializer, AuditLogSerializer
)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def pin_login(request):
    pin = request.data.get('pin', '').strip()
    if not pin or not pin.isdigit() or len(pin) < 4:
        return Response({'detail': 'PIN inválido'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(pin=pin, is_active=True)
    except User.DoesNotExist:
        return Response({'detail': 'PIN incorrecto'}, status=status.HTTP_401_UNAUTHORIZED)

    refresh = RefreshToken.for_user(user)
    AuditLog.objects.create(
        user=user,
        action='login',
        model_name='User',
        object_id=str(user.id),
        description=f'Inicio de sesión con PIN: {user.get_full_name() or user.username}',
    )

    from .serializers import UserSerializer
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserSerializer(user).data,
    })


class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


class UserViewSet(mixins.ListModelMixin,
                  mixins.RetrieveModelMixin,
                  mixins.CreateModelMixin,
                  mixins.UpdateModelMixin,
                  mixins.DestroyModelMixin,
                  viewsets.GenericViewSet):
    queryset = User.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ('create',):
            return UserCreateSerializer
        if self.action in ('partial_update', 'update'):
            return UserUpdateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'me'):
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsAdminUser()]

    def perform_create(self, serializer):
        user = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='create',
            model_name='User',
            object_id=str(user.id),
            description=f'Usuario creado: {user.username}',
        )

    def perform_update(self, serializer):
        user = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action='update',
            model_name='User',
            object_id=str(user.id),
            description=f'Usuario actualizado: {user.username}',
        )

    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            action='delete',
            model_name='User',
            object_id=str(instance.id),
            description=f'Usuario eliminado: {instance.username}',
        )
        instance.delete()

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ['rnc', 'business_name', 'commercial_name', 'phone']


class AuditLogViewSet(mixins.ListModelMixin,
                      mixins.RetrieveModelMixin,
                      viewsets.GenericViewSet):
    queryset = AuditLog.objects.select_related('user').all()
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    filterset_fields = ['action', 'model_name']
    ordering = ['-created_at']
