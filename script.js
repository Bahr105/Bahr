// تحميل حالة المصادقة من localStorage عند بدء التشغيل
let isAuthenticated = localStorage.getItem('googleAuthState') === 'authenticated';

// عند نجاح المصادقة، احفظ الحالة فوراً
function handleAuthSuccess() {
    isAuthenticated = true;
    localStorage.setItem('googleAuthState', 'authenticated');

    // حفظ التوكن في localStorage مع معلومات الوقت
    const token = gapi.client.getToken();
    if (token) {
        // إضافة timestamp إذا لم يكن موجوداً
        if (!token.created_at) {
            token.created_at = Date.now();
        }
        localStorage.setItem('googleAuthToken', JSON.stringify(token));
        console.log('Token saved to localStorage');
    }
}

// عند فشل المصادقة أو تسجيل الخروج، احذف الحالة
function handleAuthFailure() {
    isAuthenticated = false;
    localStorage.removeItem('googleAuthState');
    localStorage.removeItem('googleAuthToken');
    if (typeof gapi !== 'undefined' && gapi.client && gapi.client.getToken()) {
        gapi.client.setToken(null);
    }
}

// --- Google Sheets API Configuration ---
const API_KEY = 'AIzaSyAFKAWVM6Y7V3yxuD7c-9u0e11Ki1z-5VU';
const CLIENT_ID = '514562869133-nuervm5carqqctkqudvqkcolup7s12ve.apps.googleusercontent.com';
const SPREADSHEET_ID = '16WsTQuebZDGErC8NwPRYf7qsHDVWhfDvUtvQ7u7IC9Q';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

const SHEETS = {
    USERS: 'Users',
    CATEGORIES: 'Categories',
    EXPENSES: 'Expenses',
    CUSTOMERS: 'Customers',
    SHIFT_CLOSURES: 'ShiftClosures',
    CUSTOMER_CREDIT_HISTORY: 'CustomerCreditHistory'
};

let gapiInited = false;
let gisInited = false;
let tokenClient;

// --- Global Application State ---
let users = [];
let categories = [];
let customers = [];
let currentUser = null;
let currentUserName = '';
let currentUserRole = '';
let currentSelectedCustomerId = null;

// متغيرات جديدة لمنع التكرار
let initialDataLoaded = false;
let expenseSubmissionInProgress = false;
window.authInProgress = false;
window.authClickInProgress = false;
let googleScriptsLoadedAndInitialized = false; // متغير جديد لتتبع حالة التحميل والتهيئة الكاملة

let cashierDailyData = {
    expenses: [],
    insta: [],
    visa: [],
    online: [],
    totalExpenses: 0,
    totalInsta: 0,
    totalVisa: 0,
    totalOnline: 0,
    drawerCash: 0,
    shiftStartDate: null,
    shiftEndDate: null,
    shiftStartTime: null,
    shiftEndTime: null,
};

// دالة لتحميل مكتبات Google API و GIS
function loadGoogleScripts() {
    return new Promise((resolve, reject) => {
        if (googleScriptsLoadedAndInitialized) {
            console.log('Google Scripts already loaded and initialized.');
            resolve();
            return;
        }

        const gapiScript = document.createElement('script');
        gapiScript.src = 'https://apis.google.com/js/api.js';
        gapiScript.onload = function() {
            console.log('GAPI loaded, initializing...');
            gapi.load('client', async () => {
                try {
                    await initializeGapiClient();
                    const gisScript = document.createElement('script');
                    gisScript.src = 'https://accounts.google.com/gsi/client';
                    gisScript.onload = function() {
                        console.log('GIS loaded, initializing...');
                        gisLoaded();
                        googleScriptsLoadedAndInitialized = true; // تم التحميل والتهيئة بنجاح
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

// --- Google API Initialization ---
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

function gisLoaded() {
    try {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '', // سيتم تعيين الـ callback ديناميكيًا في handleAuthClick
        });
        gisInited = true;
        console.log('GIS client initialized.');
        maybePerformAuthAndLoadData(); // استدعاء هذه الدالة بعد تهيئة GIS
    } catch (error) {
        console.error('Error initializing GIS:', error);
        showMessage('فشل تهيئة Google Identity Services', 'error');
        handleAuthFailure();
    }
}

// دالة موحدة لبدء المصادقة وتحميل البيانات الأولية
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
                await handleAuthClick(true); // حاول التجديد بصمت
            }
        } catch (error) {
            console.error('❌ خطأ في استعادة التوكن:', error);
            await handleAuthClick(false); // اطلب موافقة المستخدم
        }
    } else {
        console.log('🔐 لا توجد مصادقة سابقة، جاري طلب المصادقة...');
        await handleAuthClick(false); // اطلب موافقة المستخدم
    }
    window.authInProgress = false;
}

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

function isTokenValid() {
    if (typeof gapi === 'undefined' || !gapi.client) {
        console.log('GAPI client not available, cannot check token validity.');
        return false;
    }

    const token = gapi.client.getToken();
    if (!token || !token.created_at) { // يجب أن يكون created_at موجودًا
        console.log('No token or created_at found');
        return false;
    }

    const expiresAt = token.created_at + (token.expires_in * 1000);
    const safetyMargin = 5 * 60 * 1000; // 5 دقائق هامش أمان
    const isValid = expiresAt > (Date.now() + safetyMargin);
    console.log('Token expiry check:', {
        created: new Date(token.created_at),
        expires: new Date(expiresAt),
        now: new Date(),
        isValid
    });
    return isValid;
}

// --- Google Sheets API Functions ---
async function readSheet(sheetName, range = 'A:Z') {
    try {
        if (!isAuthenticated) {
            console.log(`Not authenticated for readSheet(${sheetName}). Attempting re-authentication.`);
            await handleAuthClick(true); // حاول المصادقة بصمت
            if (!isAuthenticated) {
                throw new Error('Authentication failed before reading sheet.');
            }
        }

        const fullRange = range ? `${sheetName}!${range}` : `${sheetName}!A:Z`;
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: fullRange,
        });
        return response.result.values || [];
    } catch (error) {
        console.error(`Error reading sheet ${sheetName}:`, error);
        showMessage(`خطأ في قراءة البيانات من ${sheetName}`, 'error');
        return [];
    }
}

async function appendToSheet(sheetName, values) {
    try {
        if (!isAuthenticated) {
            console.log(`Not authenticated for appendToSheet(${sheetName}). Attempting re-authentication.`);
            await handleAuthClick(true);
            if (!isAuthenticated) {
                throw new Error('Authentication failed before appending to sheet.');
            }
        }

        const response = await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:Z`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [values]
            }
        });
        return { success: true, data: response.result };
    } catch (error) {
        console.error(`Error appending to sheet ${sheetName}:`, error);
        return { success: false, message: error.message };
    }
}

async function updateSheet(sheetName, range, values) {
    try {
        if (!isAuthenticated) {
            console.log(`Not authenticated for updateSheet(${sheetName}). Attempting re-authentication.`);
            await handleAuthClick(true);
            if (!isAuthenticated) {
                throw new Error('Authentication failed before updating sheet.');
            }
        }

        const response = await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!${range}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [values]
            }
        });
        return { success: true, data: response.result };
    } catch (error) {
        console.error(`Error updating sheet ${sheetName}:`, error);
        return { success: false, message: error.message };
    }
}

async function findRowIndex(sheetName, columnIndex, searchValue) {
    const data = await readSheet(sheetName);
    for (let i = 1; i < data.length; i++) {
        if (data[i][columnIndex] === searchValue) {
            return i + 1;
        }
    }
    return -1;
}

// --- Data Loading Functions ---
async function loadUsers() {
    try {
        const data = await readSheet(SHEETS.USERS);
        if (data.length > 1) {
            users = data.slice(1).map(row => ({
                id: row[0] || '',
                name: row[1] || '',
                phone: row[2] || '',
                username: row[3] || '',
                password: row[4] || '',
                role: row[5] || '',
                status: row[6] || 'نشط',
                creationDate: row[7] || ''
            }));
        } else {
            users = [];
        }
    } catch (error) {
        console.error('Error loading users:', error);
        users = [];
    }
}

async function loadCategories() {
    try {
        const data = await readSheet(SHEETS.CATEGORIES);
        if (data.length > 1) {
            categories = data.slice(1).map(row => ({
                code: row[0] || '',
                name: row[1] || '',
                formType: row[2] || 'عادي',
                creationDate: row[3] || '',
                createdBy: row[4] || ''
            }));
        } else {
            categories = [];
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        categories = [];
    }
}

async function loadCustomers() {
    try {
        const data = await readSheet(SHEETS.CUSTOMERS);
        if (data.length > 1) {
            customers = data.slice(1).map(row => ({
                id: row[0] || '',
                name: row[1] || '',
                phone: row[2] || '',
                // معالجة القيمة الرقمية: إزالة الفواصل قبل التحويل
                totalCredit: parseFloat((row[3] || '0').replace(/,/g, '')),
                creationDate: row[4] || '',
                lastUpdate: row[5] || ''
            }));
        } else {
            customers = [];
        }
    } catch (error) {
        console.error('Error loading customers:', error);
        customers = [];
    }
}

async function loadCustomerCreditHistory(customerId) {
    try {
        const data = await readSheet(SHEETS.CUSTOMER_CREDIT_HISTORY);
        if (data.length <= 1) return [];

        return data.slice(1).filter(row => row[1] === customerId).map(row => ({
            id: row[0] || '',
            customerId: row[1] || '',
            date: row[2] || '',
            type: row[3] || '',
            // معالجة القيمة الرقمية: إزالة الفواصل قبل التحويل
            amount: parseFloat((row[4] || '0').replace(/,/g, '')),
            invoiceNumber: row[5] || '',
            notes: row[6] || '',
            recordedBy: row[7] || ''
        }));
    } catch (error) {
        console.error('Error loading customer credit history:', error);
        return [];
    }
}

async function loadExpenses(filters = {}) {
    try {
        const data = await readSheet(SHEETS.EXPENSES);
        if (data.length <= 1) return [];

        let expenses = data.slice(1).map(row => ({
            id: row[0] || '',
            category: row[1] || '',
            categoryCode: row[2] || '',
            invoiceNumber: row[3] || '',
            // معالجة القيمة الرقمية: إزالة الفواصل قبل التحويل
            amount: parseFloat((row[4] || '0').replace(/,/g, '')),
            notes: row[5] || '',
            date: row[6] || '',
            time: row[7] || '',
            cashier: row[8] || '',
            year: row[9] || '',
            referenceNumber: row[10] || '',
            tabName: row[11] || '',
            tabPhone: row[12] || '',
            location: row[13] || '',
            personName: row[14] || '',
            companyName: row[15] || '',
            companyCode: row[16] || '',
            customer: row[17] || ''
        }));

        // Apply filters
        if (filters.cashier) {
            expenses = expenses.filter(exp => exp.cashier === filters.cashier);
        }
        if (filters.dateFrom) {
            expenses = expenses.filter(exp => new Date(exp.date) >= new Date(filters.dateFrom));
        }
        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59, 999);
            expenses = expenses.filter(exp => new Date(exp.date) <= toDate);
        }
        if (filters.timeFrom && filters.timeTo) {
            expenses = expenses.filter(exp => {
                const [expHours, expMinutes] = exp.time.split(':').map(Number);
                const [fromHours, fromMinutes] = filters.timeFrom.split(':').map(Number);
                const [toHours, toMinutes] = filters.timeTo.split(':').map(Number);
                const expTotalMinutes = expHours * 60 + expMinutes;
                const fromTotalMinutes = fromHours * 60 + fromMinutes;
                const toTotalMinutes = toHours * 60 + toMinutes;
                return expTotalMinutes >= fromTotalMinutes && expTotalMinutes <= toTotalMinutes;
            });
        }
        if (filters.category) {
            expenses = expenses.filter(exp => exp.category === filters.category);
        }

        return expenses;
    } catch (error) {
        console.error('Error loading expenses:', error);
        return [];
    }
}

async function loadShiftClosures(filters = {}) {
    try {
        const data = await readSheet(SHEETS.SHIFT_CLOSURES);
        if (data.length <= 1) return [];

        let closures = data.slice(1).map(row => ({
            id: row[0] || '',
            cashier: row[1] || '',
            dateFrom: row[2] || '',
            timeFrom: row[3] || '',
            dateTo: row[4] || '',
            timeTo: row[5] || '',
            // معالجة القيمة الرقمية: إزالة الفواصل قبل التحويل
            totalExpenses: parseFloat((row[6] || '0').replace(/,/g, '')),
            expenseCount: parseInt(row[7] || 0),
            totalInsta: parseFloat((row[8] || '0').replace(/,/g, '')),
            instaCount: parseInt(row[9] || 0),
            totalVisa: parseFloat((row[10] || '0').replace(/,/g, '')),
            visaCount: parseInt(row[11] || 0),
            totalOnline: parseFloat((row[12] || '0').replace(/,/g, '')),
            onlineCount: parseInt(row[13] || 0),
            grandTotal: parseFloat((row[14] || '0').replace(/,/g, '')),
            drawerCash: parseFloat((row[15] || '0').replace(/,/g, '')),
            newMindTotal: parseFloat((row[16] || '0').replace(/,/g, '')),
            difference: parseFloat((row[17] || '0').replace(/,/g, '')),
            status: row[18] || '',
            closureDate: row[19] || '',
            closureTime: row[20] || '',
            accountant: row[21] || ''
        }));

        // Apply filters
        if (filters.cashier) {
            closures = closures.filter(closure => closure.cashier === filters.cashier);
        }
        if (filters.dateFrom && filters.dateTo) {
            const fromDateTime = new Date(`${filters.dateFrom}T${filters.timeFrom || '00:00'}:00`);
            const toDateTime = new Date(`${filters.dateTo}T${filters.timeTo || '23:59'}:59.999`);
            closures = closures.filter(closure => {
                const closureStart = new Date(`${closure.dateFrom}T${closure.timeFrom}:00`);
                const closureEnd = new Date(`${closure.dateTo}T${closure.timeTo}:00`);
                return closureStart >= fromDateTime && closureEnd <= toDateTime;
            });
        }

        return closures;
    } catch (error) {
        console.error('Error loading shift closures:', error);
        return [];
    }
}

// --- Initial Data Loading ---
async function loadInitialData() {
    if (initialDataLoaded) {
        console.log('Initial data already loaded, skipping...');
        return;
    }
    
    try {
        showLoading(true);
        await Promise.all([
            loadUsers(),
            loadCategories(),
            loadCustomers()
        ]);
        populateUserDropdown();
        initialDataLoaded = true;
        console.log('✅ تم تحميل البيانات الأولية بنجاح');
    } catch (error) {
        console.error('Error loading initial data:', error);
        showMessage('حدث خطأ أثناء تحميل البيانات', 'error');
    } finally {
        showLoading(false);
    }
}

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

// --- Authentication ---
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

function logout() {
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('cashierPage').classList.remove('active');
    document.getElementById('accountantPage').classList.remove('active');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    currentUser = null;
    currentUserName = '';
    currentUserRole = '';
    resetCashierDailyData();
    handleAuthFailure(); // مسح حالة المصادقة عند تسجيل الخروج
    showMessage('تم تسجيل الخروج بنجاح.', 'success');
}

function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const toggleButton = document.querySelector('.show-password i');
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleButton.classList.remove('fa-eye');
        toggleButton.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        toggleButton.classList.remove('fa-eye-slash');
        toggleButton.classList.add('fa-eye');
    }
}

// --- Page Navigation ---
function showTab(tabId) {
    const allTabs = document.querySelectorAll('.tab-content');
    allTabs.forEach(tab => tab.classList.remove('active'));

    const allNavTabs = document.querySelectorAll('.nav-tab');
    allNavTabs.forEach(navTab => navTab.classList.remove('active'));

    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.classList.add('active');
    }

    const targetNavTab = document.querySelector(`[onclick="showTab('${tabId}')"]`);
    if (targetNavTab) {
        targetNavTab.classList.add('active');
    }

    // إجراءات محددة لكل علامة تبويب
    if (tabId === 'categoriesTabCashier' || tabId === 'categoriesTabAccountant') {
        displayCategories(tabId === 'categoriesTabCashier' ? 'categoriesGridCashier' : 'categoriesGridAccountant');
    } else if (tabId === 'expensesTabCashier') {
        loadCashierExpenses();
        populateExpenseCategoryFilter();
    } else if (tabId === 'customersTabCashier') {
        displayCustomers('customersTableBodyCashier');
    } else if (tabId === 'customersTabAccountant') {
        displayCustomers('customersTableBodyAccountant');
        const customerDetailsAccountant = document.getElementById('customerDetailsAccountant');
        if (customerDetailsAccountant) {
            customerDetailsAccountant.style.display = 'none';
        }
    } else if (tabId === 'dashboardTabAccountant') {
        populateAccountantFilters();
        updateAccountantDashboard();
    } else if (tabId === 'usersTabAccountant') {
        displayUsers();
    } else if (tabId === 'reportsTabAccountant') {
        populateReportFilters();
        generateAccountantReport();

    } else if (tabId === 'shiftCloseTabAccountant') {
        populateAccountantShiftCashierFilter();
        loadAccountantShiftClosuresHistory();
        resetAccountantShiftForm();
    }
}

// --- Cashier Page Functions ---
async function showCashierPage() {
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('accountantPage').classList.remove('active');
    document.getElementById('cashierPage').classList.add('active');
    document.getElementById('cashierNameDisplay').textContent = currentUserName;
    document.getElementById('currentDateCashier').textContent = new Date().toLocaleDateString('ar-EG');

    await loadCategories();
    await loadCustomers();
    resetCashierDailyData();
    showTab('categoriesTabCashier');
}

function resetCashierDailyData() {
    cashierDailyData = {
        expenses: [],
        insta: [],
        visa: [],
        online: [],
        totalExpenses: 0,
        totalInsta: 0,
        totalVisa: 0,
        totalOnline: 0,
        drawerCash: 0,
        shiftStartDate: null,
        shiftEndDate: null,
        shiftStartTime: null,
        shiftEndTime: null,
    };

    const expenseTableBody = document.getElementById('expensesTableBodyCashier');
    if (expenseTableBody) {
        expenseTableBody.innerHTML = '';
    }

    const shiftSummary = document.getElementById('shiftSummaryCashier');
    if (shiftSummary) {
        shiftSummary.style.display = 'none';
    }

    const drawerCash = document.getElementById('drawerCashCashier');
    if (drawerCash) {
        drawerCash.value = '';
    }

    setDefaultDatesAndTimes();
}

function setDefaultDatesAndTimes() {
    const today = new Date().toISOString().split('T')[0];
    const timeNow = new Date().toTimeString().split(' ')[0].substring(0, 5);

    const elements = [
        'shiftDateFromCashier',
        'shiftDateToCashier',
        'dashboardDateFromAccountant',
        'dashboardDateToAccountant',
        'reportDateFromAccountant',
        'reportDateToAccountant',
        'expenseDateFromFilterCashier',
        'expenseDateToFilterCashier',
        'accountantShiftDateFrom',
        'accountantShiftDateTo'
    ];

    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = today;
    });

    const timeElements = [
        'shiftTimeFromCashier',
        'shiftTimeToCashier',
        'accountantShiftTimeFrom',
        'accountantShiftTimeTo'
    ];

    timeElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = timeNow;
    });
}

// --- Categories Management ---
function displayCategories(gridId) {
    const categoriesGrid = document.getElementById(gridId);
    if (!categoriesGrid) return;

    categoriesGrid.innerHTML = '';
    if (categories.length === 0) {
        categoriesGrid.innerHTML = '<p>لا توجد تصنيفات مسجلة.</p>';
        return;
    }

    categories.forEach(cat => {
        const categoryCard = document.createElement('div');
        categoryCard.className = 'category-card';
        categoryCard.innerHTML = `
            <div class="category-header">
                <span class="category-name">${cat.name}</span>
                <span class="category-code">${cat.code}</span>
            </div>
            <div class="category-type">نوع الفورم: ${cat.formType}</div>
            <div class="category-actions">
                <button class="edit-btn" onclick="showMessage('وظيفة تعديل التصنيف غير متاحة حالياً.', 'warning')"><i class="fas fa-edit"></i> تعديل</button>
                <button class="delete-btn" onclick="showMessage('وظيفة حذف التصنيف غير متاحة حالياً.', 'warning')"><i class="fas fa-trash"></i> حذف</button>
            </div>
        `;
        categoriesGrid.appendChild(categoryCard);
    });
}

function showAddCategoryModal() {
    const form = document.getElementById('addCategoryForm');
    if (form) {
        form.reset();
    }
    const modal = document.getElementById('addCategoryModal');
    if (modal) {
        modal.classList.add('active');
    }
}

async function addCategory() {
    const code = document.getElementById('categoryCode').value.trim();
    const name = document.getElementById('categoryName').value.trim();
    const formType = document.getElementById('formType').value;

    if (!code || !name || !formType) {
        showMessage('يرجى ملء جميع حقول التصنيف.', 'warning');
        return;
    }

    const existingCategory = categories.find(cat => cat.code === code);
    if (existingCategory) {
        showMessage('كود التصنيف موجود بالفعل. يرجى استخدام كود آخر.', 'warning');
        return;
    }

    const newCategory = [
        code,
        name,
        formType,
        new Date().toISOString().split('T')[0],
        currentUserName
    ];

    const result = await appendToSheet(SHEETS.CATEGORIES, newCategory);

    if (result.success) {
        showMessage('تم إضافة التصنيف بنجاح.', 'success');
        closeModal('addCategoryModal');
        await loadCategories();
        displayCategories('categoriesGridCashier');
        displayCategories('categoriesGridAccountant');
        populateExpenseCategoryFilter();
        populateAccountantFilters();
    } else {
        showMessage('فشل إضافة التصنيف.', 'error');
    }
}

// --- Expenses Management ---
function showAddExpenseModal() {
    const form = document.getElementById('addExpenseForm');
    if (form) form.reset();

    document.getElementById('expenseCategorySearch').value = '';
    document.getElementById('expenseCategorySuggestions').innerHTML = '';
    document.getElementById('selectedExpenseCategoryCode').value = '';
    document.getElementById('selectedExpenseCategoryName').value = '';
    document.getElementById('selectedExpenseCategoryFormType').value = '';
    document.getElementById('dynamicExpenseForm').innerHTML = '';

    const modal = document.getElementById('addExpenseModal');
    if (modal) modal.classList.add('active');
}

function searchExpenseCategories(searchTerm) {
    const suggestionsDiv = document.getElementById('expenseCategorySuggestions');
    if (!suggestionsDiv) return;

    suggestionsDiv.innerHTML = '';

    if (searchTerm.length < 2) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    const filtered = categories.filter(cat =>
        cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cat.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filtered.length === 0) {
        suggestionsDiv.innerHTML = '<div class="suggestion-item">لا توجد نتائج</div>';
        suggestionsDiv.style.display = 'block';
        return;
    }

    filtered.forEach(cat => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.textContent = `${cat.name} (${cat.code}) - ${cat.formType}`;
        item.onclick = () => selectExpenseCategory(cat);
        suggestionsDiv.appendChild(item);
    });

    suggestionsDiv.style.display = 'block';
}

function selectExpenseCategory(category) {
    document.getElementById('expenseCategorySearch').value = `${category.name} (${category.code})`;
    document.getElementById('selectedExpenseCategoryCode').value = category.code;
    document.getElementById('selectedExpenseCategoryName').value = category.name;
    document.getElementById('selectedExpenseCategoryFormType').value = category.formType;
    document.getElementById('expenseCategorySuggestions').style.display = 'none';

    generateDynamicExpenseForm(category.formType);
}

function generateDynamicExpenseForm(formType) {
    const dynamicFormDiv = document.getElementById('dynamicExpenseForm');
    if (!dynamicFormDiv) return;

    let formHtml = ``;

    // إضافة حقل رقم الفاتورة لجميع الأنواع التي تتطلبها، بما في ذلك "أجل"
    if (['عادي', 'فيزا', 'اونلاين', 'مرتجع', 'خصم عميل', 'إنستا', 'اجل', 'شحن_تاب', 'شحن_كهربا', 'بنزين', 'سلف', 'دفعة_شركة', 'عجوزات'].includes(formType)) {
        formHtml += `
            <div class="form-group">
                <label for="expenseInvoiceNumber">رقم الفاتورة: <span style="color: red;">*</span></label>
                <input type="text" id="expenseInvoiceNumber" required placeholder="أدخل رقم الفاتورة">
            </div>
        `;
    }

    formHtml += `
        <div class="form-group">
            <label for="expenseAmount">القيمة: <span style="color: red;">*</span></label>
            <input type="number" id="expenseAmount" step="0.01" required placeholder="أدخل القيمة">
        </div>
        <div class="form-group">
            <label for="expenseNotes">الملاحظات (اختياري):</label>
            <input type="text" id="expenseNotes" placeholder="أدخل ملاحظات">
        </div>
    `;

    if (formType === 'فيزا') {
        formHtml += `
            <div class="form-group">
                <label for="visaReferenceNumber">الرقم المرجعي للفيزا (آخر 4 أرقام):</label>
                <input type="text" id="visaReferenceNumber" pattern="\\d{4}" maxlength="4" placeholder="أدخل آخر 4 أرقام من الفيزا">
            </div>
        `;
    } else if (formType === 'شحن_تاب') {
        formHtml += `
            <div class="form-group">
                <label for="tabName">اسم التاب (اختياري):</label>
                <input type="text" id="tabName" placeholder="أدخل اسم التاب">
            </div>
            <div class="form-group">
                <label for="tabPhone">رقم تليفون التاب:</label>
                <input type="tel" id="tabPhone" required placeholder="أدخل رقم تليفون التاب">
            </div>
        `;
    } else if (formType === 'شحن_كهربا') {
        formHtml += `
            <div class="form-group">
                <label for="electricityLocation">مكان الشحن:</label>
                <input type="text" id="electricityLocation" required placeholder="أدخل مكان الشحن">
            </div>
        `;
    } else if (['بنزين', 'سلف', 'عجوزات'].includes(formType)) {
        formHtml += `
            <div class="form-group">
                <label for="personName">اسم الشخص:</label>
                <input type="text" id="personName" required placeholder="أدخل اسم الشخص">
            </div>
        `;
    } else if (formType === 'دفعة_شركة') {
        formHtml += `
            <div class="form-group">
                <label for="companyName">اسم الشركة:</label>
                <input type="text" id="companyName" required placeholder="أدخل اسم الشركة">
            </div>
            <div class="form-group">
                <label for="companyCode">كود الشركة:</label>
                <input type="text" id="companyCode" placeholder="أدخل كود الشركة">
            </div>
        `;
    } else if (formType === 'اجل') {
        formHtml += `
            <div class="form-group">
                <label for="customerSearch">البحث عن العميل: <span style="color: red;">*</span></label>
                <div class="input-group">
                    <input type="text" id="customerSearch" placeholder="ابحث بالاسم أو الرقم" onkeyup="searchCustomersForExpense(this.value)" autocomplete="off">
                    <div id="customerSuggestions" class="suggestions"></div>
                </div>
                <input type="hidden" id="selectedCustomerId">
                <input type="hidden" id="selectedCustomerName">
            </div>
            <button type="button" class="add-btn" onclick="showAddCustomerModalFromExpense()" style="margin-top: 10px;">
                <i class="fas fa-plus"></i> إضافة عميل جديد
            </button>
        `;
    }

    dynamicFormDiv.innerHTML = formHtml;
}

function searchCustomersForExpense(searchTerm) {
    const suggestionsDiv = document.getElementById('customerSuggestions');
    if (!suggestionsDiv) return;

    suggestionsDiv.innerHTML = '';

    if (searchTerm.length < 2) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    const filtered = customers.filter(cust =>
        cust.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cust.phone.includes(searchTerm)
    );

    if (filtered.length === 0) {
        suggestionsDiv.innerHTML = '<div class="suggestion-item">لا توجد نتائج</div>';
        suggestionsDiv.style.display = 'block';
        return;
    }

    filtered.forEach(cust => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.textContent = `${cust.name} (${cust.phone}) - رصيد: ${cust.totalCredit.toFixed(2)}`;
        item.onclick = () => selectCustomerForExpense(cust);
        suggestionsDiv.appendChild(item);
    });

    suggestionsDiv.style.display = 'block';
}

function selectCustomerForExpense(customer) {
    document.getElementById('customerSearch').value = `${customer.name} (${customer.phone})`;
    document.getElementById('selectedCustomerId').value = customer.id;
    document.getElementById('selectedCustomerName').value = customer.name;
    document.getElementById('customerSuggestions').style.display = 'none';
}

function showAddCustomerModalFromExpense() {
    closeModal('addExpenseModal');
    setTimeout(() => {
        showAddCustomerModal(true);
    }, 300);
}

async function addExpense() {
    if (event) event.preventDefault();
    
    if (expenseSubmissionInProgress) {
        console.log('Expense submission already in progress, skipping...');
        return;
    }
    expenseSubmissionInProgress = true;
    showLoading(true); // عرض شاشة التحميل عند بدء الإرسال

    try {
        const now = new Date();

        const categoryCode = document.getElementById('selectedExpenseCategoryCode').value;
        const categoryName = document.getElementById('selectedExpenseCategoryName').value;
        const formType = document.getElementById('selectedExpenseCategoryFormType').value;
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        const notes = document.getElementById('expenseNotes')?.value.trim() || '';
        const invoiceNumber = document.getElementById('expenseInvoiceNumber')?.value.trim() || '';

        if (!categoryCode || isNaN(amount) || amount <= 0) {
            showMessage('يرجى اختيار تصنيف وإدخال قيمة صحيحة.', 'warning');
            return; // الخروج المبكر
        }

        if (['عادي', 'فيزا', 'اونلاين', 'مرتجع', 'خصم عميل', 'إنستا', 'اجل', 'شحن_تاب', 'شحن_كهربا', 'بنزين', 'سلف', 'دفعة_شركة', 'عجوزات'].includes(formType)) {
            if (!invoiceNumber) {
                showMessage('يرجى إدخال رقم الفاتورة.', 'warning');
                return; // الخروج المبكر
            }

            const allExistingExpenses = await readSheet(SHEETS.EXPENSES);
            const isInvoiceNumberDuplicate = allExistingExpenses.slice(1).some(row =>
                row[3] && row[3].trim() === invoiceNumber
            );

            if (isInvoiceNumberDuplicate) {
                showMessage('رقم الفاتورة هذا موجود بالفعل. يرجى إدخال رقم فاتورة فريد.', 'error');
                return; // الخروج المبكر
            }
        }

        // Handle customer credit for "اجل" type
        if (formType === 'اجل') {
            const customerId = document.getElementById('selectedCustomerId').value;
            if (!customerId) {
                showMessage('يرجى اختيار العميل الآجل.', 'warning');
                return; // الخروج المبكر
            }

            const customerIndex = customers.findIndex(c => c.id === customerId);
            if (customerIndex !== -1) {
                const currentCustomer = customers[customerIndex];
                const newTotalCredit = currentCustomer.totalCredit + amount;

                const rowIndex = await findRowIndex(SHEETS.CUSTOMERS, 0, customerId);
                if (rowIndex !== -1) {
                    const updateResult = await updateSheet(SHEETS.CUSTOMERS, `D${rowIndex}`, [newTotalCredit.toFixed(2)]);
                    if (!updateResult.success) {
                        showMessage('فشل تحديث إجمالي الأجل للعميل.', 'error');
                        return; // الخروج المبكر
                    }
                    await updateSheet(SHEETS.CUSTOMERS, `F${rowIndex}`, [now.toISOString().split('T')[0]]);
                } else {
                    showMessage('لم يتم العثور على العميل لتحديث الأجل.', 'error');
                    return; // الخروج المبكر
                }

                currentCustomer.totalCredit = newTotalCredit;
                customers[customerIndex] = currentCustomer;

                const historyId = 'CRH_' + now.getTime();
                const newHistoryEntry = [
                    historyId,
                    customerId,
                    now.toISOString().split('T')[0],
                    'أجل',
                    amount,
                    invoiceNumber,
                    notes,
                    currentUser.username
                ];
                const historyResult = await appendToSheet(SHEETS.CUSTOMER_CREDIT_HISTORY, newHistoryEntry);
                if (!historyResult.success) {
                    showMessage('فشل تسجيل حركة الأجل.', 'error');
                    return; // الخروج المبكر
                }
            } else {
                showMessage('العميل المختار غير موجود.', 'error');
                return; // الخروج المبكر
            }
        }
        
        const expenseId = 'EXP_' + now.getTime();

        let expenseData = [
            expenseId,
            categoryName,
            categoryCode,
            invoiceNumber,
            amount.toFixed(2), // تنسيق القيمة كرقم عشري بسلسلة نصية
            notes,
            now.toISOString().split('T')[0], // Date
            now.toTimeString().split(' ')[0], // Time
            currentUser.username,
            now.getFullYear().toString(),
            document.getElementById('visaReferenceNumber')?.value.trim() || '',
            document.getElementById('tabName')?.value.trim() || '',
            document.getElementById('tabPhone')?.value.trim() || '',
            document.getElementById('electricityLocation')?.value.trim() || '',
            document.getElementById('personName')?.value.trim() || '',
            document.getElementById('companyName')?.value.trim() || '',
            document.getElementById('companyCode')?.value.trim() || '',
            document.getElementById('selectedCustomerId')?.value || ''
        ];

        const result = await appendToSheet(SHEETS.EXPENSES, expenseData);

        if (result.success) {
            showMessage(`تم إضافة ${categoryName} بنجاح.`, 'success');
            closeModal('addExpenseModal');

            const newEntry = {
                id: expenseId,
                category: categoryName,
                categoryCode: categoryCode,
                invoiceNumber: invoiceNumber,
                amount: amount,
                notes: notes,
                date: expenseData[6],
                time: expenseData[7],
                cashier: currentUser.username
            };

            if (formType === 'إنستا') {
                cashierDailyData.insta.push(newEntry);
                cashierDailyData.totalInsta += amount;
            } else if (formType === 'فيزا') {
                cashierDailyData.visa.push(newEntry);
                cashierDailyData.totalVisa += amount;
            } else if (formType === 'اونلاين') {
                cashierDailyData.online.push(newEntry);
                cashierDailyData.totalOnline += amount;
            } else {
                cashierDailyData.expenses.push(newEntry);
                cashierDailyData.totalExpenses += amount;
            }

            if (formType === 'اجل') {
                await loadCustomers();
                displayCustomers('customersTableBodyCashier');
            }
            loadCashierExpenses();
        } else {
            showMessage('فشل إضافة المصروف.', 'error');
        }
    } catch (error) {
        console.error('Error adding expense:', error);
        showMessage('حدث خطأ أثناء إضافة المصروف.', 'error');
    } finally {
        expenseSubmissionInProgress = false;
        showLoading(false); // إخفاء شاشة التحميل عند الانتهاء
    }
}

async function loadCashierExpenses() {
    const expenses = await loadExpenses({ cashier: currentUser.username });

    // Reset cashier data
    cashierDailyData.expenses = [];
    cashierDailyData.insta = [];
    cashierDailyData.visa = [];
    cashierDailyData.online = [];
    cashierDailyData.totalExpenses = 0;
    cashierDailyData.totalInsta = 0;
    cashierDailyData.totalVisa = 0;
    cashierDailyData.totalOnline = 0;

    expenses.forEach(expense => {
        const category = categories.find(c => c.name === expense.category || c.code === expense.categoryCode);
        const formType = category ? category.formType : 'عادي';

        if (formType === 'إنستا') {
            cashierDailyData.insta.push(expense);
            cashierDailyData.totalInsta += expense.amount;
        } else if (formType === 'فيزا') {
            cashierDailyData.visa.push(expense);
            cashierDailyData.totalVisa += expense.amount;
        } else if (formType === 'اونلاين') {
            cashierDailyData.online.push(expense);
            cashierDailyData.totalOnline += expense.amount;
        } else {
            cashierDailyData.expenses.push(expense);
            cashierDailyData.totalExpenses += expense.amount;
        }
    });

    filterCashierExpenses();
}

function populateExpenseCategoryFilter() {
    const filterSelect = document.getElementById('expenseCategoryFilterCashier');
    if (!filterSelect) return;

    filterSelect.innerHTML = '<option value="">جميع التصنيفات</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        filterSelect.appendChild(option);
    });
}

function filterCashierExpenses() {
    const categoryFilter = document.getElementById('expenseCategoryFilterCashier')?.value || '';
    const dateFromFilter = document.getElementById('expenseDateFromFilterCashier')?.value || '';
    const dateToFilter = document.getElementById('expenseDateToFilterCashier')?.value || '';
    const tableBody = document.getElementById('expensesTableBodyCashier');

    if (!tableBody) return;

    tableBody.innerHTML = '';

    let filtered = [...cashierDailyData.expenses, ...cashierDailyData.insta, ...cashierDailyData.visa, ...cashierDailyData.online];

    if (categoryFilter) {
        filtered = filtered.filter(exp => exp.category === categoryFilter);
    }
    if (dateFromFilter) {
        filtered = filtered.filter(exp => new Date(exp.date) >= new Date(dateFromFilter));
    }
    if (dateToFilter) {
        const toDate = new Date(dateToFilter);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(exp => new Date(exp.date) <= toDate);
    }

    if (filtered.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7">لا توجد مصروفات مطابقة للمعايير.</td></tr>';
        return;
    }

    filtered.sort((a, b) => new Date(`${b.date} ${b.time}`) - new Date(`${a.date} ${a.time}`));

    filtered.forEach(exp => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = exp.category;
        row.insertCell().textContent = exp.invoiceNumber || '--';
        row.insertCell().textContent = exp.amount.toFixed(2); // عرض القيمة الصحيحة
        row.insertCell().textContent = exp.date;
        row.insertCell().textContent = exp.time;
        row.insertCell().textContent = exp.notes || '--';
        const actionsCell = row.insertCell();
        actionsCell.innerHTML = `<button class="delete-btn" onclick="showMessage('وظيفة حذف المصروفات غير متاحة حالياً.', 'warning')"><i class="fas fa-trash"></i> حذف</button>`;
    });
}

function clearCashierExpenseFilters() {
    const categoryFilter = document.getElementById('expenseCategoryFilterCashier');
    const dateFromFilter = document.getElementById('expenseDateFromFilterCashier');
    const dateToFilter = document.getElementById('expenseDateToFilterCashier');

    if (categoryFilter) categoryFilter.value = '';
    if (dateFromFilter) dateFromFilter.value = '';
    if (dateToFilter) dateToFilter.value = '';

    filterCashierExpenses();
}

// --- Customers Management ---
function displayCustomers(tableBodyId) {
    const tableBody = document.getElementById(tableBodyId);
    if (!tableBody) return;

    tableBody.innerHTML = '';
    if (customers.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">لا توجد عملاء مسجلين.</td></tr>';
        return;
    }

    customers.forEach(cust => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = cust.name;
        row.insertCell().textContent = cust.phone;
        row.insertCell().textContent = cust.totalCredit.toFixed(2);
        row.insertCell().textContent = new Date(cust.creationDate).toLocaleDateString('ar-EG');
        const actionsCell = row.insertCell();

        if (tableBodyId === 'customersTableBodyAccountant') {
            actionsCell.innerHTML = `
                <button class="edit-btn" onclick="showMessage('وظيفة تعديل العميل غير متاحة حالياً.', 'warning')"><i class="fas fa-edit"></i> تعديل</button>
                <button class="delete-btn" onclick="showMessage('وظيفة حذف العميل غير متاحة حالياً.', 'warning')"><i class="fas fa-trash"></i> حذف</button>
                <button class="view-btn" onclick="viewCustomerDetails('${cust.id}', '${cust.name}')"><i class="fas fa-eye"></i> تفاصيل</button>
            `;
        } else {
            actionsCell.innerHTML = `
                <button class="edit-btn" onclick="showMessage('وظيفة تعديل العميل غير متاحة حالياً.', 'warning')"><i class="fas fa-edit"></i> تعديل</button>
                <button class="delete-btn" onclick="showMessage('وظيفة حذف العميل غير متاحة حالياً.', 'warning')"><i class="fas fa-trash"></i> حذف</button>
            `;
        }
    });
}

async function viewCustomerDetails(customerId, customerName) {
    showLoading(true);
    try {
        currentSelectedCustomerId = customerId;
        document.getElementById('customerDetailsName').textContent = customerName;
        document.getElementById('customerDetailsAccountant').style.display = 'block';
        document.getElementById('customerPaymentAmount').value = '';

        const history = await loadCustomerCreditHistory(customerId);
        const tableBody = document.getElementById('customerCreditHistoryBody');
        if (!tableBody) return;

        tableBody.innerHTML = '';
        if (history.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">لا توجد حركات أجل/سداد لهذا العميل.</td></tr>';
            return;
        }

        history.sort((a, b) => new Date(b.date) - new Date(a.date));

        history.forEach(item => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = item.date;
            row.insertCell().textContent = item.type;
            row.insertCell().textContent = item.amount.toFixed(2);
            row.insertCell().textContent = item.invoiceNumber || item.notes || '--';
            row.insertCell().textContent = item.recordedBy;
        });
    } catch (error) {
        console.error('Error viewing customer details:', error);
        showMessage('حدث خطأ أثناء عرض تفاصيل العميل.', 'error');
    } finally {
        showLoading(false);
    }
}

async function processCustomerPayment() {
    if (!currentSelectedCustomerId) {
        showMessage('يرجى اختيار عميل أولاً.', 'warning');
        return;
    }

    const paymentAmount = parseFloat(document.getElementById('customerPaymentAmount').value);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
        showMessage('يرجى إدخال مبلغ سداد صحيح وموجب.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const customerIndex = customers.findIndex(c => c.id === currentSelectedCustomerId);
        if (customerIndex === -1) {
            showMessage('العميل غير موجود.', 'error');
            return;
        }

        const currentCustomer = customers[customerIndex];
        if (currentCustomer.totalCredit < paymentAmount) {
            showMessage('مبلغ السداد أكبر من إجمالي الأجل المستحق.', 'warning');
            return;
        }

        const newTotalCredit = currentCustomer.totalCredit - paymentAmount;
        const now = new Date();
        const date = now.toISOString().split('T')[0];

        const rowIndex = await findRowIndex(SHEETS.CUSTOMERS, 0, currentSelectedCustomerId);
        if (rowIndex !== -1) {
            const updateResult = await updateSheet(SHEETS.CUSTOMERS, `D${rowIndex}`, [newTotalCredit.toFixed(2)]);
            if (!updateResult.success) {
                showMessage('فشل تحديث إجمالي الأجل للعميل.', 'error');
                return;
            }
            await updateSheet(SHEETS.CUSTOMERS, `F${rowIndex}`, [date]);
        } else {
            showMessage('لم يتم العثور على العميل لتحديث الأجل.', 'error');
            return;
        }

        const historyId = 'CRH_' + now.getTime();
        const newHistoryEntry = [
            historyId,
            currentSelectedCustomerId,
            date,
            'سداد',
            paymentAmount,
            '',
            `سداد من المحاسب ${currentUserName}`,
            currentUser.username
        ];
        const historyResult = await appendToSheet(SHEETS.CUSTOMER_CREDIT_HISTORY, newHistoryEntry);
        if (!historyResult.success) {
            showMessage('فشل تسجيل حركة السداد.', 'error');
            return;
        }

        currentCustomer.totalCredit = newTotalCredit;
        customers[customerIndex] = currentCustomer;

        showMessage('تم سداد الأجل بنجاح.', 'success');
        document.getElementById('customerPaymentAmount').value = '';
        await viewCustomerDetails(currentSelectedCustomerId, currentCustomer.name);
        displayCustomers('customersTableBodyAccountant');
        updateAccountantDashboard();
    } catch (error) {
        console.error('Error processing customer payment:', error);
        showMessage('حدث خطأ أثناء معالجة السداد.', 'error');
    } finally {
        showLoading(false);
    }
}

function showAddCustomerModal(fromExpense = false) {
    const form = document.getElementById('addCustomerForm');
    if (form) form.reset();

    const modal = document.getElementById('addCustomerModal');
    if (modal) {
        modal.classList.add('active');
        modal.dataset.fromExpense = fromExpense;
    }
}

async function addCustomer() {
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();

    if (!name || !phone) {
        showMessage('يرجى ملء جميع حقول العميل.', 'warning');
        return;
    }

    const existingCustomer = customers.find(cust => cust.phone === phone);
    if (existingCustomer) {
        showMessage('رقم التليفون موجود بالفعل.', 'warning');
        return;
    }

    const customerId = 'CUST_' + new Date().getTime();
    const newCustomer = [
        customerId,
        name,
        phone,
        '0', // Total Credit starts at 0
        new Date().toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
    ];

    const result = await appendToSheet(SHEETS.CUSTOMERS, newCustomer);

    if (result.success) {
        showMessage('تم إضافة العميل بنجاح.', 'success');
        closeModal('addCustomerModal');
        await loadCustomers();
        displayCustomers('customersTableBodyCashier');
        displayCustomers('customersTableBodyAccountant');
        updateAccountantDashboard();

        const modal = document.getElementById('addCustomerModal');
        if (modal && modal.dataset.fromExpense === 'true') {
            showAddExpenseModal();
            const newCustomerObj = { id: customerId, name: name, phone: phone, totalCredit: 0 };
            selectCustomerForExpense(newCustomerObj);
        }
    } else {
        showMessage('فشل إضافة العميل.', 'error');
    }
}

// --- Shift Management ---
async function calculateCashierShift() {
    const dateFrom = document.getElementById('shiftDateFromCashier').value;
    const dateTo = document.getElementById('shiftDateToCashier').value;
    const timeFrom = document.getElementById('shiftTimeFromCashier').value;
    const timeTo = document.getElementById('shiftTimeToCashier').value;

    if (!dateFrom || !dateTo || !timeFrom || !timeTo) {
        showMessage('يرجى ملء جميع حقول التاريخ والوقت.', 'warning');
        return;
    }

    showLoading(true);

    try {
        const filters = {
            dateFrom: dateFrom,
            dateTo: dateTo,
            timeFrom: timeFrom,
            timeTo: timeTo,
            cashier: currentUser.username
        };

        const expenses = await loadExpenses(filters);

        let categorizedExpenses = {
            expenses: [],
            insta: [],
            visa: [],
            online: []
        };

        expenses.forEach(expense => {
            const category = categories.find(cat => cat.name === expense.category || cat.code === expense.categoryCode);
            const formType = category ? category.formType : 'عادي';

            if (formType === 'إنستا') {
                categorizedExpenses.insta.push(expense);
            } else if (formType === 'فيزا') {
                categorizedExpenses.visa.push(expense);
            } else if (formType === 'اونلاين') {
                categorizedExpenses.online.push(expense);
            } else {
                categorizedExpenses.expenses.push(expense);
            }
        });

        const totalExpenses = categorizedExpenses.expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const expenseCount = categorizedExpenses.expenses.length;
        const totalInsta = categorizedExpenses.insta.reduce((sum, exp) => sum + exp.amount, 0);
        const instaCount = categorizedExpenses.insta.length;
        const totalVisa = categorizedExpenses.visa.reduce((sum, exp) => sum + exp.amount, 0);
        const visaCount = categorizedExpenses.visa.length;
        const totalOnline = categorizedExpenses.online.reduce((sum, exp) => sum + exp.amount, 0);
        const onlineCount = categorizedExpenses.online.length;
        // Corrected: grandTotal for cashier should include drawerCash
        // For calculation, we assume drawerCash is 0 initially, it's added later by the cashier
        const grandTotal = totalExpenses + totalInsta + totalVisa + totalOnline; 

        document.getElementById('totalExpensesCashier').textContent = totalExpenses.toFixed(2);
        document.getElementById('expenseCountCashier').textContent = expenseCount;
        document.getElementById('totalInstaCashier').textContent = totalInsta.toFixed(2);
        document.getElementById('instaCountCashier').textContent = instaCount;
        document.getElementById('totalVisaCashier').textContent = totalVisa.toFixed(2);
        document.getElementById('visaCountCashier').textContent = visaCount;
        document.getElementById('totalOnlineCashier').textContent = totalOnline.toFixed(2);
        document.getElementById('onlineCountCashier').textContent = onlineCount;
        document.getElementById('grandTotalCashier').textContent = grandTotal.toFixed(2); // This is the sum of transactions only

        document.getElementById('shiftSummaryCashier').style.display = 'block';

        showMessage('تم حساب الشيفت بنجاح.', 'success');
    } catch (error) {
        showMessage('حدث خطأ أثناء حساب الشيفت.', 'error');
        console.error(error);
    } finally {
        showLoading(false);
    }
}

async function finalizeCashierShiftCloseout() {
    const drawerCash = parseFloat(document.getElementById('drawerCashCashier').value);

    if (isNaN(drawerCash) || drawerCash < 0) {
        showMessage('يرجى إدخال قيمة صحيحة للنقدية في الدرج.', 'warning');
        return;
    }

    showLoading(true);

    try {
        const now = new Date();
        const shiftId = 'SHIFT_' + now.getTime();

        const totalExpenses = parseFloat(document.getElementById('totalExpensesCashier').textContent) || 0;
        const expenseCount = parseInt(document.getElementById('expenseCountCashier').textContent) || 0;
        const totalInsta = parseFloat(document.getElementById('totalInstaCashier').textContent) || 0;
        const instaCount = parseInt(document.getElementById('instaCountCashier').textContent) || 0;
        const totalVisa = parseFloat(document.getElementById('totalVisaCashier').textContent) || 0;
        const visaCount = parseInt(document.getElementById('visaCountCashier').textContent) || 0;
        const totalOnline = parseFloat(document.getElementById('totalOnlineCashier').textContent) || 0;
        const onlineCount = parseInt(document.getElementById('onlineCountCashier').textContent) || 0;
        
        // Corrected: grandTotal for cashier closure should include drawerCash
        const grandTotalTransactions = totalExpenses + totalInsta + totalVisa + totalOnline;
        const grandTotalWithDrawerCash = grandTotalTransactions + drawerCash;


        const shiftClosureData = [
            shiftId,
            currentUser.username,
            document.getElementById('shiftDateFromCashier').value,
            document.getElementById('shiftTimeFromCashier').value,
            document.getElementById('shiftDateToCashier').value,
            document.getElementById('shiftTimeToCashier').value,
            totalExpenses.toFixed(2), // تنسيق القيمة
            expenseCount,
            totalInsta.toFixed(2), // تنسيق القيمة
            instaCount,
            totalVisa.toFixed(2), // تنسيق القيمة
            visaCount,
            totalOnline.toFixed(2), // تنسيق القيمة
            onlineCount,
            grandTotalWithDrawerCash.toFixed(2), // Corrected: grandTotal for closure
            drawerCash.toFixed(2), // تنسيق القيمة
            0, // newMindTotal (not used for cashier self-closure)
            0, // difference (not calculated for cashier)
            'مغلق', // status
            now.toISOString().split('T')[0],
            now.toTimeString().split(' ')[0],
            '' // accountant (empty for self-closure)
        ];

        const result = await appendToSheet(SHEETS.SHIFT_CLOSURES, shiftClosureData);

        if (result.success) {
            showMessage('تم تقفيل الشيفت بنجاح.', 'success');
            resetCashierDailyData();
            document.getElementById('shiftSummaryCashier').style.display = 'none';
        } else {
            showMessage('فشل تقفيل الشيفت.', 'error');
        }
    } catch (error) {
        console.error('Error finalizing shift closeout:', error);
        showMessage('حدث خطأ أثناء تقفيل الشيفت.', 'error');
    } finally {
        showLoading(false);
    }
}

// --- Accountant Page Functions ---
async function showAccountantPage() {
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('cashierPage').classList.remove('active');
    document.getElementById('accountantPage').classList.add('active');
    document.getElementById('accountantNameDisplay').textContent = currentUserName;
    document.getElementById('currentDateAccountant').textContent = new Date().toLocaleDateString('ar-EG');

    await loadUsers();
    await loadCategories();
    await loadCustomers();
    populateAccountantFilters();
    updateAccountantDashboard();
    showTab('dashboardTabAccountant');
}

function populateAccountantFilters() {
    // Populate cashier filter for dashboard
    const cashierSelect = document.getElementById('cashierFilterAccountant');
    if (cashierSelect) {
        cashierSelect.innerHTML = '<option value="">جميع الكاشيرز</option>';
        const cashiers = users.filter(u => u.role === 'كاشير');
        cashiers.forEach(cashier => {
            const option = document.createElement('option');
            option.value = cashier.username;
            option.textContent = cashier.name;
            cashierSelect.appendChild(option);
        });
    }

    // Populate cashier filter for shift closure
    populateAccountantShiftCashierFilter();

    // Populate category filter for reports
    populateReportFilters();
}

function populateAccountantShiftCashierFilter() {
    const select = document.getElementById('selectedCashierAccountant');
    if (!select) return;
    select.innerHTML = '<option value="">اختر الكاشير</option>';
    const cashiers = users.filter(u => u.role === 'كاشير');
    cashiers.forEach(cashier => {
        const option = document.createElement('option');
        option.value = cashier.username;
        option.textContent = cashier.name;
        select.appendChild(option);
    });
}

async function updateAccountantDashboard() {
    const cashierFilter = document.getElementById('cashierFilterAccountant')?.value || '';
    const dateFromFilter = document.getElementById('dashboardDateFromAccountant')?.value || '';
    const dateToFilter = document.getElementById('dashboardDateToAccountant')?.value || '';

    const filters = { cashier: cashierFilter };
    if (dateFromFilter) filters.dateFrom = dateFromFilter;
    if (dateToFilter) filters.dateTo = dateToFilter;

    showLoading(true);
    try {
        const allExpenses = await loadExpenses(filters);

        let normalExpenses = [];
        let visaExpenses = [];
        let instaExpenses = [];
        let onlineExpenses = [];

        allExpenses.forEach(expense => {
            const category = categories.find(cat => cat.name === expense.category || cat.code === expense.categoryCode);
            const formType = category ? category.formType : 'عادي';

            if (formType === 'فيزا') {
                visaExpenses.push(expense);
            } else if (formType === 'إنستا') {
                instaExpenses.push(expense);
            } else if (formType === 'اونلاين') {
                onlineExpenses.push(expense);
            } else {
                normalExpenses.push(expense);
            }
        });

        const totalNormal = normalExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const normalCount = normalExpenses.length;
        const totalVisa = visaExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const visaCount = visaExpenses.length;
        const totalInsta = instaExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const instaCount = instaExpenses.length;
        const totalOnline = onlineExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const onlineCount = onlineExpenses.length;

        // Update stats grid
        document.getElementById('totalNormalExpensesAccountant').textContent = totalNormal.toFixed(2);
        document.getElementById('countNormalExpensesAccountant').textContent = normalCount;
        document.getElementById('totalVisaAccountant').textContent = totalVisa.toFixed(2);
        document.getElementById('countVisaAccountant').textContent = visaCount;
        document.getElementById('totalInstaAccountant').textContent = totalInsta.toFixed(2);
        document.getElementById('countInstaAccountant').textContent = instaCount;
        document.getElementById('totalOnlineAccountant').textContent = totalOnline.toFixed(2);
        document.getElementById('countOnlineAccountant').textContent = onlineCount;

        // Cashiers stats
        const activeCashiers = users.filter(u => u.role === 'كاشير' && u.status === 'نشط').length;
        const suspendedCashiers = users.filter(u => u.role === 'كاشير' && u.status === 'موقوف').length;
        const blockedCashiers = users.filter(u => u.role === 'كاشير' && u.status === 'محظور').length;

        document.getElementById('totalActiveCashiersAccountant').textContent = activeCashiers;
        document.getElementById('totalInactiveCashiersAccountant').textContent = suspendedCashiers;
        document.getElementById('totalBlockedCashiersAccountant').textContent = blockedCashiers;

        // Customers stats
        const totalCustomers = customers.length;
        const customersWithCredit = customers.filter(c => c.totalCredit > 0).length;
        const totalCredit = customers.reduce((sum, c) => sum + c.totalCredit, 0);
        const zeroCreditCustomers = customers.filter(c => c.totalCredit === 0).length;

        document.getElementById('totalCustomersAccountant').textContent = totalCustomers;
        document.getElementById('customersWithCreditAccountant').textContent = customersWithCredit;
        document.getElementById('totalCreditAmountAccountant').textContent = totalCredit.toFixed(2);
        document.getElementById('customersWithZeroCreditAccountant').textContent = zeroCreditCustomers;

        // Update cashier overview table
        updateAccountantCashierOverview(filters);
    } catch (error) {
        console.error('Error updating dashboard:', error);
        showMessage('حدث خطأ أثناء تحديث لوحة التحكم.', 'error');
    } finally {
        showLoading(false);
    }
}

async function updateAccountantCashierOverview(filters) {
    const tableBody = document.getElementById('cashiersOverviewBodyAccountant');
    if (!tableBody) return;

    const cashiers = users.filter(u => u.role === 'كاشير');
    tableBody.innerHTML = '';

    for (const cashier of cashiers) {
        const expenses = await loadExpenses({ ...filters, cashier: cashier.username });

        let normalExpenses = [];
        let visaExpenses = [];
        let instaExpenses = [];
        let onlineExpenses = [];

        expenses.forEach(expense => {
            const category = categories.find(cat => cat.name === expense.category || cat.code === expense.categoryCode);
            const formType = category ? category.formType : 'عادي';

            if (formType === 'فيزا') {
                visaExpenses.push(expense);
            } else if (formType === 'إنستا') {
                instaExpenses.push(expense);
            } else if (formType === 'اونلاين') {
                onlineExpenses.push(expense);
            } else {
                normalExpenses.push(expense);
            }
        });

        const totalNormal = normalExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const normalCount = normalExpenses.length;
        const totalVisa = visaExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const visaCount = visaExpenses.length;
        const totalInsta = instaExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const instaCount = instaExpenses.length;
        const totalOnline = onlineExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const onlineCount = onlineExpenses.length;

        // Get last activity date
        const lastActivity = expenses.length > 0 ?
            Math.max(...expenses.map(exp => new Date(exp.date))) :
            null;
        const lastActivityStr = lastActivity ?
            new Date(lastActivity).toLocaleDateString('ar-EG') :
            'لا يوجد نشاط';

        const row = tableBody.insertRow();
        row.insertCell().textContent = cashier.name;
        row.insertCell().textContent = totalNormal.toFixed(2);
        row.insertCell().textContent = normalCount;
        row.insertCell().textContent = totalVisa.toFixed(2);
        row.insertCell().textContent = visaCount;
        row.insertCell().textContent = totalInsta.toFixed(2);
        row.insertCell().textContent = instaCount;
        row.insertCell().textContent = totalOnline.toFixed(2);
        row.insertCell().textContent = onlineCount;
        row.insertCell().textContent = lastActivityStr;

        const statusCell = row.insertCell();
        statusCell.innerHTML = `<span class="status ${cashier.status === 'نشط' ? 'active' : 'inactive'}">${cashier.status}</span>`;
    }

    if (tableBody.rows.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="11">لا توجد بيانات للكاشيرز.</td></tr>';
    }
}

// --- Invoice Search Function ---
async function searchInvoiceAccountant() {
    const searchInput = document.getElementById('searchInputAccountant');
    const invoiceNumber = searchInput?.value.trim();
    const resultDiv = document.getElementById('invoiceSearchResultAccountant');

    if (!invoiceNumber) {
        showMessage('يرجى إدخال رقم الفاتورة للبحث.', 'warning');
        return;
    }

    if (!resultDiv) return;

    showLoading(true);
    try {
        const allExpenses = await loadExpenses({});
        const matchingExpenses = allExpenses.filter(exp =>
            exp.invoiceNumber && exp.invoiceNumber.toLowerCase().includes(invoiceNumber.toLowerCase())
        );

        resultDiv.innerHTML = '';

        if (matchingExpenses.length === 0) {
            resultDiv.innerHTML = '<p>لم يتم العثور على فواتير مطابقة لرقم الفاتورة المدخل.</p>';
            resultDiv.style.display = 'block';
            return;
        }

        let tableHtml = `
            <h4>نتائج البحث عن فاتورة رقم: ${invoiceNumber}</h4>
            <table>
                <thead>
                    <tr>
                        <th>التصنيف</th>
                        <th>رقم الفاتورة</th>
                        <th>القيمة</th>
                        <th>التاريخ</th>
                        <th>الوقت</th>
                        <th>الكاشير</th>
                        <th>الملاحظات</th>
                    </tr>
                </thead>
                <tbody>
        `;

        matchingExpenses.forEach(exp => {
            tableHtml += `
                <tr>
                    <td>${exp.category}</td>
                    <td>${exp.invoiceNumber}</td>
                    <td>${exp.amount.toFixed(2)}</td>
                    <td>${exp.date}</td>
                    <td>${exp.time}</td>
                    <td>${exp.cashier}</td>
                    <td>${exp.notes || '--'}</td>
                </tr>
            `;
        });

        tableHtml += '</tbody></table>';
        resultDiv.innerHTML = tableHtml;
        resultDiv.style.display = 'block';

        showMessage(`تم العثور على ${matchingExpenses.length} فاتورة مطابقة.`, 'success');
    } catch (error) {
        console.error('Error searching invoice:', error);
        showMessage('حدث خطأ أثناء البحث عن الفاتورة.', 'error');
    } finally {
        showLoading(false);
    }
}

// --- Reports Functions ---
function populateReportFilters() {
    const categorySelect = document.getElementById('reportCategoryAccountant');
    if (categorySelect) {
        categorySelect.innerHTML = '<option value="">جميع التصنيفات</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            categorySelect.appendChild(option);
        });
    }

    const cashierSelect = document.getElementById('reportCashierAccountant');
    if (cashierSelect) {
        cashierSelect.innerHTML = '<option value="">جميع الكاشيرز</option>';
        const cashiers = users.filter(u => u.role === 'كاشير');
        cashiers.forEach(cashier => {
            const option = document.createElement('option');
            option.value = cashier.username;
            option.textContent = cashier.name;
            cashierSelect.appendChild(option);
        });
    }
}

async function generateAccountantReport() {
    const categoryFilter = document.getElementById('reportCategoryAccountant')?.value || '';
    const cashierFilter = document.getElementById('reportCashierAccountant')?.value || '';
    const dateFrom = document.getElementById('reportDateFromAccountant')?.value || '';
    const dateTo = document.getElementById('reportDateToAccountant')?.value || '';

    const filters = { cashier: cashierFilter };
    if (categoryFilter) filters.category = categoryFilter;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    showLoading(true);
    try {
        const expenses = await loadExpenses(filters);
        const reportContent = document.getElementById('reportContentAccountant');
        if (!reportContent) return;

        reportContent.innerHTML = '';

        if (expenses.length === 0) {
            reportContent.innerHTML = '<p>لا توجد بيانات مطابقة لمعايير التقرير المحددة.</p>';
            return;
        }

        // Group expenses by cashier
        const expensesByCashier = {};
        expenses.forEach(exp => {
            if (!expensesByCashier[exp.cashier]) {
                expensesByCashier[exp.cashier] = {
                    normal: [],
                    visa: [],
                    insta: [],
                    online: []
                };
            }

            const category = categories.find(cat => cat.name === exp.category || cat.code === exp.categoryCode);
            const formType = category ? category.formType : 'عادي';

            if (formType === 'فيزا') {
                expensesByCashier[exp.cashier].visa.push(exp);
            } else if (formType === 'إنستا') {
                expensesByCashier[exp.cashier].insta.push(exp);
            } else if (formType === 'اونلاين') {
                expensesByCashier[exp.cashier].online.push(exp);
            } else {
                expensesByCashier[exp.cashier].normal.push(exp);
            }
        });

        let reportHtml = `
            <div class="report-header">
                <h3>تقرير المصروفات</h3>
                <p>من ${dateFrom || 'البداية'} إلى ${dateTo || 'النهاية'}</p>
                ${cashierFilter ? `<p>الكاشير: ${cashierFilter}</p>` : ''}
                ${categoryFilter ? `<p>التصنيف: ${categoryFilter}</p>` : ''}
            </div>
        `;

        let grandTotalNormal = 0;
        let grandTotalVisa = 0;
        let grandTotalInsta = 0;
        let grandTotalOnline = 0;

        Object.keys(expensesByCashier).forEach(cashierName => {
            const cashierData = expensesByCashier[cashierName];
            const cashierUser = users.find(u => u.username === cashierName);
            const displayName = cashierUser ? cashierUser.name : cashierName;

            const totalNormal = cashierData.normal.reduce((sum, exp) => sum + exp.amount, 0);
            const totalVisa = cashierData.visa.reduce((sum, exp) => sum + exp.amount, 0);
            const totalInsta = cashierData.insta.reduce((sum, exp) => sum + exp.amount, 0);
            const totalOnline = cashierData.online.reduce((sum, exp) => sum + exp.amount, 0);

            grandTotalNormal += totalNormal;
            grandTotalVisa += totalVisa;
            grandTotalInsta += totalInsta;
            grandTotalOnline += totalOnline;

            reportHtml += `
                <div class="cashier-section">
                    <h4>${displayName}</h4>
                    <div class="stats-summary">
                        <p>إجمالي المصروفات العادية: ${totalNormal.toFixed(2)} (${cashierData.normal.length} فاتورة)</p>
                        <p>إجمالي الفيزا: ${totalVisa.toFixed(2)} (${cashierData.visa.length} فاتورة)</p>
                        <p>إجمالي الإنستا: ${totalInsta.toFixed(2)} (${cashierData.insta.length} فاتورة)</p>
                        <p>إجمالي الأونلاين: ${totalOnline.toFixed(2)} (${cashierData.online.length} فاتورة)</p>
                        <p><strong>الإجمالي الكلي: ${(totalNormal + totalVisa + totalInsta + totalOnline).toFixed(2)}</strong></p>
                    </div>
            `;

            if (cashierFilter === cashierName || !cashierFilter) {
                const allCashierExpenses = [...cashierData.normal, ...cashierData.visa, ...cashierData.insta, ...cashierData.online];
                allCashierExpenses.sort((a, b) => new Date(`${b.date} ${b.time}`) - new Date(`${a.date} ${a.date}`));

                if (allCashierExpenses.length > 0) {
                    reportHtml += `
                        <table>
                            <thead>
                                <tr>
                                    <th>التصنيف</th>
                                    <th>رقم الفاتورة</th>
                                    <th>القيمة</th>
                                    <th>التاريخ</th>
                                    <th>الوقت</th>
                                    <th>الملاحظات</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;

                    allCashierExpenses.forEach(exp => {
                        reportHtml += `
                            <tr>
                                <td>${exp.category}</td>
                                <td>${exp.invoiceNumber || '--'}</td>
                                <td>${exp.amount.toFixed(2)}</td>
                                <td>${exp.date}</td>
                                <td>${exp.time}</td>
                                <td>${exp.notes || '--'}</td>
                            </tr>
                        `;
                    });

                    reportHtml += '</tbody></table>';
                }
            }

            reportHtml += '</div>';
        });

        reportHtml += `
            <div class="report-footer">
                <h4>الإجمالي العام</h4>
                <p>إجمالي المصروفات العادية: ${grandTotalNormal.toFixed(2)}</p>
                <p>إجمالي الفيزا: ${grandTotalVisa.toFixed(2)}</p>
                <p>إجمالي الإنستا: ${grandTotalInsta.toFixed(2)}</p>
                <p>إجمالي الأونلاين: ${grandTotalOnline.toFixed(2)}</p>
                <p><strong>الإجمالي الكلي: ${(grandTotalNormal + grandTotalVisa + grandTotalInsta + grandTotalOnline).toFixed(2)}</strong></p>
            </div>
        `;

        reportContent.innerHTML = reportHtml;
        showMessage('تم إنشاء التقرير بنجاح.', 'success');
    } catch (error) {
        console.error('Error generating report:', error);
        showMessage('حدث خطأ أثناء إنشاء التقرير.', 'error');
    } finally {
        showLoading(false);
    }
}

function printReport() {
    const reportContent = document.getElementById('reportContentAccountant');
    if (!reportContent || !reportContent.innerHTML.trim()) {
        showMessage('لا يوجد تقرير للطباعة. يرجى إنشاء التقرير أولاً.', 'warning');
        return;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>تقرير المصروفات</title>
                <style>
                    body { font-family: 'Tajawal', sans-serif; direction: rtl; text-align: right; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                    th { background-color: #f2f2f2; }
                    .report-header, .report-footer { margin: 20px 0; }
                    .cashier-section { margin: 30px 0; border-top: 2px solid #ccc; padding-top: 20px; }
                    .stats-summary { background: #f9f9f9; padding: 15px; margin: 10px 0; }
                    @media print { body { -webkit-print-color-adjust: exact; } }
                </style>
            </head>
            <body>
                ${reportContent.innerHTML}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

function showWhatsAppModal() {
    const reportContent = document.getElementById('reportContentAccountant');
    if (!reportContent || !reportContent.innerHTML.trim()) {
        showMessage('لا يوجد تقرير للإرسال. يرجى إنشاء التقرير أولاً.', 'warning');
        return;
    }

    const modal = document.getElementById('whatsappModal');
    if (modal) {
        modal.classList.add('active');
        document.getElementById('whatsappNumber').value = '';
    }
}

function sendReportViaWhatsApp() {
    const phoneNumber = document.getElementById('whatsappNumber').value.trim();
    const reportContent = document.getElementById('reportContentAccountant');

    if (!phoneNumber) {
        showMessage('يرجى إدخال رقم الواتساب.', 'warning');
        return;
    }

    if (!reportContent || !reportContent.innerHTML.trim()) {
        showMessage('لا يوجد تقرير للإرسال.', 'error');
        return;
    }

    // Extract text content from the report
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = reportContent.innerHTML;
    const reportText = tempDiv.textContent || tempDiv.innerText || '';

    // Create WhatsApp URL
    const encodedText = encodeURIComponent(`تقرير المصروفات\n\n${reportText.substring(0, 1000)}...`);
    const whatsappUrl = `https://wa.me/${phoneNumber.replace(/\D/g, '')}?text=${encodedText}`;

    window.open(whatsappUrl, '_blank');
    closeModal('whatsappModal');
    showMessage('تم فتح واتساب لإرسال التقرير.', 'success');
}

// --- Users Management ---
function displayUsers() {
    const tableBody = document.getElementById('usersTableBodyAccountant');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7">لا توجد مستخدمين.</td></tr>';
        return;
    }

    users.forEach(user => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = user.name;
        row.insertCell().textContent = user.phone;
        row.insertCell().textContent = user.username;
        row.insertCell().textContent = user.role;

        const statusCell = row.insertCell();
        statusCell.innerHTML = `<span class="status ${user.status === 'نشط' ? 'active' : 'inactive'}">${user.status}</span>`;

        row.insertCell().textContent = user.creationDate;

        const actionsCell = row.insertCell();
        actionsCell.innerHTML = `
            <button class="edit-btn" onclick="editUser('${user.id}')"><i class="fas fa-edit"></i> تعديل</button>
            <button class="delete-btn" onclick="showMessage('وظيفة حذف المستخدم غير متاحة حالياً.', 'warning')"><i class="fas fa-trash"></i> حذف</button>
            <button class="block-btn" onclick="changeUserPassword('${user.id}')"><i class="fas fa-key"></i> كلمة المرور</button>
        `;
    });
}

// Placeholder functions for user management (to avoid errors)
function editUser(userId) {
    showMessage('وظيفة تعديل المستخدم غير متاحة حالياً.', 'warning');
    console.log('Edit user:', userId);
}

function changeUserPassword(userId) {
    showMessage('وظيفة تغيير كلمة مرور المستخدم غير متاحة حالياً.', 'warning');
    console.log('Change password for user:', userId);
}

function showAddUserModal() {
    const form = document.getElementById('addUserForm');
    if (form) form.reset();

    const modal = document.getElementById('addUserModal');
    if (modal) modal.classList.add('active');
}

async function addUser() {
    const name = document.getElementById('userName').value.trim();
    const phone = document.getElementById('userPhone').value.trim();
    const username = document.getElementById('userUsername').value.trim();
    const password = document.getElementById('userPassword').value.trim();
    const role = document.getElementById('userRole').value;

    if (!name || !phone || !username || !password || !role) {
        showMessage('يرجى ملء جميع حقول المستخدم.', 'warning');
        return;
    }

    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
        showMessage('اسم المستخدم موجود بالفعل.', 'warning');
        return;
    }

    const existingPhone = users.find(u => u.phone === phone);
    if (existingPhone) {
        showMessage('رقم التليفون موجود بالفعل.', 'warning');
        return;
    }

    const userId = 'USER_' + new Date().getTime();
    const newUser = [
        userId,
        name,
        phone,
        username,
        password,
        role,
        'نشط',
        new Date().toISOString().split('T')[0]
    ];

    const result = await appendToSheet(SHEETS.USERS, newUser);

    if (result.success) {
        showMessage('تم إضافة المستخدم بنجاح.', 'success');
        closeModal('addUserModal');
        await loadUsers();
        displayUsers();
        populateUserDropdown();
        populateAccountantFilters();
    } else {
        showMessage('فشل إضافة المستخدم.', 'error');
    }
}

// --- Shift Closure for Accountant ---
function resetAccountantShiftForm() {
    const closureResultsAccountant = document.getElementById('closureResultsAccountant');
    if (closureResultsAccountant) {
        closureResultsAccountant.style.display = 'none';
    }

    const differenceResultAccountant = document.getElementById('differenceResultAccountant');
    if (differenceResultAccountant) {
        differenceResultAccountant.style.display = 'none';
    }

    const newmindTotalAccountant = document.getElementById('newmindTotalAccountant');
    if (newmindTotalAccountant) {
        newmindTotalAccountant.value = '';
    }

    // Reset form fields to current date/time
    setDefaultDatesAndTimes();

    // Clear selected cashier
    const selectedCashier = document.getElementById('selectedCashierAccountant');
    if (selectedCashier) {
        selectedCashier.value = '';
    }

    // Clear stored closure data
    window.currentClosureData = null;

    // Hide close cashier button
    const closeCashierBtn = document.querySelector('.close-cashier-btn');
    if (closeCashierBtn) {
        closeCashierBtn.style.display = 'none';
    }
}
// --- حساب الفرق للمحاسب ---
function calculateDifferenceAccountant() {
    if (!window.currentClosureData) {
        showMessage('يرجى البحث عن بيانات الكاشير أولاً.', 'warning');
        return;
    }

    const newMindTotal = parseFloat(document.getElementById('newmindTotalAccountant').value);
    if (isNaN(newMindTotal) || newMindTotal < 0) {
        showMessage('يرجى إدخال قيمة صحيحة لإجمالي نيو مايند.', 'warning');
        return;
    }

    const cashierTotal = window.currentClosureData.grandTotal;
    const difference = newMindTotal - cashierTotal;

    const differenceResult = document.getElementById('differenceResultAccountant');
    if (!differenceResult) return;

    let statusText = '';
    let statusClass = '';
    
    if (difference === 0) {
        statusText = 'مطابق ✓';
        statusClass = 'status-match';
    } else if (difference > 0) {
        statusText = `عجز على الكاشير: +${difference.toFixed(2)}`;
        statusClass = 'status-deficit';
    } else {
        statusText = `زيادة عند الكاشير: ${difference.toFixed(2)}`;
        statusClass = 'status-surplus';
    }

    differenceResult.innerHTML = `
        <div class="difference-card ${statusClass}">
            <h4>نتيجة المقارنة</h4>
            <p><strong>إجمالي الكاشير:</strong> ${cashierTotal.toFixed(2)}</p>
            <p><strong>إجمالي نيو مايند:</strong> ${newMindTotal.toFixed(2)}</p>
            <p><strong>الفرق:</strong> ${difference.toFixed(2)}</p>
            <p><strong>الحالة:</strong> ${statusText}</p>
        </div>
    `;

    differenceResult.style.display = 'block';

    // إظهار زر تقفيل الكاشير
    const closeCashierBtn = document.querySelector('.close-cashier-btn');
    if (closeCashierBtn) {
        closeCashierBtn.style.display = 'block';
    }

    showMessage('تم حساب الفرق بنجاح.', 'success');
}
// دالة مساعدة لتحويل AM/PM إلى 24 ساعة (محدثة للتعامل مع الثواني إذا وُجدت)
function convertTo24HourFormat(timeStr) {
    // timeStr مثل "09:52 ص" أو "09:52:00 م" أو "21:00:00"
    let period = '';
    let timePart = timeStr;

    // فصل الفترة (ص/م) إذا وُجدت
    if (timeStr.includes('ص') || timeStr.includes('م')) {
        const match = timeStr.match(/(\d{1,2}:\d{2}(:\d{2})?)\s*(ص|م)/);
        if (match) {
            timePart = match[1];
            period = match[3];
        }
    }

    let [hours, minutes, seconds = '00'] = timePart.split(':').map(Number);
    
    // تحويل إلى 24 ساعة
    if (period.includes('م') && hours !== 12) {
        hours += 12;
    } else if (period.includes('ص') && hours === 12) {
        hours = 0;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds}`;
}

// دالة جديدة لتنظيف الوقت إلى HH:MM:SS دائمًا (تجنب الإضافة الزائدة)
// دالة محسنة لتنظيف الوقت إلى HH:MM:SS
function normalizeTimeToHHMMSS(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') {
        return '00:00:00';
    }
    
    // تنظيف السلسلة من المسافات الزائدة
    timeStr = timeStr.trim();
    
    // إذا كان الوقت فارغاً
    if (timeStr === '') {
        return '00:00:00';
    }
    
    // معالجة الوقت إذا كان بتنسيق AM/PM عربي
    if (timeStr.includes('ص') || timeStr.includes('م')) {
        const match = timeStr.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(ص|م)/);
        if (match) {
            let hours = parseInt(match[1]);
            let minutes = parseInt(match[2]);
            let seconds = match[3] ? parseInt(match[3]) : 0;
            const period = match[4];
            
            // تحويل من 12 ساعة إلى 24 ساعة
            if (period.includes('م') && hours !== 12) {
                hours += 12;
            } else if (period.includes('ص') && hours === 12) {
                hours = 0;
            }
            
            // التأكد من أن الأرقام ضمن النطاق الصحيح
            hours = Math.max(0, Math.min(23, hours));
            minutes = Math.max(0, Math.min(59, minutes));
            seconds = Math.max(0, Math.min(59, seconds));
            
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    // معالجة الوقت بتنسيق 24 ساعة
    const timeParts = timeStr.split(':').filter(part => part !== '');
    
    if (timeParts.length >= 2) {
        let hours = parseInt(timeParts[0]) || 0;
        let minutes = parseInt(timeParts[1]) || 0;
        let seconds = timeParts[2] ? parseInt(timeParts[2]) || 0 : 0;
        
        // إصلاح المشكلة: إذا كانت الثواني مكتوبة كـ "0" بدلاً من "00"
        if (seconds === 0 && timeParts[2] === '0') {
            seconds = 0; // هذا صحيح، ولكن سنضمن أنه يُنسق كـ "00"
        }
        
        // التأكد من أن الأرقام ضمن النطاق الصحيح
        hours = Math.max(0, Math.min(23, hours));
        minutes = Math.max(0, Math.min(59, minutes));
        seconds = Math.max(0, Math.min(59, seconds));
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // إذا فشل كل شيء، إرجاع الوقت الافتراضي
    console.warn(`تعذر تحليل الوقت: "${timeStr}"، سيتم استخدام 00:00:00`);
    return '00:00:00';
}

async function searchCashierClosuresAccountant() {
    const selectedCashier = document.getElementById('selectedCashierAccountant').value;
    const dateFrom = document.getElementById('accountantShiftDateFrom').value;
    const dateTo = document.getElementById('accountantShiftDateTo').value;
    const timeFrom = document.getElementById('accountantShiftTimeFrom').value;
    const timeTo = document.getElementById('accountantShiftTimeTo').value;

    if (!selectedCashier || !dateFrom || !dateTo || !timeFrom || !timeTo) {
        showMessage('يرجى ملء جميع الحقول للبحث عن تقفيلة الكاشير.', 'warning');
        return;
    }

    showLoading(true);

    try {
        // تنظيف أوقات الإدخال إلى HH:MM:SS
        const formattedTimeFrom = normalizeTimeToHHMMSS(timeFrom);
        const formattedTimeTo = normalizeTimeToHHMMSS(timeTo);

        // التحقق من صحة التواريخ أولاً
        if (!isValidDate(dateFrom) || !isValidDate(dateTo)) {
            throw new Error('تنسيق التاريخ غير صحيح. يرجى استخدام الصيغة YYYY-MM-DD.');
        }

        // التحقق من صحة الأوقات
        if (!isValidTime(formattedTimeFrom) || !isValidTime(formattedTimeTo)) {
            throw new Error('تنسيق الوقت غير صحيح.');
        }

        // Construct the start and end Date objects for the search period
        const searchStartDateTime = new Date(`${dateFrom}T${formattedTimeFrom}`);
        const searchEndDateTime = new Date(`${dateTo}T${formattedTimeTo}`);

        // التحقق من صحة التواريخ المنشأة
        if (isNaN(searchStartDateTime.getTime()) || isNaN(searchEndDateTime.getTime())) {
            throw new Error('تنسيق التاريخ أو الوقت غير صحيح. تأكد من الإدخال.');
        }

        console.log(`البحث عن إغلاقات داخل الفترة: ${searchStartDateTime.toISOString()} إلى ${searchEndDateTime.toISOString()}`);
        console.log(`الكاشير المحدد: ${selectedCashier}, formattedTimeFrom: ${formattedTimeFrom}, formattedTimeTo: ${formattedTimeTo}`);

        // Load expenses for the current search period
        const expenses = await loadExpenses({
            dateFrom: dateFrom,
            dateTo: dateTo,
            timeFrom: formattedTimeFrom.slice(0, 5), // HH:MM
            timeTo: formattedTimeTo.slice(0, 5),
            cashier: selectedCashier
        });

        let normalExpenses = [];
        let visaExpenses = [];
        let instaExpenses = [];
        let onlineExpenses = [];

        expenses.forEach(expense => {
            const category = categories.find(cat => cat.name === expense.category || cat.code === expense.categoryCode);
            const formType = category ? category.formType : 'عادي';

            if (formType === 'فيزا') {
                visaExpenses.push(expense);
            } else if (formType === 'إنستا') {
                instaExpenses.push(expense);
            } else if (formType === 'اونلاين') {
                onlineExpenses.push(expense);
            } else {
                normalExpenses.push(expense);
            }
        });

        // --- MODIFIED LOGIC FOR DRAWER CASH: البحث داخل الفترة أولاً ---
        let drawerCash = 0;
        const allClosures = await loadShiftClosures({});

        // طباعة جميع الإغلاقات للتشخيص
        console.log('جميع الإغلاقات المحملة:', allClosures.map(c => ({ 
            id: c.id, 
            cashier: c.cashier, 
            dateTo: c.dateTo, 
            timeTo: c.timeTo, 
            drawerCash: c.drawerCash 
        })));

        // 1. البحث عن الإغلاقات داخل الفترة
        const closuresInPeriod = allClosures.filter(closure => {
            if (!closure.dateTo || !closure.timeTo || closure.drawerCash === undefined) return false;

            // تنظيف timeTo للإغلاق
            const normalizedClosureTimeTo = normalizeTimeToHHMMSS(closure.timeTo);
            
            const closureEndDateTimeStr = `${closure.dateTo}T${normalizedClosureTimeTo}`;
            const closureEndDateTime = new Date(closureEndDateTimeStr);
            
            // التحقق من صحة التاريخ
            if (isNaN(closureEndDateTime.getTime())) {
                console.error(`وقت غير صالح للإغلاق ${closure.id}: ${closureEndDateTimeStr} (normalized: ${normalizedClosureTimeTo})`);
                return false;
            }

            const isInPeriod = closure.cashier === selectedCashier && 
                               closureEndDateTime >= searchStartDateTime && 
                               closureEndDateTime <= searchEndDateTime;
            
            console.log(`فحص إغلاق ${closure.id}: انتهى في ${closureEndDateTime.toISOString()}, normalizedTime: ${normalizedClosureTimeTo}, هل داخل الفترة؟ ${isInPeriod}, drawerCash: ${closure.drawerCash}`);
            
            return isInPeriod;
        });

        let drawerCashFromPeriod = 0;
        if (closuresInPeriod.length > 0) {
            drawerCashFromPeriod = closuresInPeriod.reduce((sum, closure) => sum + (parseFloat(closure.drawerCash) || 0), 0);
            console.log(`وُجد ${closuresInPeriod.length} إغلاق داخل الفترة، drawerCash المجموع = ${drawerCashFromPeriod}`);
            drawerCash = drawerCashFromPeriod;
        } else {
            console.log(`لا يوجد إغلاق داخل الفترة ${dateFrom} ${formattedTimeFrom.slice(0,5)} إلى ${dateTo} ${formattedTimeTo.slice(0,5)}`);
        }

        // 2. Fallback: آخر إغلاق قبل الفترة إذا لم يوجد داخل
        if (drawerCashFromPeriod === 0) {
            const previousClosures = allClosures.filter(closure => {
                if (!closure.dateTo || !closure.timeTo || closure.drawerCash === undefined) return false;

                const normalizedClosureTimeTo = normalizeTimeToHHMMSS(closure.timeTo);
                const closureEndDateTimeStr = `${closure.dateTo}T${normalizedClosureTimeTo}`;
                const closureEndDateTime = new Date(closureEndDateTimeStr);
                
                if (isNaN(closureEndDateTime.getTime())) {
                    console.error(`وقت غير صالح للإغلاق السابق ${closure.id}: ${closureEndDateTimeStr}`);
                    return false;
                }

                const isPrevious = closure.cashier === selectedCashier && closureEndDateTime < searchStartDateTime;
                
                console.log(`فحص إغلاق سابق ${closure.id}: انتهى في ${closureEndDateTime.toISOString()}, هل قبل الفترة؟ ${isPrevious}, drawerCash: ${closure.drawerCash}`);
                
                return isPrevious;
            });

            if (previousClosures.length > 0) {
                const latestPrevious = previousClosures.sort((a, b) => {
                    const timeA = normalizeTimeToHHMMSS(a.timeTo);
                    const timeB = normalizeTimeToHHMMSS(b.timeTo);
                    return new Date(`${b.dateTo}T${timeB}`) - new Date(`${a.dateTo}T${timeA}`);
                })[0];
                drawerCash = parseFloat(latestPrevious.drawerCash) || 0;
                console.log(`آخر إغلاق سابق: ${latestPrevious.id}، drawerCash = ${drawerCash}`);
            } else {
                drawerCash = 0;
                console.log(`لا يوجد إغلاق داخل أو قبل الفترة، drawerCash = 0`);
            }
        }

        // --- END MODIFIED LOGIC ---

        const totalNormal = normalExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const totalVisa = visaExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const totalInsta = instaExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const totalOnline = onlineExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        
        const grandTotal = totalNormal + totalVisa + totalInsta + totalOnline + drawerCash; 

        // عرض النتائج
        document.getElementById('closureResultsAccountant').style.display = 'block';

        document.getElementById('accTotalNormalExpenses').textContent = totalNormal.toFixed(2);
        document.getElementById('accTotalVisa').textContent = totalVisa.toFixed(2);
        document.getElementById('accTotalInsta').textContent = totalInsta.toFixed(2);
        document.getElementById('accTotalOnline').textContent = totalOnline.toFixed(2);
        document.getElementById('accDrawerCash').textContent = drawerCash.toFixed(2);
        document.getElementById('accGrandTotalCashier').textContent = grandTotal.toFixed(2);

        document.getElementById('newmindTotalAccountant').value = '';
        document.getElementById('differenceResultAccountant').style.display = 'none';
        const closeCashierBtn = document.querySelector('.close-cashier-btn');
        if (closeCashierBtn) {
            closeCashierBtn.style.display = 'none';
        }

        // حفظ البيانات
        window.currentClosureData = {
            cashier: selectedCashier,
            dateFrom: dateFrom,
            timeFrom: formattedTimeFrom.slice(0, 5), // HH:MM
            dateTo: dateTo,
            timeTo: formattedTimeTo.slice(0, 5),
            totalNormal: totalNormal,
            normalCount: normalExpenses.length,
            totalVisa: totalVisa,
            visaCount: visaExpenses.length,
            totalInsta: totalInsta,
            instaCount: instaExpenses.length,
            totalOnline: totalOnline,
            onlineCount: onlineExpenses.length,
            drawerCash: drawerCash,
            grandTotal: grandTotal
        };

        const cashierUser  = users.find(u => u.username === selectedCashier);
        const cashierDisplayName = cashierUser  ? cashierUser .name : selectedCashier;
        let cashSource = '';
        if (closuresInPeriod.length > 0) {
            cashSource = ` (مجموع من ${closuresInPeriod.length} إغلاق داخل الفترة)`;
        } else if (drawerCash > 0) {
            cashSource = ` (من آخر إغلاق سابق)`;
        } else {
            cashSource = ` (لا إغلاقات، افتراضي)`;
        }
        showMessage(`تم البحث عن بيانات الكاشير ${cashierDisplayName} للفترة المحددة. إجمالي الكاش في الدرج: ${drawerCash.toFixed(2)}${cashSource}.`, 'success');
    } catch (error) {
        console.error('Error searching cashier closures:', error);
        showMessage(`حدث خطأ أثناء البحث عن بيانات الكاشير: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// دالة للتحقق من صحة التاريخ
function isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
}

// دالة للتحقق من صحة الوقت
function isValidTime(timeString) {
    const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
    return regex.test(timeString);
}

// تحسين دالة تحويل الوقت لتكون أكثر أماناً
function normalizeTimeToHHMMSS(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') {
        return '00:00:00';
    }
    
    // إذا كان الوقت بالفعل بتنسيق 24 ساعة
    if (timeStr.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/)) {
        const parts = timeStr.split(':');
        if (parts.length === 3) return timeStr;
        if (parts.length === 2) return timeStr + ':00';
        return '00:00:00';
    }
    
    // تحويل من AM/PM إلى 24 ساعة
    try {
        let period = '';
        let timePart = timeStr.trim();
        
        // فصل الفترة (ص/م) إذا وُجدت
        if (timeStr.includes('ص') || timeStr.includes('م')) {
            const match = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(ص|م)/);
            if (match) {
                timePart = match[1] + ':' + match[2] + (match[3] ? ':' + match[3] : '');
                period = match[4];
            }
        }
        
        let [hours, minutes, seconds = '00'] = timePart.split(':').map(Number);
        
        if (isNaN(hours) || isNaN(minutes)) {
            return '00:00:00';
        }
        
        // تحويل إلى 24 ساعة
        if (period.includes('م') && hours !== 12) {
            hours += 12;
        } else if (period.includes('ص') && hours === 12) {
            hours = 0;
        }
        
        // التأكد من أن الأرقام ضمن النطاق الصحيح
        hours = Math.max(0, Math.min(23, hours));
        minutes = Math.max(0, Math.min(59, minutes));
        seconds = Math.max(0, Math.min(59, seconds));
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } catch (error) {
        console.error('Error normalizing time:', error, timeStr);
        return '00:00:00';
    }
}

async function closeCashierByAccountant() {
    if (!window.currentClosureData) {
        showMessage('يرجى البحث عن بيانات الكاشير أولاً.', 'warning');
        return;
    }

    const newMindTotal = parseFloat(document.getElementById('newmindTotalAccountant').value);
    if (isNaN(newMindTotal) || newMindTotal < 0) {
        showMessage('يرجى إدخال قيمة صحيحة لإجمالي نيو مايند.', 'warning');
        return;
    }

    const difference = newMindTotal - window.currentClosureData.grandTotal;

    showLoading(true);
    try {
        const now = new Date();
        const shiftId = 'SHIFT_ACC_' + now.getTime();

        const shiftClosureData = [
            shiftId,
            window.currentClosureData.cashier,
            window.currentClosureData.dateFrom,
            window.currentClosureData.timeFrom,
            window.currentClosureData.dateTo,
            window.currentClosureData.timeTo,
            window.currentClosureData.totalNormal.toFixed(2),
            window.currentClosureData.normalCount,
            window.currentClosureData.totalInsta.toFixed(2),
            window.currentClosureData.instaCount,
            window.currentClosureData.totalVisa.toFixed(2),
            window.currentClosureData.visaCount,
            window.currentClosureData.totalOnline.toFixed(2),
            window.currentClosureData.onlineCount,
            window.currentClosureData.grandTotal.toFixed(2), // الإجمالي الكلي للكاشير (مع الكاش في الدرج)
            window.currentClosureData.drawerCash.toFixed(2), // الكاش في الدرج
            newMindTotal.toFixed(2),
            difference.toFixed(2),
            'مغلق بواسطة المحاسب',
            now.toISOString().split('T')[0],
            now.toTimeString().split(' ')[0],
            currentUser.username
        ];

        const result = await appendToSheet(SHEETS.SHIFT_CLOSURES, shiftClosureData);

        if (result.success) {
            const cashierUser = users.find(u => u.username === window.currentClosureData.cashier);
            const cashierDisplayName = cashierUser ? cashierUser.name : window.currentClosureData.cashier;
            showMessage(`تم تقفيل شيفت الكاشير ${cashierDisplayName} بنجاح بواسطة المحاسب.`, 'success');

            resetAccountantShiftForm();
            loadAccountantShiftClosuresHistory();
        } else {
            showMessage('فشل تقفيل شيفت الكاشير.', 'error');
        }
    } catch (error) {
        console.error('Error closing cashier shift by accountant:', error);
        showMessage('حدث خطأ أثناء تقفيل شيفت الكاشير.', 'error');
    } finally {
        showLoading(false);
    }
}

async function loadAccountantShiftClosuresHistory() {
    const closures = await loadShiftClosures({});
    const tableBody = document.getElementById('closuresHistoryBodyAccountant');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (closures.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9">لا توجد سجلات تقفيلات.</td></tr>'; // تم زيادة colspan
        return;
    }

    closures.sort((a, b) => new Date(`${b.closureDate} ${b.closureTime}`) - new Date(`${a.closureDate} ${a.closureTime}`));

    closures.forEach(closure => {
        const row = tableBody.insertRow();

        const cashierUser = users.find(u => u.username === closure.cashier);
        const cashierDisplayName = cashierUser ? cashierUser.name : closure.cashier;

        row.insertCell().textContent = cashierDisplayName;
        row.insertCell().textContent = `${closure.dateFrom} ${closure.timeFrom} - ${closure.dateTo} ${closure.timeTo}`;

        // إجمالي الكاشير يجب أن يشمل الكاش في الدرج
        const totalCashierAmount = closure.totalExpenses + closure.totalVisa + closure.totalInsta + closure.totalOnline + closure.drawerCash;
        row.insertCell().textContent = totalCashierAmount.toFixed(2);

        row.insertCell().textContent = closure.newMindTotal.toFixed(2);

        const differenceCell = row.insertCell();
        const diffValue = closure.difference;
        differenceCell.textContent = diffValue.toFixed(2);
        if (diffValue > 0) {
            differenceCell.style.color = 'red';
            differenceCell.title = 'عجز على الكاشير (نقص في النقدية)';
        } else if (diffValue < 0) {
            differenceCell.style.color = 'green';
            differenceCell.title = 'زيادة عند الكاشير (فائض في النقدية)';
        } else {
            differenceCell.style.color = 'blue';
            differenceCell.title = 'مطابق';
        }

        const statusCell = row.insertCell();
        statusCell.innerHTML = `<span class="status ${closure.status === 'مغلق' || closure.status === 'مغلق بواسطة المحاسب' ? 'closed' : 'open'}">${closure.status}</span>`;

        row.insertCell().textContent = `${closure.closureDate} ${closure.closureTime}`;

        const actionsCell = row.insertCell();
        actionsCell.innerHTML = `
            <button class="view-btn" onclick="viewClosureDetails('${closure.id}')">
                <i class="fas fa-eye"></i> عرض
            </button>
            <button class="accountant-close-btn" onclick="showAccountantClosureModal('${closure.id}')">
                <i class="fas fa-check-double"></i> تقفيل المحاسب
            </button>
        `;
    });
}

// --- New Modal for Accountant Closure Details ---
async function showAccountantClosureModal(closureId) { // Make it async
    showLoading(true); // Show loading overlay
    try {
        const allClosures = await loadShiftClosures({}); // Load all closures to ensure 'closures' is defined
        const closure = allClosures.find(c => c.id === closureId);
        if (!closure) {
            showMessage('لم يتم العثور على تفاصيل التقفيلة.', 'error');
            return;
        }

        // Populate the modal with closure data
        document.getElementById('accountantClosureModalCashierName').textContent = users.find(u => u.username === closure.cashier)?.name || closure.cashier;
        document.getElementById('accountantClosureModalPeriod').textContent = `${closure.dateFrom} ${closure.timeFrom} - ${closure.dateTo} ${closure.timeTo}`;
        document.getElementById('accountantClosureModalTotalExpenses').textContent = closure.totalExpenses.toFixed(2);
        document.getElementById('accountantClosureModalTotalInsta').textContent = closure.totalInsta.toFixed(2);
        document.getElementById('accountantClosureModalTotalVisa').textContent = closure.totalVisa.toFixed(2);
        document.getElementById('accountantClosureModalTotalOnline').textContent = closure.totalOnline.toFixed(2);
        document.getElementById('accountantClosureModalDrawerCash').textContent = closure.drawerCash.toFixed(2);
        // Corrected: grandTotal for modal should include drawerCash
        document.getElementById('accountantClosureModalGrandTotal').textContent = (closure.totalExpenses + closure.totalInsta + closure.totalVisa + closure.totalOnline + closure.drawerCash).toFixed(2);
        
        document.getElementById('accountantClosureModalNewMindTotal').value = closure.newMindTotal > 0 ? closure.newMindTotal.toFixed(2) : '';
        document.getElementById('accountantClosureModalDifference').textContent = closure.difference.toFixed(2);
        document.getElementById('accountantClosureModalStatus').textContent = closure.status;

        // Store current closure data for processing
        window.currentAccountantClosure = closure;

        // Show the modal
        document.getElementById('accountantClosureDetailsModal').classList.add('active');
        updateAccountantClosureDifference(); // Calculate initial difference if newMindTotal is pre-filled
    } catch (error) {
        console.error('Error showing accountant closure modal:', error);
        showMessage('حدث خطأ أثناء عرض تفاصيل تقفيل المحاسب.', 'error');
    } finally {
        showLoading(false); // Hide loading overlay
    }
}

function updateAccountantClosureDifference() {
    const newMindTotalInput = document.getElementById('accountantClosureModalNewMindTotal');
    const differenceDisplay = document.getElementById('accountantClosureModalDifference');
    const statusDisplay = document.getElementById('accountantClosureModalStatus');
    const saveButton = document.getElementById('saveAccountantClosureBtn');

    if (!window.currentAccountantClosure) return;

    const cashierTotal = parseFloat(document.getElementById('accountantClosureModalGrandTotal').textContent);
    const newMindTotal = parseFloat(newMindTotalInput.value);

    if (isNaN(newMindTotal)) {
        differenceDisplay.textContent = '0.00';
        statusDisplay.textContent = 'في انتظار الإدخال';
        statusDisplay.className = 'status open';
        saveButton.disabled = true;
        return;
    }

    const difference = newMindTotal - cashierTotal;
    differenceDisplay.textContent = difference.toFixed(2);

    if (difference === 0) {
        statusDisplay.textContent = 'مطابق ✓';
        statusDisplay.className = 'status closed';
    } else if (difference > 0) {
        statusDisplay.textContent = 'عجز علي الكاشير (زيادة في نيو مايند)';
        statusDisplay.className = 'status inactive';
    } else {
        statusDisplay.textContent = 'زيادة عند الكاشير (عجز في نيو مايند)';
        statusDisplay.className = 'status active'; // Using 'active' for deficit, can be customized
    }
    saveButton.disabled = false;
}

async function saveAccountantClosure() {
    if (!window.currentAccountantClosure) {
        showMessage('لا توجد بيانات تقفيلة لحفظها.', 'error');
        return;
    }

    const newMindTotal = parseFloat(document.getElementById('accountantClosureModalNewMindTotal').value);
    if (isNaN(newMindTotal) || newMindTotal < 0) {
        showMessage('يرجى إدخال قيمة صحيحة لإجمالي نيو مايند.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const closure = window.currentAccountantClosure;
        const cashierTotal = parseFloat(document.getElementById('accountantClosureModalGrandTotal').textContent);
        const difference = newMindTotal - cashierTotal;
        const now = new Date();

        // Find the row index of the existing closure to update it
        const rowIndex = await findRowIndex(SHEETS.SHIFT_CLOSURES, 0, closure.id);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على التقفيلة لتحديثها.', 'error');
            return;
        }

        const updatedData = [
            closure.id,
            closure.cashier,
            closure.dateFrom,
            closure.timeFrom,
            closure.dateTo,
            closure.timeTo,
            closure.totalExpenses.toFixed(2),
            closure.expenseCount,
            closure.totalInsta.toFixed(2),
            closure.instaCount,
            closure.totalVisa.toFixed(2),
            closure.visaCount,
            closure.totalOnline.toFixed(2),
            closure.onlineCount,
            cashierTotal.toFixed(2), // grandTotal (now includes drawerCash)
            closure.drawerCash.toFixed(2), // drawerCash
            newMindTotal.toFixed(2), // newMindTotal
            difference.toFixed(2), // difference
            'مغلق بواسطة المحاسب', // status
            now.toISOString().split('T')[0], // closureDate
            now.toTimeString().split(' ')[0], // closureTime
            currentUser.username // accountant
        ];

        // Update the entire row
        const result = await updateSheet(SHEETS.SHIFT_CLOSURES, `A${rowIndex}:V${rowIndex}`, updatedData);

        if (result.success) {
            showMessage('تم تقفيل الشيفت بنجاح بواسطة المحاسب.', 'success');
            closeModal('accountantClosureDetailsModal');
            loadAccountantShiftClosuresHistory(); // Refresh the history table
        } else {
            showMessage('فشل تقفيل الشيفت بواسطة المحاسب.', 'error');
        }
    } catch (error) {
        console.error('Error saving accountant closure:', error);
        showMessage('حدث خطأ أثناء حفظ تقفيلة المحاسب.', 'error');
    } finally {
        showLoading(false);
    }
}

// --- View Closure Details (for the 'عرض' button) ---
async function viewClosureDetails(closureId) {
    showLoading(true);
    try {
        const allClosures = await loadShiftClosures({}); // Load all closures
        const closure = allClosures.find(c => c.id === closureId);
        if (!closure) {
            showMessage('لم يتم العثور على تفاصيل التقفيلة.', 'error');
            return;
        }

        const cashierUser = users.find(u => u.username === closure.cashier);
        const cashierDisplayName = cashierUser ? cashierUser.name : closure.cashier;
        const accountantUser = users.find(u => u.username === closure.accountant);
        const accountantDisplayName = accountantUser ? accountantUser.name : closure.accountant;

        let detailsHtml = `
            <h3>تفاصيل تقفيلة الشيفت</h3>
            <p><strong>الكاشير:</strong> ${cashierDisplayName}</p>
            <p><strong>الفترة:</strong> ${closure.dateFrom} ${closure.timeFrom} - ${closure.dateTo} ${closure.timeTo}</p>
            <p><strong>إجمالي المصروفات (عادي):</strong> ${closure.totalExpenses.toFixed(2)} (${closure.expenseCount} فاتورة)</p>
            <p><strong>إجمالي الإنستا:</strong> ${closure.totalInsta.toFixed(2)} (${closure.instaCount} فاتورة)</p>
            <p><strong>إجمالي الفيزا:</strong> ${closure.totalVisa.toFixed(2)} (${closure.visaCount} فاتورة)</p>
            <p><strong>إجمالي الأونلاين:</strong> ${closure.totalOnline.toFixed(2)} (${closure.onlineCount} فاتورة)</p>
            <p><strong>إجمالي الكاش في الدرج:</strong> ${closure.drawerCash.toFixed(2)}</p>
            <p><strong>الإجمالي الكلي للكاشير:</strong> ${(closure.totalExpenses + closure.totalInsta + closure.totalVisa + closure.totalOnline + closure.drawerCash).toFixed(2)}</p>
            <p><strong>إجمالي نيو مايند:</strong> ${closure.newMindTotal.toFixed(2)}</p>
            <p><strong>الفرق:</strong> ${closure.difference.toFixed(2)}</p>
            <p><strong>الحالة:</strong> ${closure.status}</p>
            <p><strong>تاريخ التقفيل:</strong> ${closure.closureDate} ${closure.closureTime}</p>
            ${closure.accountant ? `<p><strong>تم التقفيل بواسطة المحاسب:</strong> ${accountantDisplayName}</p>` : ''}
        `;

        // Display in a generic modal or a dedicated one
        const genericModal = document.getElementById('genericDetailsModal'); // Assuming you have a generic modal
        const genericModalContent = document.getElementById('genericDetailsModalContent');
        if (genericModal && genericModalContent) {
            genericModalContent.innerHTML = detailsHtml;
            genericModal.classList.add('active');
        } else {
            alert(detailsHtml.replace(/<[^>]*>?/gm, '\n').replace(/\n\n/g, '\n').trim()); // Fallback to alert
        }

    } catch (error) {
        console.error('Error viewing closure details:', error);
        showMessage('حدث خطأ أثناء عرض تفاصيل التقفيلة.', 'error');
    } finally {
        showLoading(false);
    }
}


// --- Utility Functions ---
function showLoading(show = true) {
    const loading = document.getElementById('loadingOverlay');
    if (loading) {
        loading.classList.toggle('hidden', !show);
    }
}

function showMessage(message, type = 'info') {
    let messageContainer = document.getElementById('messageContainer');
    if (!messageContainer) {
        messageContainer = document.createElement('div');
        messageContainer.id = 'messageContainer';
        messageContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000; max-width: 400px;';
        document.body.appendChild(messageContainer);
    }

    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;

    let icon = '';
    switch (type) {
        case 'success':
            icon = '<i class="fas fa-check-circle"></i>';
            break;
        case 'error':
            icon = '<i class="fas fa-exclamation-circle"></i>';
            break;
        case 'warning':
            icon = '<i class="fas fa-exclamation-triangle"></i>';
            break;
        case 'info':
            icon = '<i class="fas fa-info-circle"></i>';
            break;
        default:
            icon = '<i class="fas fa-info-circle"></i>';
    }

    messageElement.innerHTML = `${icon} ${message}`;
    messageContainer.appendChild(messageElement);

    const delay = type === 'error' ? 5000 : type === 'warning' ? 4000 : 3000;
    setTimeout(() => {
        if (messageElement && messageElement.parentNode) {
            messageElement.parentNode.removeChild(messageElement);
        }
    }, delay);

    messageElement.addEventListener('click', () => {
        if (messageElement && messageElement.parentNode) {
            messageElement.parentNode.removeChild(messageElement);
        }
    });
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal.active');
    modals.forEach(modal => {
        if (event.target === modal) {
            closeModal(modal.id);
        }
    });
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, starting Google scripts loading...');

    loadGoogleScripts().then(() => {
        console.log('Google Scripts loaded successfully and initialized.');
        // بعد التحميل والتهيئة، ابدأ عملية المصادقة وتحميل البيانات الأولية
        maybePerformAuthAndLoadData();
    }).catch(error => {
        console.error('Failed to load Google Scripts:', error);
        showMessage('فشل تحميل مكتبات Google. يرجى التحقق من الاتصال بالإنترنت.', 'error');

        const retryButton = document.createElement('button');
        retryButton.textContent = 'إعادة المحاولة';
        retryButton.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10000; padding: 10px 20px;';
        retryButton.onclick = () => location.reload();
        document.body.appendChild(retryButton);
    });

    setDefaultDatesAndTimes();

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            login();
        });
    }

    const addCategoryForm = document.getElementById('addCategoryForm');
    if (addCategoryForm) {
        addCategoryForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addCategory();
        });
    }

    const addExpenseForm = document.getElementById('addExpenseForm');
    if (addExpenseForm) {
        addExpenseForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addExpense();
        });
    }

    const addCustomerForm = document.getElementById('addCustomerForm');
    if (addCustomerForm) {
        addCustomerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addCustomer();
        });
    }

    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) {
        addUserForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addUser();
        });
    }

    const whatsappForm = document.getElementById('whatsappForm');
    if (whatsappForm) {
        whatsappForm.addEventListener('submit', function(e) {
            e.preventDefault();
            sendReportViaWhatsApp();
        });
    }
});
