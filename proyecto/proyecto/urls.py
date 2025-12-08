from django.contrib import admin
from django.urls import path
from manitas import views

from django.contrib.auth import views as auth_views
from django.urls import path, include
from manitas.views import perfil_view
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('',views.home, name='home'),
    path('home/', views.home, name="home"),
    path('diccionario/', views.diccionario_visual, name="diccionario_visual"),
    path('lecciones/', views.lecciones, name="lecciones"),
    path('registrate/', views.registrate, name="registrate"),
    path('login/', views.login_view, name="login"),
    path('perfil/', perfil_view, name='perfil'),
    path('logout/', views.logout_view, name="logout"),
    path('nosotros/', views.nosotros, name='nosotros'),
    path('contacto/', views.contacto, name='contacto'),
    
    path('leccion1/', views.leccion1, name='leccion1'),
    path('leccion2/', views.leccion2, name='leccion2'),
    path('leccion3/', views.leccion3, name='leccion3'),
    path('leccion4/', views.leccion4, name='leccion4'),

    path('ejercicios/', views.ejercicios, name='ejercicios'),
    path('admin/upload_samples/', views.upload_samples, name='upload_samples'),
    path('admin/train-signs/', views.admin_train_signs, name='admin_train_signs'),
    path('api/sign-standards/', views.api_sign_standards, name='api_sign_standards'),
    path('media/sign-video/<int:standard_id>/', views.serve_sign_video, name='serve_sign_video'),


    path('recuperar_password/', auth_views.PasswordResetView.as_view(template_name='recuperar_password.html' ),name='password_reset'),
    path('recuperar_password_done/',auth_views.PasswordResetDoneView.as_view(template_name='recuperar_password_done.html'),name='password_reset_done'),
    path('reset/<uidb64>/<token>/',auth_views.PasswordResetConfirmView.as_view(template_name='recuperar_password_confirm.html'),name='password_reset_confirm'),
    path('reset/done/',auth_views.PasswordResetCompleteView.as_view(template_name='recuperar_password_complete.html'),name='password_reset_complete'),
    path('password_change/',auth_views.PasswordChangeView.as_view(template_name='cambiar_password.html'),name='password_change'),
    path('password_change/done/',auth_views.PasswordChangeDoneView.as_view(template_name='cambiar_password_done.html'),name='password_change_done'),

    path('oauth/', include('social_django.urls', namespace='social')),
    path('registrate_google/', views.registrate_google, name='registrate_google'),

] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
