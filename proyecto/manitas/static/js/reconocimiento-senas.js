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
        this.confidenceThreshold = 0.6; // 60% de similaridad requerida
        this.signStandards = {}; // Almacenar estándares cargados desde el servidor
        this.isAdmin = false; // Se establecerá desde el template
        this.lastCorrectDetection = false; // Para cambiar color cuando se detecta correctamente
        
        // Estado para entrenamiento y clasificación cliente-side
        this.samples = {};
        this.trainingMode = false;
        this.trainingCollecting = false;
        this.trainingLabel = null;
        this.trainingBuffer = [];
        this.trainingFramesToCollect = 12;
        this.knnK = 3;
        this.minSamplesPerSign = 5;
        
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

    async processMediaFile(file) {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        const label = prompt("Ingresá el label para esta muestra (ej: A, NUM_3, HOLA):");
        if (!label) return;

        if (isImage) {
            const img = new Image();
            img.onload = async () => {
            await this.hands.send({ image: img });
            // El resultado se procesa en onResults
            this.trainingLabel = label;
            this.trainingCollecting = true;
            this.trainingBuffer = [];
            };
            img.src = URL.createObjectURL(file);
        }

        if (isVideo) {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            video.muted = true;
            video.play();

            let frameCount = 0;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const captureFrame = async () => {
            if (frameCount >= this.trainingFramesToCollect) {
                video.pause();
                return;
            }

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            await this.hands.send({ image: canvas });
            this.trainingLabel = label;
            this.trainingCollecting = true;
            frameCount++;
            setTimeout(captureFrame, 300); // cada 300ms
            };

            video.onloadeddata = () => {
            captureFrame();
            };
        }
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
        for (let i = 1; i <= 10; i++) {
            exercises.push({
                id: `NUM_${i}`,
                name: `Número ${i}`,
                description: `Hacé la seña del número ${i}`,
                category: 'numeros'
            });
        }
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
        this.setupUI();
        this.loadMediaPipe().then(() => {
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
        if (this.hands) return;
        
        if (typeof Hands === 'undefined') {
            console.warn('Hands no está disponible aún');
            return;
        }
        
        try {
            this.hands = new Hands({
                locateFile: (file) => {
                    const baseUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands';
                    const normalizedFile = file.replace(/^\.\//, '');
                    if (normalizedFile.startsWith('http://') || normalizedFile.startsWith('https://')) {
                        return normalizedFile;
                    }
                    return `${baseUrl}/${normalizedFile}`;
                }
            });

            this.hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            this.hands.onResults((results) => {
                this.onResults(results);
            });
            
            console.log('MediaPipe Hands inicializado correctamente');
            
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
            if (typeof Hands !== 'undefined' && typeof Camera !== 'undefined') {
                resolve();
                return;
            }

            let attempts = 0;
            const maxAttempts = 100;
            
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
        this.video = document.getElementById('video-senas');
        this.canvas = document.getElementById('canvas-senas');
        
        if (!this.video || !this.canvas) {
            console.error('No se encontraron los elementos video o canvas');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        
        if (this.canvas.width === 0 || this.canvas.height === 0) {
            this.canvas.width = 640;
            this.canvas.height = 480;
        }

        const btnStart = document.getElementById('btn-start-camera');
        const btnStop = document.getElementById('btn-stop-camera');
        const btnNext = document.getElementById('btn-next-exercise');
        const btnPrev = document.getElementById('btn-prev-exercise');
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
        if (btnPrev) {
            btnPrev.addEventListener('click', () => this.prevExercise());
        }
        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => this.selectCategory(e.target.value));
        }
    }
    
    async selectCategory(categoryId) {
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
        this.lastDetection = null;
        
        // Cargar estándares desde el servidor
        await this.loadStandardsForCategory(categoryId);
        
        // Intentar cargar progreso guardado para esta categoría
        const savedProgress = this.loadProgress(categoryId);
        const startIndex = savedProgress !== null ? savedProgress : 0;
        
        this.currentExerciseIndex = startIndex;
        
        exerciseInfo.style.display = 'block';
        if (btnStart) btnStart.disabled = false;
        
        // Mostrar información sobre entrenamiento
        const trainingInfo = document.getElementById('training-info');
        if (trainingInfo) {
            trainingInfo.style.display = 'block';
        }
        
        this.loadExercise(startIndex);
    }
    
    async loadStandardsForCategory(categoryId) {
        try {
            const response = await fetch(`/api/sign-standards/?category=${categoryId}`);
            const data = await response.json();
            
            // Limpiar estándares anteriores de esta categoría
            Object.keys(this.signStandards).forEach(key => {
                if (key.startsWith(categoryId + '_')) {
                    delete this.signStandards[key];
                }
            });
            
            // Almacenar nuevos estándares con todos sus archivos
            if (data.standards) {
                data.standards.forEach(std => {
                    const key = `${std.category}_${std.exercise_id}`;
                    this.signStandards[key] = {
                        id: std.id,
                        exercise_id: std.exercise_id,
                        category: std.category,
                        media_type: std.media_type,
                        media_url: std.media_url,
                        description: std.description,
                        media_files: std.media_files || []  // Incluir todos los archivos
                    };
                });
            }
        } catch (error) {
            console.error('Error cargando estándares:', error);
        }
    }

    loadExercise(index) {
        if (index < 0) {
            index = 0;
        }
        
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
        
        // Habilitar/deshabilitar botones de navegación
        const btnNext = document.getElementById('btn-next-exercise');
        const btnPrev = document.getElementById('btn-prev-exercise');
        
        if (btnNext) btnNext.disabled = true;
        if (btnPrev) btnPrev.disabled = (index === 0);
        
        this.updateProgress();
        
        // Guardar progreso
        this.saveProgress();
        
        // Ocultar estándar de referencia (solo se usa como base)
        this.displayStandardReference();
    }
    
    displayStandardReference() {
        // Las referencias están ocultas - solo se usan como base para el reconocimiento
        // No se muestran visualmente al usuario
        const standardRef = document.getElementById('standard-reference');
        if (standardRef) {
            standardRef.style.display = 'none';
        }
    }

    async startCamera() {
        try {
            if (typeof Hands === 'undefined' || typeof Camera === 'undefined') {
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

            this.video.style.display = 'none';
            this.video.style.position = 'absolute';
            this.video.style.opacity = '0';
            this.video.style.pointerEvents = 'none';
            
            const placeholder = document.getElementById('camera-placeholder');
            if (placeholder) {
                placeholder.style.display = 'none';
            }
            
            if (this.canvas) {
                this.canvas.style.display = 'block';
                this.canvas.style.visibility = 'visible';
            }
            
            if (this.video.srcObject) {
                this.video.srcObject.getTracks().forEach(track => track.stop());
                this.video.srcObject = null;
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            this.video.srcObject = stream;
            
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout esperando metadatos del video'));
                }, 5000);
                
                const onLoadedMetadata = () => {
                    clearTimeout(timeout);
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
                    clearTimeout(timeout);
                    onLoadedMetadata();
                } else {
                    this.video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
                    this.video.addEventListener('error', onError, { once: true });
                }
                
                this.video.load();
            });
            
            try {
                await this.video.play();
                console.log('Video está reproduciéndose correctamente');
            } catch (err) {
                console.error('Error al reproducir video:', err);
                await new Promise(resolve => setTimeout(resolve, 300));
                try {
                    await this.video.play();
                    console.log('Video reproducido en segundo intento');
                } catch (err2) {
                    console.error('Error persistente al reproducir video:', err2);
                    throw err2;
                }
            }
            
            if (!this.hands) {
                this.initializeHands();
            }
            
            if (!this.hands) {
                throw new Error('No se pudo inicializar MediaPipe Hands. Por favor, recargá la página.');
            }
            
            let handsWaitAttempts = 0;
            while (!this.handsReady && handsWaitAttempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                handsWaitAttempts++;
            }
            
            if (!this.handsReady) {
                console.warn('MediaPipe Hands puede no estar completamente listo, pero continuando...');
            }

            await new Promise(resolve => setTimeout(resolve, 300));

            await new Promise(resolve => {
                const checkReady = () => {
                    if (this.video.readyState >= 3) {
                        resolve();
                    } else {
                        requestAnimationFrame(checkReady);
                    }
                };
                checkReady();
            });
            
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            this.camera = new Camera(this.video, {
                onFrame: async () => {
                    if (this.hands && this.video && this.video.readyState >= 3 && this.video.videoWidth > 0 && this.video.videoHeight > 0) {
                        try {
                            await this.hands.send({ image: this.video });
                        } catch (error) {
                            if (error.message && !error.message.includes('Aborted') && !error.message.includes('Module')) {
                                console.error('Error enviando frame a MediaPipe:', error);
                            }
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
        
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    onResults(results) {
        if (!this.ctx || !this.canvas || !this.video) {
            console.warn('Canvas, contexto o video no disponible en onResults');
            return;
        }
        
        if (this.video.videoWidth > 0 && this.video.videoHeight > 0) {
            if (this.canvas.width !== this.video.videoWidth || this.canvas.height !== this.video.videoHeight) {
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
            }
        }
        
        this.ctx.save();
        
        if (this.video.readyState >= 2) {
            this.ctx.drawImage(
                this.video,
                0, 0,
                this.canvas.width,
                this.canvas.height
            );
        } else {
            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            results.multiHandLandmarks.forEach((landmarks, handIndex) => {
                this.drawLandmarks(landmarks, handIndex);
            });
            
            const landmarks = results.multiHandLandmarks[0];

            // Entrenamiento: capturar features
            if (this.trainingCollecting && this.trainingLabel) {
                const feat = this.extractFeatures(landmarks);
                this.trainingBuffer.push(feat);
                if (this.trainingBuffer.length >= this.trainingFramesToCollect) {
                    const avg = this.averageFeatureBuffer(this.trainingBuffer);
                    this.addSample(this.trainingLabel, avg);
                    this.trainingCollecting = false;
                    this.trainingBuffer = [];
                    const statusEl = document.getElementById('detection-status');
                    if (statusEl && this.isAdmin) {
                        // Solo mostrar mensaje de muestra guardada para admins
                        statusEl.className = 'alert alert-success text-center';
                        statusEl.innerHTML = `<i class="bi bi-check-circle-fill"></i> Muestra guardada para ${this.trainingLabel} (solo visible para admin)`;
                    }
                } else {
                    const statusEl = document.getElementById('detection-status');
                    if (statusEl && this.isAdmin) {
                        // Solo mostrar progreso de recolección para admins
                        statusEl.className = 'alert alert-info text-center';
                        statusEl.innerHTML = `<i class="bi bi-hourglass-split"></i> Recolectando muestra ${this.trainingBuffer.length}/${this.trainingFramesToCollect} para ${this.trainingLabel}`;
                    }
                }
            }

            // Clasificación - SOLO usar muestras de entrenamiento
            let detectedSign = null;
            try {
                detectedSign = this.classifyFromSamples(landmarks);
            } catch (e) {
                console.error('Error en clasificación desde muestras:', e);
                detectedSign = null;
            }

            // Verificar si la detección es correcta (coincide con el ejercicio actual)
            this.lastCorrectDetection = false;
            if (detectedSign && this.currentExercise && detectedSign === this.currentExercise.id) {
                this.lastCorrectDetection = true;
            }

            if (detectedSign) {
                this.handleDetection(detectedSign);
            }
        } else {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, this.canvas.height - 60, this.canvas.width, 60);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '18px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('', this.canvas.width / 2, this.canvas.height - 20);
        }

        this.ctx.restore();
    }

    drawLandmarks(landmarks, handIndex = 0) {
        // Colores por defecto: rojo para puntos y líneas
        const defaultColors = [
            { stroke: '#FF0000', point: '#FF0000', wrist: '#FF0000' },
            { stroke: '#FF4444', point: '#FF4444', wrist: '#FF0000' }
        ];
        
        // Colores cuando la detección es correcta: verde
        const successColors = [
            { stroke: '#00FF00', point: '#00FF00', wrist: '#00FF00' },
            { stroke: '#00FF88', point: '#00FF88', wrist: '#00FF00' }
        ];
        
        // Usar verde si la última detección fue correcta, sino rojo
        const colorSet = this.lastCorrectDetection ? successColors : defaultColors;
        const color = colorSet[handIndex % colorSet.length];
        
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],
            [0, 5], [5, 6], [6, 7], [7, 8],
            [0, 9], [9, 10], [10, 11], [11, 12],
            [0, 13], [13, 14], [14, 15], [15, 16],
            [0, 17], [17, 18], [18, 19], [19, 20],
            [5, 9], [9, 13], [13, 17]
        ];

        this.ctx.strokeStyle = color.stroke;
        this.ctx.lineWidth = 3;

        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];
            this.ctx.beginPath();
            this.ctx.moveTo(startPoint.x * this.canvas.width, startPoint.y * this.canvas.height);
            this.ctx.lineTo(endPoint.x * this.canvas.width, endPoint.y * this.canvas.height);
            this.ctx.stroke();
        });

        landmarks.forEach((landmark, index) => {
            this.ctx.fillStyle = index === 0 ? color.wrist : color.point;
            const pointSize = index === 0 ? 7 : 5;
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
        
        // Usar SOLO el sistema de clasificación basado en muestras de entrenamiento
        // NO usar lógica hardcodeada
        return this.classifyFromSamples(landmarks);
    }

    getFingerStates(landmarks) {
        const fingerTips = [4, 8, 12, 16, 20];
        const fingerPips = [3, 6, 10, 14, 18];
        
        const states = {};
        
        fingerTips.forEach((tip, index) => {
            const tipY = landmarks[tip].y;
            const pipY = landmarks[fingerPips[index]].y;
            states[index] = tipY < pipY;
        });

        const thumbTipX = landmarks[4].x;
        const thumbIpX = landmarks[3].x;
        states[0] = thumbTipX > thumbIpX;

        return states;
    }

    // Métodos de reconocimiento hardcodeado ELIMINADOS
    // Ahora todo el reconocimiento se basa en los estándares y muestras de entrenamiento

    handleDetection(detectedSign) {
        const now = Date.now();
        
        if (this.lastDetection && now - this.lastDetection < 2000) {
            return;
        }
        
        this.lastDetection = now;

        if (detectedSign === this.currentExercise.id) {
            this.showSuccess();
        } else {
            if (!document.getElementById('btn-next-exercise').disabled) {
                return;
            }
            this.showError();
        }
    }

    showSuccess() {
        if (!document.getElementById('btn-next-exercise').disabled) {
            return;
        }

        const statusEl = document.getElementById('detection-status');
        statusEl.className = 'alert alert-success text-center';
        statusEl.innerHTML = `
            <i class="bi bi-check-circle-fill"></i> 
            <strong>¡Correcto!</strong> Hiciste bien la seña de ${this.currentExercise.name} 🎉
        `;

        setTimeout(() => {
            document.getElementById('btn-next-exercise').disabled = false;
        }, 2000);

        this.playSuccessSound();
        
        const completed = parseInt(document.getElementById('completed-count').textContent) + 1;
        document.getElementById('completed-count').textContent = completed;
        this.updateProgress();
    }

    showError() {
        const statusEl = document.getElementById('detection-status');
        const labels = Object.keys(this.samples || {});
        const currentLabel = this.currentExercise ? this.currentExercise.id : null;
        const hasSamples = labels.length > 0 && (currentLabel ? this.samples[currentLabel]?.length > 0 : false);
        
        if (!hasSamples && currentLabel) {
            statusEl.className = 'alert alert-warning text-center';
            if (this.isAdmin) {
                statusEl.innerHTML = `
                    <i class="bi bi-exclamation-triangle-fill"></i> 
                    <strong>Este ejercicio aún no ha sido entrenado.</strong><br>
                    <small>Para que el sistema reconozca "${this.currentExercise.name}", necesitás entrenarlo primero:</small><br>
                    <small>1. Presioná <kbd>Ctrl+Shift+S</kbd> para abrir el panel de admin</small><br>
                    <small>2. Ingresá el label: <strong>${currentLabel}</strong></small><br>
                    <small>3. Hacé clic en "Grabar muestra" y realizá la seña varias veces (mínimo 5 veces recomendado)</small>
                `;
            } else {
                statusEl.innerHTML = `
                    <i class="bi bi-info-circle-fill"></i> 
                    <strong>Este ejercicio aún no está disponible.</strong><br>
                    <small>El sistema necesita ser entrenado por un administrador para reconocer "${this.currentExercise.name}".</small>
                `;
            }
        } else {
            statusEl.className = 'alert alert-warning text-center';
            statusEl.innerHTML = `
                <i class="bi bi-exclamation-triangle-fill"></i> 
                Intentá de nuevo. Asegurate de hacer la seña correctamente según el estándar mostrado.
            `;
        }
    }

    nextExercise() {
        this.lastDetection = null;
        this.lastCorrectDetection = false; // Resetear el color a rojo
        document.getElementById('btn-next-exercise').disabled = true;
        
        this.loadExercise(this.currentExerciseIndex + 1);
        document.getElementById('detection-status').className = 'alert alert-info text-center';
        document.getElementById('detection-status').innerHTML = '<i class="bi bi-info-circle"></i> Mostrá tu seña';
    }
    
    prevExercise() {
        this.lastDetection = null;
        this.lastCorrectDetection = false; // Resetear el color a rojo
        
        if (this.currentExerciseIndex > 0) {
            this.loadExercise(this.currentExerciseIndex - 1);
            document.getElementById('detection-status').className = 'alert alert-info text-center';
            document.getElementById('detection-status').innerHTML = '<i class="bi bi-info-circle"></i> Mostrá tu seña';
        }
    }
    
    saveProgress() {
        if (!this.currentCategory) return;
        
        try {
            const progressKey = `manitas_exercise_progress_${this.currentCategory}`;
            const progressData = {
                category: this.currentCategory,
                exerciseIndex: this.currentExerciseIndex,
                exerciseId: this.currentExercise ? this.currentExercise.id : null,
                timestamp: Date.now()
            };
            localStorage.setItem(progressKey, JSON.stringify(progressData));
        } catch (e) {
            console.error('Error guardando progreso:', e);
        }
    }
    
    loadProgress(categoryId) {
        try {
            const progressKey = `manitas_exercise_progress_${categoryId}`;
            const saved = localStorage.getItem(progressKey);
            if (saved) {
                const progressData = JSON.parse(saved);
                // Verificar que la categoría coincida y que el índice sea válido
                if (progressData.category === categoryId && 
                    progressData.exerciseIndex >= 0 && 
                    progressData.exerciseIndex < this.categories[categoryId].exercises.length) {
                    return progressData.exerciseIndex;
                }
            }
        } catch (e) {
            console.error('Error cargando progreso:', e);
        }
        return null;
    }

    updateProgress() {
        const completed = parseInt(document.getElementById('completed-count').textContent) || 0;
        const total = this.exercises.length || 1;
        const progress = (completed / total) * 100;
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        
        if (progressBar) {
            progressBar.style.width = progress + '%';
            progressBar.setAttribute('aria-valuenow', progress);
        }
        if (progressText) {
            progressText.textContent = Math.round(progress) + '%';
        }
        
        // Guardar progreso actualizado
        this.saveProgress();
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

    // ===== TRAINING / CLASSIFIER HELPERS (CLIENT-SIDE K-NN) =====
    extractFeatures(landmarks) {
        const wrist = landmarks[0];
        const ref = landmarks[5] || landmarks[1];
        const scale = Math.hypot((ref.x - wrist.x), (ref.y - wrist.y)) || 1;
        const feats = [];
        landmarks.forEach(l => {
            feats.push((l.x - wrist.x) / scale);
            feats.push((l.y - wrist.y) / scale);
        });
        return feats;
    }

    averageFeatureBuffer(buffer) {
        if (!buffer || buffer.length === 0) return null;
        const len = buffer[0].length;
        const avg = new Array(len).fill(0);
        buffer.forEach(vec => {
            for (let i = 0; i < len; i++) avg[i] += vec[i];
        });
        for (let i = 0; i < len; i++) avg[i] /= buffer.length;
        return avg;
    }

    addSample(label, featureVec) {
        if (!label || !featureVec) return;
        if (!this.samples[label]) this.samples[label] = [];
        this.samples[label].push(featureVec);
        this.persistSamples();
        this.updateAdminPanelCounts();
    }

    persistSamples() {
        try {
            localStorage.setItem('manitas_sign_samples_v1', JSON.stringify(this.samples));
        } catch (e) {
            console.error('No se pudo guardar samples en localStorage', e);
        }
    }

    loadPersistedSamples() {
        try {
            const raw = localStorage.getItem('manitas_sign_samples_v1');
            if (raw) this.samples = JSON.parse(raw);
        } catch (e) {
            console.error('Error cargando samples desde localStorage', e);
            this.samples = {};
        }
    }

    l2Distance(a, b) {
        let s = 0;
        for (let i = 0; i < a.length; i++) {
            const d = a[i] - b[i];
            s += d * d;
        }
        return Math.sqrt(s);
    }

    classifyFromSamples(landmarks) {
        if (!landmarks) return null;
        const labels = Object.keys(this.samples || {});
        
        // Si no hay muestras de entrenamiento, no se puede reconocer
        if (labels.length === 0) {
            return null;
        }
        
        // Verificar que haya muestras para el ejercicio actual
        if (this.currentExercise) {
            const currentLabel = this.currentExercise.id;
            if (!this.samples[currentLabel] || this.samples[currentLabel].length === 0) {
                // No hay muestras para este ejercicio específico
                return null;
            }
        }
        
        const feat = this.extractFeatures(landmarks);
        const neighbors = [];
        
        labels.forEach(label => {
            (this.samples[label] || []).forEach(sampleVec => {
                neighbors.push({label, dist: this.l2Distance(feat, sampleVec)});
            });
        });
        
        if (neighbors.length === 0) return null;
        
        neighbors.sort((a, b) => a.dist - b.dist);
        const k = Math.min(this.knnK, neighbors.length);
        const topK = neighbors.slice(0, k);
        
        const counts = {};
        topK.forEach(n => counts[n.label] = (counts[n.label] || 0) + 1);
        
        let bestLabel = null, bestCount = 0;
        Object.keys(counts).forEach(l => {
            if (counts[l] > bestCount) {
                bestLabel = l;
                bestCount = counts[l];
            }
        });
        
        // Calcular similaridad basada en la distancia mínima
        // Usar una función que permita 70% de similaridad de forma más flexible
        const minDist = topK[0].dist;
        
        // Calcular el rango de distancias para normalizar
        // Usar solo las distancias del label más probable para mejor precisión
        const bestLabelDistances = neighbors
            .filter(n => n.label === bestLabel)
            .map(n => n.dist);
        
        const avgBestLabelDist = bestLabelDistances.length > 0 
            ? bestLabelDistances.reduce((sum, d) => sum + d, 0) / bestLabelDistances.length 
            : minDist;
        
        // Calcular similaridad usando una función más flexible
        // Si la distancia mínima es menor que el promedio del mejor label, es muy similar
        const distanceRatio = avgBestLabelDist > 0 ? minDist / avgBestLabelDist : 0;
        
        // Convertir distancia a similaridad: menor distancia = mayor similaridad
        // Usar una función que permita 70% de similaridad de forma más natural
        const similarity = Math.max(0, 1 - (distanceRatio * 1.5)); // Factor 1.5 para hacer más flexible
        
        // Aplicar un factor adicional si hay múltiples vecinos del mismo label (mayor confianza)
        const confidenceBoost = bestCount > 1 ? 0.1 : 0;
        const finalSimilarity = Math.min(similarity + confidenceBoost, 1);
        
        // Solo retornar si la similaridad es al menos 70% (0.7)
        if (finalSimilarity >= this.confidenceThreshold) {
            // Verificar que el label reconocido coincida con el ejercicio actual
            if (this.currentExercise && bestLabel === this.currentExercise.id) {
                return bestLabel;
            }
            // Si no coincide exactamente, pero está cerca, también aceptarlo
            // (útil para variaciones)
            return bestLabel;
        }
        return null;
    }

    exportSamples() {
        const dataStr = JSON.stringify(this.samples);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'manitas_sign_samples.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    importSamples(json) {
        try {
            const obj = JSON.parse(json);
            Object.keys(obj).forEach(label => {
                if (!this.samples[label]) this.samples[label] = [];
                this.samples[label] = this.samples[label].concat(obj[label]);
            });
            this.persistSamples();
            this.updateAdminPanelCounts();
            return true;
        } catch (e) {
            console.error('Import samples failed', e);
            return false;
        }
    }

    updateAdminPanelCounts() {
        // Solo actualizar si es admin y el panel existe
        if (!this.isAdmin) return;
        
        const panel = document.getElementById('admin-train-panel');
        if (!panel) return;
        const list = panel.querySelector('#admin-sample-counts');
        if (!list) return;
        
        list.innerHTML = '';
        this.exercises.forEach(ex => {
            const cnt = (this.samples[ex.id] || []).length;
            const li = document.createElement('div');
            li.textContent = `${ex.id}: ${cnt} muestras`;
            list.appendChild(li);
        });
    }

    toggleAdminPanel() {
        // Solo admins pueden usar el panel de entrenamiento
        if (!this.isAdmin) {
            console.warn('Solo administradores pueden acceder al panel de entrenamiento');
            return;
        }
        
        let panel = document.getElementById('admin-train-panel');
        if (!panel) {
            panel = this.createAdminPanel();
            document.body.appendChild(panel);
        }
        this.loadPersistedSamples();
        this.trainingMode = !this.trainingMode;
        panel.style.display = this.trainingMode ? 'block' : 'none';
        this.updateAdminPanelCounts();
    }

    createAdminPanel() {
        const panel = document.createElement('div');
        panel.id = 'admin-train-panel';
        panel.style.position = 'fixed';
        panel.style.right = '12px';
        panel.style.top = '12px';
        panel.style.zIndex = '9999';
        panel.style.background = 'rgba(255,255,255,0.95)';
        panel.style.border = '1px solid #ccc';
        panel.style.padding = '12px';
        panel.style.borderRadius = '8px';
        panel.style.maxWidth = '320px';
        panel.style.fontSize = '14px';
        panel.style.display = 'none';

        const title = document.createElement('div');
        title.innerHTML = '<strong>Admin: Entrenamiento (Ctrl+Shift+S)</strong>';
        panel.appendChild(title);

        const input = document.createElement('input');
        input.id = 'admin-train-label';
        input.placeholder = 'Label (ej: NUM_3, DEPT_SAN_MIGUEL, A)';
        input.style.width = '100%';
        input.style.marginTop = '8px';
        panel.appendChild(input);

        const btnRecord = document.createElement('button');
        btnRecord.textContent = 'Grabar muestra (12 frames)';
        btnRecord.style.width = '100%';
        btnRecord.style.marginTop = '8px';
        btnRecord.className = 'btn btn-sm btn-primary';
        btnRecord.addEventListener('click', () => {
            const label = document.getElementById('admin-train-label').value.trim();
            if (!label) {
                alert('Ingresá un label');
                return;
            }
            this.trainingLabel = label;
            this.trainingCollecting = true;
            this.trainingBuffer = [];
        });
        panel.appendChild(btnRecord);

        const counts = document.createElement('div');
        counts.id = 'admin-sample-counts';
        counts.style.marginTop = '8px';
        panel.appendChild(counts);

        const btnExport = document.createElement('button');
        btnExport.textContent = 'Exportar muestras';
        btnExport.className = 'btn btn-sm btn-outline-secondary';
        btnExport.style.marginTop = '8px';
        btnExport.style.width = '100%';
        btnExport.addEventListener('click', () => this.exportSamples());
        panel.appendChild(btnExport);

        const btnUpload = document.createElement('button');
        btnUpload.textContent = 'Subir muestras al servidor (Admin)';
        btnUpload.className = 'btn btn-sm btn-outline-success';
        btnUpload.style.marginTop = '8px';
        btnUpload.style.width = '100%';
        btnUpload.addEventListener('click', async () => {
            try {
                const csrftoken = (() => {
                    const name = 'csrftoken=';
                    const c = document.cookie.split(';').map(s => s.trim()).find(s => s.startsWith(name));
                    return c ? decodeURIComponent(c.substring(name.length)) : '';
                })();
                const resp = await fetch('/admin/upload_samples/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrftoken
                    },
                    body: JSON.stringify(this.samples)
                });
                const j = await resp.json();
                if (resp.ok) {
                    alert('Muestras subidas correctamente: ' + (j.file || ''));
                } else {
                    alert('Error subiendo muestras: ' + (j.error || JSON.stringify(j)));
                }
            } catch (e) {
                console.error('Error subiendo muestras:', e);
                alert('Error subiendo muestras: ' + e.message);
            }
        });
        panel.appendChild(btnUpload);

        const inputFile = document.createElement('input');
        inputFile.type = 'file';
        inputFile.accept = '.json,application/json';
        inputFile.style.marginTop = '8px';
        inputFile.addEventListener('change', (e) => {
            const f = e.target.files[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = () => {
                this.importSamples(r.result);
            };
            r.readAsText(f);
        });
        panel.appendChild(inputFile);

        const hint = document.createElement('div');
        hint.style.marginTop = '8px';
        hint.style.fontSize = '12px';
        hint.style.color = '#555';
        hint.textContent = 'Oculto: presioná Ctrl+Shift+S para mostrar/ocultar.';
        panel.appendChild(hint);

        

        const mediaInput = document.createElement('input');
        mediaInput.type = 'file';
        mediaInput.accept = 'image/*,video/*';
        mediaInput.style.marginTop = '8px';
        mediaInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        this.processMediaFile(file);
        });
        panel.appendChild(mediaInput);

        return panel;
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
                
                // Cargar muestras persistidas
                try {
                    reconocimiento.loadPersistedSamples();
                } catch (e) {
                    console.warn('No se pudieron cargar muestras persistidas', e);
                }

                // Atajos y botones - Solo para admins
                document.addEventListener('keydown', (ev) => {
                    if (ev.ctrlKey && ev.shiftKey && ev.code === 'KeyS') {
                        // Solo permitir si es admin
                        if (reconocimiento.isAdmin) {
                            reconocimiento.toggleAdminPanel();
                        } else {
                            console.warn('Solo administradores pueden acceder al panel de entrenamiento');
                        }
                    }
                });
                
                const adminBtn = document.getElementById('btn-admin-train');
                if (adminBtn && reconocimiento.isAdmin) {
                    adminBtn.addEventListener('click', () => reconocimiento.toggleAdminPanel());
                } else if (adminBtn) {
                    // Ocultar el botón si no es admin
                    adminBtn.style.display = 'none';
                }
            }
        } else {
            console.error('No se encontraron los elementos video o canvas');
        }
    };
    
    initReconocimiento();
    
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
