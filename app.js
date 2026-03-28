const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware setup
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

const weather = {
    city: "Suceava",
    date: "2025-06-01",
    temperature: {
        current: 19,
        high: 24,
        low: 12,
        feelsLike: 19
    },
    conditions: {
        description: "Predominant însorit",
        clouds: true,
        rainProbability: 80,
        precipitation: {
            type: "averse de ploaie",
            amount_mm: 15
        },
        lightnings: true,
        thunderstormRisk: true
    },
    wind: {
        speed_kmh: 29,
        gusts_kmh: 35,
        direction: "SE"
    },
    humidity: 74,
    pressure_hPa: 1018,
    uvIndex: 1,
    dewPoint: 3,
    visibility_km: 16,
    airQuality: {
        index: "Moderat",
        description: "Calitate acceptabilă a aerului"
    },
    sun: {
        sunrise: "05:15",
        sunset: "21:05"
    },
    moon: {
        phase: "Lună în descreștere",
        illumination: "47.1%"
    },
    pollen: {
        birch: 0,
        grass: 0,
        ragweed: 0
    },
    alerts: [{
        type: "Cod galben",
        issuedBy: "Administraţia Naţională de Meteorologie",
        start: "14:00",
        end: "20:00",
        description: "Averse torențiale, descărcări electrice, intensificări ale vântului (50-70 km/h), vijelii și grindină. Cantități de apă de 15-25 l/mp, izolat până la 40 l/mp."
    }]
};

app.get('/api/weather', (req, res) => {
    res.json(weather);
});

// Mapa de limbaje pentru Judge0 API
const languageMap = {
    'c': 45,
    'cpp': 54,
    'java': 26,
    'python': 71,
    'php': 8,
    'cs': 51,
    'go': 60,
    'javascript': 63,
    'html': 92,
    'css': 92,
    'js': 63
};

// Funcción para compilar con Judge0
async function compileWithJudge0(code, language_id, stdin) {
    const apiKey = process.env.JUDGE0_API_KEY;
    const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
    
    // Si estamos en Vercel, solo usar Judge0 API (no hay gcc/g++)
    if (isVercel) {
        console.log('[Judge0] Ejecutando en Vercel - usando solo API...');
        if (!apiKey || apiKey === 'demo') {
            console.log('[Judge0] Intentando versión gratuita (free.judge0.com)...');
            return await compileWithFreeJudge0(code, language_id, stdin);
        } else {
            console.log('[Judge0] Usando RapidAPI versión...');
            return await compileWithRapidAPIJudge0(code, language_id, stdin, apiKey);
        }
    }
    
    // En local, intenta versión gratuita primero
    if (!apiKey || apiKey === 'demo') {
        console.log('[Judge0] Intentando versión gratuita (free.judge0.com)...');
        try {
            return await compileWithFreeJudge0(code, language_id, stdin);
        } catch (error) {
            console.error('[Judge0-Free] Fallo:', error.message);
            console.log('[Judge0] Intentando versión local (educacional)...');
            return await compileWithLocalInterpreter(code, language_id, stdin);
        }
    }
    
    // Si hay API key, intenta RapidAPI
    console.log('[Judge0] Usando RapidAPI versión...');
    return await compileWithRapidAPIJudge0(code, language_id, stdin, apiKey);
}

// Compilador local educacional (fallback) - solo en local, no en Vercel
async function compileWithLocalInterpreter(code, language_id, stdin) {
    const { exec, execSync } = require('child_process');
    const fs = require('fs');
    const path = require('path');
    const tmpDir = process.env.TMPDIR || process.env.TMP || '/tmp';

    try {
        console.log('[Local] Compilando localmente...');

        let command = '';
        let fileName = '';
        let fileExt = '';
        let binaryName = '';
        let toolCheck = ''; // Para verificar si la herramienta existe

        // Mapear language_id a comandos
        switch(language_id) {
            case 71: // Python
                toolCheck = 'python3 --version';
                fileExt = '.py';
                fileName = path.join(tmpDir, `code_${Date.now()}${fileExt}`);
                fs.writeFileSync(fileName, code);
                command = `python3 "${fileName}"`;
                break;
                
            case 63: // JavaScript
                toolCheck = 'node --version';
                fileExt = '.js';
                fileName = path.join(tmpDir, `code_${Date.now()}${fileExt}`);
                fs.writeFileSync(fileName, code);
                command = `node "${fileName}"`;
                break;
                
            case 54: // C++
                toolCheck = 'g++ --version';
                fileExt = '.cpp';
                fileName = path.join(tmpDir, `code_${Date.now()}${fileExt}`);
                binaryName = path.join(tmpDir, `binary_${Date.now()}`);
                fs.writeFileSync(fileName, code);
                command = `g++ "${fileName}" -o "${binaryName}" && timeout 5 "${binaryName}"`;
                break;
                
            case 45: // C
                toolCheck = 'gcc --version';
                fileExt = '.c';
                fileName = path.join(tmpDir, `code_${Date.now()}${fileExt}`);
                binaryName = path.join(tmpDir, `binary_${Date.now()}`);
                fs.writeFileSync(fileName, code);
                command = `gcc "${fileName}" -o "${binaryName}" && timeout 5 "${binaryName}"`;
                break;
                
            default:
                throw new Error(`Lenguaje ID ${language_id} no soportado localmente.`);
        }

        // Verificar si la herramienta está disponible
        try {
            execSync(toolCheck, { stdio: 'ignore' });
        } catch (e) {
            console.warn(`[Local] Herramienta no disponible para language_id ${language_id}`);
            throw new Error(`Compiler not available locally for language ${language_id}. Please use Judge0 API.`);
        }

        return new Promise((resolve) => {
            exec(command, { timeout: 15000, maxBuffer: 10 * 1024 * 1024, shell: '/bin/bash' }, (error, stdout, stderr) => {
                // Limpiar
                try { fs.unlinkSync(fileName); } catch(e) {}
                try { if (binaryName) fs.unlinkSync(binaryName); } catch(e) {}

                const output = {
                    stdout: stdout || '',
                    stderr: error ? (stderr || error.message) : '',
                    compile_output: '',
                    status: error ? 'Runtime Error' : 'Accepted',
                    exit_code: error ? 1 : 0,
                    time: 0,
                    memory: 0
                };

                console.log('[Local] Resultado:', output.status);
                resolve(output);
            });
        });

    } catch (error) {
        console.error('[Local] Eroare:', error.message);
        throw error;
    }
}

// Versiune gratuită - free.judge0.com (nu necesită API key)
async function compileWithFreeJudge0(code, language_id, stdin) {
    try {
        console.log('[Judge0-Free] Trimitere cod...');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15 sec timeout

        const submissionResponse = await fetch('https://free.judge0.com/submissions?base64_encoded=false&fields=*', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                source_code: code,
                language_id: language_id,
                stdin: stdin || '',
                wait: true
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);
        console.log('[Judge0-Free] Response Status:', submissionResponse.status);

        if (!submissionResponse.ok) {
            const errorText = await submissionResponse.text();
            console.error('[Judge0-Free] HTTP Error:', submissionResponse.status, errorText);
            throw new Error(`HTTP ${submissionResponse.status}: ${errorText}`);
        }

        const result = await submissionResponse.json();
        console.log('[Judge0-Free] Rezultat:', result.status);

        return {
            stdout: result.stdout || '',
            stderr: result.stderr || '',
            compile_output: result.compile_output || '',
            status: result.status?.description || 'Success',
            exit_code: result.exit_code || 0,
            time: result.time || 0,
            memory: result.memory || 0
        };

    } catch (error) {
        console.error('[Judge0-Free] Eroare:', error.message);
        throw error;
    }
}

// Versiune RapidAPI - judge0-ce.p.rapidapi.com (necesită API key)
async function compileWithRapidAPIJudge0(code, language_id, stdin, apiKey) {
    try {
        console.log('[Judge0-RapidAPI] Trimitere cod...');

        const submissionResponse = await fetch('https://judge0-ce.p.rapidapi.com/submissions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
            },
            body: JSON.stringify({
                source_code: code,
                language_id: language_id,
                stdin: stdin || ''
            })
        });

        console.log('[Judge0-RapidAPI] Response Status:', submissionResponse.status);

        if (!submissionResponse.ok) {
            const errorText = await submissionResponse.text();
            console.error('[Judge0-RapidAPI] HTTP Error:', submissionResponse.status, errorText);

            if (submissionResponse.status === 401 || submissionResponse.status === 403) {
                throw new Error('API Key invalid (401/403). Verifică JUDGE0_API_KEY în .env');
            }
            if (submissionResponse.status === 429) {
                throw new Error('Rate limit exceeded (429). Așteptă sau upgrade planul RapidAPI.');
            }

            throw new Error(`HTTP ${submissionResponse.status}: ${errorText}`);
        }

        const submission = await submissionResponse.json();

        if (!submission.token) {
            console.error('[Judge0-RapidAPI] Nu s-a primit token:', submission);
            throw new Error('Niciun token primit de la Judge0');
        }

        console.log('[Judge0-RapidAPI] Token:', submission.token);

        // Poll for results
        let result = null;
        let attempts = 0;
        const maxAttempts = 20;

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500));

            const statusResponse = await fetch(
                `https://judge0-ce.p.rapidapi.com/submissions/${submission.token}`,
                {
                    headers: {
                        'X-RapidAPI-Key': apiKey,
                        'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
                    }
                }
            );

            if (!statusResponse.ok) {
                console.error('[Judge0-RapidAPI] Eroare status:', statusResponse.status);
                attempts++;
                continue;
            }

            result = await statusResponse.json();

            if (result.status?.id > 2) {
                console.log('[Judge0-RapidAPI] Finalizat:', result.status.description);
                break;
            }

            attempts++;
        }

        if (!result) {
            throw new Error('Timeout la compilare');
        }

        return {
            stdout: result.stdout || '',
            stderr: result.stderr || '',
            compile_output: result.compile_output || '',
            status: result.status?.description || 'Success',
            exit_code: result.exit_code || 0,
            time: result.time || 0,
            memory: result.memory || 0
        };

    } catch (error) {
        console.error('[Judge0-RapidAPI] Eroare:', error.message);
        throw error;
    }
}

// Endpoint pentru compilare prin Judge0 API
app.post('/api/compile', async (req, res) => {
    try {
        const { code, language = 'cpp', stdin = '' } = req.body;
        
        if (!code) {
            return res.status(400).json({ error: 'Cod lipsă' });
        }

        const language_id = languageMap[language] || languageMap['cpp'];

        console.log(`[Compile] Limbaj: ${language} (ID: ${language_id})`);

        const output = await compileWithJudge0(code, language_id, stdin);
        res.json(output);

    } catch (error) {
        console.error('[Compile] Eroare finală:', error.message);
        
        // Mesaje de eroare mai detaliate
        let suggestion = '';
        if (error.message.includes('fetch') || error.message.includes('Network')) {
            suggestion = 'Serviciul Judge0 este indisponibil. Verifica conectarea la internet.';
        } else if (error.message.includes('API Key')) {
            suggestion = 'Configureaza JUDGE0_API_KEY in .env cu o cheie valida de la RapidAPI.';
        } else if (error.message.includes('Compiler not available')) {
            suggestion = 'C/C++ compiler nu este disponibil. Compileaza C++ cod pe Judge0 cu o API key.';
        } else if (error.message.includes('Rate limit')) {
            suggestion = 'Ai depasit limita de compilari. Asteapta sau configureaza RapidAPI Pro plan.';
        }

        res.status(500).json({ 
            error: error.message || 'Eroare la compilare',
            suggestion: suggestion,
            message: 'Cod nu s-a putut compila. Verifica cod si incearca din nou.'
        });
    }
});

app.post('/api/register', (req, res) => {
    res.redirect('/login');
});

app.post('/api/login', (req, res) => {
    res.redirect('/');
});

app.get('/', (req, res) => {
    res.render('routes/home', { title: "MNDCode" });
});

app.get('/compiler', (req, res) => {
    res.render('routes/compiler', { title: "Compiler" });
});

app.get('/soon', (req, res) => {
    res.render("routes/soon", { title: "Coming soon" });
});

app.get('/register', (req, res) => {
    res.render('account/register', { title: "Register" });
});

app.get('/login', (req, res) => {
    res.render('account/login', { title: "Login" });
});

app.get('/hard_lessons', (req, res) => {
    res.render('hard_lessons/hard_lessons', { title: "Hard Lessons" });
});

app.get('/hard_lessons/1', (req, res) => {
    res.render('hard_lessons/hard_lessons__1', { title: "Hard Lesson 1" });
});

app.get('/hard_lessons/2', (req, res) => {
    res.render('hard_lessons/hard_lessons__2', { title: "Hard Lesson 2" });
});

app.get('/hard_lessons/3', (req, res) => {
    res.render('hard_lessons/hard_lessons__3', { title: "Hard Lesson 3" });
});

app.get('/languages', (req, res) => {
    res.render('languages/languages', { title: "Languages" });
});

app.get('/languages/help', (req, res) => {
    res.render('languages/help', { title: "Help" });
});

app.get('/languages/c', (req, res) => {
    res.render('languages/c', { title: "C" });
});

app.get('/languages/cpp', (req, res) => {
    res.render('languages/cpp', { title: "CPP" });
});

app.get('/languages/cs', (req, res) => {
    res.render('languages/cs', { title: "CS" });
});

app.get('/languages/go', (req, res) => {
    res.render('languages/go', { title: "GO" });
});

app.get('/languages/java', (req, res) => {
    res.render('languages/java', { title: "JAVA" });
});

app.get('/languages/python', (req, res) => {
    res.render('languages/python', { title: "Python" });
});

app.get('/languages/html', (req, res) => {
    res.render('languages/html', { title: "Html" });
});

app.get('/languages/js', (req, res) => {
    res.render('languages/js', { title: "JS" });
});

app.get('/languages/css', (req, res) => {
    res.render('languages/css', { title: "CSS" });
});

app.get('/languages/php', (req, res) => {
    res.render('languages/php', { title: "PHP" });
});

app.get('/about', (req, res) => {
    res.render('footer/about', { title: "About" });
});

app.get('/contact', (req, res) => {
    res.render('footer/contact', { title: "Contact" });
});

app.get('/privacy_policy', (req, res) => {
    res.render('footer/privacy_policy', { title: "Privacy Policy" });
});

app.get('/terms_and_conditions', (req, res) => {
    res.render('footer/terms_and_conditions', { title: "Terms And Conditions" });
});

app.use((req, res) => {
    res.status(404).render('routes/404', { title: "404" });
});

// Pornire locală pentru teste
if (process.env.NODE_ENV !== 'production') {
    const PORT = 3000;
    app.listen(PORT, () => console.log(`🚀 MNDCode rulează pe http://localhost:${PORT}`));
}

module.exports = app;