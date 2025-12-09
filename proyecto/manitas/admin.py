from django.contrib import admin
from .models import Perfil, SignStandard, SignStandardMedia

# Register your models here.

@admin.register(Perfil)
class PerfilAdmin(admin.ModelAdmin):
    list_display = ['user', 'image']
    search_fields = ['user__username', 'user__email']


class SignStandardMediaInline(admin.TabularInline):
    model = SignStandardMedia
    extra = 1
    fields = ('media_file', 'hand_preference', 'variant_description', 'order')
    ordering = ('order', 'id')


@admin.register(SignStandard)
class SignStandardAdmin(admin.ModelAdmin):
    list_display = ['exercise_id', 'category', 'media_type', 'is_active', 'created_at', 'get_media_count']
    list_filter = ['category', 'media_type', 'is_active', 'created_at']
    search_fields = ['exercise_id', 'description']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [SignStandardMediaInline]
    
    fieldsets = (
        ('Información del Ejercicio', {
            'fields': ('exercise_id', 'category', 'description')
        }),
        ('Archivo Multimedia (Legacy)', {
            'fields': ('media_type', 'media_file'),
            'description': 'Este campo se mantiene para compatibilidad. Usar los archivos múltiples en la sección inferior.'
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
    
    def get_media_count(self, obj):
        """Muestra la cantidad de archivos multimedia asociados"""
        return obj.media_files.count()
    get_media_count.short_description = 'Archivos'


@admin.register(SignStandardMedia)
class SignStandardMediaAdmin(admin.ModelAdmin):
    list_display = ['standard', 'hand_preference', 'variant_description', 'order', 'created_at']
    list_filter = ['hand_preference', 'standard__category', 'created_at']
    search_fields = ['standard__exercise_id', 'variant_description']
    ordering = ['standard', 'order', 'id']
