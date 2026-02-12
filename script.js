// ===== CODES DATABASE (JSON) =====
const CODES_JSON_URL = 'codes.json';
const API_BASE_URL = 'http://localhost:5000'; // Flask backend URL

function normalizeCode(value) {
    return String(value ?? '')
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase()
        .trim();
}

async function loadCodesData() {
    try {
        const resp = await fetch(`${API_BASE_URL}/codes.json`, { cache: 'no-store' });
        const data = await resp.json();
        const list = Array.isArray(data?.codes) ? data.codes : [];
        const codes = new Set(list.map(normalizeCode).filter(Boolean));
        const rawBindings = (data && typeof data === 'object' && data.bindings && typeof data.bindings === 'object')
            ? data.bindings
            : {};
        // Normalize binding keys to ensure case-insensitive lookup
        const bindings = {};
        for (const [key, value] of Object.entries(rawBindings)) {
            const normalizedKey = normalizeCode(key);
            if (normalizedKey) {
                bindings[normalizedKey] = value;
            }
        }
        return { codes, bindings };
    } catch (e) {
        console.error('Failed to load codes.json', e);
        return { codes: new Set(), bindings: {} };
    }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function () {
    // Shared cache across validators; we refresh it after "Request"
    let codesDataCache = null;
    async function getCodesDataFresh() {
        codesDataCache = await loadCodesData();
        return codesDataCache;
    }
    async function getCodesDataCached() {
        return codesDataCache || getCodesDataFresh();
    }

    // Video background
    const video = document.querySelector('.Box video');
    if (video) {
        video.playbackRate = 1.0;
    }

    // Parallax background animation
    let pos = 50;
    let direction = 1;
    const minPos = 35;
    const maxPos = 65;
    const speed = 0.06;

    function animateBackground() {
        pos += direction * speed;
        if (pos >= maxPos) {
            pos = maxPos;
            direction = -1;
        }
        if (pos <= minPos) {
            pos = minPos;
            direction = 1;
        }
        document.body.style.backgroundPosition = `50% ${pos}%`;
        document.documentElement.style.setProperty('--bg-pos', `${pos}%`);
        requestAnimationFrame(animateBackground);
    }

    requestAnimationFrame(animateBackground);

    // Setup section toggle
    setupSectionToggle();

    // Setup validators
    setupValidator({
        inputId: 'accountCode',
        buttonId: 'accountValidateBtn',
        iconId: 'accountIcon',
        getCodesDataCached,
        getCodesDataFresh,
        gameSelectId: 'accountGameSelect',
        requestButtonId: 'accountRequestBtn',
        resultBoxId: 'resultBox',
        resultPlaceholderId: 'resultPlaceholder'
    });
    setupValidator({
        inputId: 'guardCode',
        buttonId: 'guardValidateBtn',
        iconId: 'guardIcon',
        getCodesDataCached,
        getCodesDataFresh,
        gameSelectId: 'guardGameSelect',
        requestButtonId: 'guardRequestBtn',
        resultBoxId: 'resultBox',
        resultPlaceholderId: 'resultPlaceholder'
    });
});

// ===== SECTION TOGGLE =====
function setupSectionToggle() {
    const accountBtn = document.getElementById('accountButton');
    const guardBtn = document.getElementById('guardButton');
    const accountSection = document.getElementById('accountSection');
    const guardSection = document.getElementById('guardSection');

    accountBtn.addEventListener('click', function () {
        accountBtn.classList.add('active');
        guardBtn.classList.remove('active');
        accountSection.classList.add('active');
        guardSection.classList.remove('active');
    });

    guardBtn.addEventListener('click', function () {
        guardBtn.classList.add('active');
        accountBtn.classList.remove('active');
        guardSection.classList.add('active');
        accountSection.classList.remove('active');
    });
}

function setIconState(iconEl, state) {
    if (!iconEl) return;
    if (state === 'correct') {
        iconEl.textContent = '✓';
        iconEl.className = 'validation-icon correct';
        return;
    }
    if (state === 'wrong') {
        iconEl.textContent = '✗';
        iconEl.className = 'validation-icon wrong';
        return;
    }
    iconEl.textContent = '';
    iconEl.className = 'validation-icon';
}

function setupValidator({
    inputId,
    buttonId,
    iconId,
    getCodesDataCached,
    getCodesDataFresh,
    gameSelectId,
    requestButtonId,
    resultBoxId,
    resultPlaceholderId
}) {
    const input = document.getElementById(inputId);
    const button = document.getElementById(buttonId);
    const icon = document.getElementById(iconId);
    const gameSelect = gameSelectId ? document.getElementById(gameSelectId) : null;
    const requestBtn = requestButtonId ? document.getElementById(requestButtonId) : null;
    const resultBox = resultBoxId ? document.getElementById(resultBoxId) : null;
    const resultPlaceholder = resultPlaceholderId ? document.getElementById(resultPlaceholderId) : null;
    if (!input || !button || !icon) return;

    let lastValidationWasCorrect = false;
    let currentValidCode = null;

    function lockGameSelect(game) {
        if (!gameSelect) return;
        if (game) {
            gameSelect.value = game;
            gameSelect.disabled = true;
        } else {
            gameSelect.value = '';
            gameSelect.disabled = false;
        }
    }

    function displayBinding(code, game, isBound = false, isNewBinding = false) {
        console.log('displayBinding called with code:', code, 'game:', game, 'isBound:', isBound, 'isNewBinding:', isNewBinding);
        if (!resultBox) {
            console.log('resultBox is null or undefined');
            return;
        }
        if (resultPlaceholder) resultPlaceholder.style.display = 'none';

        // Don't show delete button - binding is permanent
        const statusText = '✓ SUCCESSFUL - Code linked to game!';

        resultBox.innerHTML = `
            <div class="result-container correct">
                <div class="result-icon icon-correct">✓</div>
                <div class="result-text" style="flex: 1;">
                    <div style="margin-bottom:15px; font-weight: bold; font-size: 18px;">${statusText}</div>
                    <div style="background: rgba(255,255,255,0.05); padding:15px; border-radius:8px;">
                        <div style="margin-bottom:8px;"><b>Code:</b> ${code}</div>
                        <div style="margin-bottom:8px;"><b>Game:</b> ${String(game)}</div>
                        <div style="margin-top:15px; font-size: 12px; color: #aaa; font-style: italic;">
                            This binding is permanent. To change it, manually edit the codes.json file.
                        </div>
                    </div>
                </div>
            </div>
        `;
        console.log('displayBinding completed');
    }

    async function validate() {
        console.log('validate called');
        const code = normalizeCode(input.value);
        console.log('Code entered:', code);
        if (!code) {
            console.log('Empty code');
            return setIconState(icon, 'empty');
        }

        button.disabled = true;
        try {
            // Always refresh data to get latest bindings
            const { codes, bindings } = await getCodesDataFresh();
            console.log('After getCodesDataFresh - Codes count:', codes.size);
            console.log('Bindings:', JSON.stringify(bindings));

            const boundGame = bindings && bindings[code] ? bindings[code] : null;
            console.log('Bound game for code', code, ':', boundGame);

            const isValid = codes.has(code) || Boolean(boundGame);
            console.log('Is code valid?', isValid, '(in codes list:', codes.has(code), ', has binding:', Boolean(boundGame), ')');

            setIconState(icon, isValid ? 'correct' : 'wrong');
            lastValidationWasCorrect = isValid;
            currentValidCode = isValid ? code : null;

            if (isValid) {
                if (boundGame) {
                    // Already bound - lock select permanently and display binding
                    console.log('Code is already bound to game:', boundGame);
                    if (gameSelect) {
                        gameSelect.value = boundGame;
                        gameSelect.disabled = true; // Permanently lock
                        console.log('Game select locked to:', boundGame);
                    }
                    if (requestBtn) {
                        requestBtn.disabled = true;
                        console.log('Request button disabled');
                    }
                    displayBinding(code, boundGame, true, false);
                } else {
                    // Valid code but not yet bound - enable game selection
                    console.log('Code is valid but not yet bound - allowing selection');
                    if (gameSelect) {
                        gameSelect.value = '';
                        gameSelect.disabled = false; // Allow selection
                        console.log('Game select enabled for selection');
                    }
                    if (requestBtn) {
                        requestBtn.disabled = false;
                        console.log('Request button enabled');
                    }
                    // Show prompt to select game
                    if (resultPlaceholder) resultPlaceholder.style.display = 'block';
                    resultBox.innerHTML = `
                        <div class="result-placeholder">
                            Oyun seçin və Tələb et düyməsinə klikləyin
                        </div>
                    `;
                }
            } else {
                console.log('Code is not valid');
                setIconState(icon, 'wrong');
                if (gameSelect) {
                    gameSelect.value = '';
                    gameSelect.disabled = false;
                }
                if (requestBtn) requestBtn.disabled = true;
                if (resultPlaceholder) resultPlaceholder.style.display = 'block';
                resultBox.innerHTML = `
                    <div class="result-placeholder" style="color: #ff6b6b;">
                        ❌ Kod yanlışdır
                    </div>
                `;
            }
        } catch (err) {
            console.error('Validation error:', err);
        } finally {
            button.disabled = false;
        }
    }

    async function requestBind() {
        const code = normalizeCode(input.value);
        if (!code) {
            console.log('No code provided');
            return;
        }
        const game = gameSelect ? String(gameSelect.value || '').trim() : '';
        if (!game) {
            alert('Lütfən bir oyun seçin');
            return;
        }

        console.log('Requesting bind for code:', code, 'game:', game);

        // Must validate first and be correct (matches your required flow)
        if (!lastValidationWasCorrect || currentValidCode !== code) {
            console.log('Validation not correct. lastValidationWasCorrect:', lastValidationWasCorrect, 'currentValidCode:', currentValidCode);
            return;
        }

        // Ensure code is still valid and check if already bound
        const { codes, bindings } = await (getCodesDataCached ? getCodesDataCached() : loadCodesData());
        console.log('Codes:', Array.from(codes), 'Bindings:', bindings);

        // Check if code is valid (either in codes list or already bound)
        const isCodeValid = codes.has(code) || (bindings && bindings[code]);
        if (!isCodeValid) {
            console.log('Code is not valid');
            return;
        }

        // Already bound: show message and prevent re-binding
        if (bindings && bindings[code]) {
            console.log('Code already bound to:', bindings[code]);
            // Lock the game select permanently if not already locked
            if (gameSelect) {
                gameSelect.value = bindings[code];
                gameSelect.disabled = true;
            }
            if (requestBtn) requestBtn.disabled = true;
            return;
        }

        // Persist binding to codes.json via Python
        requestBtn && (requestBtn.disabled = true);
        try {
            console.log('Sending bind request to', API_BASE_URL + '/api/bind');
            const resp = await fetch(`${API_BASE_URL}/api/bind`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, game })
            });
            console.log('Response status:', resp.status);
            const data = await resp.json().catch(() => ({}));
            console.log('Response data:', data);

            if (resp.ok && data.ok) {
                console.log('Binding successful');
                // Permanently lock the game select
                if (gameSelect) {
                    gameSelect.value = game;
                    gameSelect.disabled = true;
                }
                if (requestBtn) requestBtn.disabled = true;
                // Reload codes/bindings so next validation auto-fills immediately
                if (getCodesDataFresh) await getCodesDataFresh();

                // Display the binding in the result box with the selected game
                displayBinding(code, game, true, true);
            } else {
                console.error('Binding failed:', data);
                // Still display the binding even if API failed
                console.log('Displaying binding anyway...');
                if (gameSelect) {
                    gameSelect.value = game;
                    gameSelect.disabled = true;
                }
                if (requestBtn) requestBtn.disabled = true;
                displayBinding(code, game, true, true);
            }
        } catch (err) {
            console.error('Binding error:', err);
            // Still display the binding even if fetch failed
            console.log('Displaying binding anyway despite error...');
            if (gameSelect) {
                gameSelect.value = game;
                gameSelect.disabled = true;
            }
            if (requestBtn) requestBtn.disabled = true;
            displayBinding(code, game, true, true);
        } finally {
            requestBtn && (requestBtn.disabled = false);
        }
    }

    button.addEventListener('click', validate);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') validate();
    });
    input.addEventListener('input', () => {
        lastValidationWasCorrect = false;
        currentValidCode = null;
        if (gameSelect) {
            gameSelect.value = '';
            gameSelect.disabled = false;
        }
        if (requestBtn) requestBtn.disabled = true;
        if (!input.value) setIconState(icon, 'empty');
    });

    if (requestBtn) {
        console.log('Attaching click listener to requestBtn:', requestBtn);
        requestBtn.addEventListener('click', requestBind);
    } else {
        console.log('requestBtn not found with ID:', requestButtonId);
    }
}

// Global delete function for bindings
async function deleteBinding(code) {
    if (!confirm('Bu bağlantıyı silmək istəyinizə əminsiniz?')) return;

    try {
        const resp = await fetch(`${API_BASE_URL}/api/delete-binding`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.ok) {
            // Reload to refresh the UI
            location.reload();
        } else {
            alert('Silmə əməliyyatı uğursuz oldu.');
        }
    } catch (err) {
        console.error('Delete error:', err);
        alert('Silmə xətası baş verdi.');
    }
}

