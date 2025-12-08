
// Sistema de reconocimiento de señas LESSA usando MediaPipe Hands
class ReconocimientoSenas {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.hands = null;
        this.handsReady = false;
        this.cameraActive = false;
        this.currentExercise = null;
        this.currentCategory = null;
        this.exercises = [];
        this.currentExerciseIndex = 0;
        this.detectionInterval = null;
        this.lastDetection = null;
        this.confidenceThreshold = 0.7;
        
        // Definir todas las categorías y ejercicios
        this.categories = {
            'alfabeto': {
                name: 'Alfabeto',
                exercises: this.generateAlphabetExercises()
            },
            'numeros': {
                name: 'Números',
                exercises: this.generateNumberExercises()
            },
            'departamentos': {
                name: 'Departamentos de El Salvador',
                exercises: this.generateDepartmentExercises()
            },
            'saludos': {
                name: 'Saludos Básicos',
                exercises: this.generateGreetingExercises()
            }
        };
    }
    
    generateAlphabetExercises() {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        return alphabet.split('').map(letter => ({
            id: letter,
            name: `Letra ${letter}`,
            description: `Hacé la seña de la letra ${letter}`,
            category: 'alfabeto'
        }));
    }
    
    generateNumberExercises() {
        const exercises = [];
        // Números del 1 al 10
        for (let i = 1; i <= 10; i++) {
            exercises.push({
                id: `NUM_${i}`,
                name: `Número ${i}`,
                description: `Hacé la seña del número ${i}`,
                category: 'numeros'
            });
        }
        // De 10 en 10 hasta 100
        for (let i = 20; i <= 100; i += 10) {
            exercises.push({
                id: `NUM_${i}`,
                name: `Número ${i}`,
                description: `Hacé la seña del número ${i}`,
                category: 'numeros'
            });
        }
        // 1000 y 1000000
        exercises.push(
            {
                id: 'NUM_1000',
                name: 'Número 1000',
                description: 'Hacé la seña del número 1000',
                category: 'numeros'
            },
            {
                id: 'NUM_1000000',
                name: 'Número 1,000,000',
                description: 'Hacé la seña del número 1,000,000',
                category: 'numeros'
            }
        );
        return exercises;
    }
    
    generateDepartmentExercises() {
        const departments = [
            'Ahuachapán', 'Cabañas', 'Chalatenango', 'Cuscatlán', 'La Libertad',
            'La Paz', 'La Unión', 'Morazán', 'San Miguel', 'San Salvador',
            'San Vicente', 'Santa Ana', 'Sonsonate', 'Usulután'
        ];
        return departments.map(dept => ({
            id: `DEPT_${dept.toUpperCase().replace(/\s/g, '_')}`,
            name: dept,
            description: `Hacé la seña del departamento ${dept}`,
            category: 'departamentos'
        }));
    }
    
    generateGreetingExercises() {
        return [
            { id: 'HOLA', name: 'Hola', description: 'Hacé la seña de "Hola"', category: 'saludos' },
            { id: 'BUENOS_DIAS', name: 'Buenos Días', description: 'Hacé la seña de "Buenos Días"', category: 'saludos' },
            { id: 'BUENAS_TARDES', name: 'Buenas Tardes', description: 'Hacé la seña de "Buenas Tardes"', category: 'saludos' },
            { id: 'BUENAS_NOCHES', name: 'Buenas Noches', description: 'Hacé la seña de "Buenas Noches"', category: 'saludos' },
            { id: 'ADIOS', name: 'Adiós', description: 'Hacé la seña de "Adiós"', category: 'saludos' },
            { id: 'GRACIAS', name: 'Gracias', description: 'Hacé la seña de "Gracias"', category: 'saludos' },
            { id: 'POR_FAVOR', name: 'Por Favor', description: 'Hacé la seña de "Por Favor"', category: 'saludos' }
        ];
    }

    async init() {
        // Configurar UI primero (no depende de MediaPipe)
        this.setupUI();
        
        // Cargar MediaPipe Hands en segundo plano
        this.loadMediaPipe().then(() => {
            // Inicializar Hands una sola vez cuando MediaPipe esté listo
            this.initializeHands();
        }).catch(error => {
            console.error('Error cargando MediaPipe:', error);
            const statusEl = document.getElementById('detection-status');
            if (statusEl) {
                statusEl.className = 'alert alert-warning text-center';
                statusEl.innerHTML = '<i class="bi bi-exclamation-triangle"></i> MediaPipe se está cargando. Intentá iniciar la cámara en unos segundos.';
            }
        });
    }
    
    initializeHands() {
        if (this.hands) {
            return; // Ya está inicializado
        }
        
        if (typeof Hands === 'undefined') {
            console.warn('Hands no está disponible aún');
            return;
        }
        
        try {
            // Inicializar MediaPipe Hands con locateFile mejorado
            this.hands = new Hands({
                locateFile: (file) => {
                    // Asegurar que la ruta sea correcta
                    const baseUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands';
                    // Normalizar la ruta del archivo
                    const normalizedFile = file.replace(/^\.\//, ''); // Remover ./ si existe
                    if (normalizedFile.startsWith('http://') || normalizedFile.startsWith('https://')) {
                        return normalizedFile;
                    }
                    const fullUrl = `${baseUrl}/${normalizedFile}`;
                    console.log(`MediaPipe solicitando archivo: ${fullUrl}`);
                    return fullUrl;
                }
            });

            this.hands.setOptions({
                maxNumHands: 2, // Detectar ambas manos
                modelComplexity: 1,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            this.hands.onResults((results) => {
                // Log ocasional para verificar que onResults se está llamando
                if (Math.random() < 0.01) { // Solo 1% de las veces para no saturar la consola
                    console.log('onResults llamado, manos detectadas:', results.multiHandLandmarks?.length || 0);
                }
                this.onResults(results);
            });
            
            console.log('MediaPipe Hands inicializado correctamente');
            
            // Marcar que Hands está listo después de un breve delay para que cargue assets
            setTimeout(() => {
                this.handsReady = true;
                console.log('MediaPipe Hands listo para usar');
            }, 1000);
        } catch (error) {
            console.error('Error inicializando Hands:', error);
            this.hands = null;
        }
    }

    async loadMediaPipe() {
        return new Promise((resolve, reject) => {
            // Si ya está cargado, resolver inmediatamente
            if (typeof Hands !== 'undefined' && typeof Camera !== 'undefined') {
                resolve();
                return;
            }

            // Esperar a que MediaPipe se cargue desde los scripts en el HTML
            let attempts = 0;
            const maxAttempts = 100; // 10 segundos máximo
            
            const checkLoaded = setInterval(() => {
                attempts++;
                if (typeof Hands !== 'undefined' && typeof Camera !== 'undefined') {
                    clearInterval(checkLoaded);
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkLoaded);
                    reject(new Error('Timeout cargando MediaPipe. Por favor, recargá la página.'));
                }
            }, 100);
        });
    }

    setupUI() {
        // Los elementos ya están en el HTML, solo necesitamos obtener referencias
        this.video = document.getElementById('video-senas');
        this.canvas = document.getElementById('canvas-senas');
        
        if (!this.video || !this.canvas) {
            console.error('No se encontraron los elementos video o canvas');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        
        // Configurar dimensiones iniciales del canvas
        if (this.canvas.width === 0 || this.canvas.height === 0) {
            this.canvas.width = 640;
            this.canvas.height = 480;
        }

        // Event listeners
        const btnStart = document.getElementById('btn-start-camera');
        const btnStop = document.getElementById('btn-stop-camera');
        const btnNext = document.getElementById('btn-next-exercise');
        const categorySelect = document.getElementById('category-select');
        
        if (btnStart) {
            btnStart.addEventListener('click', () => this.startCamera());
        }
        if (btnStop) {
            btnStop.addEventListener('click', () => this.stopCamera());
        }
        if (btnNext) {
            btnNext.addEventListener('click', () => this.nextExercise());
        }
        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => this.selectCategory(e.target.value));
        }
    }
    
    selectCategory(categoryId) {
        const btnStart = document.getElementById('btn-start-camera');
        const exerciseInfo = document.getElementById('exercise-info');
        
        if (!categoryId) {
            exerciseInfo.style.display = 'none';
            this.exercises = [];
            this.currentCategory = null;
            if (btnStart) btnStart.disabled = true;
            return;
        }
        
        this.currentCategory = categoryId;
        this.exercises = this.categories[categoryId].exercises;
        this.currentExerciseIndex = 0;
        this.lastDetection = null;
        
        // Mostrar información del ejercicio
        exerciseInfo.style.display = 'block';
        if (btnStart) btnStart.disabled = false;
        this.loadExercise(0);
    }

    loadExercise(index) {
        if (index >= this.exercises.length) {
            this.showCompletion();
            return;
        }

        this.currentExerciseIndex = index;
        this.currentExercise = this.exercises[index];
        
        document.getElementById('exercise-title').textContent = this.currentExercise.name;
        document.getElementById('exercise-description').textContent = this.currentExercise.description;
        document.getElementById('total-count').textContent = this.exercises.length;
        document.getElementById('completed-count').textContent = index;
        
        document.getElementById('btn-next-exercise').disabled = true;
        this.updateProgress();
    }

    async startCamera() {
        try {
            // Verificar que MediaPipe esté cargado
            if (typeof Hands === 'undefined' || typeof Camera === 'undefined') {
                // Intentar cargar MediaPipe si no está disponible
                await this.loadMediaPipe();
            }
            
            if (typeof Hands === 'undefined' || typeof Camera === 'undefined') {
                alert('MediaPipe aún se está cargando. Por favor, esperá unos segundos e intentá de nuevo.');
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });

            // Ocultar video visualmente, pero mantenerlo activo para MediaPipe
            this.video.style.display = 'none';
            this.video.style.position = 'absolute';
            this.video.style.opacity = '0';
            this.video.style.pointerEvents = 'none';
            
            const placeholder = document.getElementById('camera-placeholder');
            if (placeholder) {
                placeholder.style.display = 'none';
            }
            
            // Asegurar que el canvas sea visible
            if (this.canvas) {
                this.canvas.style.display = 'block';
                this.canvas.style.visibility = 'visible';
                
                // El canvas mostrará el video cuando comience a procesar frames
                // No necesitamos mostrar un mensaje inicial ya que el video se dibujará automáticamente
            }
            
            // Limpiar cualquier srcObject anterior
            if (this.video.srcObject) {
                this.video.srcObject.getTracks().forEach(track => track.stop());
                this.video.srcObject = null;
                // Esperar un momento para que se limpie
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Asignar el nuevo stream
            this.video.srcObject = stream;
            
            // Esperar a que los metadatos se carguen
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout esperando metadatos del video'));
                }, 5000);
                
                const onLoadedMetadata = () => {
                    clearTimeout(timeout);
                    // Asegurar que el canvas tenga las dimensiones correctas
                    this.canvas.width = this.video.videoWidth || 640;
                    this.canvas.height = this.video.videoHeight || 480;
                    console.log('Canvas configurado con dimensiones:', this.canvas.width, 'x', this.canvas.height);
                    this.video.removeEventListener('loadedmetadata', onLoadedMetadata);
                    this.video.removeEventListener('error', onError);
                    resolve();
                };
                
                const onError = (err) => {
                    clearTimeout(timeout);
                    this.video.removeEventListener('loadedmetadata', onLoadedMetadata);
                    this.video.removeEventListener('error', onError);
                    reject(err);
                };
                
                if (this.video.readyState >= 1) {
                    // Ya está cargado
                    clearTimeout(timeout);
                    onLoadedMetadata();
                } else {
                    this.video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
                    this.video.addEventListener('error', onError, { once: true });
                }
                
                // Forzar carga de metadatos si no se dispara el evento
                this.video.load();
            });
            
            // Esperar a que el video comience a reproducirse
            try {
                await this.video.play();
                console.log('Video está reproduciéndose correctamente');
            } catch (err) {
                console.error('Error al reproducir video:', err);
                // Si falla, esperar un momento y reintentar
                await new Promise(resolve => setTimeout(resolve, 300));
                try {
                    await this.video.play();
                    console.log('Video reproducido en segundo intento');
                } catch (err2) {
                    console.error('Error persistente al reproducir video:', err2);
                    throw err2;
                }
            }
            
            // Asegurar que Hands esté inicializado
            if (!this.hands) {
                this.initializeHands();
            }
            
            if (!this.hands) {
                throw new Error('No se pudo inicializar MediaPipe Hands. Por favor, recargá la página.');
            }
            
            // Esperar a que Hands esté completamente listo (cargue sus assets)
            let handsWaitAttempts = 0;
            while (!this.handsReady && handsWaitAttempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                handsWaitAttempts++;
            }
            
            if (!this.handsReady) {
                console.warn('MediaPipe Hands puede no estar completamente listo, pero continuando...');
            }

            // Esperar un momento adicional para asegurar que el video esté completamente listo
            await new Promise(resolve => setTimeout(resolve, 300));

            // Iniciar detección solo después de que el video esté completamente listo
            // Esperar a que el video tenga datos suficientes
            await new Promise(resolve => {
                const checkReady = () => {
                    if (this.video.readyState >= 3) { // HAVE_FUTURE_DATA - video tiene datos suficientes
                        resolve();
                    } else {
                        requestAnimationFrame(checkReady);
                    }
                };
                checkReady();
            });
            
            // Esperar un frame adicional para asegurar estabilidad
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            // Iniciar detección
            this.camera = new Camera(this.video, {
                onFrame: async () => {
                    // Verificar que todo esté listo antes de enviar frames
                    if (this.hands && this.video && this.video.readyState >= 3 && this.video.videoWidth > 0 && this.video.videoHeight > 0) {
                        try {
                            await this.hands.send({ image: this.video });
                        } catch (error) {
                            // Solo registrar errores críticos, ignorar errores temporales
                            if (error.message && !error.message.includes('Aborted') && !error.message.includes('Module')) {
                                console.error('Error enviando frame a MediaPipe:', error);
                            }
                        }
                    } else {
                        // Log para debugging
                        if (!this.hands) console.warn('Hands no disponible');
                        if (!this.video) console.warn('Video no disponible');
                        if (this.video && this.video.readyState < 3) console.warn('Video no listo, readyState:', this.video.readyState);
                        if (this.video && (this.video.videoWidth === 0 || this.video.videoHeight === 0)) {
                            console.warn('Dimensiones del video inválidas:', this.video.videoWidth, 'x', this.video.videoHeight);
                        }
                    }
                },
                width: 640,
                height: 480
            });
            this.camera.start();
            
            console.log('Cámara iniciada, esperando frames...');

            this.cameraActive = true;
            const btnStart = document.getElementById('btn-start-camera');
            const btnStop = document.getElementById('btn-stop-camera');
            const statusEl = document.getElementById('detection-status');
            
            if (btnStart) btnStart.disabled = true;
            if (btnStop) btnStop.disabled = false;
            if (statusEl) {
                statusEl.className = 'alert alert-success text-center';
                statusEl.innerHTML = '<i class="bi bi-check-circle"></i> Cámara activa - Mostrá tu seña';
            }

        } catch (error) {
            console.error('Error al acceder a la cámara:', error);
            const statusEl = document.getElementById('detection-status');
            if (statusEl) {
                statusEl.className = 'alert alert-danger text-center';
                statusEl.innerHTML = '<i class="bi bi-exclamation-triangle"></i> Error: ' + error.message;
            }
            alert('No se pudo acceder a la cámara. Por favor, asegurate de dar permisos de cámara.');
        }
    }

    stopCamera() {
        if (this.camera) {
            try {
                this.camera.stop();
            } catch (error) {
                console.error('Error deteniendo cámara:', error);
            }
            this.camera = null;
        }
        
        if (this.video && this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => {
                try {
                    track.stop();
                } catch (error) {
                    console.error('Error deteniendo track:', error);
                }
            });
            this.video.srcObject = null;
        }
        
        if (this.video) {
            this.video.style.display = 'none';
        }
        
        const placeholder = document.getElementById('camera-placeholder');
        if (placeholder) {
            placeholder.style.display = 'flex';
        }
        
        this.cameraActive = false;
        
        const btnStart = document.getElementById('btn-start-camera');
        const btnStop = document.getElementById('btn-stop-camera');
        const statusEl = document.getElementById('detection-status');
        
        if (btnStart) btnStart.disabled = false;
        if (btnStop) btnStop.disabled = true;
        if (statusEl) {
            statusEl.className = 'alert alert-info text-center';
            statusEl.innerHTML = '<i class="bi bi-info-circle"></i> Cámara detenida';
        }
        
        // Limpiar canvas
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    onResults(results) {
        // Verificar que el canvas y el contexto estén disponibles
        if (!this.ctx || !this.canvas || !this.video) {
            console.warn('Canvas, contexto o video no disponible en onResults');
            return;
        }
        
        // Asegurar que el canvas tenga las dimensiones correctas
        if (this.video.videoWidth > 0 && this.video.videoHeight > 0) {
            if (this.canvas.width !== this.video.videoWidth || this.canvas.height !== this.video.videoHeight) {
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
            }
        }
        
        this.ctx.save();
        
        // Dibujar el video primero (imagen de fondo)
        if (this.video.readyState >= 2) { // HAVE_CURRENT_DATA o superior
            this.ctx.drawImage(
                this.video,
                0, 0,
                this.canvas.width,
                this.canvas.height
            );
        } else {
            // Si el video no está listo, mostrar fondo negro
            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Dibujar landmarks de todas las manos detectadas
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            // Dibujar landmarks de cada mano
            results.multiHandLandmarks.forEach((landmarks, handIndex) => {
                // Usar diferentes colores para cada mano
                this.drawLandmarks(landmarks, handIndex);
            });
            
            // Reconocer seña usando la primera mano (para compatibilidad con ejercicios)
            const landmarks = results.multiHandLandmarks[0];
            const detectedSign = this.recognizeSign(landmarks);
            
            if (detectedSign) {
                this.handleDetection(detectedSign);
            }
        } else {
            // Mostrar mensaje cuando no hay manos detectadas (sobre el video)
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, this.canvas.height - 60, this.canvas.width, 60);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '18px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Mostrá tus manos frente a la cámara', this.canvas.width / 2, this.canvas.height - 20);
        }

        this.ctx.restore();
    }

    drawLandmarks(landmarks, handIndex = 0) {
        // Colores diferentes para cada mano
        const colors = [
            { stroke: '#00FF00', point: '#00FF00', wrist: '#FF0000' }, // Mano 1: Verde
            { stroke: '#00BFFF', point: '#00BFFF', wrist: '#FF1493' }  // Mano 2: Azul claro
        ];
        
        const color = colors[handIndex % colors.length];
        
        // Dibujar conexiones
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4], // Pulgar
            [0, 5], [5, 6], [6, 7], [7, 8], // Índice
            [0, 9], [9, 10], [10, 11], [11, 12], // Medio
            [0, 13], [13, 14], [14, 15], [15, 16], // Anular
            [0, 17], [17, 18], [18, 19], [19, 20], // Meñique
            [5, 9], [9, 13], [13, 17] // Base de los dedos
        ];

        this.ctx.strokeStyle = color.stroke;
        this.ctx.lineWidth = 3; // Líneas un poco más gruesas para mejor visibilidad

        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];
            this.ctx.beginPath();
            this.ctx.moveTo(startPoint.x * this.canvas.width, startPoint.y * this.canvas.height);
            this.ctx.lineTo(endPoint.x * this.canvas.width, endPoint.y * this.canvas.height);
            this.ctx.stroke();
        });

        // Dibujar puntos
        landmarks.forEach((landmark, index) => {
            this.ctx.fillStyle = index === 0 ? color.wrist : color.point;
            const pointSize = index === 0 ? 7 : 5; // Punto de muñeca más grande
            this.ctx.beginPath();
            this.ctx.arc(
                landmark.x * this.canvas.width,
                landmark.y * this.canvas.height,
                pointSize, 0, 2 * Math.PI
            );
            this.ctx.fill();
        });
    }

    recognizeSign(landmarks) {
        if (!this.currentExercise) return null;
        
        // Obtener posiciones de los dedos
        const fingerStates = this.getFingerStates(landmarks);
        
        // Reconocer según la categoría y el ejercicio actual
        const category = this.currentCategory;
        const exerciseId = this.currentExercise.id;
        
        if (category === 'alfabeto') {
            return this.recognizeAlphabet(exerciseId, fingerStates, landmarks);
        } else if (category === 'numeros') {
            return this.recognizeNumber(exerciseId, fingerStates, landmarks);
        } else if (category === 'departamentos') {
            // Para departamentos, por ahora usar reconocimiento básico
            // Esto puede expandirse con lógica específica para cada departamento
            return this.recognizeGeneric(fingerStates, landmarks);
        } else if (category === 'saludos') {
            return this.recognizeGreeting(exerciseId, fingerStates, landmarks);
        }
        
        return null;
    }
    
    recognizeAlphabet(letter, fingerStates, landmarks) {
        // Por ahora, reconocer letras básicas
        // Esto puede expandirse con lógica específica para cada letra
        switch(letter) {
            case 'A':
                return this.recognizeA(fingerStates, landmarks);
            case 'B':
                return this.recognizeB(fingerStates, landmarks);
            case 'C':
                return this.recognizeC(fingerStates, landmarks);
            default:
                // Para otras letras, usar reconocimiento genérico básico
                // En producción, esto debería tener lógica específica para cada letra
                return this.recognizeGeneric(fingerStates, landmarks);
        }
    }
    
    recognizeNumber(numberId, fingerStates, landmarks) {
        // Extraer el número del ID (ej: NUM_5 -> 5)
        const num = parseInt(numberId.replace('NUM_', ''));
        
        if (num >= 1 && num <= 5) {
            // Números del 1 al 5: dedos extendidos
            return this.recognizeNumber1to5(num, fingerStates, landmarks);
        } else if (num >= 6 && num <= 10) {
            // Números del 6 al 10: combinaciones
            return this.recognizeNumber6to10(num, fingerStates, landmarks);
        } else {
            // Números mayores: usar reconocimiento genérico
            return this.recognizeGeneric(fingerStates, landmarks);
        }
    }
    
    recognizeNumber1to5(num, fingerStates, landmarks) {
        // Números 1-5: contar dedos extendidos
        let extendedCount = 0;
        for (let i = 1; i <= 4; i++) { // Índice, Medio, Anular, Meñique
            if (fingerStates[i]) extendedCount++;
        }
        // El pulgar puede estar extendido o no dependiendo del número
        if (num === extendedCount || (num === 1 && extendedCount === 1 && !fingerStates[0])) {
            return `NUM_${num}`;
        }
        return null;
    }
    
    recognizeNumber6to10(num, fingerStates, landmarks) {
        // Números 6-10: combinaciones de ambas manos o gestos específicos
        // Por ahora, reconocimiento básico
        return this.recognizeGeneric(fingerStates, landmarks);
    }
    
    recognizeGreeting(greetingId, fingerStates, landmarks) {
        switch(greetingId) {
            case 'HOLA':
                return this.recognizeHola(fingerStates, landmarks);
            default:
                return this.recognizeGeneric(fingerStates, landmarks);
        }
    }
    
    recognizeGeneric(fingerStates, landmarks) {
        // Reconocimiento genérico básico
        // Por ahora, este es un placeholder - en producción debería tener lógica específica
        // Retornamos null para que no se detecte automáticamente
        // Esto fuerza a implementar reconocimiento específico para cada seña
        return null;
    }

    getFingerStates(landmarks) {
        // Índices de los puntos clave de cada dedo
        const fingerTips = [4, 8, 12, 16, 20]; // Pulgar, Índice, Medio, Anular, Meñique
        const fingerPips = [3, 6, 10, 14, 18]; // Articulaciones medias
        
        const states = {};
        
        fingerTips.forEach((tip, index) => {
            const tipY = landmarks[tip].y;
            const pipY = landmarks[fingerPips[index]].y;
            
            // Si la punta está por encima de la articulación, el dedo está extendido
            states[index] = tipY < pipY;
        });

        // Pulgar (especial - se compara con x)
        const thumbTipX = landmarks[4].x;
        const thumbIpX = landmarks[3].x;
        states[0] = thumbTipX > thumbIpX; // Para mano derecha

        return states;
    }

    recognizeA(fingerStates, landmarks) {
        // Letra A en LESSA: puño cerrado con pulgar al lado
        // Pulgar extendido hacia afuera, otros dedos cerrados formando puño
        const thumbExtended = fingerStates[0];
        const indexClosed = !fingerStates[1];
        const middleClosed = !fingerStates[2];
        const ringClosed = !fingerStates[3];
        const pinkyClosed = !fingerStates[4];
        
        // Verificar que el pulgar esté en posición correcta (no completamente cerrado)
        const thumbTip = landmarks[4];
        const thumbMcp = landmarks[2];
        const thumbDistance = Math.abs(thumbTip.x - thumbMcp.x) * this.canvas.width;
        
        if (thumbExtended && indexClosed && middleClosed && ringClosed && pinkyClosed && thumbDistance > 20) {
            return 'A';
        }
        return null;
    }

    recognizeB(fingerStates, landmarks) {
        // Letra B: todos los dedos extendidos excepto el pulgar (que está doblado)
        const thumbClosed = !fingerStates[0] || (landmarks[4].x < landmarks[3].x);
        const indexExtended = fingerStates[1];
        const middleExtended = fingerStates[2];
        const ringExtended = fingerStates[3];
        const pinkyExtended = fingerStates[4];
        
        if (thumbClosed && indexExtended && middleExtended && ringExtended && pinkyExtended) {
            return 'B';
        }
        return null;
    }

    recognizeC(fingerStates, landmarks) {
        // Letra C: forma de C con los dedos
        // Pulgar e índice forman una C, otros dedos pueden estar parcialmente extendidos
        if (fingerStates[0] && // Pulgar extendido
            fingerStates[1]) { // Índice extendido
            // Verificar que formen una forma de C (distancia entre pulgar e índice)
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const distance = Math.sqrt(
                Math.pow((thumbTip.x - indexTip.x) * this.canvas.width, 2) +
                Math.pow((thumbTip.y - indexTip.y) * this.canvas.height, 2)
            );
            
            if (distance > 30 && distance < 100) {
                return 'C';
            }
        }
        return null;
    }

    recognizeHola(fingerStates, landmarks) {
        // Hola: movimiento de mano o gesto específico
        // Por simplicidad, usaremos una combinación de dedos
        // En LESSA, "Hola" puede ser una mano abierta con movimiento
        if (fingerStates[1] && fingerStates[2] && fingerStates[3] && fingerStates[4]) {
            return 'HOLA';
        }
        return null;
    }

    handleDetection(detectedSign) {
        const now = Date.now();
        
        // Evitar detecciones muy frecuentes (esperar 2 segundos entre detecciones)
        if (this.lastDetection && now - this.lastDetection < 2000) {
            return;
        }
        
        this.lastDetection = now;

        if (detectedSign === this.currentExercise.id) {
            this.showSuccess();
        } else {
            // Solo mostrar error si no se ha completado el ejercicio
            if (!document.getElementById('btn-next-exercise').disabled) {
                return; // Ya se completó, no mostrar más errores
            }
            this.showError();
        }
    }

    showSuccess() {
        // Evitar múltiples éxitos
        if (!document.getElementById('btn-next-exercise').disabled) {
            return;
        }

        const statusEl = document.getElementById('detection-status');
        statusEl.className = 'alert alert-success text-center';
        statusEl.innerHTML = `
            <i class="bi bi-check-circle-fill"></i> 
            <strong>¡Correcto!</strong> Hiciste bien la seña de ${this.currentExercise.name} 🎉
        `;

        // Habilitar botón siguiente después de 2 segundos
        setTimeout(() => {
            document.getElementById('btn-next-exercise').disabled = false;
        }, 2000);

        // Reproducir sonido de éxito
        this.playSuccessSound();
        
        // Actualizar contador de completados
        const completed = parseInt(document.getElementById('completed-count').textContent) + 1;
        document.getElementById('completed-count').textContent = completed;
        this.updateProgress();
    }

    showError() {
        const statusEl = document.getElementById('detection-status');
        statusEl.className = 'alert alert-warning text-center';
        statusEl.innerHTML = `
            <i class="bi bi-exclamation-triangle-fill"></i> 
            Intentá de nuevo. Asegurate de hacer la seña correctamente.
        `;
    }

    nextExercise() {
        // Reiniciar estado
        this.lastDetection = null;
        document.getElementById('btn-next-exercise').disabled = true;
        
        this.loadExercise(this.currentExerciseIndex + 1);
        document.getElementById('detection-status').className = 'alert alert-info text-center';
        document.getElementById('detection-status').innerHTML = '<i class="bi bi-info-circle"></i> Mostrá tu seña';
    }

    updateProgress() {
        const completed = parseInt(document.getElementById('completed-count').textContent) || 0;
        const progress = (completed / this.exercises.length) * 100;
        document.getElementById('progress-bar').style.width = progress + '%';
        document.getElementById('progress-text').textContent = Math.round(progress) + '%';
    }

    showCompletion() {
        document.getElementById('exercise-info').innerHTML = `
            <div class="text-center">
                <h3 class="fw-bold" style="color: #471396;">🎉 ¡Felicitaciones!</h3>
                <p class="lead">Completaste todos los ejercicios de reconocimiento de señas</p>
                <button class="btn btn-morado btn-lg mt-3" onclick="location.reload()">
                    Reiniciar Ejercicios
                </button>
            </div>
        `;
        
        document.getElementById('detection-status').className = 'alert alert-success text-center';
        document.getElementById('detection-status').innerHTML = '<i class="bi bi-trophy-fill"></i> ¡Todos los ejercicios completados!';
    }

    playSuccessSound() {
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
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    const initReconocimiento = () => {
        const video = document.getElementById('video-senas');
        const canvas = document.getElementById('canvas-senas');
        
        if (video && canvas) {
            if (!window.reconocimientoSenas) {
                const reconocimiento = new ReconocimientoSenas();
                reconocimiento.init().catch(error => {
                    console.error('Error inicializando reconocimiento:', error);
                    const statusEl = document.getElementById('detection-status');
                    if (statusEl) {
                        statusEl.className = 'alert alert-warning text-center';
                        statusEl.innerHTML = '<i class="bi bi-exclamation-triangle"></i> MediaPipe se está cargando. Esperá unos segundos e intentá iniciar la cámara.';
                    }
                });
                window.reconocimientoSenas = reconocimiento;
            }
        } else {
            console.error('No se encontraron los elementos video o canvas');
        }
    };
    
    // Inicializar inmediatamente (la UI no depende de MediaPipe)
    initReconocimiento();
    
    // También escuchar el evento de MediaPipe listo
    window.addEventListener('mediapipe-ready', () => {
        console.log('MediaPipe está listo');
        if (window.reconocimientoSenas && !window.reconocimientoSenas.hands) {
            window.reconocimientoSenas.initializeHands();
        }
        const statusEl = document.getElementById('detection-status');
        if (statusEl && statusEl.textContent.includes('cargando')) {
            statusEl.className = 'alert alert-info text-center';
            statusEl.innerHTML = '<i class="bi bi-info-circle"></i> MediaPipe listo. Podés iniciar la cámara.';
        }
    });
});

