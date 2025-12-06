// Sistema de ejercicios interactivos mejorado para Manitas SV

class EjercicioInteractivo {
    constructor() {
        this.puntuacion = 0;
        this.intentos = 0;
        this.ejerciciosCompletados = 0;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadProgress();
    }

    setupEventListeners() {
        // Agregar event listeners a todas las imágenes de ejercicios
        document.querySelectorAll('.ejercicio-img').forEach(img => {
            img.addEventListener('click', (e) => this.handleAnswer(e));
        });
    }

    handleAnswer(event) {
        const img = event.currentTarget;
        const isCorrect = img.dataset.correct === 'true';
        const preguntaId = img.closest('.pregunta-container').dataset.preguntaId;
        
        // Deshabilitar todas las opciones de esta pregunta
        const preguntaContainer = img.closest('.pregunta-container');
        preguntaContainer.querySelectorAll('.ejercicio-img').forEach(option => {
            option.style.pointerEvents = 'none';
        });

        this.intentos++;

        if (isCorrect) {
            this.showSuccess(img, preguntaId);
            this.puntuacion++;
            this.ejerciciosCompletados++;
        } else {
            this.showError(img, preguntaId);
        }

        this.saveProgress();
        this.updateProgressBar();
    }

    showSuccess(element, preguntaId) {
        // Agregar clase de éxito
        element.classList.add('correct-answer');
        
        // Crear feedback visual
        const feedback = document.createElement('div');
        feedback.className = 'feedback-message feedback-success';
        feedback.innerHTML = `
            <i class="bi bi-check-circle-fill"></i>
            <span>¡Correcto! Excelente trabajo 🎉</span>
        `;
        
        const preguntaContainer = element.closest('.pregunta-container');
        preguntaContainer.appendChild(feedback);
        
        // Animación de confeti
        this.createConfetti(element);
        
        // Sonido de éxito (opcional)
        this.playSuccessSound();
        
        // Marcar pregunta como completada
        preguntaContainer.classList.add('completada');
        
        // Verificar si todas las preguntas están completadas
        setTimeout(() => {
            this.checkAllCompleted();
        }, 1500);
    }

    showError(element, preguntaId) {
        // Agregar clase de error
        element.classList.add('incorrect-answer');
        
        // Crear feedback visual
        const feedback = document.createElement('div');
        feedback.className = 'feedback-message feedback-error';
        feedback.innerHTML = `
            <i class="bi bi-x-circle-fill"></i>
            <span>No es correcto. Intentá de nuevo 💪</span>
        `;
        
        const preguntaContainer = element.closest('.pregunta-container');
        preguntaContainer.appendChild(feedback);
        
        // Resaltar la respuesta correcta después de un momento
        setTimeout(() => {
            const correctAnswer = preguntaContainer.querySelector('[data-correct="true"]');
            if (correctAnswer) {
                correctAnswer.classList.add('show-correct');
            }
        }, 2000);
        
        // Remover feedback después de 3 segundos
        setTimeout(() => {
            feedback.remove();
            element.classList.remove('incorrect-answer');
        }, 3000);
    }

    createConfetti(element) {
        const colors = ['#471396', '#303481', '#FFCC00', '#B13BFF'];
        const confettiCount = 30;
        
        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = element.offsetLeft + (element.offsetWidth / 2) + 'px';
            confetti.style.top = element.offsetTop + (element.offsetHeight / 2) + 'px';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.width = Math.random() * 8 + 4 + 'px';
            confetti.style.height = confetti.style.width;
            
            document.body.appendChild(confetti);
            
            const angle = Math.random() * Math.PI * 2;
            const velocity = Math.random() * 200 + 100;
            const x = Math.cos(angle) * velocity;
            const y = Math.sin(angle) * velocity;
            
            confetti.style.transform = `translate(${x}px, ${y}px) rotate(${Math.random() * 360}deg)`;
            confetti.style.opacity = '0';
            
            setTimeout(() => confetti.remove(), 1000);
        }
    }

    playSuccessSound() {
        // Crear un sonido de éxito simple usando Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (e) {
            // Silenciar si no hay soporte de audio
        }
    }

    checkAllCompleted() {
        const todasCompletadas = document.querySelectorAll('.pregunta-container').length === 
                                 document.querySelectorAll('.pregunta-container.completada').length;
        
        if (todasCompletadas) {
            this.showCompletionModal();
        }
    }

    showCompletionModal() {
        // Marcar lección como completada si todos los ejercicios están correctos
        const leccionId = window.location.pathname.match(/leccion(\d+)/)?.[1];
        if (leccionId) {
            const totalPreguntas = document.querySelectorAll('.pregunta-container').length;
            // Marcar como completada si todas las preguntas fueron respondidas correctamente
            if (this.puntuacion === totalPreguntas && window.sistemaProgreso) {
                window.sistemaProgreso.completarLeccion(`leccion${leccionId}`);
            }
        }

        // Agregar puntos por ejercicios completados
        if (window.sistemaProgreso) {
            window.sistemaProgreso.agregarPuntosEjercicio(this.puntuacion * 10);
        }

        const modal = document.createElement('div');
        modal.className = 'completion-modal';
        modal.innerHTML = `
            <div class="completion-modal-content">
                <div class="completion-icon">🎉</div>
                <h2>¡Felicitaciones!</h2>
                <p>Completaste todos los ejercicios</p>
                <div class="stats">
                    <div class="stat-item">
                        <span class="stat-value">${this.puntuacion}</span>
                        <span class="stat-label">Correctas</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${this.intentos}</span>
                        <span class="stat-label">Intentos</span>
                    </div>
                    ${window.sistemaProgreso ? `
                    <div class="stat-item">
                        <span class="stat-value">+${this.puntuacion * 10}</span>
                        <span class="stat-label">Puntos</span>
                    </div>
                    ` : ''}
                </div>
                <button class="btn btn-morado btn-lg mt-3" onclick="this.closest('.completion-modal').remove()">
                    Continuar
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Animación de entrada
        setTimeout(() => modal.classList.add('show'), 10);
    }

    updateProgressBar() {
        const totalPreguntas = document.querySelectorAll('.pregunta-container').length;
        const porcentaje = (this.ejerciciosCompletados / totalPreguntas) * 100;
        
        let progressBar = document.querySelector('.progress-bar-ejercicios');
        if (!progressBar) {
            const progressContainer = document.createElement('div');
            progressContainer.className = 'progress-container-ejercicios mb-4';
            progressContainer.innerHTML = `
                <div class="progress" style="height: 25px; border-radius: 15px;">
                    <div class="progress-bar progress-bar-ejercicios" 
                         role="progressbar" 
                         style="width: 0%; background: linear-gradient(90deg, #471396, #B13BFF);"
                         aria-valuenow="0" 
                         aria-valuemin="0" 
                         aria-valuemax="100">
                        <span class="progress-text">0%</span>
                    </div>
                </div>
            `;
            
            const ejerciciosSection = document.querySelector('.ejercicios-section');
            if (ejerciciosSection) {
                ejerciciosSection.insertBefore(progressContainer, ejerciciosSection.firstChild);
            }
            progressBar = document.querySelector('.progress-bar-ejercicios');
        }
        
        progressBar.style.width = porcentaje + '%';
        progressBar.setAttribute('aria-valuenow', porcentaje);
        progressBar.querySelector('.progress-text').textContent = Math.round(porcentaje) + '%';
    }

    saveProgress() {
        const progress = {
            puntuacion: this.puntuacion,
            intentos: this.intentos,
            ejerciciosCompletados: this.ejerciciosCompletados,
            timestamp: Date.now()
        };
        
        localStorage.setItem('manitas_progress', JSON.stringify(progress));
    }

    loadProgress() {
        const saved = localStorage.getItem('manitas_progress');
        if (saved) {
            const progress = JSON.parse(saved);
            this.puntuacion = progress.puntuacion || 0;
            this.intentos = progress.intentos || 0;
            this.ejerciciosCompletados = progress.ejerciciosCompletados || 0;
        }
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.ejercicio-img')) {
        new EjercicioInteractivo();
    }
});

