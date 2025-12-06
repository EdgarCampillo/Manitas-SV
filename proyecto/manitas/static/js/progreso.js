// Sistema de progreso y gamificación para Manitas SV

class SistemaProgreso {
    constructor() {
        this.progreso = this.cargarProgreso();
        this.init();
    }

    init() {
        this.actualizarBadges();
        this.actualizarBarraProgreso();
        this.verificarLogros();
    }

    cargarProgreso() {
        const guardado = localStorage.getItem('manitas_progreso_completo');
        if (guardado) {
            return JSON.parse(guardado);
        }
        return {
            lecciones: {
                leccion1: { completada: false, puntuacion: 0 },
                leccion2: { completada: false, puntuacion: 0 },
                leccion3: { completada: false, puntuacion: 0 },
                leccion4: { completada: false, puntuacion: 0 }
            },
            ejerciciosCompletados: 0,
            puntosTotales: 0,
            logros: []
        };
    }

    guardarProgreso() {
        localStorage.setItem('manitas_progreso_completo', JSON.stringify(this.progreso));
    }

    completarLeccion(leccionId) {
        if (!this.progreso.lecciones[leccionId]) {
            this.progreso.lecciones[leccionId] = { completada: false, puntuacion: 0 };
        }
        
        this.progreso.lecciones[leccionId].completada = true;
        this.progreso.puntosTotales += 100;
        this.guardarProgreso();
        this.actualizarBadges();
        this.verificarLogros();
    }

    agregarPuntosEjercicio(puntos) {
        this.progreso.ejerciciosCompletados++;
        this.progreso.puntosTotales += puntos;
        this.guardarProgreso();
        this.actualizarBarraProgreso();
    }

    actualizarBadges() {
        const badges = document.querySelectorAll('.badge-progreso');
        badges.forEach(badge => {
            const leccionId = badge.dataset.leccion;
            if (this.progreso.lecciones[leccionId]?.completada) {
                badge.innerHTML = '<i class="bi bi-check-circle-fill"></i> Completada';
                badge.classList.remove('bg-secondary');
                badge.classList.add('bg-success');
            }
        });
    }

    actualizarBarraProgreso() {
        const barra = document.querySelector('.barra-progreso-global');
        if (!barra) return;

        const totalLecciones = Object.keys(this.progreso.lecciones).length;
        const leccionesCompletadas = Object.values(this.progreso.lecciones)
            .filter(l => l.completada).length;
        
        const porcentaje = (leccionesCompletadas / totalLecciones) * 100;
        
        barra.style.width = porcentaje + '%';
        barra.setAttribute('aria-valuenow', porcentaje);
        
        const texto = barra.querySelector('.progreso-texto');
        if (texto) {
            texto.textContent = `${leccionesCompletadas}/${totalLecciones} lecciones`;
        }

        // Actualizar contador de puntos
        const contadorPuntos = document.querySelector('.contador-puntos');
        if (contadorPuntos) {
            contadorPuntos.textContent = this.progreso.puntosTotales;
        }
    }

    verificarLogros() {
        const logros = [
            {
                id: 'primera_leccion',
                nombre: 'Primer Paso',
                descripcion: 'Completaste tu primera lección',
                condicion: () => Object.values(this.progreso.lecciones).filter(l => l.completada).length >= 1
            },
            {
                id: 'estudiante_dedicado',
                nombre: 'Estudiante Dedicado',
                descripcion: 'Completaste 2 lecciones',
                condicion: () => Object.values(this.progreso.lecciones).filter(l => l.completada).length >= 2
            },
            {
                id: 'experto_lessa',
                nombre: 'Experto LESSA',
                descripcion: 'Completaste todas las lecciones',
                condicion: () => Object.values(this.progreso.lecciones).every(l => l.completada)
            },
            {
                id: 'practicante',
                nombre: 'Practicante',
                descripcion: 'Completaste 10 ejercicios',
                condicion: () => this.progreso.ejerciciosCompletados >= 10
            }
        ];

        logros.forEach(logro => {
            if (logro.condicion() && !this.progreso.logros.includes(logro.id)) {
                this.progreso.logros.push(logro.id);
                this.mostrarLogro(logro);
            }
        });

        this.guardarProgreso();
    }

    // Verificar si una lección está desbloqueada (solo para mostrar progreso, no bloquea)
    leccionDesbloqueada(leccionId) {
        if (leccionId === 'leccion1') {
            return true; // La primera lección siempre está desbloqueada
        }
        
        const leccionNumero = parseInt(leccionId.replace('leccion', ''));
        const leccionAnterior = `leccion${leccionNumero - 1}`;
        
        return this.progreso.lecciones[leccionAnterior]?.completada || false;
    }

    mostrarLogro(logro) {
        const notificacion = document.createElement('div');
        notificacion.className = 'notificacion-logro';
        notificacion.innerHTML = `
            <div class="notificacion-logro-contenido">
                <div class="notificacion-icono">🏆</div>
                <div class="notificacion-texto">
                    <h5>¡Logro Desbloqueado!</h5>
                    <p><strong>${logro.nombre}</strong></p>
                    <small>${logro.descripcion}</small>
                </div>
            </div>
        `;
        
        document.body.appendChild(notificacion);
        
        setTimeout(() => notificacion.classList.add('mostrar'), 10);
        setTimeout(() => {
            notificacion.classList.remove('mostrar');
            setTimeout(() => notificacion.remove(), 500);
        }, 4000);
    }

    obtenerEstadisticas() {
        const leccionesCompletadas = Object.values(this.progreso.lecciones)
            .filter(l => l.completada).length;
        
        return {
            leccionesCompletadas,
            totalLecciones: Object.keys(this.progreso.lecciones).length,
            ejerciciosCompletados: this.progreso.ejerciciosCompletados,
            puntosTotales: this.progreso.puntosTotales,
            logros: this.progreso.logros.length
        };
    }

    // Actualizar estado visual de lecciones (solo mostrar progreso, no bloquear)
    actualizarEstadoLecciones() {
        const badges = document.querySelectorAll('.badge-progreso');
        
        badges.forEach(badge => {
            const leccionId = badge.dataset.leccion;
            if (leccionId) {
                const leccion = this.progreso.lecciones[leccionId];
                
                if (leccion?.completada) {
                    badge.innerHTML = '<i class="bi bi-check-circle-fill"></i> Completada';
                    badge.classList.remove('bg-secondary');
                    badge.classList.add('bg-success');
                } else if (this.leccionDesbloqueada(leccionId)) {
                    badge.innerHTML = '<i class="bi bi-unlock"></i> Disponible';
                    badge.classList.remove('bg-success');
                    badge.classList.add('bg-info');
                } else {
                    badge.innerHTML = '<i class="bi bi-circle"></i> Pendiente';
                    badge.classList.remove('bg-success', 'bg-info');
                    badge.classList.add('bg-secondary');
                }
            }
        });
    }
}

// Inicializar sistema de progreso
let sistemaProgreso;

document.addEventListener('DOMContentLoaded', () => {
    sistemaProgreso = new SistemaProgreso();
    window.sistemaProgreso = sistemaProgreso; // Hacer disponible globalmente
    
    // Actualizar estado de lecciones en la página de lecciones (solo para mostrar progreso)
    if (window.location.pathname.includes('lecciones') || window.location.pathname === '/') {
        sistemaProgreso.actualizarEstadoLecciones();
    }
});

// Función global para marcar lección como completada
function marcarLeccionCompletada(leccionId) {
    if (sistemaProgreso) {
        sistemaProgreso.completarLeccion(leccionId);
    }
}

