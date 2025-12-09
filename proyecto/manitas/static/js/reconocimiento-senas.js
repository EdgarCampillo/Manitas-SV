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
        this.trainingDuration = 15; // 15 segundos para saludos y departamentos
        this.trainingStartTime = null;
        this.trainingInterval = null;
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
            await this.processVideoForTraining(file, label);
        }
    }

    async processVideoForTraining(file, label) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            video.muted = true;
            video.crossOrigin = 'anonymous';
            video.preload = 'metadata';
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const targetFrames = this.trainingFramesToCollect;
            let framesProcessed = 0;
            
            video.addEventListener('loadedmetadata', () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                const duration = video.duration;
                if (!duration || isNaN(duration) || duration <= 0) {
                    console.error('Video no tiene duración válida');
                    URL.revokeObjectURL(video.src);
                    reject(new Error('Video inválido'));
                    return;
                }
                
                const frameInterval = Math.max(0.1, duration / targetFrames);
                
                // Configurar para capturar frames
                this.trainingLabel = label;
                this.trainingCollecting = true;
                this.trainingBuffer = [];
                
                // Función para capturar un frame en un tiempo específico y esperar a que se procese
                const captureFrameAtTime = async (time) => {
                    return new Promise((frameResolve) => {
                        const seekTime = Math.max(0, Math.min(time, duration - 0.1));
                        video.currentTime = seekTime;
                        
                        const onSeeked = async () => {
                            video.removeEventListener('seeked', onSeeked);
                            
                            // Esperar un momento para que el frame se estabilice
                            await new Promise(resolve => setTimeout(resolve, 100));
                            
                            // Dibujar el frame actual en el canvas
                            try {
                                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                                
                                // Enviar a MediaPipe para procesar y ESPERAR a que termine
                                try {
                                    await this.hands.send({ image: canvas });
                                    // Esperar a que onResults procese el frame antes de continuar
                                    await new Promise(resolve => setTimeout(resolve, 200));
                                    framesProcessed++;
                                    frameResolve();
                                } catch (err) {
                                    console.error('Error procesando frame:', err);
                                    framesProcessed++;
                                    frameResolve();
                                }
                            } catch (err) {
                                console.error('Error dibujando frame:', err);
                                framesProcessed++;
                                frameResolve();
                            }
                        };
                        
                        const onError = () => {
                            video.removeEventListener('seeked', onSeeked);
                            video.removeEventListener('error', onError);
                            console.error('Error buscando tiempo en video');
                            framesProcessed++;
                            frameResolve();
                        };
                        
                        video.addEventListener('seeked', onSeeked, { once: true });
                        video.addEventListener('error', onError, { once: true });
                    });
                };
                
                // Capturar frames SECUENCIALMENTE (no en paralelo) para asegurar que cada uno se procese completamente
                const captureAllFrames = async () => {
                    try {
                        // Primero reproducir y pausar para inicializar
                        await video.play();
                        video.pause();
                        
                        // Esperar un momento
                        await new Promise(resolve => setTimeout(resolve, 300));
                        
                        // Procesar frames uno por uno, esperando a que cada uno termine
                        for (let i = 0; i < targetFrames; i++) {
                            const time = (i * frameInterval) + (frameInterval / 2);
                            await captureFrameAtTime(time);
                            
                            // Pequeña pausa entre frames
                            await new Promise(resolve => setTimeout(resolve, 150));
                        }
                        
                        // Esperar un momento final para que se procesen todas las muestras
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        video.pause();
                        URL.revokeObjectURL(video.src);
                        console.log(`Procesados ${framesProcessed} frames del video para ${label}`);
                        resolve();
                    } catch (err) {
                        console.error('Error en captureAllFrames:', err);
                        video.pause();
                        URL.revokeObjectURL(video.src);
                        reject(err);
                    }
                };
                
                // Esperar a que el video esté completamente listo
                if (video.readyState >= 2) {
                    captureAllFrames();
                } else {
                    video.addEventListener('canplaythrough', captureAllFrames, { once: true });
                }
            });
            
            video.addEventListener('error', (err) => {
                console.error('Error cargando video:', err);
                URL.revokeObjectURL(video.src);
                reject(err);
            });
            
            video.load();
        });
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
        
        // Inicializar estados de categorías al cargar
        setTimeout(() => {
            this.updateCategoryStatuses();
        }, 500);
    }
    
    async selectCategory(categoryId) {
        const btnStart = document.getElementById('btn-start-camera');
        const exerciseInfo = document.getElementById('exercise-info');
        
        if (!categoryId) {
            exerciseInfo.style.display = 'none';
            this.exercises = [];
            this.currentCategory = null;
            if (btnStart) btnStart.disabled = true;
            this.updateCategoryStatuses(); // Actualizar estados cuando no hay categoría seleccionada
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
        
        // Actualizar la barra de progreso inmediatamente
        this.loadExercise(startIndex);
        this.updateProgress(); // Forzar actualización inmediata
        
        // Actualizar estados de categorías después de cargar
        this.updateCategoryStatuses();
    }
    
    async waitForMediaPipeReady() {
        // Esperar a que MediaPipe esté completamente listo
        if (this.handsReady && this.hands) {
            return true;
        }
        
        let attempts = 0;
        const maxAttempts = 50;
        
        while (attempts < maxAttempts) {
            if (this.handsReady && this.hands) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        return false;
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
                
                // Procesamiento automático de videos deshabilitado para evitar bloqueos
                // Los videos se pueden procesar manualmente desde el panel de admin
                // if (this.isAdmin) {
                //     await this.processStandardsVideosForTraining(categoryId);
                // }
            }
        } catch (error) {
            console.error('Error cargando estándares:', error);
        }
    }
    
    async processStandardsVideosForTraining(categoryId) {
        // Esperar a que MediaPipe esté listo antes de procesar videos
        const isReady = await this.waitForMediaPipeReady();
        if (!isReady) {
            console.warn('MediaPipe no está listo, no se pueden procesar videos automáticamente');
            return;
        }
        
        // Verificar que la cámara no esté activa antes de procesar videos
        if (this.cameraActive) {
            console.warn('La cámara está activa, no se pueden procesar videos automáticamente');
            return;
        }
        
        // Procesar videos de estándares automáticamente para entrenamiento
        const standards = Object.values(this.signStandards).filter(s => s.category === categoryId);
        
        // Mostrar mensaje de estado si es admin
        if (this.isAdmin) {
            const statusEl = document.getElementById('detection-status');
            if (statusEl) {
                statusEl.className = 'alert alert-info text-center';
                statusEl.innerHTML = '<i class="bi bi-hourglass-split"></i> Procesando videos de estándares para entrenamiento...';
            }
        }
        
        let processedCount = 0;
        const processedUrls = new Set(); // Evitar procesar el mismo video múltiples veces
        
        for (const standard of standards) {
            const exerciseId = standard.exercise_id;
            
            // Verificar si ya hay muestras para este ejercicio
            if (this.samples[exerciseId] && this.samples[exerciseId].length >= this.minSamplesPerSign) {
                console.log(`Ya hay suficientes muestras para ${exerciseId}, saltando...`);
                continue;
            }
            
            // Buscar videos en los archivos multimedia
            const videoFiles = (standard.media_files || []).filter(mf => {
                const url = mf.url || '';
                return url.match(/\.(mp4|webm|ogg|mov)$/i) || standard.media_type === 'video';
            });
            
            // Si hay videos, procesar el primero
            if (videoFiles.length > 0 || (standard.media_type === 'video' && standard.media_url)) {
                try {
                    const videoUrl = videoFiles[0]?.url || standard.media_url;
                    if (videoUrl && !processedUrls.has(videoUrl)) {
                        processedUrls.add(videoUrl);
                        console.log(`Procesando video estándar para ${exerciseId}...`);
                        await this.processVideoUrlForTraining(videoUrl, exerciseId);
                        processedCount++;
                        
                        // Pequeña pausa entre videos para no sobrecargar
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                } catch (error) {
                    console.error(`Error procesando video para ${exerciseId}:`, error);
                    // Continuar con el siguiente video aunque este falle
                }
            }
        }
        
        // Actualizar mensaje de estado
        if (this.isAdmin) {
            const statusEl = document.getElementById('detection-status');
            if (statusEl) {
                if (processedCount > 0) {
                    statusEl.className = 'alert alert-success text-center';
                    statusEl.innerHTML = `<i class="bi bi-check-circle"></i> Procesados ${processedCount} videos de estándares. Podés comenzar a entrenar.`;
                    setTimeout(() => {
                        if (statusEl && !this.cameraActive) {
                            statusEl.className = 'alert alert-info text-center';
                            statusEl.innerHTML = '<i class="bi bi-info-circle"></i> Iniciá la cámara para comenzar';
                        }
                    }, 3000);
                } else {
                    statusEl.className = 'alert alert-info text-center';
                    statusEl.innerHTML = '<i class="bi bi-info-circle"></i> No hay videos nuevos para procesar. Iniciá la cámara para comenzar.';
                }
            }
        }
    }
    
    async processVideoUrlForTraining(videoUrl, label) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            // Construir URL completa si es relativa
            const fullUrl = videoUrl.startsWith('http') ? videoUrl : window.location.origin + videoUrl;
            video.src = fullUrl;
            video.muted = true;
            video.crossOrigin = 'anonymous';
            video.preload = 'metadata';
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const targetFrames = this.trainingFramesToCollect;
            let framesCaptured = 0;
            let timeoutId = null;
            
            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                video.pause();
                video.src = '';
                video.load();
            };
            
            // Timeout de seguridad
            timeoutId = setTimeout(() => {
                console.warn(`Timeout procesando video para ${label}`);
                cleanup();
                resolve(); // Resolver en lugar de rechazar para no bloquear otros videos
            }, 60000); // 60 segundos máximo para videos más largos
            
            video.addEventListener('loadedmetadata', () => {
                if (!video.videoWidth || !video.videoHeight) {
                    console.warn(`Video ${label} no tiene dimensiones válidas`);
                    cleanup();
                    resolve();
                    return;
                }
                
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                const duration = video.duration;
                if (!duration || isNaN(duration) || duration <= 0) {
                    console.warn(`Video ${label} no tiene duración válida`);
                    cleanup();
                    resolve();
                    return;
                }
                
                const frameInterval = Math.max(0.1, duration / targetFrames);
                
                // Configurar para capturar frames
                this.trainingLabel = label;
                this.trainingCollecting = true;
                this.trainingBuffer = [];
                
                // Función para capturar un frame en un tiempo específico y esperar a que se procese
                const captureFrameAtTime = async (time) => {
                    return new Promise((frameResolve) => {
                        const seekTime = Math.max(0, Math.min(time, duration - 0.1));
                        video.currentTime = seekTime;
                        
                        const onSeeked = async () => {
                            video.removeEventListener('seeked', onSeeked);
                            
                            // Esperar un momento para que el frame se estabilice
                            await new Promise(resolve => setTimeout(resolve, 100));
                            
                            // Dibujar el frame actual en el canvas
                            try {
                                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                                
                                // Enviar a MediaPipe para procesar y ESPERAR a que termine
                                try {
                                    await this.hands.send({ image: canvas });
                                    // Esperar a que onResults procese el frame antes de continuar
                                    await new Promise(resolve => setTimeout(resolve, 200));
                                    framesCaptured++;
                                    frameResolve();
                                } catch (err) {
                                    console.error('Error procesando frame:', err);
                                    framesCaptured++;
                                    frameResolve();
                                }
                            } catch (err) {
                                console.error('Error dibujando frame:', err);
                                framesCaptured++;
                                frameResolve();
                            }
                        };
                        
                        const onError = () => {
                            video.removeEventListener('seeked', onSeeked);
                            video.removeEventListener('error', onError);
                            console.error('Error buscando tiempo en video');
                            framesCaptured++;
                            frameResolve();
                        };
                        
                        video.addEventListener('seeked', onSeeked, { once: true });
                        video.addEventListener('error', onError, { once: true });
                    });
                };
                
                // Capturar frames SECUENCIALMENTE (no en paralelo) para asegurar que cada uno se procese completamente
                const captureAllFrames = async () => {
                    try {
                        // Primero reproducir y pausar para inicializar
                        await video.play();
                        video.pause();
                        
                        // Esperar un momento
                        await new Promise(resolve => setTimeout(resolve, 300));
                        
                        // Procesar frames uno por uno, esperando a que cada uno termine
                        for (let i = 0; i < targetFrames; i++) {
                            const time = (i * frameInterval) + (frameInterval / 2);
                            await captureFrameAtTime(time);
                            
                            // Pequeña pausa entre frames
                            await new Promise(resolve => setTimeout(resolve, 150));
                        }
                        
                        // Esperar un momento final para que se procesen todas las muestras
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        if (timeoutId) clearTimeout(timeoutId);
                        cleanup();
                        
                        console.log(`Procesados ${framesCaptured} frames del video estándar para ${label}`);
                        resolve();
                    } catch (err) {
                        console.error('Error en captureAllFrames:', err);
                        if (timeoutId) clearTimeout(timeoutId);
                        cleanup();
                        resolve(); // Resolver en lugar de rechazar
                    }
                };
                
                // Esperar a que el video esté completamente listo
                if (video.readyState >= 2) {
                    captureAllFrames();
                } else {
                    video.addEventListener('canplaythrough', captureAllFrames, { once: true });
                }
            });
            
            video.addEventListener('error', (err) => {
                // Solo mostrar el error una vez, no en bucle
                if (!video.dataset.errorLogged) {
                    console.error('Error cargando video desde URL:', fullUrl);
                    video.dataset.errorLogged = 'true';
                }
                if (timeoutId) clearTimeout(timeoutId);
                cleanup();
                resolve(); // Resolver en lugar de rechazar para no bloquear otros videos
            });
            
            video.load();
        });
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
        
        const exerciseTitle = document.getElementById('exercise-title');
        const exerciseDescription = document.getElementById('exercise-description');
        const totalCountEl = document.getElementById('total-count');
        const completedCountEl = document.getElementById('completed-count');
        
        if (exerciseTitle) exerciseTitle.textContent = this.currentExercise.name;
        if (exerciseDescription) exerciseDescription.textContent = this.currentExercise.description;
        if (totalCountEl) totalCountEl.textContent = this.exercises.length;
        if (completedCountEl) completedCountEl.textContent = index;
        
        // Habilitar/deshabilitar botones de navegación
        const btnNext = document.getElementById('btn-next-exercise');
        const btnPrev = document.getElementById('btn-prev-exercise');
        
        if (btnNext) btnNext.disabled = true;
        if (btnPrev) btnPrev.disabled = (index === 0);
        
        // Actualizar progreso inmediatamente
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
            
            // Asegurar que el canvas sea visible
            if (this.canvas) {
                this.canvas.style.display = 'block';
                this.canvas.style.visibility = 'visible';
                this.canvas.style.position = 'relative';
                this.canvas.style.zIndex = '2';
                // Inicializar con fondo negro si no hay video aún
                if (this.ctx) {
                    this.ctx.fillStyle = '#000000';
                    this.ctx.fillRect(0, 0, this.canvas.width || 640, this.canvas.height || 480);
                }
            }
            
            // Detener cualquier stream anterior
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
                    const videoWidth = this.video.videoWidth || 640;
                    const videoHeight = this.video.videoHeight || 480;
                    this.canvas.width = videoWidth;
                    this.canvas.height = videoHeight;
                    console.log('Canvas configurado con dimensiones:', this.canvas.width, 'x', this.canvas.height);
                    
                    // Asegurar que el canvas sea visible
                    this.canvas.style.display = 'block';
                    this.canvas.style.visibility = 'visible';
                    
                    // Dibujar el primer frame inmediatamente
                    if (this.ctx && this.video.readyState >= 2) {
                        this.ctx.drawImage(this.video, 0, 0, videoWidth, videoHeight);
                    }
                    
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
                
                // Determinar el modo de entrenamiento según la categoría
                const isTimeBasedCategory = this.currentCategory === 'saludos' || this.currentCategory === 'departamentos';
                
                if (isTimeBasedCategory) {
                    // Para saludos y departamentos: usar tiempo (15 segundos)
                    this.trainingBuffer.push(feat);
                    const elapsed = (Date.now() - this.trainingStartTime) / 1000;
                    const remaining = Math.max(0, this.trainingDuration - elapsed);
                    
                    const statusEl = document.getElementById('detection-status');
                    if (statusEl && this.isAdmin) {
                        statusEl.className = 'alert alert-info text-center';
                        statusEl.innerHTML = `<i class="bi bi-hourglass-split"></i> Grabando... ${Math.ceil(remaining)}s restantes para ${this.trainingLabel}`;
                    }
                    
                    if (remaining <= 0) {
                        // Tiempo completado: guardar todas las muestras
                        this.trainingBuffer.forEach(sample => {
                            this.addSample(this.trainingLabel, sample);
                        });
                        const sampleCount = this.trainingBuffer.length;
                        this.trainingCollecting = false;
                        this.trainingBuffer = [];
                        this.trainingStartTime = null;
                        if (this.trainingInterval) {
                            clearInterval(this.trainingInterval);
                            this.trainingInterval = null;
                        }
                        const statusEl = document.getElementById('detection-status');
                        if (statusEl && this.isAdmin) {
                            statusEl.className = 'alert alert-success text-center';
                            statusEl.innerHTML = `<i class="bi bi-check-circle-fill"></i> Muestra guardada para ${this.trainingLabel} (${sampleCount} frames capturados)`;
                        }
                    }
                } else {
                    // Para alfabeto y números: sin frames, guardar muestra directa
                    this.addSample(this.trainingLabel, feat);
                    this.trainingCollecting = false;
                    const statusEl = document.getElementById('detection-status');
                    if (statusEl && this.isAdmin) {
                        statusEl.className = 'alert alert-success text-center';
                        statusEl.innerHTML = `<i class="bi bi-check-circle-fill"></i> Muestra guardada para ${this.trainingLabel}`;
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
        const btnNext = document.getElementById('btn-next-exercise');
        if (!btnNext || !btnNext.disabled) {
            return;
        }

        const statusEl = document.getElementById('detection-status');
        if (statusEl) {
            statusEl.className = 'alert alert-success text-center';
            statusEl.innerHTML = `
                <i class="bi bi-check-circle-fill"></i> 
                <strong>¡Correcto!</strong> Hiciste bien la seña de ${this.currentExercise.name} 🎉
            `;
        }

        setTimeout(() => {
            if (btnNext) btnNext.disabled = false;
        }, 2000);

        this.playSuccessSound();
        
        const completedCountEl = document.getElementById('completed-count');
        if (completedCountEl) {
            const completed = parseInt(completedCountEl.textContent) + 1;
            completedCountEl.textContent = completed;
        }
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
            const completedKey = `manitas_category_completed_${this.currentCategory}`;
            
            // Guardar progreso actual
            const progressData = {
                category: this.currentCategory,
                exerciseIndex: this.currentExerciseIndex,
                exerciseId: this.currentExercise ? this.currentExercise.id : null,
                timestamp: Date.now()
            };
            localStorage.setItem(progressKey, JSON.stringify(progressData));
            
            // Si la categoría está completada, marcarla como tal (pero preservar el progreso)
            if (this.currentExerciseIndex >= this.exercises.length) {
                localStorage.setItem(completedKey, 'true');
            } else {
                // Si no está completada, asegurarse de que el flag de completado no esté presente
                // pero preservar el progreso existente
                const existingCompleted = localStorage.getItem(completedKey);
                // Solo remover el flag si realmente no está completada
                if (existingCompleted === 'true' && this.currentExerciseIndex < this.exercises.length) {
                    localStorage.removeItem(completedKey);
                }
            }
        } catch (e) {
            console.error('Error guardando progreso:', e);
        }
    }
    
    loadProgress(categoryId) {
        try {
            const progressKey = `manitas_exercise_progress_${categoryId}`;
            const completedKey = `manitas_category_completed_${categoryId}`;
            const saved = localStorage.getItem(progressKey);
            const isCompleted = localStorage.getItem(completedKey) === 'true';
            
            if (saved) {
                const progressData = JSON.parse(saved);
                // Verificar que la categoría coincida y que el índice sea válido
                if (progressData.category === categoryId && 
                    progressData.exerciseIndex >= 0) {
                    // Si está completada, mantener el último índice pero permitir continuar
                    if (isCompleted && progressData.exerciseIndex >= this.categories[categoryId].exercises.length) {
                        return this.categories[categoryId].exercises.length; // Permitir ver el estado completado
                    }
                    // Si no está completada pero el índice es válido, usarlo
                    if (progressData.exerciseIndex < this.categories[categoryId].exercises.length) {
                        return progressData.exerciseIndex;
                    }
                }
            }
        } catch (e) {
            console.error('Error cargando progreso:', e);
        }
        return null;
    }
    
    getCategoryStatus(categoryId) {
        if (!categoryId || !this.categories[categoryId]) {
            return null;
        }
        
        try {
            const progressKey = `manitas_exercise_progress_${categoryId}`;
            const completedKey = `manitas_category_completed_${categoryId}`;
            const saved = localStorage.getItem(progressKey);
            const isCompleted = localStorage.getItem(completedKey) === 'true';
            const totalExercises = this.categories[categoryId].exercises.length;
            
            if (!saved) {
                return { status: 'faltante', progress: 0, total: totalExercises };
            }
            
            const progressData = JSON.parse(saved);
            const currentIndex = progressData.exerciseIndex || 0;
            
            if (isCompleted || currentIndex >= totalExercises) {
                return { status: 'terminada', progress: totalExercises, total: totalExercises };
            } else if (currentIndex > 0) {
                return { status: 'en_proceso', progress: currentIndex, total: totalExercises };
            } else {
                return { status: 'faltante', progress: 0, total: totalExercises };
            }
        } catch (e) {
            console.error('Error obteniendo estado de categoría:', e);
            return { status: 'faltante', progress: 0, total: this.categories[categoryId].exercises.length };
        }
    }
    
    updateCategoryStatuses() {
        const badgesContainer = document.getElementById('category-status-badges');
        if (!badgesContainer) return;
        
        badgesContainer.innerHTML = '';
        
        const categorySelect = document.getElementById('category-select');
        if (!categorySelect) return;
        
        const categories = ['alfabeto', 'numeros', 'departamentos', 'saludos'];
        
        categories.forEach(categoryId => {
            const status = this.getCategoryStatus(categoryId);
            if (!status) return;
            
            const categoryItem = document.createElement('div');
            categoryItem.className = 'd-flex align-items-center gap-2';
            categoryItem.style.marginBottom = '5px';
            
            const categoryName = document.createElement('span');
            categoryName.textContent = this.categories[categoryId].name + ':';
            categoryName.style.fontWeight = '500';
            categoryName.style.minWidth = '180px';
            categoryItem.appendChild(categoryName);
            
            const badge = document.createElement('span');
            let statusText = '';
            let badgeClass = '';
            
            if (status.status === 'terminada') {
                statusText = 'Terminada';
                badgeClass = 'bg-success';
            } else if (status.status === 'en_proceso') {
                statusText = 'En proceso';
                badgeClass = 'bg-warning text-dark';
            } else {
                statusText = 'Faltante';
                badgeClass = 'bg-secondary';
            }
            
            badge.className = `badge ${badgeClass}`;
            badge.textContent = statusText;
            badge.style.cursor = 'default';
            categoryItem.appendChild(badge);
            
            // Si está terminada, agregar botón de reiniciar
            if (status.status === 'terminada') {
                const restartBtn = document.createElement('button');
                restartBtn.className = 'btn btn-sm btn-outline-danger';
                restartBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Reiniciar';
                restartBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm(`¿Reiniciar la categoría "${this.categories[categoryId].name}"?`)) {
                        this.restartCategoryById(categoryId);
                    }
                };
                categoryItem.appendChild(restartBtn);
            }
            
            badgesContainer.appendChild(categoryItem);
        });
    }
    
    restartCategoryById(categoryId) {
        if (!categoryId || !this.categories[categoryId]) return;
        
        // Limpiar progreso guardado
        try {
            const progressKey = `manitas_exercise_progress_${categoryId}`;
            const completedKey = `manitas_category_completed_${categoryId}`;
            localStorage.removeItem(progressKey);
            localStorage.removeItem(completedKey);
        } catch (e) {
            console.error('Error limpiando progreso:', e);
        }
        
        // Si es la categoría actual, reiniciarla también
        if (this.currentCategory === categoryId) {
            this.restartCategory();
        } else {
            // Actualizar estados visuales
            this.updateCategoryStatuses();
        }
    }

    updateProgress() {
        if (!this.currentCategory || !this.exercises || this.exercises.length === 0) {
            return;
        }
        
        const completed = parseInt(document.getElementById('completed-count').textContent) || 0;
        const total = this.exercises.length || 1;
        const progress = Math.min((completed / total) * 100, 100);
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        const completedCountEl = document.getElementById('completed-count');
        const totalCountEl = document.getElementById('total-count');
        
        // Actualizar contadores
        if (completedCountEl) {
            completedCountEl.textContent = completed;
        }
        if (totalCountEl) {
            totalCountEl.textContent = total;
        }
        
        if (progressBar) {
            progressBar.style.width = progress + '%';
            progressBar.setAttribute('aria-valuenow', progress);
            // Forzar repaint para actualización inmediata
            progressBar.offsetHeight;
        }
        if (progressText) {
            progressText.textContent = Math.round(progress) + '%';
        }
        
        // Guardar progreso actualizado
        this.saveProgress();
        
        // Actualizar estados de categorías
        this.updateCategoryStatuses();
    }

    showCompletion() {
        const categoryName = this.currentCategory ? this.categories[this.currentCategory]?.name || this.currentCategory : 'la categoría';
        const exerciseInfo = document.getElementById('exercise-info');
        
        if (exerciseInfo) {
            exerciseInfo.innerHTML = `
                <div class="text-center">
                    <div class="mb-4">
                        <i class="bi bi-check-circle-fill" style="font-size: 4rem; color: #28a745;"></i>
                    </div>
                    <h3 class="fw-bold" style="color: #471396;">🎉 ¡Felicitaciones!</h3>
                    <p class="lead">Completaste todos los ejercicios de <strong>${categoryName}</strong></p>
                    <div class="mt-4">
                        <button class="btn btn-morado btn-lg me-2" onclick="window.reconocimientoSenas.restartCategory()">
                            <i class="bi bi-arrow-clockwise"></i> Reiniciar Categoría
                        </button>
                        <button class="btn btn-outline-secondary btn-lg" onclick="document.getElementById('category-select').value = ''; document.getElementById('category-select').dispatchEvent(new Event('change'));">
                            <i class="bi bi-list"></i> Cambiar Categoría
                        </button>
                    </div>
                </div>
            `;
        }
        
        const detectionStatus = document.getElementById('detection-status');
        if (detectionStatus) {
            detectionStatus.className = 'alert alert-success text-center';
            detectionStatus.innerHTML = '<i class="bi bi-trophy-fill"></i> ¡Categoría completada!';
        }
        
        // Actualizar barra de progreso al 100%
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        const completedCountEl = document.getElementById('completed-count');
        const totalCountEl = document.getElementById('total-count');
        
        if (progressBar) {
            progressBar.style.width = '100%';
            progressBar.setAttribute('aria-valuenow', 100);
        }
        if (progressText) {
            progressText.textContent = '100%';
        }
        if (completedCountEl && totalCountEl) {
            completedCountEl.textContent = this.exercises.length;
            totalCountEl.textContent = this.exercises.length;
        }
        
        // Deshabilitar botones de navegación
        const btnNext = document.getElementById('btn-next-exercise');
        const btnPrev = document.getElementById('btn-prev-exercise');
        if (btnNext) btnNext.disabled = true;
        if (btnPrev) btnPrev.disabled = true;
        
        // Guardar progreso como completado
        this.saveProgress();
        
        // Actualizar estados de categorías
        this.updateCategoryStatuses();
    }
    
    restartCategory() {
        if (!this.currentCategory) return;
        
        // Limpiar progreso guardado
        try {
            const progressKey = `manitas_exercise_progress_${this.currentCategory}`;
            const completedKey = `manitas_category_completed_${this.currentCategory}`;
            localStorage.removeItem(progressKey);
            localStorage.removeItem(completedKey);
        } catch (e) {
            console.error('Error limpiando progreso:', e);
        }
        
        // Reiniciar al primer ejercicio
        this.currentExerciseIndex = 0;
        this.lastDetection = null;
        this.lastCorrectDetection = false;
        
        // Recargar ejercicio
        this.loadExercise(0);
        
        // Resetear estado
        const statusEl = document.getElementById('detection-status');
        if (statusEl) {
            statusEl.className = 'alert alert-info text-center';
            statusEl.innerHTML = '<i class="bi bi-info-circle"></i> Categoría reiniciada. Iniciá la cámara para comenzar.';
        }
        
        // Actualizar estados de categorías
        this.updateCategoryStatuses();
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
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            item.style.marginBottom = '4px';
            item.style.padding = '4px';
            item.style.borderBottom = '1px solid #eee';
            
            const label = document.createElement('span');
            label.textContent = `${ex.id}: ${cnt} muestras`;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '🗑️';
            deleteBtn.className = 'btn btn-sm btn-outline-danger';
            deleteBtn.style.padding = '2px 6px';
            deleteBtn.style.fontSize = '12px';
            deleteBtn.title = 'Borrar todas las muestras de ' + ex.id;
            deleteBtn.addEventListener('click', () => {
                if (confirm(`¿Estás seguro de borrar todas las muestras de ${ex.id}?`)) {
                    this.deleteSamples(ex.id);
                }
            });
            
            item.appendChild(label);
            if (cnt > 0) {
                item.appendChild(deleteBtn);
            }
            list.appendChild(item);
        });
    }
    
    deleteSamples(label) {
        if (this.samples[label]) {
            delete this.samples[label];
            this.persistSamples();
            this.updateAdminPanelCounts();
            console.log(`Muestras de ${label} eliminadas`);
            
            // Mostrar mensaje de confirmación
            const statusEl = document.getElementById('detection-status');
            if (statusEl) {
                statusEl.className = 'alert alert-success text-center';
                statusEl.innerHTML = `<i class="bi bi-check-circle"></i> Muestras de ${label} eliminadas`;
                setTimeout(() => {
                    if (statusEl && !this.cameraActive) {
                        statusEl.className = 'alert alert-info text-center';
                        statusEl.innerHTML = '<i class="bi bi-info-circle"></i> Iniciá la cámara para comenzar';
                    }
                }, 2000);
            }
        }
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
        const isTimeBased = this.currentCategory === 'saludos' || this.currentCategory === 'departamentos';
        btnRecord.textContent = isTimeBased ? 'Grabar muestra (15s)' : 'Grabar muestra';
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
            
            if (isTimeBased) {
                // Iniciar temporizador de 15 segundos
                this.trainingStartTime = Date.now();
                const statusEl = document.getElementById('detection-status');
                if (statusEl) {
                    statusEl.className = 'alert alert-info text-center';
                    statusEl.innerHTML = `<i class="bi bi-hourglass-split"></i> Grabando... 15s restantes para ${label}`;
                }
            }
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
