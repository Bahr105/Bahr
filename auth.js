// --- Authentication Functions ---

/**
 * Loads Google API and GIS scripts.
 * @returns {Promise<void>} A promise that resolves when scripts are loaded and initialized.
 */
function loadGoogleScripts() {
    return new Promise((resolve, reject) => {
        if (googleScriptsLoadedAndInitialized) {
            console.log('Google Scripts already loaded and initialized.');
            resolve();
            return;
        }

        const gapiScript = document.createElement('script');
        gapiScript.src = 'https://apis.google.com/js/api.js';
        gapiScript.async = true;
        gapiScript.defer = true;
        gapiScript.onload = function() {
            console.log('GAPI loaded, initializing...');
            gapi.load('client', async () => {
                try {
                    await initializeGapiClient();
                    const gisScript = document.createElement('script');
                    gisScript.src = 'https://accounts.google.com/gsi/client';
                    gisScript.async = true;
                    gisScript.defer = true;
                    gisScript.onload = function() {
                        console.log('GIS loaded, initializing...');
                        gisLoaded();
                        googleScriptsLoadedAndInitialized = true;
                        console.log('Both GAPI and GIS initialized successfully');
                        resolve();
                    };
                    gisScript.onerror = () => {
                        console.error('Failed to load GIS');
                        reject(new Error('Failed to load GIS'));
                    };
                    document.head.appendChild(gisScript);
                } catch (error) {
                    console.error('Error during GAPI client initialization:', error);
                    reject(error);
                }
            });
        };
        gapiScript.onerror = () => {
            console.error('Failed to load GAPI');
            reject(new Error('Failed to load GAPI'));
        };
        document.head.appendChild(gapiScript);
    });
}

/**
 * Initializes the Google API client.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
        });
        gapiInited = true;
        console.log('GAPI client initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing GAPI client:', error);
        showMessage('فشل تهيئة Google API', 'error');
        return false;
    }
}

/**
 * Initializes the Google Identity Services (GIS) client.
 */
function gisLoaded() {
    try {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '', // Callback will be set dynamically in handleAuthClick
        });
        gisInited = true;
        console.log('GIS client initialized.');
        maybePerformAuthAndLoadData(); // Attempt authentication and data loading
    } catch (error) {
        console.error('Error initializing GIS:', error);
        showMessage('فشل تهيئة Google Identity Services', 'error');
        handleAuthFailure();
    }
}

/**
 * Attempts to perform authentication and load initial data.
 */
async function maybePerformAuthAndLoadData() {
    if (!gapiInited || !gisInited) {
        console.log('GAPI or GIS not yet initialized. Waiting...');
        return;
    }

    if (window.authInProgress) {
        console.log('Authentication already in progress, skipping...');
        return;
    }
    window.authInProgress = true;

    const wasAuthenticatedInLocalStorage = localStorage.getItem('googleAuthState') === 'authenticated';
    const savedTokenStr = localStorage.getItem('googleAuthToken');

    console.log('Auth check:', {
        wasAuthenticatedInLocalStorage,
        hasSavedToken: !!savedTokenStr,
        gapiInited,
        gisInited
    });

    isAuthenticated = false;
    if (gapi.client) {
        gapi.client.setToken(null);
    }

    if (wasAuthenticatedInLocalStorage && savedTokenStr) {
        try {
            const savedToken = JSON.parse(savedTokenStr);
            console.log('Restoring token from localStorage:', savedToken);

            if (gapi.client) {
                gapi.client.setToken(savedToken);
            }

            if (isTokenValid()) {
                isAuthenticated = true;
                console.log('✅ تم استعادة التوكن بنجاح من localStorage');
                await loadInitialData();
            } else {
                console.log('🔄 التوكن منتهي الصلاحية، جاري تجديده...');
                await handleAuthClick(true); // Attempt silent renewal
            }
        } catch (error) {
            console.error('❌ خطأ في استعادة التوكن:', error);
            await handleAuthClick(false); // Request user consent
        }
    } else {
        console.log('🔐 لا توجد مصادقة سابقة، جاري طلب المصادقة...');
        await handleAuthClick(false); // Request user consent
    }
    window.authInProgress = false;
}

/**
 * Handles the authentication click event, initiating the OAuth2 flow.
 * @param {boolean} silent - If true, attempts silent token renewal.
 * @returns {Promise<void>} A promise that resolves on successful authentication or rejects on failure.
 */
async function handleAuthClick(silent = false) {
    if (window.authClickInProgress) {
        console.log('Auth click already in progress, skipping...');
        return Promise.resolve();
    }
    window.authClickInProgress = true;

    return new Promise((resolve, reject) => {
        tokenClient.callback = async (resp) => {
            window.authClickInProgress = false;
            if (resp.error !== undefined) {
                console.error('فشل المصادقة:', resp.error);
                handleAuthError(resp);
                reject(resp);
            } else {
                handleAuthSuccess();
                console.log('تمت المصادقة بنجاح. جاري تحميل البيانات الأولية...');
                try {
                    await loadInitialData();
                    resolve();
                } catch (error) {
                    console.error('فشل تحميل البيانات بعد المصادقة:', error);
                    showMessage('فشل تحميل البيانات بعد المصادقة.', 'error');
                    reject(error);
                }
            }
        };

        if (silent) {
            console.log('محاولة تحديث التوكن بصمت.');
            tokenClient.requestAccessToken({ prompt: 'none' });
        } else {
            console.log('طلب موافقة المستخدم.');
            tokenClient.requestAccessToken({ prompt: 'consent' });
        }
    });
}

/**
 * Handles authentication errors.
 * @param {object} resp - The authentication response object.
 */
function handleAuthError(resp) {
    if (resp.error === 'popup_closed_by_user' || resp.error === 'access_denied') {
        showMessage('تم إلغاء المصادقة بواسطة المستخدم.', 'warning');
    } else {
        showMessage('فشل المصادقة مع Google. يرجى المحاولة مرة أخرى.', 'error');
    }
    handleAuthFailure(); // Clear authentication state
}

/**
 * Checks if the current Google API token is valid and not expired.
 * @returns {boolean} True if the token is valid, false otherwise.
 */
function isTokenValid() {
    if (typeof gapi === 'undefined' || !gapi.client) {
        console.log('GAPI client not available, cannot check token validity.');
        return false;
    }

    const token = gapi.client.getToken();
    if (!token || !token.created_at) {
        console.log('No token or created_at found');
        return false;
    }

    const expiresAt = token.created_at + (token.expires_in * 1000);
    const safetyMargin = 5 * 60 * 1000; // 5 minutes safety margin
    const isValid = expiresAt > (Date.now() + safetyMargin);
    console.log('Token expiry check:', {
        created: new Date(token.created_at),
        expires: new Date(expiresAt),
        now: new Date(),
        isValid
    });
    return isValid;
}

/**
 * Saves authentication state and token upon successful authentication.
 */
function handleAuthSuccess() {
    isAuthenticated = true;
    localStorage.setItem('googleAuthState', 'authenticated');

    const token = gapi.client.getToken();
    if (token) {
        if (!token.created_at) {
            token.created_at = Date.now();
        }
        localStorage.setItem('googleAuthToken', JSON.stringify(token));
        console.log('Token saved to localStorage');
    }
}

/**
 * Clears authentication state and token upon failure or logout.
 */
function handleAuthFailure() {
    isAuthenticated = false;
    localStorage.removeItem('googleAuthState');
    localStorage.removeItem('googleAuthToken');
    if (typeof gapi !== 'undefined' && gapi.client && gapi.client.getToken()) {
        gapi.client.setToken(null);
    }
}

/**
 * Handles user login.
 */
async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!username || !password) {
        showMessage('يرجى اختيار المستخدم وإدخال كلمة المرور.', 'warning');
        return;
    }

    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        if (user.status === 'محظور') {
            showMessage('هذا المستخدم محظور. اتصل بالمدير.', 'error');
            return;
        }
        if (user.status === 'موقوف') {
            showMessage('هذا المستخدم موقوف مؤقتاً. اتصل بالمدير.', 'warning');
            return;
        }

        currentUser = user;
        currentUserName = user.name;
        currentUserRole = user.role;

        if (currentUserRole === 'كاشير') {
            showCashierPage();
        } else if (currentUserRole === 'محاسب') {
            showAccountantPage();
        }
        showMessage(`مرحباً بك، ${currentUserName}!`, 'success');
    } else {
        showMessage('اسم المستخدم أو كلمة المرور غير صحيحة.', 'error');
    }
}

/**
 * Handles user logout.
 */
function logout() {
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('cashierPage').classList.remove('active');
    document.getElementById('accountantPage').classList.remove('active');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    currentUser = null;
    currentUserName = '';
    currentUserRole = '';
    handleAuthFailure();
    showMessage('تم تسجيل الخروج بنجاح.', 'success');
}

/**
 * Populates the user dropdown for login.
 */
function populateUserDropdown() {
    const usernameSelect = document.getElementById('username');
    if (!usernameSelect) return;

    usernameSelect.innerHTML = '<option value="">اختر المستخدم</option>';
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.username;
        option.textContent = user.name + ' (' + user.role + ')';
        usernameSelect.appendChild(option);
    });
}