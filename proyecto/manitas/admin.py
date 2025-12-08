from django.contrib import admin
from .models import Perfil, SignStandard

# Register your models here.

@admin.register(Perfil)
class PerfilAdmin(admin.ModelAdmin):
    list_display = ['user', 'image']
    search_fields = ['user__username', 'user__email']


@admin.register(SignStandard)
class SignStandardAdmin(admin.ModelAdmin):
    list_display = ['exercise_id', 'category', 'media_type', 'is_active', 'created_at']
    list_filter = ['category', 'media_type', 'is_active', 'created_at']
    search_fields = ['exercise_id', 'description']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Información del Ejercicio', {
            'fields': ('exercise_id', 'category', 'description')
        }),
        ('Archivo Multimedia', {
            'fields': ('media_type', 'media_file')
        }),
        ('Estado', {
            'fields': ('is_active',)
        }),
        ('Fechas', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_readonly_fields(self, request, obj=None):
        if obj:  # Si es una edición
            return self.readonly_fields + ('exercise_id', 'category', 'media_type')
        return self.readonly_fields
