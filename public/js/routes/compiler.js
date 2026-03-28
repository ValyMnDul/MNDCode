
let cooldown = false;
const runBtn = document.getElementById("runBtn");
const outputElement = document.getElementById('output');
const codeElement = document.getElementById('code');
const languageElement = document.getElementById('language');

// Load saved code and language from localStorage
document.addEventListener('DOMContentLoaded', () => {
    const savedCode = localStorage.getItem('compiler_code');
    const savedLanguage = localStorage.getItem('compiler_language');
    
    if (savedCode) codeElement.value = savedCode;
    if (savedLanguage) languageElement.value = savedLanguage;
});

// Save code and language on change
codeElement.addEventListener('input', () => {
    localStorage.setItem('compiler_code', codeElement.value);
});

languageElement.addEventListener('change', () => {
    localStorage.setItem('compiler_language', languageElement.value);
});

// Keyboard shortcut: Ctrl+Enter to run
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (!cooldown) runCode();
    }
});

function runCode() {
    if (!cooldown) {
        SendRequest();

        cooldown = true;
        runBtn.disabled = true;
        runBtn.textContent = "Running...";
    }
}

async function SendRequest() {
    try {
        const code = codeElement.value;
        const language = languageElement.value || 'cpp';

        if (!code.trim()) {
            outputElement.textContent = 'Error: Code is empty';
            outputElement.style.color = '#d9480f';
            resetButton();
            return;
        }

        outputElement.textContent = 'Compiling...';
        outputElement.style.color = '#1a1a1a';

        const response = await fetch('/api/compile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                code: code,
                language: language,
                stdin: ''
            }),
            timeout: 30000
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        let output = '';

        if (result.error) {
            output = `Error: ${result.error}`;
            outputElement.style.color = '#d9480f';
        } else {
            if (result.compile_output && result.compile_output.trim()) {
                output = `Compilation Error:\n${result.compile_output}`;
                outputElement.style.color = '#d9480f';
            } else if (result.stderr && result.stderr.trim()) {
                output = `Error:\n${result.stderr}`;
                outputElement.style.color = '#d9480f';
            } else {
                output = result.stdout || '(No output)';
                outputElement.style.color = '#1a1a1a';
            }
        }

        outputElement.textContent = output;

    } catch (error) {
        console.error('Error:', error);
        outputElement.textContent = `Network Error: ${error.message}`;
        outputElement.style.color = '#d9480f';
    } finally {
        resetButton();
    }
}

function resetButton() {
    cooldown = false;
    runBtn.disabled = false;
    runBtn.textContent = "Run";
}

