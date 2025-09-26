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
const SPREADSHEET_ID = '16WsTQuebZDGErC8NwPRYf7qsHDVWhfDvUtvQ7u7IC9Q'; // تأكد من تحديث هذا الـ ID إذا كان مختلفًا
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

const SHEETS = {
    USERS: 'Users',
    CATEGORIES: 'Categories',
    EXPENSES: 'Expenses',
    CUSTOMERS: 'Customers',
    SHIFT_CLOSURES: 'ShiftClosures',
    CUSTOMER_CREDIT_HISTORY: 'CustomerCreditHistory',
    CATEGORY_CUSTOM_FIELDS: 'CategoryCustomFields', // ورقة جديدة للحقول المخصصة
    EMPLOYEES: 'Employees', // ورقة جديدة للموظفين
    EMPLOYEE_ADVANCE_HISTORY: 'EmployeeAdvanceHistory' // ورقة جديدة لسجل سلف الموظفين
};

let gapiInited = false;
let gisInited = false;
let tokenClient;

// --- Global Application State ---
let users = [];
let categories = [];
let customers = [];
let employees = []; // حالة جديدة للموظفين
let categoryCustomFields = []; // حالة جديدة للحقول المخصصة
let currentUser = null;
let currentUserName = '';
let currentUserRole = '';
let currentSelectedCustomerId = null; // لتتبع العميل المحدد في تفاصيل الأجل
let currentSelectedEmployeeId = null; // لتتبع الموظف المحدد في تفاصيل السلف
let currentEditUserId = null; // لتتبع المستخدم الذي يتم تعديله
let currentEditCategoryId = null; // لتتبع التصنيف الذي يتم تعديله
let currentEditExpenseId = null; // لتتبع المصروف الذي يتم تعديله
let currentEditEmployeeId = null; // لتتبع الموظف الذي يتم تعديله

// متغيرات جديدة لمنع التكرار
let initialDataLoaded = false;
let expenseSubmissionInProgress = false;
window.authInProgress = false;
window.authClickInProgress = false;
let googleScriptsLoadedAndInitialized = false; // متغير جديد لتتبع حالة التحميل والتهيئة الكاملة

// كلمة مرور التعديل (يجب استبدالها بآلية أكثر أمانًا في بيئة إنتاج)
const EDIT_PASSWORD = '2552'; 

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
        gapiScript.async = true; // Load asynchronously
        gapiScript.defer = true; // Defer execution
        gapiScript.onload = function() {
            console.log('GAPI loaded, initializing...');
            gapi.load('client', async () => {
                try {
                    await initializeGapiClient();
                    const gisScript = document.createElement('script');
                    gisScript.src = 'https://accounts.google.com/gsi/client';
                    gisScript.async = true; // Load asynchronously
                    gisScript.defer = true; // Defer execution
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
                handleAuthError(resp); // دالة جديدة لمعالجة أخطاء المصادقة
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

function handleAuthError(resp) {
    if (resp.error === 'popup_closed_by_user' || resp.error === 'access_denied') {
        showMessage('تم إلغاء المصادقة بواسطة المستخدم.', 'warning');
    } else {
        showMessage('فشل المصادقة مع Google. يرجى المحاولة مرة أخرى.', 'error');
    }
    handleAuthFailure(); // مسح حالة المصادقة
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
                values: values // values هنا يجب أن تكون مصفوفة من الصفوف، حتى لو كان صفًا واحدًا
            }
        });
        return { success: true, data: response.result };
    } catch (error) {
        console.error(`Error updating sheet ${sheetName}:`, error);
        return { success: false, message: error.message };
    }
}

async function deleteSheetRow(sheetName, rowIndex) {
    try {
        if (!isAuthenticated) {
            console.log(`Not authenticated for deleteSheetRow(${sheetName}). Attempting re-authentication.`);
            await handleAuthClick(true);
            if (!isAuthenticated) {
                throw new Error('Authentication failed before deleting sheet row.');
            }
        }

        const response = await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: await getSheetId(sheetName), // دالة مساعدة للحصول على sheetId
                            dimension: 'ROWS',
                            startIndex: rowIndex - 1, // Google Sheets API uses 0-based index
                            endIndex: rowIndex
                        }
                    }
                }]
            }
        });
        return { success: true, data: response.result };
    } catch (error) {
        console.error(`Error deleting row from sheet ${sheetName}:`, error);
        return { success: false, message: error.message };
    }
}

// دالة مساعدة للحصول على sheetId
async function getSheetId(sheetName) {
    const response = await gapi.client.sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
    });
    const sheet = response.result.sheets.find(s => s.properties.title === sheetName);
    if (!sheet) {
        throw new Error(`Sheet with name ${sheetName} not found.`);
    }
    return sheet.properties.sheetId;
}


async function findRowIndex(sheetName, columnIndex, searchValue) {
    const data = await readSheet(sheetName);
    // نبدأ من الصف الثاني (index 1) لتجاهل الرأس
    for (let i = 1; i < data.length; i++) {
        if (data[i][columnIndex] === searchValue) {
            return i + 1; // +1 لأن Google Sheets API تستخدم 1-based index للصفوف
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
                id: row[0] || '', // العمود A - يجب أن يكون فريداً
                code: row[1] || '',        // العمود B
                name: row[2] || '',        // العمود C
                formType: row[3] || 'عادي', // العمود D
                creationDate: row[4] || '',
                createdBy: row[5] || ''
            }));
            
            // إذا كانت الـ IDs أرقاماً فقط، نقوم بتحويلها إلى تنسيق فريد
            categories.forEach(cat => {
                if (cat.id && !isNaN(cat.id) && cat.id.length < 10) {
                    cat.id = 'CAT_' + cat.id;
                }
            });
        } else {
            categories = [];
        }
        
        console.log('Categories loaded:', categories);
    } catch (error) {
        console.error('Error loading categories:', error);
        categories = [];
    }
}

async function loadCategoryCustomFields() {
    try {
        const data = await readSheet(SHEETS.CATEGORY_CUSTOM_FIELDS);
        if (data.length > 1) {
            categoryCustomFields = data.slice(1).map(row => ({
                categoryId: row[0] || '',
                fieldName: row[1] || '',
                fieldType: row[2] || 'text',
                isRequired: (row[3] || 'false').toLowerCase() === 'true',
                options: row[4] ? JSON.parse(row[4]) : [] // إذا كان FieldType هو 'select'
            }));
        } else {
            categoryCustomFields = [];
        }
    } catch (error) {
        console.error('Error loading category custom fields:', error);
        categoryCustomFields = [];
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

async function loadEmployees() {
    try {
        const data = await readSheet(SHEETS.EMPLOYEES);
        if (data.length > 1) {
            employees = data.slice(1).map(row => ({
                id: row[0] || '',
                name: row[1] || '',
                phone: row[2] || '',
                totalAdvance: parseFloat((row[3] || '0').replace(/,/g, '')),
                creationDate: row[4] || '',
                lastUpdate: row[5] || ''
            }));
        } else {
            employees = [];
        }
    } catch (error) {
        console.error('Error loading employees:', error);
        employees = [];
    }
}

async function loadEmployeeAdvanceHistory(employeeId) {
    try {
        const data = await readSheet(SHEETS.EMPLOYEE_ADVANCE_HISTORY);
        if (data.length <= 1) return [];

        return data.slice(1).filter(row => row[1] === employeeId).map(row => ({
            id: row[0] || '',
            employeeId: row[1] || '',
            date: row[2] || '',
            type: row[3] || '',
            amount: parseFloat((row[4] || '0').replace(/,/g, '')),
            notes: row[5] || '',
            recordedBy: row[6] || ''
        }));
    } catch (error) {
        console.error('Error loading employee advance history:', error);
        return [];
    }
}

async function loadExpenses(filters = {}) {
    try {
        const data = await readSheet(SHEETS.EXPENSES);
        if (data.length <= 1) return [];

        let expenses = data.slice(1).map(row => {
            const expense = {
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
                customer: row[17] || '',
                employee: row[18] || '' // حقل جديد للموظف
            };
            // إضافة الحقول المخصصة ديناميكيًا
            const customFieldsStartIndex = 19; // بدء الحقول المخصصة بعد حقل الموظف
            const categoryObj = categories.find(cat => cat.name === expense.category || cat.code === expense.categoryCode);
            if (categoryObj) {
                const customFieldsForCategory = categoryCustomFields.filter(cf => cf.categoryId === categoryObj.id);
                expense.customFields = {};
                customFieldsForCategory.forEach((cf, index) => {
                    expense.customFields[cf.fieldName] = row[customFieldsStartIndex + index] || '';
                });
            }
            return expense;
        });

        // Apply filters
        if (filters.cashier) {
            expenses = expenses.filter(exp => exp.cashier === filters.cashier);
        }
        if (filters.dateFrom) {
            const filterDateFrom = new Date(filters.dateFrom);
            expenses = expenses.filter(exp => new Date(exp.date) >= filterDateFrom);
        }
        if (filters.dateTo) {
            const filterDateTo = new Date(filters.dateTo);
            filterDateTo.setHours(23, 59, 59, 999); // Include the whole end day
            expenses = expenses.filter(exp => new Date(exp.date) <= filterDateTo);
        }
        if (filters.timeFrom && filters.timeTo) {
            expenses = expenses.filter(exp => {
                // تحويل الوقت إلى تنسيق موحد للمقارنة
                const expDateTime = new Date(`${exp.date}T${exp.time}`);
                const filterStartDateTime = new Date(`${exp.date}T${filters.timeFrom}`);
                const filterEndDateTime = new Date(`${exp.date}T${filters.timeTo}`);
                return expDateTime >= filterStartDateTime && expDateTime <= filterEndDateTime;
            });
        }
        if (filters.category) {
            expenses = expenses.filter(exp => exp.category === filters.category);
        }
        if (filters.formType) { // فلتر جديد حسب نوع الفورم
            expenses = expenses.filter(exp => {
                const category = categories.find(cat => cat.name === exp.category || cat.code === exp.categoryCode);
                return category && category.formType === filters.formType;
            });
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
            grandTotal: parseFloat((row[14] || '0').replace(/,/g, '')), // هذا هو الإجمالي الذي سجله الكاشير (يشمل الكاش في الدرج ويستثني المرتجعات)
            drawerCash: parseFloat((row[15] || '0').replace(/,/g, '')),
            newMindTotal: parseFloat((row[16] || '0').replace(/,/g, '')),
            difference: parseFloat((row[17] || '0').replace(/,/g, '')),
            status: row[18] || '',
            closureDate: row[19] || '',
            closureTime: row[20] || '',
            accountant: row[21] || '',
            totalReturns: parseFloat((row[22] || '0').replace(/,/g, '')), // إضافة حقل إجمالي المرتجعات
            grandTotalAfterReturns: parseFloat((row[23] || '0').replace(/,/g, '')) // إضافة حقل الإجمالي بعد خصم المرتجعات (هذا هو الإجمالي الذي قارنه المحاسب مع نيو مايند)
        }));

        // Apply filters
        if (filters.cashier) {
            closures = closures.filter(closure => closure.cashier === filters.cashier);
        }
        if (filters.dateFrom && filters.dateTo) {
            const filterStartDateTime = new Date(`${filters.dateFrom}T${filters.timeFrom || '00:00'}:00`);
            const filterEndDateTime = new Date(`${filters.dateTo}T${filters.timeTo || '23:59'}:59.999`);
            closures = closures.filter(closure => {
                const closureStart = new Date(`${closure.dateFrom}T${closure.timeFrom}:00`);
                const closureEnd = new Date(`${closure.dateTo}T${closure.timeTo}:00`);
                return closureStart >= filterStartDateTime && closureEnd <= filterEndDateTime;
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
            loadCategoryCustomFields(), // تحميل الحقول المخصصة
            loadCustomers(),
            loadEmployees() // تحميل الموظفين
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
    // لا داعي لـ resetCashierDailyData هنا، لأنها ستُعاد تهيئتها عند تسجيل الدخول ككاشير
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
async function showTab(tabId) {
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
    showLoading(true); // عرض شاشة التحميل قبل تحديث المحتوى
    try {
        if (tabId === 'categoriesTabCashier' || tabId === 'categoriesTabAccountant') {
            await loadCategories(); // إعادة تحميل التصنيفات لضمان التحديث
            await loadCategoryCustomFields(); // تحميل الحقول المخصصة
            displayCategories(tabId === 'categoriesTabCashier' ? 'categoriesGridCashier' : 'categoriesGridAccountant');
        } else if (tabId === 'expensesTabCashier') {
            await loadCategories(); // لضمان تحديث قائمة التصنيفات في الفلتر
            await loadCategoryCustomFields(); // تحميل الحقول المخصصة
            await loadCustomers(); // لضمان تحديث قائمة العملاء في الفورم
            await loadEmployees(); // لضمان تحديث قائمة الموظفين في الفورم
            await loadCashierExpenses();
            populateExpenseCategoryFilter();
        } else if (tabId === 'customersTabCashier') {
            await loadCustomers(); // إعادة تحميل العملاء لضمان التحديث
            displayCustomers('customersTableBodyCashier');
        } else if (tabId === 'employeesTabCashier') { // تبويب الموظفين الجديد للكاشير
            await loadEmployees(); // تحميل بيانات الموظفين
            displayEmployees('employeesTableBodyCashier'); // عرض الموظفين في جدول الكاشير
        } else if (tabId === 'customersTabAccountant') {
            await loadCustomers(); // إعادة تحميل العملاء لضمان التحديث
            displayCustomers('customersTableBodyAccountant');
            const customerDetailsAccountant = document.getElementById('customerDetailsAccountant');
            if (customerDetailsAccountant) {
                customerDetailsAccountant.style.display = 'none';
            }
        } else if (tabId === 'employeesTabAccountant') { // علامة تبويب الموظفين الجديدة
            await loadEmployees();
            displayEmployees('employeesTableBodyAccountant');
            const employeeDetailsAccountant = document.getElementById('employeeDetailsAccountant');
            if (employeeDetailsAccountant) {
                employeeDetailsAccountant.style.display = 'none';
            }
        } else if (tabId === 'dashboardTabAccountant') {
            await loadUsers(); // لضمان تحديث قائمة الكاشيرز في الفلتر
            await loadCategories(); // لضمان تحديث أنواع المصروفات
            await loadCustomers(); // لضمان تحديث إحصائيات العملاء
            await loadEmployees(); // لضمان تحديث إحصائيات الموظفين
            populateAccountantFilters();
            await updateAccountantDashboard();
        } else if (tabId === 'usersTabAccountant') {
            await loadUsers(); // إعادة تحميل المستخدمين لضمان التحديث
            displayUsers();
        } else if (tabId === 'reportsTabAccountant') {
            await loadUsers(); // لضمان تحديث قائمة الكاشيرز في الفلتر
            await loadCategories(); // لضمان تحديث قائمة التصنيفات في الفلتر
            populateReportFilters();
            // لا نولد التقرير تلقائيًا، ننتظر المستخدم ليضغط "إنشاء التقرير"
            document.getElementById('reportContentAccountant').innerHTML = '<p>يرجى تحديد معايير التقرير والضغط على "إنشاء التقرير".</p>';
        } else if (tabId === 'shiftCloseTabAccountant') {
            await loadUsers(); // لضمان تحديث قائمة الكاشيرز في الفلتر
            await loadCategories(); // لضمان تحديث أنواع المصروفات
            populateAccountantShiftCashierFilter();
            await loadAccountantShiftClosuresHistory();
            resetAccountantShiftForm();
        } else if (tabId === 'shiftCloseTabCashier') {
            await loadCategories(); // لضمان تحديث أنواع المصروفات
            await loadCashierPreviousClosures();
            setDefaultDatesAndTimes();
        }
    } catch (error) {
        console.error('Error showing tab:', error);
        showMessage('حدث خطأ أثناء تحميل محتوى علامة التبويب.', 'error');
    } finally {
        showLoading(false); // إخفاء شاشة التحميل بعد تحديث المحتوى
    }
}

// --- Cashier Page Functions ---
async function showCashierPage() {
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('accountantPage').classList.remove('active');
    document.getElementById('cashierPage').classList.add('active');
    const cashierNameDisplay = document.getElementById('cashierNameDisplay');
    if (cashierNameDisplay) cashierNameDisplay.textContent = currentUserName;
    const currentDateCashier = document.getElementById('currentDateCashier');
    if (currentDateCashier) currentDateCashier.textContent = new Date().toLocaleDateString('ar-EG');

    // لا داعي لإعادة تحميل البيانات هنا، showTab ستفعل ذلك
    // await loadCategories();
    // await loadCustomers();
    // resetCashierDailyData(); // هذه الدالة لم تعد ضرورية هنا، لأننا نعتمد على loadCashierExpenses
    showTab('categoriesTabCashier'); // ستقوم showTab بتحميل البيانات اللازمة
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
                <button class="edit-btn" onclick="showEditCategoryModal('${cat.id}')"><i class="fas fa-edit"></i> تعديل</button>
                <button class="delete-btn" onclick="deleteCategory('${cat.id}', '${cat.name}')"><i class="fas fa-trash"></i> حذف</button>
            </div>
        `;
        categoriesGrid.appendChild(categoryCard);
    });
}

function showAddCategoryModal() {
    const form = document.getElementById('addCategoryForm');
    if (form) {
        form.reset();
        document.getElementById('addCategoryModalTitle').textContent = 'إضافة تصنيف جديد';
        document.getElementById('addCategoryModalSaveBtn').onclick = addCategory;
        currentEditCategoryId = null; // مسح أي ID لتصنيف سابق
        document.getElementById('customFieldsContainer').innerHTML = ''; // مسح الحقول المخصصة القديمة
    }
    const modal = document.getElementById('addCategoryModal');
    if (modal) {
        modal.classList.add('active');
    }
}

async function showEditCategoryModal(categoryId) {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) {
        showMessage('التصنيف غير موجود.', 'error');
        return;
    }

    document.getElementById('categoryCode').value = category.code;
    document.getElementById('categoryName').value = category.name;
    document.getElementById('formType').value = category.formType;

    // تحميل وعرض الحقول المخصصة لهذا التصنيف
    const customFieldsContainer = document.getElementById('customFieldsContainer');
    customFieldsContainer.innerHTML = '';
    const customFieldsForCategory = categoryCustomFields.filter(cf => cf.categoryId === categoryId);
    customFieldsForCategory.forEach(cf => {
        addCustomFieldToEditor(cf.fieldName, cf.fieldType, cf.isRequired, cf.options);
    });

    document.getElementById('addCategoryModalTitle').textContent = 'تعديل تصنيف';
    document.getElementById('addCategoryModalSaveBtn').onclick = updateCategory;
    currentEditCategoryId = categoryId;

    const modal = document.getElementById('addCategoryModal');
    if (modal) {
        modal.classList.add('active');
    }
}

// دالة لإضافة حقل مخصص إلى محرر التصنيف
function addCustomFieldToEditor(fieldName = '', fieldType = 'text', isRequired = false, options = []) {
    const container = document.getElementById('customFieldsContainer');
    const fieldId = `customFieldEditor_${Date.now()}`; // Unique ID for editor elements

    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'custom-field-editor-item';
    fieldDiv.id = fieldId;
    fieldDiv.innerHTML = `
        <div class="form-group">
            <label for="${fieldId}_name">اسم الحقل:</label>
            <input type="text" id="${fieldId}_name" value="${fieldName}" placeholder="مثال: رقم الطلب" required>
        </div>
        <div class="form-group">
            <label for="${fieldId}_type">نوع الحقل:</label>
            <select id="${fieldId}_type" onchange="toggleOptionsInput('${fieldId}')">
                <option value="text" ${fieldType === 'text' ? 'selected' : ''}>نص</option>
                <option value="number" ${fieldType === 'number' ? 'selected' : ''}>رقم</option>
                <option value="date" ${fieldType === 'date' ? 'selected' : ''}>تاريخ</option>
                <option value="select" ${fieldType === 'select' ? 'selected' : ''}>قائمة منسدلة</option>
            </select>
        </div>
        <div class="form-group">
            <input type="checkbox" id="${fieldId}_required" ${isRequired ? 'checked' : ''}>
            <label for="${fieldId}_required">مطلوب</label>
        </div>
        <div class="form-group options-group" id="${fieldId}_options_group" style="display: ${fieldType === 'select' ? 'block' : 'none'};">
            <label for="${fieldId}_options">خيارات (افصل بينها بفاصلة):</label>
            <input type="text" id="${fieldId}_options" value="${options.join(',')}" placeholder="مثال: خيار1,خيار2">
        </div>
        <button type="button" class="delete-btn" onclick="document.getElementById('${fieldId}').remove()">
            <i class="fas fa-trash"></i> حذف
        </button>
    `;
    container.appendChild(fieldDiv);
}

// دالة لتبديل عرض حقل الخيارات بناءً على نوع الحقل
function toggleOptionsInput(fieldId) {
    const fieldTypeSelect = document.getElementById(`${fieldId}_type`);
    const optionsGroup = document.getElementById(`${fieldId}_options_group`);
    if (fieldTypeSelect && optionsGroup) {
        if (fieldTypeSelect.value === 'select') {
            optionsGroup.style.display = 'block';
        } else {
            optionsGroup.style.display = 'none';
        }
    }
}

async function addCategory() {
    const categoryId = 'CAT_' + new Date().getTime();
    const code = document.getElementById('categoryCode')?.value.trim();
    const name = document.getElementById('categoryName')?.value.trim();
    const formType = document.getElementById('formType')?.value;

    if (!code || !name || !formType) {
        showMessage('يرجى ملء جميع حقول التصنيف الأساسية.', 'warning');
        return;
    }

    // البحث عن التصنيف باستخدام الكود في العمود B (index 1)
    const existingCategory = categories.find(cat => cat.code === code);
    if (existingCategory) {
        showMessage('كود التصنيف موجود بالفعل. يرجى استخدام كود آخر.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const newCategoryData = [
            categoryId, // ID جديد
            code,
            name,
            formType,
            new Date().toISOString().split('T')[0],
            currentUserName
        ];

        const result = await appendToSheet(SHEETS.CATEGORIES, newCategoryData);

        if (result.success) {
            // حفظ الحقول المخصصة
            const customFieldsToSave = [];
            const customFieldItems = document.querySelectorAll('.custom-field-editor-item');
            for (const item of customFieldItems) {
                const fieldNameInput = item.querySelector('input[type="text"]');
                const fieldTypeSelect = item.querySelector('select');
                const isRequiredCheckbox = item.querySelector('input[type="checkbox"]');
                const optionsInput = item.querySelector('.options-group input[type="text"]');

                if (!fieldNameInput || !fieldTypeSelect || !isRequiredCheckbox) {
                    console.warn('Missing elements in custom field editor item:', item);
                    continue;
                }

                const fieldName = fieldNameInput.value.trim();
                const fieldType = fieldTypeSelect.value;
                const isRequired = isRequiredCheckbox.checked;
                const options = fieldType === 'select' && optionsInput ? optionsInput.value.split(',').map(opt => opt.trim()).filter(opt => opt) : [];

                if (fieldName) {
                    customFieldsToSave.push([
                        categoryId,
                        fieldName,
                        fieldType,
                        isRequired.toString(),
                        JSON.stringify(options)
                    ]);
                }
            }

            if (customFieldsToSave.length > 0) {
                // يجب أن تكون appendToSheet قادرة على التعامل مع مصفوفة من الصفوف
                // أو يجب أن نكرر استدعاءها لكل صف
                for (const cfData of customFieldsToSave) {
                    await appendToSheet(SHEETS.CATEGORY_CUSTOM_FIELDS, cfData);
                }
            }

            showMessage('تم إضافة التصنيف بنجاح.', 'success');
            closeModal('addCategoryModal');
            await loadCategories();
            await loadCategoryCustomFields();
            displayCategories('categoriesGridCashier');
            displayCategories('categoriesGridAccountant');
            populateExpenseCategoryFilter();
            populateAccountantFilters();
        } else {
            showMessage('فشل إضافة التصنيف.', 'error');
        }
    } catch (error) {
        console.error('Error adding category:', error);
        showMessage('حدث خطأ أثناء إضافة التصنيف.', 'error');
    } finally {
        showLoading(false);
    }
}

async function updateCategory() {
    if (!currentEditCategoryId) {
        showMessage('لا يوجد تصنيف محدد للتعديل.', 'error');
        return;
    }

    const code = document.getElementById('categoryCode')?.value.trim();
    const name = document.getElementById('categoryName')?.value.trim();
    const formType = document.getElementById('formType')?.value;

    if (!code || !name || !formType) {
        showMessage('يرجى ملء جميع حقول التصنيف الأساسية.', 'warning');
        return;
    }

    // البحث عن التصنيف باستخدام الكود في العمود B (index 1)
    const existingCategory = categories.find(cat => cat.code === code && cat.id !== currentEditCategoryId);
    if (existingCategory) {
        showMessage('كود التصنيف موجود بالفعل لتصنيف آخر. يرجى استخدام كود فريد.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const rowIndex = await findRowIndex(SHEETS.CATEGORIES, 0, currentEditCategoryId); // البحث بالـ ID في العمود A (index 0)
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على التصنيف لتحديثه.', 'error');
            return;
        }

        const oldCategory = categories.find(cat => cat.id === currentEditCategoryId);
        const updatedCategoryData = [
            currentEditCategoryId,
            code,
            name,
            formType,
            oldCategory.creationDate, // الحفاظ على تاريخ الإنشاء الأصلي
            oldCategory.createdBy // الحفاظ على من أنشأه
        ];

        const result = await updateSheet(SHEETS.CATEGORIES, `A${rowIndex}:F${rowIndex}`, [updatedCategoryData]);

        if (result.success) {
            // تحديث الحقول المخصصة: حذف القديم وإضافة الجديد
            // أولاً، نحذف جميع الحقول المخصصة المرتبطة بهذا التصنيف
            const allCustomFieldsData = await readSheet(SHEETS.CATEGORY_CUSTOM_FIELDS);
            const rowsToDelete = allCustomFieldsData.map((row, idx) => ({ row, idx }))
                                                    .filter(item => item.row[0] === currentEditCategoryId);
            // حذف الصفوف من الأسفل للأعلى لتجنب مشاكل الفهرسة
            for (let i = rowsToDelete.length - 1; i >= 0; i--) {
                await deleteSheetRow(SHEETS.CATEGORY_CUSTOM_FIELDS, rowsToDelete[i].idx + 1);
            }

            // ثم نضيف الحقول المخصصة الجديدة
            const customFieldsToSave = [];
            const customFieldItems = document.querySelectorAll('.custom-field-editor-item');
            for (const item of customFieldItems) {
                const fieldNameInput = item.querySelector('input[type="text"]');
                const fieldTypeSelect = item.querySelector('select');
                const isRequiredCheckbox = item.querySelector('input[type="checkbox"]');
                const optionsInput = item.querySelector('.options-group input[type="text"]');

                if (!fieldNameInput || !fieldTypeSelect || !isRequiredCheckbox) {
                    console.warn('Missing elements in custom field editor item during update:', item);
                    continue;
                }

                const fieldName = fieldNameInput.value.trim();
                const fieldType = fieldTypeSelect.value;
                const isRequired = isRequiredCheckbox.checked;
                const options = fieldType === 'select' && optionsInput ? optionsInput.value.split(',').map(opt => opt.trim()).filter(opt => opt) : [];

                if (fieldName) {
                    customFieldsToSave.push([
                        currentEditCategoryId,
                        fieldName,
                        fieldType,
                        isRequired.toString(),
                        JSON.stringify(options)
                    ]);
                }
            }

            if (customFieldsToSave.length > 0) {
                for (const cfData of customFieldsToSave) {
                    await appendToSheet(SHEETS.CATEGORY_CUSTOM_FIELDS, cfData);
                }
            }

            showMessage('تم تعديل التصنيف بنجاح.', 'success');
            closeModal('addCategoryModal');
            await loadCategories();
            await loadCategoryCustomFields();
            displayCategories('categoriesGridCashier');
            displayCategories('categoriesGridAccountant');
            populateExpenseCategoryFilter();
            populateAccountantFilters();
        } else {
            showMessage('فشل تعديل التصنيف.', 'error');
        }
    } catch (error) {
        console.error('Error updating category:', error);
        showMessage('حدث خطأ أثناء تعديل التصنيف.', 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteCategory(categoryId, categoryName) {
    if (!confirm(`هل أنت متأكد من حذف التصنيف "${categoryName}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) {
        return;
    }

    showLoading(true);
    try {
        const rowIndex = await findRowIndex(SHEETS.CATEGORIES, 0, categoryId); // البحث بالـ ID في العمود A (index 0)
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على التصنيف لحذفه.', 'error');
            return;
        }

        const result = await deleteSheetRow(SHEETS.CATEGORIES, rowIndex);

        if (result.success) {
            // حذف الحقول المخصصة المرتبطة بهذا التصنيف
            const allCustomFieldsData = await readSheet(SHEETS.CATEGORY_CUSTOM_FIELDS);
            const rowsToDelete = allCustomFieldsData.map((row, idx) => ({ row, idx }))
                                                    .filter(item => item.row[0] === categoryId);
            for (let i = rowsToDelete.length - 1; i >= 0; i--) {
                await deleteSheetRow(SHEETS.CATEGORY_CUSTOM_FIELDS, rowsToDelete[i].idx + 1);
            }

            showMessage('تم حذف التصنيف بنجاح.', 'success');
            await loadCategories();
            await loadCategoryCustomFields();
            displayCategories('categoriesGridCashier');
            displayCategories('categoriesGridAccountant');
            populateExpenseCategoryFilter();
            populateAccountantFilters();
        } else {
            showMessage('فشل حذف التصنيف.', 'error');
        }
    } catch (error) {
        console.error('Error deleting category:', error);
        showMessage('حدث خطأ أثناء حذف التصنيف.', 'error');
    } finally {
        showLoading(false);
    }
}

// --- Expenses Management ---
function showAddExpenseModal() {
    const form = document.getElementById('addExpenseForm');
    if (form) form.reset();

    const expenseCategorySearch = document.getElementById('expenseCategorySearch');
    if (expenseCategorySearch) expenseCategorySearch.value = '';
    const expenseCategorySuggestions = document.getElementById('expenseCategorySuggestions');
    if (expenseCategorySuggestions) expenseCategorySuggestions.innerHTML = '';
    const selectedExpenseCategoryCode = document.getElementById('selectedExpenseCategoryCode');
    if (selectedExpenseCategoryCode) selectedExpenseCategoryCode.value = '';
    const selectedExpenseCategoryName = document.getElementById('selectedExpenseCategoryName');
    if (selectedExpenseCategoryName) selectedExpenseCategoryName.value = '';
    const selectedExpenseCategoryFormType = document.getElementById('selectedExpenseCategoryFormType');
    if (selectedExpenseCategoryFormType) selectedExpenseCategoryFormType.value = '';
    const selectedExpenseCategoryId = document.getElementById('selectedExpenseCategoryId');
    if (selectedExpenseCategoryId) selectedExpenseCategoryId.value = '';

    const dynamicExpenseForm = document.getElementById('dynamicExpenseForm');
    if (dynamicExpenseForm) dynamicExpenseForm.innerHTML = '';

    document.getElementById('addExpenseModalTitle').textContent = 'إضافة مصروف جديد';
    document.getElementById('addExpenseModalSaveBtn').onclick = addExpense;
    currentEditExpenseId = null;

    // إضافة زر تثبيت الفورم
    const modalActions = document.querySelector('#addExpenseModal .modal-actions');
    let pinButton = document.getElementById('pinExpenseFormBtn');
    if (!pinButton) {
        pinButton = document.createElement('button');
        pinButton.type = 'button';
        pinButton.id = 'pinExpenseFormBtn';
        pinButton.className = 'pin-btn';
        pinButton.innerHTML = '<i class="fas fa-thumbtack"></i> تثبيت الفورم';
        pinButton.onclick = togglePinExpenseForm;
        modalActions.prepend(pinButton);
    }
    pinButton.classList.remove('active');
    pinButton.dataset.pinned = 'false';

    const modal = document.getElementById('addExpenseModal');
    if (modal) modal.classList.add('active');

    // تحميل بيانات الموظفين عند فتح النموذج
    loadEmployees().then(() => {
        console.log('تم تحميل بيانات الموظفين للبحث');
    });
}

async function showEditExpenseModal(expenseId) {
    showLoading(true);
    try {
        const allExpenses = await loadExpenses({}); // حمل كل المصروفات للبحث
        const expense = allExpenses.find(exp => exp.id === expenseId);
        if (!expense) {
            showMessage('المصروف غير موجود.', 'error');
            return;
        }

        const category = categories.find(cat => cat.name === expense.category || cat.code === expense.categoryCode);
        if (!category) {
            showMessage('تصنيف المصروف غير موجود.', 'error');
            return;
        }

        // ملء حقول التصنيف
        document.getElementById('expenseCategorySearch').value = `${category.name} (${category.code})`;
        document.getElementById('selectedExpenseCategoryCode').value = category.code;
        document.getElementById('selectedExpenseCategoryName').value = category.name;
        document.getElementById('selectedExpenseCategoryFormType').value = category.formType;
        document.getElementById('selectedExpenseCategoryId').value = category.id; // حفظ ID التصنيف

        // توليد الفورم الديناميكي وملء البيانات
        await generateDynamicExpenseForm(category.formType, category.id, expense); // تمرير بيانات المصروف لملء الحقول المخصصة

        document.getElementById('expenseInvoiceNumber').value = expense.invoiceNumber || '';
        document.getElementById('expenseAmount').value = expense.amount;
        document.getElementById('expenseNotes').value = expense.notes || '';

        // ملء الحقول الخاصة بنوع الفورم
        if (category.formType === 'فيزا') {
            document.getElementById('visaReferenceNumber').value = expense.referenceNumber || '';
        } else if (category.formType === 'شحن_تاب') {
            document.getElementById('tabName').value = expense.tabName || '';
            document.getElementById('tabPhone').value = expense.tabPhone || '';
        } else if (category.formType === 'شحن_كهربا') {
            document.getElementById('electricityLocation').value = expense.location || '';
        } else if (['بنزين', 'سلف', 'عجوزات'].includes(category.formType)) {
            document.getElementById('personName').value = expense.personName || '';
        } else if (category.formType === 'دفعة_شركة') {
            document.getElementById('companyName').value = expense.companyName || '';
            document.getElementById('companyCode').value = expense.companyCode || '';
        } else if (category.formType === 'اجل') {
            const customer = customers.find(cust => cust.id === expense.customer);
            if (customer) {
                document.getElementById('customerSearch').value = `${customer.name} (${customer.phone})`;
                document.getElementById('selectedCustomerId').value = customer.id;
                document.getElementById('selectedCustomerName').value = customer.name;
            }
        } else if (category.formType === 'سلف_موظف') { // نوع جديد لسلف الموظفين
            const employee = employees.find(emp => emp.id === expense.employee);
            if (employee) {
                document.getElementById('employeeSearch').value = `${employee.name} (${employee.phone})`;
                document.getElementById('selectedEmployeeId').value = employee.id;
                document.getElementById('selectedEmployeeName').value = employee.name;
            }
        }

        document.getElementById('addExpenseModalTitle').textContent = 'تعديل مصروف';
        document.getElementById('addExpenseModalSaveBtn').onclick = updateExpense;
        currentEditExpenseId = expenseId;

        // إخفاء زر التثبيت في وضع التعديل
        const pinButton = document.getElementById('pinExpenseFormBtn');
        if (pinButton) pinButton.style.display = 'none';

        const modal = document.getElementById('addExpenseModal');
        if (modal) modal.classList.add('active');

    } catch (error) {
        console.error('Error showing edit expense modal:', error);
        showMessage('حدث خطأ أثناء عرض نموذج تعديل المصروف.', 'error');
    } finally {
        showLoading(false);
    }
}


function searchExpenseCategories(searchTerm) {
    const suggestionsDiv = document.getElementById('expenseCategorySuggestions');
    if (!suggestionsDiv) return;

    suggestionsDiv.innerHTML = '';

    if (searchTerm.length < 1) { // تغيير من 2 إلى 1 للبحث من الحرف الأول
        suggestionsDiv.style.display = 'none';
        return;
    }

    const filtered = categories.filter(cat =>
        cat.name && cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cat.code && cat.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filtered.length === 0) {
        suggestionsDiv.innerHTML = '<div class="suggestion-item">لا توجد نتائج</div>';
        suggestionsDiv.style.display = 'block';
        return;
    }

    filtered.forEach(cat => {
        // تحقق من أن التصنيف يحتوي على جميع البيانات المطلوبة
        if (!cat.id || !cat.code || !cat.name || !cat.formType) {
            console.warn('تصنيف ناقص البيانات:', cat);
            return;
        }
        
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.textContent = `${cat.name} (${cat.code}) - ${cat.formType}`;
        item.onclick = () => selectExpenseCategory(cat);
        suggestionsDiv.appendChild(item);
    });

    suggestionsDiv.style.display = 'block';
}

function selectExpenseCategory(category) {
    console.log('Selecting category:', category);
    
    const expenseCategorySearch = document.getElementById('expenseCategorySearch');
    if (expenseCategorySearch) expenseCategorySearch.value = `${category.name} (${category.code})`;
    
    const selectedExpenseCategoryCode = document.getElementById('selectedExpenseCategoryCode');
    if (selectedExpenseCategoryCode) selectedExpenseCategoryCode.value = category.code;
    
    const selectedExpenseCategoryName = document.getElementById('selectedExpenseCategoryName');
    if (selectedExpenseCategoryName) selectedExpenseCategoryName.value = category.name;
    
    const selectedExpenseCategoryFormType = document.getElementById('selectedExpenseCategoryFormType');
    if (selectedExpenseCategoryFormType) selectedExpenseCategoryFormType.value = category.formType;
    
    const selectedExpenseCategoryId = document.getElementById('selectedExpenseCategoryId');
    if (selectedExpenseCategoryId) {
        // تأكد من أن الـ ID فريد ومُعدّل إذا لزم الأمر
        let categoryId = category.id;
        if (categoryId && !isNaN(categoryId) && categoryId.length < 10) {
            categoryId = 'CAT_' + categoryId;
        }
        selectedExpenseCategoryId.value = categoryId;
        console.log('تم تعيين ID التصنيف:', selectedExpenseCategoryId.value);
    } else {
        console.error('عنصر selectedExpenseCategoryId غير موجود في DOM');
    }
    
    const expenseCategorySuggestions = document.getElementById('expenseCategorySuggestions');
    if (expenseCategorySuggestions) expenseCategorySuggestions.style.display = 'none';

    console.log('تم اختيار التصنيف بنجاح:', {
        id: selectedExpenseCategoryId?.value,
        code: category.code,
        name: category.name,
        formType: category.formType
    });

    generateDynamicExpenseForm(category.formType, selectedExpenseCategoryId?.value);
}


async function generateDynamicExpenseForm(formType, categoryId, expenseData = {}) {
    const dynamicFormDiv = document.getElementById('dynamicExpenseForm');
    if (!dynamicFormDiv) return;

    let formHtml = ``;

    // إضافة حقل رقم الفاتورة لجميع الأنواع التي تتطلبها، بما في ذلك "أجل"
    if (['عادي', 'فيزا', 'اونلاين', 'مرتجع', 'خصم عميل', 'إنستا', 'اجل', 'شحن_تاب', 'شحن_كهربا', 'بنزين', 'سلف', 'دفعة_شركة', 'عجوزات', 'سلف_موظف'].includes(formType)) {
        formHtml += `
            <div class="form-group">
                <label for="expenseInvoiceNumber">رقم الفاتورة: <span style="color: red;">*</span></label>
                <input type="text" id="expenseInvoiceNumber" required placeholder="أدخل رقم الفاتورة" value="${expenseData.invoiceNumber || ''}">
            </div>
        `;
    }

    formHtml += `
        <div class="form-group">
            <label for="expenseAmount">القيمة: <span style="color: red;">*</span></label>
            <input type="number" id="expenseAmount" step="0.01" required placeholder="أدخل القيمة" value="${expenseData.amount || ''}">
        </div>
        <div class="form-group">
            <label for="expenseNotes">الملاحظات (اختياري):</label>
            <input type="text" id="expenseNotes" placeholder="أدخل ملاحظات" value="${expenseData.notes || ''}">
        </div>
    `;

    if (formType === 'فيزا') {
        formHtml += `
            <div class="form-group">
                <label for="visaReferenceNumber">الرقم المرجعي للفيزا : <span style="color: red;">*</span></label>
                <input type="text" id="visaReferenceNumber" pattern="\\d{20}" maxlength="20" required placeholder="ادخل ارقام الفيزا المرجعية "  value="${expenseData.referenceNumber || ''}">
            </div>
        `;
    } else if (formType === 'شحن_تاب') {
        formHtml += `
            <div class="form-group">
                <label for="tabName">اسم التاب (اختياري):</label>
                <input type="text" id="tabName" placeholder="أدخل اسم التاب" value="${expenseData.tabName || ''}">
            </div>
            <div class="form-group">
                <label for="tabPhone">رقم تليفون التاب:</label>
                <input type="tel" id="tabPhone" required placeholder="أدخل رقم تليفون التاب" value="${expenseData.tabPhone || ''}">
            </div>
        `;
    } else if (formType === 'شحن_كهربا') {
        formHtml += `
            <div class="form-group">
                <label for="electricityLocation">مكان الشحن:</label>
                <input type="text" id="electricityLocation" required placeholder="أدخل مكان الشحن" value="${expenseData.location || ''}">
            </div>
        `;
    } else if (['بنزين', 'سلف', 'عجوزات'].includes(formType)) {
        formHtml += `
            <div class="form-group">
                <label for="personName">اسم الشخص:</label>
                <input type="text" id="personName" required placeholder="أدخل اسم الشخص" value="${expenseData.personName || ''}">
            </div>
        `;
    } else if (formType === 'دفعة_شركة') {
        formHtml += `
            <div class="form-group">
                <label for="companyName">اسم الشركة:</label>
                <input type="text" id="companyName" required placeholder="أدخل اسم الشركة" value="${expenseData.companyName || ''}">
            </div>
            <div class="form-group">
                <label for="companyCode">كود الشركة:</label>
                <input type="text" id="companyCode" placeholder="أدخل كود الشركة" value="${expenseData.companyCode || ''}">
            </div>
        `;
    } else if (formType === 'اجل') {
        formHtml += `
            <div class="form-group">
                <label for="customerSearch">البحث عن العميل: <span style="color: red;">*</span></label>
                <div class="input-group">
                    <input type="text" id="customerSearch" placeholder="ابحث بالاسم أو الرقم" onkeyup="searchCustomersForExpense(this.value)" autocomplete="off" value="${expenseData.customer ? (customers.find(c => c.id === expenseData.customer)?.name + ' (' + customers.find(c => c.id === expenseData.customer)?.phone + ')') : ''}">
                    <div id="customerSuggestions" class="suggestions"></div>
                </div>
                <input type="hidden" id="selectedCustomerId" value="${expenseData.customer || ''}">
                <input type="hidden" id="selectedCustomerName" value="${expenseData.customer ? customers.find(c => c.id === expenseData.customer)?.name : ''}">
            </div>
            <button type="button" class="add-btn" onclick="showAddCustomerModalFromExpense()" style="margin-top: 10px;">
                <i class="fas fa-plus"></i> إضافة عميل جديد
            </button>
        `;
    } else if (formType === 'سلف_موظف') { // حقول جديدة لسلف الموظفين
        formHtml += `
            <div class="form-group">
                <label for="employeeSearch">البحث عن الموظف: <span style="color: red;">*</span></label>
                <div class="input-group">
                    <input type="text" id="employeeSearch" placeholder="ابحث بالاسم أو الرقم" onkeyup="searchEmployeesForExpense(this.value)" autocomplete="off" value="${expenseData.employee ? (employees.find(e => e.id === expenseData.employee)?.name + ' (' + employees.find(e => e.id === expenseData.employee)?.phone + ')') : ''}">
                    <div id="employeeSuggestions" class="suggestions"></div>
                </div>
                <input type="hidden" id="selectedEmployeeId" value="${expenseData.employee || ''}">
                <input type="hidden" id="selectedEmployeeName" value="${expenseData.employee ? employees.find(e => e.id === expenseData.employee)?.name : ''}">
            </div>
            <button type="button" class="add-btn" onclick="showAddEmployeeModalFromExpense()" style="margin-top: 10px;">
                <i class="fas fa-plus"></i> إضافة موظف جديد
            </button>
        `;
    }

    // إضافة الحقول المخصصة ديناميكيًا
    const customFieldsForCategory = categoryCustomFields.filter(cf => cf.categoryId === categoryId);
    if (customFieldsForCategory.length > 0) {
        formHtml += `<div class="section-header" style="margin-top: 20px;"><h4>حقول إضافية</h4></div>`;
        customFieldsForCategory.forEach(cf => {
            const fieldId = `customField_${cf.fieldName.replace(/\s/g, '_')}`;
            const requiredAttr = cf.isRequired ? 'required' : '';
            const fieldValue = expenseData.customFields ? expenseData.customFields[cf.fieldName] || '' : '';

            if (cf.fieldType === 'select') {
                formHtml += `
                    <div class="form-group">
                        <label for="${fieldId}">${cf.fieldName}: ${cf.isRequired ? '<span style="color: red;">*</span>' : ''}</label>
                        <select id="${fieldId}" ${requiredAttr}>
                            <option value="">اختر...</option>
                            ${cf.options.map(option => `<option value="${option}" ${fieldValue === option ? 'selected' : ''}>${option}</option>`).join('')}
                        </select>
                    </div>
                `;
            } else {
                formHtml += `
                    <div class="form-group">
                        <label for="${fieldId}">${cf.fieldName}: ${cf.isRequired ? '<span style="color: red;">*</span>' : ''}</label>
                        <input type="${cf.fieldType}" id="${fieldId}" ${requiredAttr} placeholder="أدخل ${cf.fieldName}" value="${fieldValue}">
                    </div>
                `;
            }
        });
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
    const customerSearch = document.getElementById('customerSearch');
    if (customerSearch) customerSearch.value = `${customer.name} (${customer.phone})`;
    const selectedCustomerId = document.getElementById('selectedCustomerId');
    if (selectedCustomerId) selectedCustomerId.value = customer.id;
    const selectedCustomerName = document.getElementById('selectedCustomerName');
    if (selectedCustomerName) selectedCustomerName.value = customer.name;
    const customerSuggestions = document.getElementById('customerSuggestions');
    if (customerSuggestions) customerSuggestions.style.display = 'none';
}

function showAddCustomerModalFromExpense() {
    closeModal('addExpenseModal');
    setTimeout(() => {
        showAddCustomerModal(true);
    }, 300);
}

// وظائف جديدة للبحث واختيار الموظفين في فورم المصروفات
function searchEmployeesForExpense(searchTerm) {
    const suggestionsDiv = document.getElementById('employeeSuggestions');
    if (!suggestionsDiv) return;

    suggestionsDiv.innerHTML = '';

    if (searchTerm.length < 1) { // تغيير من 2 إلى 1 لبدء البحث من الحرف الأول
        suggestionsDiv.style.display = 'none';
        return;
    }

    // التأكد من أن employees ليست فارغة
    if (!employees || employees.length === 0) {
        suggestionsDiv.innerHTML = '<div class="suggestion-item">جارٍ تحميل بيانات الموظفين...</div>';
        suggestionsDiv.style.display = 'block';
        
        // محاولة إعادة تحميل البيانات إذا كانت فارغة
        loadEmployees().then(() => {
            if (employees.length > 0) {
                // إعادة البحث بعد تحميل البيانات
                searchEmployeesForExpense(searchTerm);
            }
        });
        return;
    }

    const filtered = employees.filter(emp =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.phone.includes(searchTerm)
    );

    if (filtered.length === 0) {
        suggestionsDiv.innerHTML = '<div class="suggestion-item">لا توجد نتائج</div>';
        suggestionsDiv.style.display = 'block';
        return;
    }

    filtered.forEach(emp => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.textContent = `${emp.name} (${emp.phone}) - سلف: ${emp.totalAdvance.toFixed(2)}`;
        item.onclick = () => selectEmployeeForExpense(emp);
        suggestionsDiv.appendChild(item);
    });

    suggestionsDiv.style.display = 'block';
}

function selectEmployeeForExpense(employee) {
    const employeeSearch = document.getElementById('employeeSearch');
    if (employeeSearch) employeeSearch.value = `${employee.name} (${employee.phone})`;
    const selectedEmployeeId = document.getElementById('selectedEmployeeId');
    if (selectedEmployeeId) selectedEmployeeId.value = employee.id;
    const selectedEmployeeName = document.getElementById('selectedEmployeeName');
    if (selectedEmployeeName) selectedEmployeeName.value = employee.name;
    const employeeSuggestions = document.getElementById('employeeSuggestions');
    if (employeeSuggestions) employeeSuggestions.style.display = 'none';
}

function showAddEmployeeModalFromExpense() {
    closeModal('addExpenseModal');
    setTimeout(() => {
        showAddEmployeeModal(true);
    }, 300);
}

 async function addExpense() {
        if (expenseSubmissionInProgress) {
            console.log('Expense submission already in progress, skipping...');
            return;
        }
        expenseSubmissionInProgress = true;
        showLoading(true);
        try {
            // تعريف المتغير now هنا
            const now = new Date();
            const currentDateTimeISO = now.toISOString();
        // التحقق المفصل من التصنيف باستخدام القيم الفعلية من DOM
        const categoryIdElement = document.getElementById('selectedExpenseCategoryId');
        const categoryCodeElement = document.getElementById('selectedExpenseCategoryCode');
        const categoryNameElement = document.getElementById('selectedExpenseCategoryName');
        const formTypeElement = document.getElementById('selectedExpenseCategoryFormType');
        
        const categoryId = categoryIdElement?.value;
        const categoryCode = categoryCodeElement?.value;
        const categoryName = categoryNameElement?.value;
        const formType = formTypeElement?.value;

        // الحصول على قيمة amount قبل استخدامها
        const amountInput = document.getElementById('expenseAmount');
        const amount = amountInput ? parseFloat(amountInput.value) : NaN;

        const notes = document.getElementById('expenseNotes')?.value.trim() || '';
        const invoiceNumber = document.getElementById('expenseInvoiceNumber')?.value.trim() || '';
        const visaReferenceNumber = document.getElementById('visaReferenceNumber')?.value.trim() || '';

        console.log('قيم التصنيف من DOM:', {
            categoryId,
            categoryCode,
            categoryName,
            formType,
            elementsExist: !!categoryIdElement && !!categoryCodeElement && !!categoryNameElement && !!formTypeElement
        });

        if (!categoryId || !categoryCode || !categoryName || !formType) {
            showMessage('يرجى اختيار تصنيف للمصروف.', 'warning');
            
            // فحص إضافي
            console.log('فحص العناصر في DOM:');
            console.log('selectedExpenseCategoryId:', categoryIdElement?.value, categoryIdElement);
            console.log('selectedExpenseCategoryCode:', categoryCodeElement?.value, categoryCodeElement);
            console.log('selectedExpenseCategoryName:', categoryNameElement?.value, categoryNameElement);
            console.log('selectedExpenseCategoryFormType:', formTypeElement?.value, formTypeElement);
            
            return;
        }

        // الآن amount معرّف ويمكن استخدامه
        if (isNaN(amount) || amount <= 0) {
            showMessage('يرجى إدخال قيمة صحيحة وموجبة للمصروف.', 'warning');
            return;
        }
        
        

        // التحقق من رقم الفاتورة إذا كان مطلوبًا
        if (['عادي', 'فيزا', 'اونلاين', 'مرتجع', 'خصم عميل', 'إنستا', 'اجل', 'شحن_تاب', 'شحن_كهربا', 'بنزين', 'سلف', 'دفعة_شركة', 'عجوزات', 'سلف_موظف'].includes(formType)) {
            if (!invoiceNumber) {
                showMessage('يرجى إدخال رقم الفاتورة.', 'warning');
                return;
            }

            const allExistingExpenses = await readSheet(SHEETS.EXPENSES);
            const isInvoiceNumberDuplicate = allExistingExpenses.slice(1).some(row =>
                row[3] && row[3].trim() === invoiceNumber
            );

            if (isInvoiceNumberDuplicate) {
                showMessage('رقم الفاتورة هذا موجود بالفعل. يرجى إدخال رقم فاتورة فريد.', 'error');
                return;
            }
        }

        // التحقق من الرقم المرجعي للفيزا إذا كان نوع الفورم "فيزا"
        if (formType === 'فيزا' && !visaReferenceNumber) {
            showMessage('يرجى إدخال الرقم المرجعي للفيزا.', 'warning');
            return;
        }

        // Handle customer credit for "اجل" type
        if (formType === 'اجل') {
            const customerId = document.getElementById('selectedCustomerId')?.value;
            if (!customerId) {
                showMessage('يرجى اختيار العميل الآجل.', 'warning');
                return;
            }

            const customerIndex = customers.findIndex(c => c.id === customerId);
            if (customerIndex !== -1) {
                const currentCustomer = customers[customerIndex];
                const newTotalCredit = currentCustomer.totalCredit + amount;

                const rowIndex = await findRowIndex(SHEETS.CUSTOMERS, 0, customerId);
                if (rowIndex !== -1) {
                    const updateResult = await updateSheet(SHEETS.CUSTOMERS, `D${rowIndex}`, [[newTotalCredit.toFixed(2)]]);
                    if (!updateResult.success) {
                        showMessage('فشل تحديث إجمالي الأجل للعميل.', 'error');
                        return;
                    }
                    await updateSheet(SHEETS.CUSTOMERS, `F${rowIndex}`, [[currentDateTimeISO.split('T')[0]]]);
                } else {
                    showMessage('لم يتم العثور على العميل لتحديث الأجل.', 'error');
                    return;
                }

                currentCustomer.totalCredit = newTotalCredit;
                customers[customerIndex] = currentCustomer;

                const historyId = 'CRH_' + now.getTime();
                const newHistoryEntry = [
                    historyId,
                    customerId,
                    currentDateTimeISO.split('T')[0],
                    'أجل',
                    amount.toFixed(2),
                    invoiceNumber,
                    notes,
                    currentUser.username
                ];
                const historyResult = await appendToSheet(SHEETS.CUSTOMER_CREDIT_HISTORY, newHistoryEntry);
                if (!historyResult.success) {
                    showMessage('فشل تسجيل حركة الأجل.', 'error');
                    return;
                }
            } else {
                showMessage('العميل المختار غير موجود.', 'error');
                return;
            }
        }

        // Handle employee advance for "سلف_موظف" type
        if (formType === 'سلف_موظف') {
            const employeeId = document.getElementById('selectedEmployeeId')?.value;
            if (!employeeId) {
                showMessage('يرجى اختيار الموظف.', 'warning');
                return;
            }

            const employeeIndex = employees.findIndex(e => e.id === employeeId);
            if (employeeIndex !== -1) {
                const currentEmployee = employees[employeeIndex];
                const newTotalAdvance = currentEmployee.totalAdvance + amount;

                const rowIndex = await findRowIndex(SHEETS.EMPLOYEES, 0, employeeId);
                if (rowIndex !== -1) {
                    const updateResult = await updateSheet(SHEETS.EMPLOYEES, `D${rowIndex}`, [[newTotalAdvance.toFixed(2)]]);
                    if (!updateResult.success) {
                        showMessage('فشل تحديث إجمالي السلف للموظف.', 'error');
                        return;
                    }
                    await updateSheet(SHEETS.EMPLOYEES, `F${rowIndex}`, [[currentDateTimeISO.split('T')[0]]]);
                } else {
                    showMessage('لم يتم العثور على الموظف لتحديث السلف.', 'error');
                    return;
                }

                currentEmployee.totalAdvance = newTotalAdvance;
                employees[employeeIndex] = currentEmployee;

                const historyId = 'EAH_' + now.getTime();
                const newHistoryEntry = [
                    historyId,
                    employeeId,
                    currentDateTimeISO.split('T')[0],
                    'سلفة',
                    amount.toFixed(2),
                    notes,
                    currentUser.username
                ];
                const historyResult = await appendToSheet(SHEETS.EMPLOYEE_ADVANCE_HISTORY, newHistoryEntry);
                if (!historyResult.success) {
                    showMessage('فشل تسجيل حركة السلفة.', 'error');
                    return;
                }
            } else {
                showMessage('الموظف المختار غير موجود.', 'error');
                return;
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
            currentDateTimeISO.split('T')[0], // Date (YYYY-MM-DD)
            currentDateTimeISO.split('T')[1].substring(0, 8), // Time (HH:MM:SS)
            currentUser.username,
            now.getFullYear().toString(),
            visaReferenceNumber, // استخدام visaReferenceNumber هنا
            document.getElementById('tabName')?.value.trim() || '',
            document.getElementById('tabPhone')?.value.trim() || '',
            document.getElementById('electricityLocation')?.value.trim() || '',
            document.getElementById('personName')?.value.trim() || '',
            document.getElementById('companyName')?.value.trim() || '',
            document.getElementById('companyCode')?.value.trim() || '',
            document.getElementById('selectedCustomerId')?.value || '',
            document.getElementById('selectedEmployeeId')?.value || '' // حقل الموظف
        ];

        // إضافة قيم الحقول المخصصة إلى expenseData
        const customFieldsForCategory = categoryCustomFields.filter(cf => cf.categoryId === categoryId);
        for (const cf of customFieldsForCategory) {
            const fieldId = `customField_${cf.fieldName.replace(/\s/g, '_')}`;
            const fieldValue = document.getElementById(fieldId)?.value || '';
            if (cf.isRequired && !fieldValue) {
                showMessage(`يرجى ملء الحقل المطلوب: ${cf.fieldName}.`, 'warning');
                return;
            }
            expenseData.push(fieldValue);
        }

        const result = await appendToSheet(SHEETS.EXPENSES, expenseData);

        if (result.success) {
            showMessage(`تم إضافة ${categoryName} بنجاح.`, 'success');
            await loadCashierExpenses(); // إعادة تحميل المصروفات وتحديث العرض
            if (formType === 'اجل') {
                await loadCustomers(); // تحديث قائمة العملاء بعد إضافة أجل
                displayCustomers('customersTableBodyCashier');
            }
            if (formType === 'سلف_موظف') {
                await loadEmployees(); // تحديث قائمة الموظفين بعد إضافة سلفة
                displayEmployees('employeesTableBodyAccountant');
            }

            // إذا كان الفورم مثبتًا، قم بمسح الحقول ذات الصلة فقط
            const pinButton = document.getElementById('pinExpenseFormBtn');
            if (pinButton && pinButton.dataset.pinned === 'true') {
                document.getElementById('expenseInvoiceNumber').value = '';
                document.getElementById('expenseAmount').value = '';
                document.getElementById('expenseNotes').value = '';
                if (formType === 'فيزا') {
                    document.getElementById('visaReferenceNumber').value = '';
                } else if (formType === 'شحن_تاب') {
                    document.getElementById('tabName').value = '';
                    document.getElementById('tabPhone').value = '';
                } else if (formType === 'شحن_كهربا') {
                    document.getElementById('electricityLocation').value = '';
                } else if (['بنزين', 'سلف', 'عجوزات'].includes(formType)) {
                    document.getElementById('personName').value = '';
                } else if (formType === 'دفعة_شركة') {
                    document.getElementById('companyName').value = '';
                    document.getElementById('companyCode').value = '';
                } else if (formType === 'اجل') {
                    document.getElementById('customerSearch').value = '';
                    document.getElementById('selectedCustomerId').value = '';
                    document.getElementById('selectedCustomerName').value = '';
                } else if (formType === 'سلف_موظف') {
                    document.getElementById('employeeSearch').value = '';
                    document.getElementById('selectedEmployeeId').value = '';
                    document.getElementById('selectedEmployeeName').value = '';
                }
                // مسح الحقول المخصصة
                for (const cf of customFieldsForCategory) {
                    const fieldId = `customField_${cf.fieldName.replace(/\s/g, '_')}`;
                    const fieldElement = document.getElementById(fieldId);
                    if (fieldElement) fieldElement.value = '';
                }
            } else {
                closeModal('addExpenseModal');
            }
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

async function updateExpense() {
    if (!currentEditExpenseId) {
        showMessage('لا يوجد مصروف محدد للتعديل.', 'error');
        return;
    }

    showLoading(true);
    try {
        const now = new Date();
        const currentDateTimeISO = now.toISOString();

        const categoryId = document.getElementById('selectedExpenseCategoryId')?.value;
        const categoryCode = document.getElementById('selectedExpenseCategoryCode')?.value;
        const categoryName = document.getElementById('selectedExpenseCategoryName')?.value;
        const formType = document.getElementById('selectedExpenseCategoryFormType')?.value;
        const amountInput = document.getElementById('expenseAmount');
        const amount = amountInput ? parseFloat(amountInput.value) : NaN;
        const notes = document.getElementById('expenseNotes')?.value.trim() || '';
        const invoiceNumber = document.getElementById('expenseInvoiceNumber')?.value.trim() || '';
        const visaReferenceNumber = document.getElementById('visaReferenceNumber')?.value.trim() || '';


        if (!categoryId) {
            showMessage('يرجى اختيار تصنيف للمصروف.', 'warning');
            return;
        }
        if (isNaN(amount) || amount <= 0) {
            showMessage('يرجى إدخال قيمة صحيحة وموجبة للمصروف.', 'warning');
            return;
        }

        if (['عادي', 'فيزا', 'اونلاين', 'مرتجع', 'خصم عميل', 'إنستا', 'اجل', 'شحن_تاب', 'شحن_كهربا', 'بنزين', 'سلف', 'دفعة_شركة', 'عجوزات', 'سلف_موظف'].includes(formType)) {
            if (!invoiceNumber) {
                showMessage('يرجى إدخال رقم الفاتورة.', 'warning');
                return;
            }
            // التحقق من تكرار رقم الفاتورة باستثناء المصروف الحالي
            const allExistingExpenses = await readSheet(SHEETS.EXPENSES);
            const isInvoiceNumberDuplicate = allExistingExpenses.slice(1).some(row =>
                row[0] !== currentEditExpenseId && row[3] && row[3].trim() === invoiceNumber
            );

            if (isInvoiceNumberDuplicate) {
                showMessage('رقم الفاتورة هذا موجود بالفعل لمصروف آخر. يرجى إدخال رقم فاتورة فريد.', 'error');
                return;
            }
        }

        // التحقق من الرقم المرجعي للفيزا إذا كان نوع الفورم "فيزا"
        if (formType === 'فيزا' && !visaReferenceNumber) {
            showMessage('يرجى إدخال الرقم المرجعي للفيزا.', 'warning');
            return;
        }

        const oldExpense = (await loadExpenses({})).find(exp => exp.id === currentEditExpenseId);
        if (!oldExpense) {
            showMessage('المصروف الأصلي غير موجود.', 'error');
            return;
        }

        // معالجة تعديل الأجل
        if (formType === 'اجل') {
            const customerId = document.getElementById('selectedCustomerId')?.value;
            if (!customerId) {
                showMessage('يرجى اختيار العميل الآجل.', 'warning');
                return;
            }

            // استرجاع العميل القديم والجديد
            const oldCustomerId = oldExpense.customer;
            const oldAmount = oldExpense.amount;

            // إذا تغير العميل أو المبلغ، يجب تعديل الأجل
            if (oldCustomerId !== customerId || oldAmount !== amount) {
                // استرجاع الأجل القديم من العميل القديم
                if (oldCustomerId) {
                    const oldCustomer = customers.find(c => c.id === oldCustomerId);
                    if (oldCustomer) {
                        const oldCustomerRowIndex = await findRowIndex(SHEETS.CUSTOMERS, 0, oldCustomerId);
                        if (oldCustomerRowIndex !== -1) {
                            const newOldCustomerCredit = oldCustomer.totalCredit - oldAmount;
                            await updateSheet(SHEETS.CUSTOMERS, `D${oldCustomerRowIndex}`, [[newOldCustomerCredit.toFixed(2)]]);
                            oldCustomer.totalCredit = newOldCustomerCredit; // تحديث الحالة المحلية
                        }
                    }
                }

                // إضافة الأجل الجديد للعميل الجديد
                const newCustomer = customers.find(c => c.id === customerId);
                if (newCustomer) {
                    const newCustomerRowIndex = await findRowIndex(SHEETS.CUSTOMERS, 0, customerId);
                    if (newCustomerRowIndex !== -1) {
                        const newNewCustomerCredit = newCustomer.totalCredit + amount;
                        await updateSheet(SHEETS.CUSTOMERS, `D${newCustomerRowIndex}`, [[newNewCustomerCredit.toFixed(2)]]);
                        newCustomer.totalCredit = newNewCustomerCredit; // تحديث الحالة المحلية
                    }
                }

                // تسجيل حركة الأجل في سجل العميل
                const historyId = 'CRH_' + now.getTime();
                const newHistoryEntry = [
                    historyId,
                    customerId,
                    currentDateTimeISO.split('T')[0],
                    'تعديل أجل',
                    amount.toFixed(2),
                    invoiceNumber,
                    `تعديل مصروف ${currentEditExpenseId} بواسطة ${currentUser.username}`,
                    currentUser.username
                ];
                await appendToSheet(SHEETS.CUSTOMER_CREDIT_HISTORY, newHistoryEntry);
            }
        }

        // معالجة تعديل سلف الموظفين
        if (formType === 'سلف_موظف') {
            const employeeId = document.getElementById('selectedEmployeeId')?.value;
            if (!employeeId) {
                showMessage('يرجى اختيار الموظف.', 'warning');
                return;
            }

            const oldEmployeeId = oldExpense.employee;
            const oldAmount = oldExpense.amount;

            if (oldEmployeeId !== employeeId || oldAmount !== amount) {
                if (oldEmployeeId) {
                    const oldEmployee = employees.find(e => e.id === oldEmployeeId);
                    if (oldEmployee) {
                        const oldEmployeeRowIndex = await findRowIndex(SHEETS.EMPLOYEES, 0, oldEmployeeId);
                        if (oldEmployeeRowIndex !== -1) {
                            const newOldEmployeeAdvance = oldEmployee.totalAdvance - oldAmount;
                            await updateSheet(SHEETS.EMPLOYEES, `D${oldEmployeeRowIndex}`, [[newOldEmployeeAdvance.toFixed(2)]]);
                            oldEmployee.totalAdvance = newOldEmployeeAdvance;
                        }
                    }
                }

                const newEmployee = employees.find(e => e.id === employeeId);
                if (newEmployee) {
                    const newEmployeeRowIndex = await findRowIndex(SHEETS.EMPLOYEES, 0, employeeId);
                    if (newEmployeeRowIndex !== -1) {
                        const newNewEmployeeAdvance = newEmployee.totalAdvance + amount;
                        await updateSheet(SHEETS.EMPLOYEES, `D${newEmployeeRowIndex}`, [[newNewEmployeeAdvance.toFixed(2)]]);
                        newEmployee.totalAdvance = newNewEmployeeAdvance;
                    }
                }

                const historyId = 'EAH_' + now.getTime();
                const newHistoryEntry = [
                    historyId,
                    employeeId,
                    currentDateTimeISO.split('T')[0],
                    'تعديل سلفة',
                    amount.toFixed(2),
                    `تعديل مصروف ${currentEditExpenseId} بواسطة ${currentUser.username}`,
                    currentUser.username
                ];
                await appendToSheet(SHEETS.EMPLOYEE_ADVANCE_HISTORY, newHistoryEntry);
            }
        }

        const rowIndex = await findRowIndex(SHEETS.EXPENSES, 0, currentEditExpenseId);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على المصروف لتحديثه.', 'error');
            return;
        }

        let updatedExpenseData = [
            currentEditExpenseId,
            categoryName,
            categoryCode,
            invoiceNumber,
            amount.toFixed(2),
            notes,
            oldExpense.date, // الحفاظ على تاريخ الإنشاء الأصلي
            oldExpense.time, // الحفاظ على وقت الإنشاء الأصلي
            currentUser.username, // تحديث الكاشير الذي قام بالتعديل
            oldExpense.year,
            visaReferenceNumber, // استخدام visaReferenceNumber هنا
            document.getElementById('tabName')?.value.trim() || '',
            document.getElementById('tabPhone')?.value.trim() || '',
            document.getElementById('electricityLocation')?.value.trim() || '',
            document.getElementById('personName')?.value.trim() || '',
            document.getElementById('companyName')?.value.trim() || '',
            document.getElementById('companyCode')?.value.trim() || '',
            document.getElementById('selectedCustomerId')?.value || '',
            document.getElementById('selectedEmployeeId')?.value || '' // حقل الموظف
        ];

        // إضافة قيم الحقول المخصصة المحدثة
        const customFieldsForCategory = categoryCustomFields.filter(cf => cf.categoryId === categoryId);
        for (const cf of customFieldsForCategory) {
            const fieldId = `customField_${cf.fieldName.replace(/\s/g, '_')}`;
            const fieldValue = document.getElementById(fieldId)?.value || '';
            if (cf.isRequired && !fieldValue) {
                showMessage(`يرجى ملء الحقل المطلوب: ${cf.fieldName}.`, 'warning');
                return;
            }
            updatedExpenseData.push(fieldValue);
        }

        const result = await updateSheet(SHEETS.EXPENSES, `A${rowIndex}:${String.fromCharCode(65 + updatedExpenseData.length - 1)}${rowIndex}`, [updatedExpenseData]);

        if (result.success) {
            showMessage('تم تعديل المصروف بنجاح.', 'success');
            closeModal('addExpenseModal');
            await loadCashierExpenses(); // إعادة تحميل المصروفات وتحديث العرض
            if (formType === 'اجل') {
                await loadCustomers(); // تحديث قائمة العملاء بعد تعديل أجل
                displayCustomers('customersTableBodyCashier');
            }
            if (formType === 'سلف_موظف') {
                await loadEmployees(); // تحديث قائمة الموظفين بعد تعديل سلفة
                displayEmployees('employeesTableBodyAccountant');
            }
        } else {
            showMessage('فشل تعديل المصروف.', 'error');
        }
    } catch (error) {
        console.error('Error updating expense:', error);
        showMessage('حدث خطأ أثناء تعديل المصروف.', 'error');
    } finally {
        expenseSubmissionInProgress = false;
        showLoading(false);
    }
}

async function deleteExpense(expenseId, expenseCategory, expenseAmount, expenseInvoiceNumber) {
    if (!confirm(`هل أنت متأكد من حذف المصروف "${expenseCategory}" بقيمة ${expenseAmount} ورقم فاتورة ${expenseInvoiceNumber}؟ هذا الإجراء لا يمكن التراجع عنه.`)) {
        return;
    }

    showLoading(true);
    try {
        const rowIndex = await findRowIndex(SHEETS.EXPENSES, 0, expenseId);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على المصروف لحذفه.', 'error');
            return;
        }

        const expense = (await loadExpenses({})).find(exp => exp.id === expenseId);
        if (!expense) {
            showMessage('المصروف غير موجود.', 'error');
            return;
        }

        const category = categories.find(cat => cat.name === expense.category || cat.code === expense.categoryCode);
        const formType = category ? category.formType : 'عادي';

        // إذا كان المصروف من نوع "أجل"، يجب تعديل رصيد العميل
        if (formType === 'اجل' && expense.customer) {
            const customer = customers.find(c => c.id === expense.customer);
            if (customer) {
                const customerRowIndex = await findRowIndex(SHEETS.CUSTOMERS, 0, expense.customer);
                if (customerRowIndex !== -1) {
                    const newTotalCredit = customer.totalCredit - expense.amount;
                    await updateSheet(SHEETS.CUSTOMERS, `D${customerRowIndex}`, [[newTotalCredit.toFixed(2)]]);
                    customer.totalCredit = newTotalCredit; // تحديث الحالة المحلية
                }
                // تسجيل حركة الحذف في سجل العميل
                const now = new Date();
                const historyId = 'CRH_' + now.getTime();
                const newHistoryEntry = [
                    historyId,
                    expense.customer,
                    now.toISOString().split('T')[0],
                    'حذف أجل',
                    (-expense.amount).toFixed(2), // قيمة سالبة للدلالة على الخصم
                    expense.invoiceNumber,
                    `حذف مصروف ${expenseId} بواسطة ${currentUser.username}`,
                    currentUser.username
                ];
                await appendToSheet(SHEETS.CUSTOMER_CREDIT_HISTORY, newHistoryEntry);
            }
        }

        // إذا كان المصروف من نوع "سلف_موظف"، يجب تعديل رصيد الموظف
        if (formType === 'سلف_موظف' && expense.employee) {
            const employee = employees.find(e => e.id === expense.employee);
            if (employee) {
                const employeeRowIndex = await findRowIndex(SHEETS.EMPLOYEES, 0, expense.employee);
                if (employeeRowIndex !== -1) {
                    const newTotalAdvance = employee.totalAdvance - expense.amount;
                    await updateSheet(SHEETS.EMPLOYEES, `D${employeeRowIndex}`, [[newTotalAdvance.toFixed(2)]]);
                    employee.totalAdvance = newTotalAdvance;
                }
                const now = new Date();
                const historyId = 'EAH_' + now.getTime();
                const newHistoryEntry = [
                    historyId,
                    expense.employee,
                    now.toISOString().split('T')[0],
                    'حذف سلفة',
                    (-expense.amount).toFixed(2),
                    `حذف مصروف ${expenseId} بواسطة ${currentUser.username}`,
                    currentUser.username
                ];
                await appendToSheet(SHEETS.EMPLOYEE_ADVANCE_HISTORY, newHistoryEntry);
            }
        }

        const result = await deleteSheetRow(SHEETS.EXPENSES, rowIndex);

        if (result.success) {
            showMessage('تم حذف المصروف بنجاح.', 'success');
            await loadCashierExpenses(); // إعادة تحميل المصروفات وتحديث العرض
            if (formType === 'اجل') {
                await loadCustomers(); // تحديث قائمة العملاء بعد حذف أجل
                displayCustomers('customersTableBodyCashier');
            }
            if (formType === 'سلف_موظف') {
                await loadEmployees(); // تحديث قائمة الموظفين بعد حذف سلفة
                displayEmployees('employeesTableBodyAccountant');
            }
        } else {
            showMessage('فشل حذف المصروف.', 'error');
        }
    } catch (error) {
        console.error('Error deleting expense:', error);
        showMessage('حدث خطأ أثناء حذف المصروف.', 'error');
    } finally {
        showLoading(false);
    }
}


// تحسين دالة loadCashierExpenses
async function loadCashierExpenses() {
    // لا نستخدم cashierDailyData هنا بشكل مباشر لتخزين المصروفات، بل نعتمد على loadExpenses
    // ونقوم بتجميع البيانات المطلوبة للعرض أو الحسابات الأخرى.
    // هذا يضمن أننا نعمل دائمًا بأحدث البيانات من Google Sheets.

    const expenses = await loadExpenses({ cashier: currentUser.username });

    // تجميع البيانات للعرض في جدول المصروفات
    displayCashierExpensesTable(expenses);
}

function displayCashierExpensesTable(expenses) {
    const tableBody = document.getElementById('expensesTableBodyCashier');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (expenses.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7">لا توجد مصروفات مسجلة لهذا الكاشير.</td></tr>';
        return;
    }

    // ترتيب الفواتير من الأحدث إلى الأقدم بناءً على التاريخ والوقت
    expenses.sort((a, b) => {
        const dateTimeA = new Date(`${a.date}T${a.time}`);
        const dateTimeB = new Date(`${b.date}T${b.time}`);
        return dateTimeB - dateTimeA; // الأحدث أولاً
    });

    expenses.forEach(exp => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = exp.category;
        row.insertCell().textContent = exp.invoiceNumber || '--';
        row.insertCell().textContent = exp.amount.toFixed(2);
        row.insertCell().textContent = exp.date;
        row.insertCell().textContent = exp.time.substring(0, 5); // عرض HH:MM فقط
        row.insertCell().textContent = exp.notes || '--';
        const actionsCell = row.insertCell();
        actionsCell.innerHTML = `
            <button class="edit-btn" onclick="showEditExpenseModal('${exp.id}')"><i class="fas fa-edit"></i> تعديل</button>
            <button class="delete-btn" onclick="deleteExpense('${exp.id}', '${exp.category}', ${exp.amount}, '${exp.invoiceNumber}')"><i class="fas fa-trash"></i> حذف</button>
        `;
    });
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

async function filterCashierExpenses() {
    showLoading(true);
    try {
        const categoryFilter = document.getElementById('expenseCategoryFilterCashier')?.value || '';
        const dateFromFilter = document.getElementById('expenseDateFromFilterCashier')?.value || '';
        const dateToFilter = document.getElementById('expenseDateToFilterCashier')?.value || '';

        const filters = { cashier: currentUser.username };
        if (categoryFilter) filters.category = categoryFilter;
        if (dateFromFilter) filters.dateFrom = dateFromFilter;
        if (dateToFilter) filters.dateTo = dateToFilter;

        const filteredExpenses = await loadExpenses(filters);
        displayCashierExpensesTable(filteredExpenses);
    } catch (error) {
        console.error('Error filtering cashier expenses:', error);
        showMessage('حدث خطأ أثناء تصفية المصروفات.', 'error');
    } finally {
        showLoading(false);
    }
}

function clearCashierExpenseFilters() {
    const categoryFilter = document.getElementById('expenseCategoryFilterCashier');
    const dateFromFilter = document.getElementById('expenseDateFromFilterCashier');
    const dateToFilter = document.getElementById('expenseDateToFilterCashier');

    if (categoryFilter) categoryFilter.value = '';
    if (dateFromFilter) dateFromFilter.value = '';
    if (dateToFilter) dateToFilter.value = '';

    filterCashierExpenses(); // إعادة تحميل المصروفات بدون فلاتر
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

    customers.sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate));

    customers.forEach(cust => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = cust.name;
        row.insertCell().textContent = cust.phone;
        row.insertCell().textContent = cust.totalCredit.toFixed(2);
        row.insertCell().textContent = new Date(cust.creationDate).toLocaleDateString('ar-EG');
        const actionsCell = row.insertCell();

        if (tableBodyId === 'customersTableBodyAccountant') {
            actionsCell.innerHTML = `
                <button class="edit-btn" onclick="showEditCustomerModal('${cust.id}')"><i class="fas fa-edit"></i> تعديل</button>
                <button class="delete-btn" onclick="deleteCustomer('${cust.id}', '${cust.name}')"><i class="fas fa-trash"></i> حذف</button>
                <button class="view-btn" onclick="viewCustomerDetails('${cust.id}', '${cust.name}')"><i class="fas fa-eye"></i> تفاصيل</button>
            `;
        } else { // Cashier page
            actionsCell.innerHTML = `
                <button class="edit-btn" onclick="showEditCustomerModal('${cust.id}')"><i class="fas fa-edit"></i> تعديل</button>
                <button class="delete-btn" onclick="deleteCustomer('${cust.id}', '${cust.name}')"><i class="fas fa-trash"></i> حذف</button>
            `;
        }
    });
}

async function viewCustomerDetails(customerId, customerName) {
    showLoading(true);
    try {
        currentSelectedCustomerId = customerId;
        const customerDetailsName = document.getElementById('customerDetailsName');
        if (customerDetailsName) customerDetailsName.textContent = customerName;
        const customerDetailsAccountant = document.getElementById('customerDetailsAccountant');
        if (customerDetailsAccountant) customerDetailsAccountant.style.display = 'block';
        const customerPaymentAmount = document.getElementById('customerPaymentAmount');
        if (customerPaymentAmount) customerPaymentAmount.value = '';

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

    const paymentAmountInput = document.getElementById('customerPaymentAmount');
    const paymentAmount = paymentAmountInput ? parseFloat(paymentAmountInput.value) : NaN;
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
            const updateResult = await updateSheet(SHEETS.CUSTOMERS, `D${rowIndex}`, [[newTotalCredit.toFixed(2)]]);
            if (!updateResult.success) {
                showMessage('فشل تحديث إجمالي الأجل للعميل.', 'error');
                return;
            }
            await updateSheet(SHEETS.CUSTOMERS, `F${rowIndex}`, [[date]]);
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
            paymentAmount.toFixed(2),
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
        if (paymentAmountInput) paymentAmountInput.value = '';
        await viewCustomerDetails(currentSelectedCustomerId, currentCustomer.name); // تحديث عرض التفاصيل
        displayCustomers('customersTableBodyAccountant'); // تحديث جدول العملاء
        updateAccountantDashboard(); // تحديث لوحة التحكم
    } catch (error) {
        console.error('Error processing customer payment:', error);
        showMessage('حدث خطأ أثناء معالجة السداد.', 'error');
    } finally {
        showLoading(false);
    }
}

function showAddCustomerModal(fromExpense = false) {
    const form = document.getElementById('addCustomerForm');
    if (form) {
        form.reset();
        document.getElementById('addCustomerModalTitle').textContent = 'إضافة عميل جديد';
        document.getElementById('addCustomerModalSaveBtn').onclick = addCustomer;
        currentSelectedCustomerId = null; // مسح أي ID لعميل سابق
    }

    const modal = document.getElementById('addCustomerModal');
    if (modal) {
        modal.classList.add('active');
        modal.dataset.fromExpense = fromExpense;
    }
}

async function showEditCustomerModal(customerId) {
    const customer = customers.find(cust => cust.id === customerId);
    if (!customer) {
        showMessage('العميل غير موجود.', 'error');
        return;
    }

    document.getElementById('customerName').value = customer.name;
    document.getElementById('customerPhone').value = customer.phone;

    document.getElementById('addCustomerModalTitle').textContent = 'تعديل عميل';
    document.getElementById('addCustomerModalSaveBtn').onclick = updateCustomer;
    currentSelectedCustomerId = customerId;

    const modal = document.getElementById('addCustomerModal');
    if (modal) {
        modal.classList.add('active');
    }
}

async function addCustomer() {
    const name = document.getElementById('customerName')?.value.trim();
    const phone = document.getElementById('customerPhone')?.value.trim();

    if (!name || !phone) {
        showMessage('يرجى ملء جميع حقول العميل.', 'warning');
        return;
    }

    const existingCustomer = customers.find(cust => cust.phone === phone);
    if (existingCustomer) {
        showMessage('رقم التليفون موجود بالفعل لعميل آخر. يرجى استخدام رقم فريد.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const customerId = 'CUST_' + new Date().getTime();
        const newCustomerData = [
            customerId,
            name,
            phone,
            '0.00', // Total Credit starts at 0
            new Date().toISOString().split('T')[0],
            new Date().toISOString().split('T')[0]
        ];

        const result = await appendToSheet(SHEETS.CUSTOMERS, newCustomerData);

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
    } catch (error) {
        console.error('Error adding customer:', error);
        showMessage('حدث خطأ أثناء إضافة العميل.', 'error');
    } finally {
        showLoading(false);
    }
}

async function updateCustomer() {
    if (!currentSelectedCustomerId) {
        showMessage('لا يوجد عميل محدد للتعديل.', 'error');
        return;
    }

    const name = document.getElementById('customerName')?.value.trim();
    const phone = document.getElementById('customerPhone')?.value.trim();

    if (!name || !phone) {
        showMessage('يرجى ملء جميع حقول العميل.', 'warning');
        return;
    }

    const existingCustomer = customers.find(cust => cust.phone === phone && cust.id !== currentSelectedCustomerId);
    if (existingCustomer) {
        showMessage('رقم التليفون موجود بالفعل لعميل آخر. يرجى استخدام رقم فريد.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const rowIndex = await findRowIndex(SHEETS.CUSTOMERS, 0, currentSelectedCustomerId);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على العميل لتحديثه.', 'error');
            return;
        }

        const oldCustomer = customers.find(cust => cust.id === currentSelectedCustomerId);
        const updatedCustomerData = [
            currentSelectedCustomerId,
            name,
            phone,
            oldCustomer.totalCredit.toFixed(2), // الحفاظ على إجمالي الأجل
            oldCustomer.creationDate, // الحفاظ على تاريخ الإنشاء
            new Date().toISOString().split('T')[0] // تحديث تاريخ آخر تعديل
        ];

        const result = await updateSheet(SHEETS.CUSTOMERS, `A${rowIndex}:F${rowIndex}`, [updatedCustomerData]);

        if (result.success) {
            showMessage('تم تعديل العميل بنجاح.', 'success');
            closeModal('addCustomerModal');
            await loadCustomers();
            displayCustomers('customersTableBodyCashier');
            displayCustomers('customersTableBodyAccountant');
            updateAccountantDashboard();
        } else {
            showMessage('فشل تعديل العميل.', 'error');
        }
    } catch (error) {
        console.error('Error updating customer:', error);
        showMessage('حدث خطأ أثناء تعديل العميل.', 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteCustomer(customerId, customerName) {
    if (!confirm(`هل أنت متأكد من حذف العميل "${customerName}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) {
        return;
    }

    showLoading(true);
    try {
        const rowIndex = await findRowIndex(SHEETS.CUSTOMERS, 0, customerId);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على العميل لحذفه.', 'error');
            return;
        }

        // التحقق مما إذا كان العميل لديه أجل مستحق
        const customer = customers.find(c => c.id === customerId);
        if (customer && customer.totalCredit > 0) {
            showMessage('لا يمكن حذف العميل لديه أجل مستحق. يرجى تسوية الأجل أولاً.', 'error');
            return;
        }

        const result = await deleteSheetRow(SHEETS.CUSTOMERS, rowIndex);

        if (result.success) {
            showMessage('تم حذف العميل بنجاح.', 'success');
            await loadCustomers();
            displayCustomers('customersTableBodyCashier');
            displayCustomers('customersTableBodyAccountant');
            updateAccountantDashboard();
        } else {
            showMessage('فشل حذف العميل.', 'error');
        }
    } catch (error) {
        console.error('Error deleting customer:', error);
        showMessage('حدث خطأ أثناء حذف العميل.', 'error');
    } finally {
        showLoading(false);
    }
}

// --- Employees Management (New Section) ---
function displayEmployees(tableBodyId) {
    const tableBody = document.getElementById(tableBodyId);
    if (!tableBody) return;

    tableBody.innerHTML = '';
    if (employees.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">لا توجد موظفين مسجلين.</td></tr>';
        return;
    }

    employees.sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate));

    employees.forEach(emp => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = emp.name;
        row.insertCell().textContent = emp.phone;
        row.insertCell().textContent = emp.totalAdvance.toFixed(2);
        row.insertCell().textContent = new Date(emp.creationDate).toLocaleDateString('ar-EG');
        const actionsCell = row.insertCell();

        // الأزرار تظهر فقط للمحاسب
        if (currentUserRole === 'محاسب') {
            actionsCell.innerHTML = `
                <button class="edit-btn" onclick="showEditEmployeeModal('${emp.id}')"><i class="fas fa-edit"></i> تعديل</button>
                <button class="delete-btn" onclick="deleteEmployee('${emp.id}', '${emp.name}')"><i class="fas fa-trash"></i> حذف</button>
                <button class="view-btn" onclick="viewEmployeeDetails('${emp.id}', '${emp.name}')"><i class="fas fa-eye"></i> تفاصيل</button>
            `;
        } else {
            actionsCell.textContent = '--'; // لا توجد إجراءات للكاشير
        }
    });
}

async function viewEmployeeDetails(employeeId, employeeName) {
    showLoading(true);
    try {
        currentSelectedEmployeeId = employeeId;
        const employeeDetailsName = document.getElementById('employeeDetailsName');
        if (employeeDetailsName) employeeDetailsName.textContent = employeeName;
        const employeeDetailsAccountant = document.getElementById('employeeDetailsAccountant');
        if (employeeDetailsAccountant) employeeDetailsAccountant.style.display = 'block';
        const employeePaymentAmount = document.getElementById('employeePaymentAmount');
        if (employeePaymentAmount) employeePaymentAmount.value = '';

        const history = await loadEmployeeAdvanceHistory(employeeId);
        const tableBody = document.getElementById('employeeAdvanceHistoryBody');
        if (!tableBody) return;

        tableBody.innerHTML = '';
        if (history.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">لا توجد حركات سلف/سداد لهذا الموظف.</td></tr>';
            return;
        }

        history.sort((a, b) => new Date(b.date) - new Date(a.date));

        history.forEach(item => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = item.date;
            row.insertCell().textContent = item.type;
            row.insertCell().textContent = item.amount.toFixed(2);
            row.insertCell().textContent = item.notes || '--';
            row.insertCell().textContent = item.recordedBy;
        });
    } catch (error) {
        console.error('Error viewing employee details:', error);
        showMessage('حدث خطأ أثناء عرض تفاصيل الموظف.', 'error');
    } finally {
        showLoading(false);
    }
}

async function processEmployeePayment() {
    if (!currentSelectedEmployeeId) {
        showMessage('يرجى اختيار موظف أولاً.', 'warning');
        return;
    }

    const paymentAmountInput = document.getElementById('employeePaymentAmount');
    const paymentAmount = paymentAmountInput ? parseFloat(paymentAmountInput.value) : NaN;
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
        showMessage('يرجى إدخال مبلغ سداد صحيح وموجب.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const employeeIndex = employees.findIndex(e => e.id === currentSelectedEmployeeId);
        if (employeeIndex === -1) {
            showMessage('الموظف غير موجود.', 'error');
            return;
        }

        const currentEmployee = employees[employeeIndex];
        if (currentEmployee.totalAdvance < paymentAmount) {
            showMessage('مبلغ السداد أكبر من إجمالي السلف المستحقة.', 'warning');
            return;
        }

        const newTotalAdvance = currentEmployee.totalAdvance - paymentAmount;
        const now = new Date();
        const date = now.toISOString().split('T')[0];

        const rowIndex = await findRowIndex(SHEETS.EMPLOYEES, 0, currentSelectedEmployeeId);
        if (rowIndex !== -1) {
            const updateResult = await updateSheet(SHEETS.EMPLOYEES, `D${rowIndex}`, [[newTotalAdvance.toFixed(2)]]);
            if (!updateResult.success) {
                showMessage('فشل تحديث إجمالي السلف للموظف.', 'error');
                return;
            }
            await updateSheet(SHEETS.EMPLOYEES, `F${rowIndex}`, [[date]]);
        } else {
            showMessage('لم يتم العثور على الموظف لتحديث السلف.', 'error');
            return;
        }

        const historyId = 'EAH_' + now.getTime();
        const newHistoryEntry = [
            historyId,
            currentSelectedEmployeeId,
            date,
            'سداد سلفة',
            paymentAmount.toFixed(2),
            `سداد من المحاسب ${currentUserName}`,
            currentUser.username
        ];
        const historyResult = await appendToSheet(SHEETS.EMPLOYEE_ADVANCE_HISTORY, newHistoryEntry);
        if (!historyResult.success) {
            showMessage('فشل تسجيل حركة السداد.', 'error');
            return;
        }

        currentEmployee.totalAdvance = newTotalAdvance;
        employees[employeeIndex] = currentEmployee;

        showMessage('تم سداد السلفة بنجاح.', 'success');
        if (paymentAmountInput) paymentAmountInput.value = '';
        await viewEmployeeDetails(currentSelectedEmployeeId, currentEmployee.name); // تحديث عرض التفاصيل
        displayEmployees('employeesTableBodyAccountant'); // تحديث جدول الموظفين
        updateAccountantDashboard(); // تحديث لوحة التحكم
    } catch (error) {
        console.error('Error processing employee payment:', error);
        showMessage('حدث خطأ أثناء معالجة السداد.', 'error');
    } finally {
        showLoading(false);
    }
}

function showAddEmployeeModal(fromExpense = false) {
    const form = document.getElementById('addEmployeeForm');
    if (form) {
        form.reset();
        document.getElementById('addEmployeeModalTitle').textContent = 'إضافة موظف جديد';
        document.getElementById('addEmployeeModalSaveBtn').onclick = addEmployee;
        currentEditEmployeeId = null; // مسح أي ID لموظف سابق
    }

    const modal = document.getElementById('addEmployeeModal');
    if (modal) {
        modal.classList.add('active');
        modal.dataset.fromExpense = fromExpense;
    }
}

async function showEditEmployeeModal(employeeId) {
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) {
        showMessage('الموظف غير موجود.', 'error');
        return;
    }

    document.getElementById('employeeName').value = employee.name;
    document.getElementById('employeePhone').value = employee.phone;

    document.getElementById('addEmployeeModalTitle').textContent = 'تعديل موظف';
    document.getElementById('addEmployeeModalSaveBtn').onclick = updateEmployee;
    currentEditEmployeeId = employeeId;

    const modal = document.getElementById('addEmployeeModal');
    if (modal) {
        modal.classList.add('active');
    }
}

async function addEmployee() {
    const name = document.getElementById('employeeName')?.value.trim();
    const phone = document.getElementById('employeePhone')?.value.trim();

    if (!name || !phone) {
        showMessage('يرجى ملء جميع حقول الموظف.', 'warning');
        return;
    }

    const existingEmployee = employees.find(emp => emp.phone === phone);
    if (existingEmployee) {
        showMessage('رقم التليفون موجود بالفعل لموظف آخر. يرجى استخدام رقم فريد.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const employeeId = 'EMP_' + new Date().getTime();
        const newEmployeeData = [
            employeeId,
            name,
            phone,
            '0.00',
            new Date().toISOString().split('T')[0],
            new Date().toISOString().split('T')[0]
        ];

        const result = await appendToSheet(SHEETS.EMPLOYEES, newEmployeeData);

        if (result.success) {
            showMessage('تم إضافة الموظف بنجاح.', 'success');
            closeModal('addEmployeeModal');
            
            // تحديث قائمة الموظفين
            await loadEmployees();
            displayEmployees('employeesTableBodyAccountant');
            // تحديث عرض الموظفين في الكاشير إذا كان مفتوحًا
            if (document.getElementById('employeesTabCashier').classList.contains('active')) {
                displayEmployees('employeesTableBodyCashier');
            }
            updateAccountantDashboard();

            const modal = document.getElementById('addEmployeeModal');
            if (modal && modal.dataset.fromExpense === 'true') {
                showAddExpenseModal();
                const newEmployeeObj = { id: employeeId, name: name, phone: phone, totalAdvance: 0 };
                
                // إعطاء وقت قصير لتحميل النموذج قبل تحديد الموظف
                setTimeout(() => {
                    selectEmployeeForExpense(newEmployeeObj);
                    
                    // تحديث قائمة الاقتراحات
                    const employeeSearchInput = document.getElementById('employeeSearch');
                    if (employeeSearchInput) {
                        employeeSearchInput.value = `${name} (${phone})`;
                        searchEmployeesForExpense(name); // عرض الاقتراحات
                    }
                }, 100);
            }
        } else {
            showMessage('فشل إضافة الموظف.', 'error');
        }
    } catch (error) {
        console.error('Error adding employee:', error);
        showMessage('حدث خطأ أثناء إضافة الموظف.', 'error');
    } finally {
        showLoading(false);
    }
}


// دالة مساعدة للتأكد من تحميل بيانات الموظفين
function ensureEmployeesLoaded() {
    return new Promise((resolve) => {
        if (employees && employees.length > 0) {
            resolve();
        } else {
            loadEmployees().then(() => {
                resolve();
            });
        }
    });
}

async function updateEmployee() {
    if (!currentEditEmployeeId) {
        showMessage('لا يوجد موظف محدد للتعديل.', 'error');
        return;
    }

    const name = document.getElementById('employeeName')?.value.trim();
    const phone = document.getElementById('employeePhone')?.value.trim();

    if (!name || !phone) {
        showMessage('يرجى ملء جميع حقول الموظف.', 'warning');
        return;
    }

    const existingEmployee = employees.find(emp => emp.phone === phone && emp.id !== currentEditEmployeeId);
    if (existingEmployee) {
        showMessage('رقم التليفون موجود بالفعل لموظف آخر. يرجى استخدام رقم فريد.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const rowIndex = await findRowIndex(SHEETS.EMPLOYEES, 0, currentEditEmployeeId);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على الموظف لتحديثه.', 'error');
            return;
        }

        const oldEmployee = employees.find(emp => emp.id === currentEditEmployeeId);
        const updatedEmployeeData = [
            currentEditEmployeeId,
            name,
            phone,
            oldEmployee.totalAdvance.toFixed(2), // الحفاظ على إجمالي السلف
            oldEmployee.creationDate, // الحفاظ على تاريخ الإنشاء
            new Date().toISOString().split('T')[0] // تحديث تاريخ آخر تعديل
        ];

        const result = await updateSheet(SHEETS.EMPLOYEES, `A${rowIndex}:F${rowIndex}`, [updatedEmployeeData]);

        if (result.success) {
            showMessage('تم تعديل الموظف بنجاح.', 'success');
            closeModal('addEmployeeModal');
            await loadEmployees();
            displayEmployees('employeesTableBodyAccountant');
            // تحديث عرض الموظفين في الكاشير إذا كان مفتوحًا
            if (document.getElementById('employeesTabCashier').classList.contains('active')) {
                displayEmployees('employeesTableBodyCashier');
            }
            updateAccountantDashboard();
        } else {
            showMessage('فشل تعديل الموظف.', 'error');
        }
    } catch (error) {
        console.error('Error updating employee:', error);
        showMessage('حدث خطأ أثناء تعديل الموظف.', 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteEmployee(employeeId, employeeName) {
    if (!confirm(`هل أنت متأكد من حذف الموظف "${employeeName}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) {
        return;
    }

    showLoading(true);
    try {
        const rowIndex = await findRowIndex(SHEETS.EMPLOYEES, 0, employeeId);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على الموظف لحذفه.', 'error');
            return;
        }

        // التحقق مما إذا كان الموظف لديه سلف مستحقة
        const employee = employees.find(e => e.id === employeeId);
        if (employee && employee.totalAdvance > 0) {
            showMessage('لا يمكن حذف الموظف لديه سلف مستحقة. يرجى تسوية السلف أولاً.', 'error');
            return;
        }

        const result = await deleteSheetRow(SHEETS.EMPLOYEES, rowIndex);

        if (result.success) {
            showMessage('تم حذف الموظف بنجاح.', 'success');
            await loadEmployees();
            displayEmployees('employeesTableBodyAccountant');
            // تحديث عرض الموظفين في الكاشير إذا كان مفتوحًا
            if (document.getElementById('employeesTabCashier').classList.contains('active')) {
                displayEmployees('employeesTableBodyCashier');
            }
            updateAccountantDashboard();
        } else {
            showMessage('فشل حذف الموظف.', 'error');
        }
    } catch (error) {
        console.error('Error deleting employee:', error);
        showMessage('حدث خطأ أثناء حذف الموظف.', 'error');
    } finally {
        showLoading(false);
    }
}

// --- Shift Management ---
async function calculateCashierShift() {
    const dateFrom = document.getElementById('shiftDateFromCashier')?.value;
    const dateTo = document.getElementById('shiftDateToCashier')?.value;
    const timeFrom = document.getElementById('shiftTimeFromCashier')?.value;
    const timeTo = document.getElementById('shiftTimeToCashier')?.value;

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
            normal: [],
            insta: [],
            visa: [],
            online: [],
            returns: []
        };

        expenses.forEach(exp => {
            const category = categories.find(cat => cat.name === exp.category || cat.code === exp.categoryCode);
            const formType = category ? category.formType : 'عادي';

            if (formType === 'إنستا') {
                categorizedExpenses.insta.push(exp);
            } else if (formType === 'فيزا') {
                categorizedExpenses.visa.push(exp);
            } else if (formType === 'اونلاين') {
                categorizedExpenses.online.push(exp);
            } else if (formType === 'مرتجع') {
                categorizedExpenses.returns.push(exp);
            } else {
                categorizedExpenses.normal.push(exp);
            }
        });

        const totalExpenses = categorizedExpenses.normal.reduce((sum, exp) => sum + exp.amount, 0);
        const expenseCount = categorizedExpenses.normal.length;
        const totalInsta = categorizedExpenses.insta.reduce((sum, exp) => sum + exp.amount, 0);
        const instaCount = categorizedExpenses.insta.length;
        const totalVisa = categorizedExpenses.visa.reduce((sum, exp) => sum + exp.amount, 0);
        const visaCount = categorizedExpenses.visa.length;
        const totalOnline = categorizedExpenses.online.reduce((sum, exp) => sum + exp.amount, 0);
        const onlineCount = categorizedExpenses.online.length;
        const totalReturns = categorizedExpenses.returns.reduce((sum, exp) => sum + exp.amount, 0);
        const returnsCount = categorizedExpenses.returns.length;

        // الإجمالي الكلي للمقارنة مع نيو مايند (لا يشمل الكاش في الدرج هنا، سيتم إضافته لاحقًا)
        const grandTotalTransactions = totalExpenses + totalInsta + totalVisa + totalOnline;

        // تحديث واجهة المستخدم
        document.getElementById('totalExpensesCashier').textContent = totalExpenses.toFixed(2);
        document.getElementById('expenseCountCashier').textContent = expenseCount;
        document.getElementById('totalInstaCashier').textContent = totalInsta.toFixed(2);
        document.getElementById('instaCountCashier').textContent = instaCount;
        document.getElementById('totalVisaCashier').textContent = totalVisa.toFixed(2);
        document.getElementById('visaCountCashier').textContent = visaCount;
        document.getElementById('totalOnlineCashier').textContent = totalOnline.toFixed(2);
        document.getElementById('onlineCountCashier').textContent = onlineCount;
        document.getElementById('grandTotalCashier').textContent = grandTotalTransactions.toFixed(2); // هذا هو إجمالي المعاملات فقط

        // تحديث بيانات المرتجعات
        document.getElementById('totalReturnsCashier').textContent = totalReturns.toFixed(2);
        document.getElementById('returnsCountCashier').textContent = returnsCount;

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
    const drawerCashInput = document.getElementById('drawerCashCashier');
    const drawerCash = drawerCashInput ? parseFloat(drawerCashInput.value) : NaN;

    if (isNaN(drawerCash) || drawerCash < 0) {
        showMessage('يرجى إدخال قيمة صحيحة للنقدية في الدرج.', 'warning');
        return;
    }

    showLoading(true);

    try {
        const now = new Date();
        const shiftId = 'SHIFT_' + now.getTime();

        const totalExpenses = parseFloat(document.getElementById('totalExpensesCashier')?.textContent) || 0;
        const expenseCount = parseInt(document.getElementById('expenseCountCashier')?.textContent) || 0;
        const totalInsta = parseFloat(document.getElementById('totalInstaCashier')?.textContent) || 0;
        const instaCount = parseInt(document.getElementById('instaCountCashier')?.textContent) || 0;
        const totalVisa = parseFloat(document.getElementById('totalVisaCashier')?.textContent) || 0;
        const visaCount = parseInt(document.getElementById('visaCountCashier')?.textContent) || 0;
        const totalOnline = parseFloat(document.getElementById('totalOnlineCashier')?.textContent) || 0;
        const onlineCount = parseInt(document.getElementById('onlineCountCashier')?.textContent) || 0;
        const totalReturns = parseFloat(document.getElementById('totalReturnsCashier')?.textContent) || 0;
        const returnsCount = parseInt(document.getElementById('returnsCountCashier')?.textContent) || 0;
        
        // grandTotal for cashier closure should include drawerCash and all transactions *excluding* returns
        const grandTotalTransactions = totalExpenses + totalInsta + totalVisa + totalOnline;
        const grandTotalWithDrawerCash = grandTotalTransactions + drawerCash; // هذا هو الإجمالي الذي سجله الكاشير

        // الإجمالي بعد خصم المرتجعات (للحفظ في الشيت، هذا هو ما سيقارنه المحاسب مع نيو مايند)
        const grandTotalAfterReturns = grandTotalWithDrawerCash - totalReturns;

        const shiftClosureData = [
            shiftId,
            currentUser.username,
            document.getElementById('shiftDateFromCashier')?.value,
            document.getElementById('shiftTimeFromCashier')?.value,
            document.getElementById('shiftDateToCashier')?.value,
            document.getElementById('shiftTimeToCashier')?.value,
            totalExpenses.toFixed(2),
            expenseCount,
            totalInsta.toFixed(2),
            instaCount,
            totalVisa.toFixed(2),
            visaCount,
            totalOnline.toFixed(2),
            onlineCount,
            grandTotalWithDrawerCash.toFixed(2), // grandTotal for closure (includes drawer cash, excludes returns)
            drawerCash.toFixed(2),
            0, // newMindTotal (not used for cashier self-closure)
            0, // difference (not calculated for cashier)
            'مغلق', // status
            now.toISOString().split('T')[0],
            now.toTimeString().split(' ')[0],
            '', // accountant (empty for self-closure)
            totalReturns.toFixed(2),
            grandTotalAfterReturns.toFixed(2) // الإجمالي بعد خصم المرتجعات
        ];

        const result = await appendToSheet(SHEETS.SHIFT_CLOSURES, shiftClosureData);

        if (result.success) {
            showMessage('تم تقفيل الشيفت بنجاح.', 'success');
            // إعادة تعيين الواجهة بعد التقفيل
            document.getElementById('shiftSummaryCashier').style.display = 'none';
            drawerCashInput.value = '';
            setDefaultDatesAndTimes(); // إعادة تعيين التواريخ والأوقات
            await loadCashierPreviousClosures(); // تحديث سجل التقفيلات للكاشير
            await loadCashierExpenses(); // تحديث جدول المصروفات
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

// --- Cashier Previous Closures ---
async function loadCashierPreviousClosures() {
    const cashierPreviousClosuresDiv = document.getElementById('cashierPreviousClosures');
    const tableBody = document.getElementById('cashierClosuresHistoryBody');
    if (!tableBody || !cashierPreviousClosuresDiv) return;

    showLoading(true);
    try {
        const closures = await loadShiftClosures({ cashier: currentUser.username });
        tableBody.innerHTML = '';

        if (closures.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7">لا توجد تقفيلات سابقة لهذا الكاشير.</td></tr>';
            cashierPreviousClosuresDiv.style.display = 'none';
            return;
        }

        closures.sort((a, b) => new Date(`${b.closureDate}T${b.closureTime}`) - new Date(`${a.closureDate}T${a.closureTime}`));

        closures.forEach(closure => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = `${closure.dateFrom} ${closure.timeFrom} - ${closure.dateTo} ${closure.timeTo}`;
            
            // إجمالي الكاشير يجب أن يشمل الكاش في الدرج
            // closure.grandTotal هو الإجمالي الذي سجله الكاشير (يشمل الكاش في الدرج ويستثني المرتجعات)
            row.insertCell().textContent = closure.grandTotal.toFixed(2);

            row.insertCell().textContent = closure.newMindTotal > 0 ? closure.newMindTotal.toFixed(2) : '--';

            const differenceCell = row.insertCell();
            const diffValue = closure.difference;
            differenceCell.textContent = diffValue.toFixed(2);
            if (diffValue < 0) {
                differenceCell.style.color = 'green';
                differenceCell.title = 'زيادة عند الكاشير';
            } else if (diffValue > 0) {
                differenceCell.style.color = 'red';
                differenceCell.title = 'عجز على الكاشير';
            } else {
                differenceCell.style.color = 'blue';
                differenceCell.title = 'مطابق';
            }

            const statusCell = row.insertCell();
            statusCell.innerHTML = `<span class="status ${closure.status === 'مغلق' || closure.status === 'مغلق بواسطة المحاسب' ? 'closed' : 'open'}">${closure.status}</span>`;

            row.insertCell().textContent = `${closure.closureDate} ${closure.closureTime.substring(0, 5)}`;

            const actionsCell = row.insertCell();
            actionsCell.innerHTML = `
                <button class="view-btn" onclick="viewClosureDetails('${closure.id}')">
                    <i class="fas fa-eye"></i> عرض
                </button>
            `;
        });
        cashierPreviousClosuresDiv.style.display = 'block';
    } catch (error) {
        console.error('Error loading cashier previous closures:', error);
        showMessage('حدث خطأ أثناء تحميل تقفيلاتك السابقة.', 'error');
    } finally {
        showLoading(false);
    }
}


// --- Accountant Page Functions ---
async function showAccountantPage() {
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('accountantPage').classList.remove('active');
    document.getElementById('accountantPage').classList.add('active');
    const accountantNameDisplay = document.getElementById('accountantNameDisplay');
    if (accountantNameDisplay) accountantNameDisplay.textContent = currentUserName;
    const currentDateAccountant = document.getElementById('currentDateAccountant');
    if (currentDateAccountant) currentDateAccountant.textContent = new Date().toLocaleDateString('ar-EG');

    // لا داعي لإعادة تحميل البيانات هنا، showTab ستفعل ذلك
    // await loadUsers();
    // await loadCategories();
    // await loadCustomers();
    // populateAccountantFilters();
    // await updateAccountantDashboard();
    showTab('dashboardTabAccountant'); // ستقوم showTab بتحميل البيانات اللازمة
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
        let returnExpenses = [];

        allExpenses.forEach(expense => {
            const category = categories.find(cat => cat.name === expense.category || cat.code === expense.categoryCode);
            const formType = category ? category.formType : 'عادي';

            if (formType === 'فيزا') {
                visaExpenses.push(expense);
            } else if (formType === 'إنستا') {
                instaExpenses.push(expense);
            } else if (formType === 'اونلاين') {
                onlineExpenses.push(expense);
            } else if (formType === 'مرتجع') {
                returnExpenses.push(expense);
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
        const totalReturns = returnExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const returnsCount = returnExpenses.length;

        // Update stats grid
        document.getElementById('totalNormalExpensesAccountant').textContent = totalNormal.toFixed(2);
        document.getElementById('countNormalExpensesAccountant').textContent = normalCount;

        document.getElementById('totalVisaAccountant').textContent = totalVisa.toFixed(2);
        document.getElementById('countVisaAccountant').textContent = visaCount;

        document.getElementById('totalInstaAccountant').textContent = totalInsta.toFixed(2);
        document.getElementById('instaCountAccountant').textContent = instaCount;

        document.getElementById('totalOnlineAccountant').textContent = totalOnline.toFixed(2);
        document.getElementById('countOnlineAccountant').textContent = onlineCount;
        
        document.getElementById('totalReturnsAccountant').textContent = totalReturns.toFixed(2);
        document.getElementById('countReturnsAccountant').textContent = returnsCount;

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

        // Employees stats (New)
        const totalEmployees = employees.length;
        const employeesWithAdvance = employees.filter(e => e.totalAdvance > 0).length;
        const totalAdvance = employees.reduce((sum, e) => sum + e.totalAdvance, 0);
        const zeroAdvanceEmployees = employees.filter(e => e.totalAdvance === 0).length;

        document.getElementById('totalEmployeesAccountant').textContent = totalEmployees;
        document.getElementById('employeesWithAdvanceAccountant').textContent = employeesWithAdvance;
        document.getElementById('totalAdvanceAmountAccountant').textContent = totalAdvance.toFixed(2);
        document.getElementById('employeesWithZeroAdvanceAccountant').textContent = zeroAdvanceEmployees;

        // Update cashier overview table
        await updateAccountantCashierOverview(filters);
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
        let returnExpenses = [];

        expenses.forEach(expense => {
            const category = categories.find(cat => cat.name === expense.category || cat.code === expense.categoryCode);
            const formType = category ? category.formType : 'عادي';

            if (formType === 'فيزا') {
                visaExpenses.push(expense);
            } else if (formType === 'إنستا') {
                instaExpenses.push(expense);
            } else if (formType === 'اونلاين') {
                onlineExpenses.push(expense);
            } else if (formType === 'مرتجع') {
                returnExpenses.push(expense);
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
        const totalReturns = returnExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const returnsCount = returnExpenses.length;

        // Get last activity date
        const lastActivity = expenses.length > 0 ?
            new Date(Math.max(...expenses.map(exp => new Date(`${exp.date}T${exp.time}`)))) :
            null;
        const lastActivityStr = lastActivity ?
            lastActivity.toLocaleDateString('ar-EG') :
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
        row.insertCell().textContent = totalReturns.toFixed(2);
        row.insertCell().textContent = returnsCount;
        row.insertCell().textContent = lastActivityStr;

        const statusCell = row.insertCell();
        statusCell.innerHTML = `<span class="status ${cashier.status === 'نشط' ? 'active' : 'inactive'}">${cashier.status}</span>`;
    }

    if (tableBody.rows.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="13">لا توجد بيانات للكاشيرز.</td></tr>';
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
                        <th>الإجراءات</th>
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
                    <td>${exp.time.substring(0, 5)}</td>
                    <td>${users.find(u => u.username === exp.cashier)?.name || exp.cashier}</td>
                    <td>${exp.notes || '--'}</td>
                    <td>
                        <button class="edit-btn" onclick="showEditExpenseModal('${exp.id}')"><i class="fas fa-edit"></i> تعديل</button>
                        <button class="delete-btn" onclick="deleteExpense('${exp.id}', '${exp.category}', ${exp.amount}, '${exp.invoiceNumber}')"><i class="fas fa-trash"></i> حذف</button>
                    </td>
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
        // تحميل جميع التقفيلات لتجميع الكاش في الدرج
        const allClosures = await loadShiftClosures({}); 
        const reportContent = document.getElementById('reportContentAccountant');
        if (!reportContent) return;

        reportContent.innerHTML = '';

        if (expenses.length === 0 && allClosures.length === 0) {
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
                    online: [],
                    returns: []
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
            } else if (formType === 'مرتجع') {
                expensesByCashier[exp.cashier].returns.push(exp);
            } else {
                expensesByCashier[exp.cashier].normal.push(exp);
            }
        });

        // Group drawer cash by cashier and date for the specified period
        const drawerCashByCashierAndDate = {};
        const fromDateObj = dateFrom ? new Date(dateFrom) : null;
        const toDateObj = dateTo ? new Date(dateTo) : null;
        if (toDateObj) toDateObj.setHours(23, 59, 59, 999); // Include the whole end day

        allClosures.forEach(closure => {
            const closureDate = new Date(closure.closureDate);
            if (fromDateObj && closureDate < fromDateObj) return;
            if (toDateObj && closureDate > toDateObj) return;
            if (cashierFilter && closure.cashier !== cashierFilter) return; // Apply cashier filter

            if (!drawerCashByCashierAndDate[closure.cashier]) {
                drawerCashByCashierAndDate[closure.cashier] = {};
            }
            const dateKey = closure.closureDate; // Use closureDate for grouping
            if (!drawerCashByCashierAndDate[closure.cashier][dateKey]) {
                drawerCashByCashierAndDate[closure.cashier][dateKey] = [];
            }
            drawerCashByCashierAndDate[closure.cashier][dateKey].push(parseFloat(closure.drawerCash) || 0);
        });


        let reportHtml = `
            <div class="report-header">
                <h3>تقرير المصروفات</h3>
                <p>من ${dateFrom || 'البداية'} إلى ${dateTo || 'النهاية'}</p>
                ${cashierFilter ? `<p>الكاشير: ${users.find(u => u.username === cashierFilter)?.name || cashierFilter}</p>` : ''}
                ${categoryFilter ? `<p>التصنيف: ${categoryFilter}</p>` : ''}
            </div>
        `;

        let grandTotalNormal = 0;
        let grandTotalVisa = 0;
        let grandTotalInsta = 0;
        let grandTotalOnline = 0;
        let grandTotalReturns = 0;
        let grandTotalDrawerCash = 0;

        const allCashiersInReport = new Set([...Object.keys(expensesByCashier), ...Object.keys(drawerCashByCashierAndDate)]);

        allCashiersInReport.forEach(cashierUsername => {
            const cashierData = expensesByCashier[cashierUsername] || { normal: [], visa: [], insta: [], online: [], returns: [] };
            const cashierUser = users.find(u => u.username === cashierUsername);
            const displayName = cashierUser ? cashierUser.name : cashierUsername;

            const totalNormal = cashierData.normal.reduce((sum, exp) => sum + exp.amount, 0);
            const totalVisa = cashierData.visa.reduce((sum, exp) => sum + exp.amount, 0);
            const totalInsta = cashierData.insta.reduce((sum, exp) => sum + exp.amount, 0);
            const totalOnline = cashierData.online.reduce((sum, exp) => sum + exp.amount, 0);
            const totalReturns = cashierData.returns.reduce((sum, exp) => sum + exp.amount, 0);

            grandTotalNormal += totalNormal;
            grandTotalVisa += totalVisa;
            grandTotalInsta += totalInsta;
            grandTotalOnline += totalOnline;
            grandTotalReturns += totalReturns;

            reportHtml += `
                <div class="cashier-section">
                    <h4>${displayName}</h4>
                    <div class="stats-summary">
                        <p>إجمالي المصروفات العادية: ${totalNormal.toFixed(2)} (${cashierData.normal.length} فاتورة)</p>
                        <p>إجمالي الفيزا: ${totalVisa.toFixed(2)} (${cashierData.visa.length} فاتورة)</p>
                        <p>إجمالي الإنستا: ${totalInsta.toFixed(2)} (${cashierData.insta.length} فاتورة)</p>
                        <p>إجمالي الأونلاين: ${totalOnline.toFixed(2)} (${cashierData.online.length} فاتورة)</p>
                        <p>إجمالي المرتجعات: ${totalReturns.toFixed(2)} (${cashierData.returns.length} فاتورة)</p>
                        <p><strong>الإجمالي الكلي (بدون الكاش في الدرج والمرتجعات): ${(totalNormal + totalVisa + totalInsta + totalOnline).toFixed(2)}</strong></p>
                    </div>
            `;

            // تفاصيل الكاش في الدرج لكل يوم
            if (drawerCashByCashierAndDate[cashierUsername]) {
                reportHtml += `
                    <h5>تفاصيل الكاش في الدرج:</h5>
                    <ul>
                `;
                let dailyDrawerCashTotal = 0;
                // Sort dates for consistent display
                Object.keys(drawerCashByCashierAndDate[cashierUsername]).sort().forEach(date => {
                    const dailyCashValues = drawerCashByCashierAndDate[cashierUsername][date];
                    const sumDailyCash = dailyCashValues.reduce((sum, val) => sum + parseFloat(val), 0);
                    dailyDrawerCashTotal += sumDailyCash;
                    reportHtml += `<li>${date}: ${sumDailyCash.toFixed(2)} (${dailyCashValues.length} إدخال)</li>`;
                });
                reportHtml += `
                    </ul>
                    <p><strong>إجمالي الكاش في الدرج للفترة: ${dailyDrawerCashTotal.toFixed(2)}</strong></p>
                `;
                grandTotalDrawerCash += dailyDrawerCashTotal;
            }


            if (cashierFilter === cashierUsername || !cashierFilter) {
                const allCashierExpenses = [...cashierData.normal, ...cashierData.visa, ...cashierData.insta, ...cashierData.online, ...cashierData.returns];
                allCashierExpenses.sort((a, b) => new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`));

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
                                    <th>الإجراءات</th>
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
                                <td>${exp.time.substring(0, 5)}</td>
                                <td>${exp.notes || '--'}</td>
                                <td>
                                    <button class="edit-btn" onclick="showEditExpenseModal('${exp.id}')"><i class="fas fa-edit"></i> تعديل</button>
                                    <button class="delete-btn" onclick="deleteExpense('${exp.id}', '${exp.category}', ${exp.amount}, '${exp.invoiceNumber}')"><i class="fas fa-trash"></i> حذف</button>
                                </td>
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
                <p>إجمالي المرتجعات: ${grandTotalReturns.toFixed(2)}</p>
                <p><strong>إجمالي الكاش في الدرج: ${grandTotalDrawerCash.toFixed(2)}</strong></p>
                <p><strong>الإجمالي الكلي الصافي (المصروفات + الكاش في الدرج - المرتجعات): ${(grandTotalNormal + grandTotalVisa + grandTotalInsta + grandTotalOnline + grandTotalDrawerCash - grandTotalReturns).toFixed(2)}</strong></p>
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
                <link rel="stylesheet" href="styles.css"> <!-- Link to your existing styles -->
                <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap" rel="stylesheet">
                <style>
                    /* Print specific styles */
                    body { font-family: 'Tajawal', sans-serif; direction: rtl; text-align: right; }
                    .report-header, .cashier-section, .report-footer { margin-bottom: 20px; border: 1px solid #eee; padding: 15px; border-radius: 8px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                    th { background-color: #f2f2f2; }
                    .edit-btn, .delete-btn { display: none; /* Hide buttons in print */ }
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
        const whatsappNumber = document.getElementById('whatsappNumber');
        if (whatsappNumber) whatsappNumber.value = '';
    }
}

function sendReportViaWhatsApp() {
    const phoneNumber = document.getElementById('whatsappNumber')?.value.trim();
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
    const encodedText = encodeURIComponent(`تقرير المصروفات\n\n${reportText.substring(0, 1000)}...`); // اقتطاع النص الطويل
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

    users.sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate));

    users.forEach(user => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = user.name;
        row.insertCell().textContent = user.phone;
        row.insertCell().textContent = user.username;
        row.insertCell().textContent = user.role;

        const statusCell = row.insertCell();
        statusCell.innerHTML = `<span class="status ${user.status === 'نشط' ? 'active' : user.status === 'موقوف' ? 'suspended' : 'blocked'}">${user.status}</span>`;

        row.insertCell().textContent = user.creationDate;

        const actionsCell = row.insertCell();
        actionsCell.innerHTML = `
            <button class="edit-btn" onclick="showEditUserModal('${user.id}')"><i class="fas fa-edit"></i> تعديل</button>
            <button class="delete-btn" onclick="deleteUser('${user.id}', '${user.name}')"><i class="fas fa-trash"></i> حذف</button>
            <button class="block-btn" onclick="showChangePasswordModal('${user.id}')"><i class="fas fa-key"></i> كلمة المرور</button>
            <button class="status-btn" onclick="toggleUserStatus('${user.id}', '${user.status}')"><i class="fas fa-toggle-${user.status === 'نشط' ? 'on' : 'off'}"></i> ${user.status === 'نشط' ? 'إيقاف' : 'تنشيط'}</button>
        `;
    });
}

function showAddUserModal() {
    const form = document.getElementById('addUserForm');
    if (form) {
        form.reset();
        document.getElementById('addUserModalTitle').textContent = 'إضافة مستخدم جديد';
        document.getElementById('addUserModalSaveBtn').onclick = addUser;
        currentEditUserId = null; // مسح أي ID لمستخدم سابق
    }

    const modal = document.getElementById('addUserModal');
    if (modal) modal.classList.add('active');
}

async function showEditUserModal(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) {
        showMessage('المستخدم غير موجود.', 'error');
        return;
    }

    document.getElementById('userName').value = user.name;
    document.getElementById('userPhone').value = user.phone;
    document.getElementById('userUsername').value = user.username;
    document.getElementById('userPassword').value = user.password; // يجب أن تكون كلمة المرور مشفرة في بيئة إنتاج
    document.getElementById('userRole').value = user.role;

    document.getElementById('addUserModalTitle').textContent = 'تعديل مستخدم';
    document.getElementById('addUserModalSaveBtn').onclick = updateUser;
    currentEditUserId = userId;

    const modal = document.getElementById('addUserModal');
    if (modal) {
        modal.classList.add('active');
    }
}

async function addUser() {
    const name = document.getElementById('userName')?.value.trim();
    const phone = document.getElementById('userPhone')?.value.trim();
    const username = document.getElementById('userUsername')?.value.trim();
    const password = document.getElementById('userPassword')?.value.trim();
    const role = document.getElementById('userRole')?.value;

    if (!name || !phone || !username || !password || !role) {
        showMessage('يرجى ملء جميع حقول المستخدم.', 'warning');
        return;
    }

    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
        showMessage('اسم المستخدم موجود بالفعل. يرجى استخدام اسم مستخدم فريد.', 'warning');
        return;
    }

    const existingPhone = users.find(u => u.phone === phone);
    if (existingPhone) {
        showMessage('رقم التليفون موجود بالفعل لمستخدم آخر. يرجى استخدام رقم فريد.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const userId = 'USER_' + new Date().getTime();
        const newUserData = [
            userId,
            name,
            phone,
            username,
            password, // في بيئة إنتاج، يجب تشفير كلمة المرور
            role,
            'نشط',
            new Date().toISOString().split('T')[0]
        ];

        const result = await appendToSheet(SHEETS.USERS, newUserData);

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
    } catch (error) {
        console.error('Error adding user:', error);
        showMessage('حدث خطأ أثناء إضافة المستخدم.', 'error');
    } finally {
        showLoading(false);
    }
}

async function updateUser() {
    if (!currentEditUserId) {
        showMessage('لا يوجد مستخدم محدد للتعديل.', 'error');
        return;
    }

    const name = document.getElementById('userName')?.value.trim();
    const phone = document.getElementById('userPhone')?.value.trim();
    const username = document.getElementById('userUsername')?.value.trim();
    const password = document.getElementById('userPassword')?.value.trim();
    const role = document.getElementById('userRole')?.value;

    if (!name || !phone || !username || !password || !role) {
        showMessage('يرجى ملء جميع حقول المستخدم.', 'warning');
        return;
    }

    const existingUser = users.find(u => u.username === username && u.id !== currentEditUserId);
    if (existingUser) {
        showMessage('اسم المستخدم موجود بالفعل لمستخدم آخر. يرجى استخدام اسم مستخدم فريد.', 'warning');
        return;
    }

    const existingPhone = users.find(u => u.phone === phone && u.id !== currentEditUserId);
    if (existingPhone) {
        showMessage('رقم التليفون موجود بالفعل لمستخدم آخر. يرجى استخدام رقم فريد.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const rowIndex = await findRowIndex(SHEETS.USERS, 0, currentEditUserId);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على المستخدم لتحديثه.', 'error');
            return;
        }

        const oldUser = users.find(u => u.id === currentEditUserId);
        const updatedUserData = [
            currentEditUserId,
            name,
            phone,
            username,
            password, // في بيئة إنتاج، يجب تشفير كلمة المرور
            role,
            oldUser.status, // الحفاظ على الحالة الأصلية
            oldUser.creationDate // الحفاظ على تاريخ الإنشاء الأصلي
        ];

        const result = await updateSheet(SHEETS.USERS, `A${rowIndex}:H${rowIndex}`, [updatedUserData]);

        if (result.success) {
            showMessage('تم تعديل المستخدم بنجاح.', 'success');
            closeModal('addUserModal');
            await loadUsers();
            displayUsers();
            populateUserDropdown();
            populateAccountantFilters();
        } else {
            showMessage('فشل تعديل المستخدم.', 'error');
        }
    } catch (error) {
        console.error('Error updating user:', error);
        showMessage('حدث خطأ أثناء تعديل المستخدم.', 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteUser(userId, userName) {
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${userName}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) {
        return;
    }

    showLoading(true);
    try {
        const rowIndex = await findRowIndex(SHEETS.USERS, 0, userId);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على المستخدم لحذفه.', 'error');
            return;
        }

        const result = await deleteSheetRow(SHEETS.USERS, rowIndex);

        if (result.success) {
            showMessage('تم حذف المستخدم بنجاح.', 'success');
            await loadUsers();
            displayUsers();
            populateUserDropdown();
            populateAccountantFilters();
        } else {
            showMessage('فشل حذف المستخدم.', 'error');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showMessage('حدث خطأ أثناء حذف المستخدم.', 'error');
    } finally {
        showLoading(false);
    }
}

async function toggleUserStatus(userId, currentStatus) {
    const newStatus = currentStatus === 'نشط' ? 'موقوف' : 'نشط';
    if (!confirm(`هل أنت متأكد من تغيير حالة المستخدم إلى "${newStatus}"؟`)) {
        return;
    }

    showLoading(true);
    try {
        const rowIndex = await findRowIndex(SHEETS.USERS, 0, userId);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على المستخدم لتغيير حالته.', 'error');
            return;
        }

        const user = users.find(u => u.id === userId);
        const updatedUserData = [
            user.id, user.name, user.phone, user.username, user.password, user.role, newStatus, user.creationDate
        ];

        const result = await updateSheet(SHEETS.USERS, `A${rowIndex}:H${rowIndex}`, [updatedUserData]);

        if (result.success) {
            showMessage(`تم تغيير حالة المستخدم إلى "${newStatus}" بنجاح.`, 'success');
            await loadUsers();
            displayUsers();
            populateUserDropdown();
            populateAccountantFilters();
        } else {
            showMessage('فشل تغيير حالة المستخدم.', 'error');
        }
    } catch (error) {
        console.error('Error toggling user status:', error);
        showMessage('حدث خطأ أثناء تغيير حالة المستخدم.', 'error');
    } finally {
        showLoading(false);
    }
}

function showChangePasswordModal(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) {
        showMessage('المستخدم غير موجود.', 'error');
        return;
    }

    document.getElementById('changePasswordModalUserName').textContent = user.name;
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmNewPassword').value = '';
    document.getElementById('changePasswordModalSaveBtn').onclick = () => changeUserPassword(userId);

    const modal = document.getElementById('changePasswordModal');
    if (modal) modal.classList.add('active');
}

async function changeUserPassword(userId) {
    const newPassword = document.getElementById('newPassword')?.value.trim();
    const confirmNewPassword = document.getElementById('confirmNewPassword')?.value.trim();

    if (!newPassword || !confirmNewPassword) {
        showMessage('يرجى إدخال كلمة المرور الجديدة وتأكيدها.', 'warning');
        return;
    }

    if (newPassword !== confirmNewPassword) {
        showMessage('كلمة المرور الجديدة وتأكيدها غير متطابقين.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const rowIndex = await findRowIndex(SHEETS.USERS, 0, userId);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على المستخدم لتغيير كلمة مروره.', 'error');
            return;
        }

        const user = users.find(u => u.id === userId);
        const updatedUserData = [
            user.id, user.name, user.phone, user.username, newPassword, user.role, user.status, user.creationDate
        ];

        const result = await updateSheet(SHEETS.USERS, `A${rowIndex}:H${rowIndex}`, [updatedUserData]);

        if (result.success) {
            showMessage('تم تغيير كلمة المرور بنجاح.', 'success');
            closeModal('changePasswordModal');
            await loadUsers(); // تحديث قائمة المستخدمين
            displayUsers(); // إعادة عرض المستخدمين
        } else {
            showMessage('فشل تغيير كلمة المرور.', 'error');
        }
    } catch (error) {
        console.error('Error changing user password:', error);
        showMessage('حدث خطأ أثناء تغيير كلمة المرور.', 'error');
    } finally {
        showLoading(false);
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
    const closeCashierBtn = document.querySelector('#shiftCloseTabAccountant .close-cashier-btn');
    if (closeCashierBtn) {
        closeCashierBtn.style.display = 'none';
    }

    // Reset the return deduction switch
    const deductReturnsSwitch = document.getElementById('deductReturnsAccountant');
    if (deductReturnsSwitch) {
        deductReturnsSwitch.checked = false;
    }
    // Hide the container for grand total after returns
    const grandTotalAfterReturnsContainer = document.getElementById('accGrandTotalAfterReturnsContainer');
    if (grandTotalAfterReturnsContainer) {
        grandTotalAfterReturnsContainer.style.display = 'none';
    }
    // Reset strikethrough for original grand total
    const accGrandTotalCashier = document.getElementById('accGrandTotalCashier');
    if (accGrandTotalCashier) {
        accGrandTotalCashier.style.textDecoration = 'none';
        accGrandTotalCashier.style.color = '#2c3e50';
    }
}

// --- حساب الفرق للمحاسب ---
function calculateDifferenceAccountant() {
    if (!window.currentClosureData) {
        showMessage('يرجى البحث عن بيانات الكاشير أولاً.', 'warning');
        return;
    }

    const newMindTotalInput = document.getElementById('newmindTotalAccountant');
    const newMindTotal = newMindTotalInput ? parseFloat(newMindTotalInput.value) : NaN;
    if (isNaN(newMindTotal) || newMindTotal < 0) {
        // لا نعرض رسالة خطأ هنا، فقط نمنع الحساب إذا كانت القيمة غير صالحة
        // ونترك زر الحفظ معطلاً
        const differenceResult = document.getElementById('differenceResultAccountant');
        if (differenceResult) differenceResult.style.display = 'none';
        const closeCashierBtn = document.querySelector('#shiftCloseTabAccountant .close-cashier-btn');
        if (closeCashierBtn) closeCashierBtn.style.display = 'none';
        return;
    }

    const addReturns = document.getElementById('deductReturnsAccountant')?.checked || false;
    // window.currentClosureData.grandTotal هو الإجمالي الذي سجله الكاشير (يشمل الكاش في الدرج ويستثني المرتجعات)
    let cashierTotalForComparison = window.currentClosureData.grandTotal; 
    let grandTotalAfterReturnsDisplayValue = cashierTotalForComparison; // القيمة التي ستعرض في "الإجمالي الكلي للكاشير بعد إضافة المرتجع"

    if (addReturns) {
        // إذا تم تحديد إضافة المرتجعات، نضيف قيمة المرتجعات إلى الإجمالي للمقارنة
        cashierTotalForComparison = cashierTotalForComparison + window.currentClosureData.totalReturns;
        grandTotalAfterReturnsDisplayValue = cashierTotalForComparison;
    }

    const difference = newMindTotal - cashierTotalForComparison; // نيو مايند - إجمالي الكاشير بعد إضافة المرتجع

    const differenceResult = document.getElementById('differenceResultAccountant');
    if (!differenceResult) return;

    let statusText = '';
    let statusClass = '';
    
    if (difference === 0) {
        statusText = 'مطابق ✓';
        statusClass = 'status-match';
    } else if (difference < 0) {
        statusText = `زيادة عند الكاشير: ${Math.abs(difference).toFixed(2)}`;
        statusClass = 'status-surplus';
    } else {
        statusText = `عجز على الكاشير: -${difference.toFixed(2)}`;
        statusClass = 'status-deficit';
    }

    differenceResult.innerHTML = `
        <div class="difference-card ${statusClass}">
            <h4>نتيجة المقارنة</h4>
            <p><strong>إجمالي الكاشير (شامل الكاش في الدرج، قبل إضافة المرتجع):</strong> ${window.currentClosureData.grandTotal.toFixed(2)}</p>
            ${addReturns ? `<p><strong>إجمالي المرتجعات المضافة:</strong> ${window.currentClosureData.totalReturns.toFixed(2)}</p>` : ''}
            <p><strong>الإجمالي الكلي للكاشير للمقارنة (بعد إضافة المرتجع إذا تم التحديد):</strong> ${grandTotalAfterReturnsDisplayValue.toFixed(2)}</p>
            <p><strong>إجمالي نيو مايند:</strong> ${newMindTotal.toFixed(2)}</p>
            <p><strong>الفرق:</strong> ${difference.toFixed(2)}</p>
            <p><strong>الحالة:</strong> ${statusText}</p>
        </div>
    `;

    differenceResult.style.display = 'block';
    const closeCashierBtn = document.querySelector('#shiftCloseTabAccountant .close-cashier-btn');
    if (closeCashierBtn) {
        closeCashierBtn.style.display = 'block';
    }

    // showMessage('تم حساب الفرق بنجاح.', 'success'); // لا داعي لرسالة هنا، العرض كافٍ
}

// دالة محسنة لتنظيف الوقت إلى HH:MM:SS
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

async function searchCashierClosuresAccountant() {
    const selectedCashier = document.getElementById('selectedCashierAccountant')?.value;
    const dateFrom = document.getElementById('accountantShiftDateFrom')?.value;
    const dateTo = document.getElementById('accountantShiftDateTo')?.value;
    const timeFrom = document.getElementById('accountantShiftTimeFrom')?.value;
    const timeTo = document.getElementById('accountantShiftTimeTo')?.value;

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
            timeFrom: formattedTimeFrom.substring(0, 5), // HH:MM
            timeTo: formattedTimeTo.substring(0, 5),
            cashier: selectedCashier
        });

        let normalExpenses = [];
        let visaExpenses = [];
        let instaExpenses = [];
        let onlineExpenses = [];
        let returnExpenses = [];

        expenses.forEach(exp => {
            const category = categories.find(cat => cat.name === exp.category || cat.code === exp.categoryCode);
            const formType = category ? category.formType : 'عادي';

            if (formType === 'فيزا') {
                visaExpenses.push(exp);
            } else if (formType === 'إنستا') {
                instaExpenses.push(exp);
            } else if (formType === 'اونلاين') {
                onlineExpenses.push(exp);
            } else if (formType === 'مرتجع') {
                returnExpenses.push(exp);
            } else {
                normalExpenses.push(exp);
            }
        });

        // --- MODIFIED LOGIC FOR DRAWER CASH ---
        let drawerCash = 0;
        let drawerCashCount = 0;
        let previousClosureMessage = '';

        const allClosures = await loadShiftClosures({});

        // 1. البحث عن الإغلاقات داخل الفترة
        const closuresInPeriod = allClosures.filter(closure => {
            if (!closure.dateTo || !closure.timeTo || closure.drawerCash === undefined) return false;

            const normalizedClosureTimeTo = normalizeTimeToHHMMSS(closure.timeTo);
            const closureEndDateTimeStr = `${closure.dateTo}T${normalizedClosureTimeTo}`;
            const closureEndDateTime = new Date(closureEndDateTimeStr);
            
            if (isNaN(closureEndDateTime.getTime())) {
                console.error(`وقت غير صالح للإغلاق ${closure.id}: ${closureEndDateTimeStr} (normalized: ${normalizedClosureTimeTo})`);
                return false;
            }

            return closure.cashier === selectedCashier && 
                   closureEndDateTime >= searchStartDateTime && 
                   closureEndDateTime <= searchEndDateTime;
        });

        if (closuresInPeriod.length > 0) {
            drawerCash = closuresInPeriod.reduce((sum, closure) => sum + (parseFloat(closure.drawerCash) || 0), 0);
            drawerCashCount = closuresInPeriod.length;
        } else {
            // إذا لم يتم العثور على إغلاقات داخل الفترة، ابحث عن آخر إغلاق قبل الفترة
            const previousClosures = allClosures.filter(closure => {
                if (!closure.dateTo || !closure.timeTo || closure.drawerCash === undefined) return false;

                const normalizedClosureTimeTo = normalizeTimeToHHMMSS(closure.timeTo);
                const closureEndDateTimeStr = `${closure.dateTo}T${normalizedClosureTimeTo}`;
                const closureEndDateTime = new Date(closureEndDateTimeStr);
                
                if (isNaN(closureEndDateTime.getTime())) {
                    console.error(`وقت غير صالح للإغلاق السابق ${closure.id}: ${closureEndDateTimeStr}`);
                    return false;
                }

                return closure.cashier === selectedCashier && closureEndDateTime < searchStartDateTime;
            });

            if (previousClosures.length > 0) {
                const latestPrevious = previousClosures.sort((a, b) => {
                    const timeA = normalizeTimeToHHMMSS(a.timeTo);
                    const timeB = normalizeTimeToHHMMSS(b.timeTo);
                    return new Date(`${b.dateTo}T${timeB}`) - new Date(`${a.dateTo}T${timeA}`);
                })[0];
                previousClosureMessage = `(يوجد إغلاق سابق في ${latestPrevious.closureDate} ${latestPrevious.closureTime.substring(0,5)} بقيمة ${parseFloat(latestPrevious.drawerCash).toFixed(2)}، لم يتم تضمينه في الحساب الحالي)`;
            }
            drawerCash = 0; // لا يتم تضمين الكاش في الدرج من إغلاق سابق في الحساب الحالي
            drawerCashCount = 0;
        }
        // --- END MODIFIED LOGIC ---

        const totalNormal = normalExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const normalCount = normalExpenses.length;
        const totalVisa = visaExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const visaCount = visaExpenses.length;
        const totalInsta = instaExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const instaCount = instaExpenses.length;
        const totalOnline = onlineExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const onlineCount = onlineExpenses.length;
        const totalReturns = returnExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const returnsCount = returnExpenses.length;
        
        // grandTotal for accountant should include all transactions *excluding* returns, plus drawer cash
        const grandTotal = totalNormal + totalVisa + totalInsta + totalOnline + drawerCash; 

        // عرض النتائج
        const closureResultsAccountant = document.getElementById('closureResultsAccountant');
        if (closureResultsAccountant) closureResultsAccountant.style.display = 'block';

        document.getElementById('accTotalNormalExpenses').innerHTML = `${totalNormal.toFixed(2)} (<span class="invoice-count">${normalCount} فاتورة</span>)`;
        document.getElementById('accTotalVisa').innerHTML = `${totalVisa.toFixed(2)} (<span class="invoice-count">${visaCount} فاتورة</span>)`;
        document.getElementById('accTotalInsta').innerHTML = `${totalInsta.toFixed(2)} (<span class="invoice-count">${instaCount} فاتورة</span>)`;
        document.getElementById('accTotalOnline').innerHTML = `${totalOnline.toFixed(2)} (<span class="invoice-count">${onlineCount} فاتورة</span>)`;
        document.getElementById('accTotalReturns').textContent = totalReturns.toFixed(2);
        document.getElementById('accReturnsCount').textContent = returnsCount;
        document.getElementById('accDrawerCash').innerHTML = `${drawerCash.toFixed(2)} (<span class="invoice-count">${drawerCashCount} إدخال</span>)`;
        document.getElementById('accGrandTotalCashier').textContent = grandTotal.toFixed(2);

        document.getElementById('newmindTotalAccountant').value = '';
        document.getElementById('differenceResultAccountant').style.display = 'none';
        document.querySelector('#shiftCloseTabAccountant .close-cashier-btn').style.display = 'none';

        // حفظ البيانات
        window.currentClosureData = {
            cashier: selectedCashier,
            dateFrom: dateFrom,
            timeFrom: formattedTimeFrom.substring(0, 5), // HH:MM
            dateTo: dateTo,
            timeTo: formattedTimeTo.substring(0, 5),
            totalNormal: totalNormal,
            normalCount: normalCount,
            totalVisa: totalVisa,
            visaCount: visaCount,
            totalInsta: totalInsta, // تم تصحيح الخطأ هنا
            instaCount: instaCount,
            totalOnline: totalOnline, // تم تصحيح الخطأ هنا
            onlineCount: onlineCount,
            totalReturns: totalReturns,
            returnsCount: returnsCount,
            drawerCash: drawerCash,
            drawerCashCount: drawerCashCount,
            grandTotal: grandTotal // هذا الإجمالي يشمل الكاش في الدرج ويستثني المرتجعات
        };

        updateAccountantClosureDisplay(); // تحديث العرض بعد تحميل البيانات

        const cashierUser  = users.find(u => u.username === selectedCashier);
        const cashierDisplayName = cashierUser  ? cashierUser .name : selectedCashier;
        let cashSource = '';
        if (closuresInPeriod.length > 0) {
            cashSource = ` (مجموع من ${closuresInPeriod.length} إغلاق داخل الفترة)`;
        } else if (previousClosureMessage) {
            cashSource = ` (لا توجد إغلاقات داخل الفترة. ${previousClosureMessage})`;
        } else {
            cashSource = ` (لا توجد إغلاقات سابقة)`;
        }
        showMessage(`تم البحث عن بيانات الكاشير ${cashierDisplayName} للفترة المحددة. إجمالي الكاش في الدرج: ${drawerCash.toFixed(2)}${cashSource}.`, 'success');
    } catch (error) {
        console.error('Error searching cashier closures:', error);
        showMessage(`حدث خطأ أثناء البحث عن بيانات الكاشير: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// دالة جديدة لتحديث عرض الإجمالي بعد خصم المرتجعات
function updateAccountantClosureDisplay() {
    if (!window.currentClosureData) return;

    const addReturns = document.getElementById('deductReturnsAccountant')?.checked || false;
    const grandTotalAfterReturnsContainer = document.getElementById('accGrandTotalAfterReturnsContainer');
    const grandTotalAfterReturnsDisplay = document.getElementById('accGrandTotalAfterReturns');
    const accGrandTotalCashier = document.getElementById('accGrandTotalCashier');

    let currentGrandTotal = window.currentClosureData.grandTotal; // هذا هو الإجمالي الذي سجله الكاشير (يشمل الكاش في الدرج ويستثني المرتجعات)
    const totalReturns = window.currentClosureData.totalReturns;
    let grandTotalForComparisonDisplay = currentGrandTotal; // القيمة التي ستعرض في "الإجمالي الكلي للكاشير بعد إضافة المرتجع"

    if (addReturns) {
        grandTotalForComparisonDisplay = currentGrandTotal + totalReturns;
        if (grandTotalAfterReturnsContainer) grandTotalAfterReturnsContainer.style.display = 'block';
        if (grandTotalAfterReturnsDisplay) grandTotalAfterReturnsDisplay.textContent = grandTotalForComparisonDisplay.toFixed(2);
        if (accGrandTotalCashier) {
            accGrandTotalCashier.style.textDecoration = 'line-through';
            accGrandTotalCashier.style.color = '#888';
        }
    } else {
        if (grandTotalAfterReturnsContainer) grandTotalAfterReturnsContainer.style.display = 'none';
        if (accGrandTotalCashier) {
            accGrandTotalCashier.style.textDecoration = 'none';
            accGrandTotalCashier.style.color = '#2c3e50';
        }
    }

    const newmindTotalAccountant = document.getElementById('newmindTotalAccountant');
    if (newmindTotalAccountant && newmindTotalAccountant.value) {
        calculateDifferenceAccountant();
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

async function closeCashierByAccountant() {
    if (!window.currentClosureData) {
        showMessage('يرجى البحث عن بيانات الكاشير أولاً.', 'warning');
        return;
    }

    const newMindTotalInput = document.getElementById('newmindTotalAccountant');
    const newMindTotal = newMindTotalInput ? parseFloat(newMindTotalInput.value) : NaN;
    if (isNaN(newMindTotal) || newMindTotal < 0) {
        showMessage('يرجى إدخال قيمة صحيحة لإجمالي نيو مايند.', 'warning');
        return;
    }

    const addReturns = document.getElementById('deductReturnsAccountant')?.checked || false;
    let cashierTotalForComparison = window.currentClosureData.grandTotal; // هذا هو الإجمالي الذي سجله الكاشير (يشمل الكاش في الدرج ويستثني المرتجعات)
    let grandTotalAfterReturnsValue = cashierTotalForComparison; // القيمة التي ستخزن في grandTotalAfterReturns في الشيت

    if (addReturns) {
        cashierTotalForComparison = cashierTotalForComparison + window.currentClosureData.totalReturns;
        grandTotalAfterReturnsValue = cashierTotalForComparison;
    } else {
        grandTotalAfterReturnsValue = cashierTotalForComparison; // إذا لم يتم إضافة المرتجعات، يكون هو نفسه grandTotal
    }

    const difference = newMindTotal - cashierTotalForComparison;

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
            window.currentClosureData.grandTotal.toFixed(2), // grandTotal (الكاشير)
            window.currentClosureData.drawerCash.toFixed(2),
            newMindTotal.toFixed(2),
            difference.toFixed(2),
            'مغلق بواسطة المحاسب',
            now.toISOString().split('T')[0],
            now.toTimeString().split(' ')[0],
            currentUser.username,
            window.currentClosureData.totalReturns.toFixed(2),
            grandTotalAfterReturnsValue.toFixed(2) // الإجمالي الذي قارنه المحاسب مع نيو مايند
        ];

        const result = await appendToSheet(SHEETS.SHIFT_CLOSURES, shiftClosureData);

        if (result.success) {
            showMessage(`تم تقفيل شيفت الكاشير ${users.find(u => u.username === window.currentClosureData.cashier)?.name || window.currentClosureData.cashier} بنجاح بواسطة المحاسب.`, 'success');
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
        tableBody.innerHTML = '<tr><td colspan="9">لا توجد سجلات تقفيلات.</td></tr>';
        return;
    }

    closures.sort((a, b) => new Date(`${b.closureDate}T${b.closureTime}`) - new Date(`${a.closureDate}T${a.closureTime}`));

    for (const closure of closures) {
        const row = tableBody.insertRow();

        const cashierUser = users.find(u => u.username === closure.cashier);
        const cashierDisplayName = cashierUser ? cashierUser.name : closure.cashier;

        row.insertCell().textContent = cashierDisplayName;
        row.insertCell().textContent = `${closure.dateFrom} ${closure.timeFrom.substring(0,5)} - ${closure.dateTo} ${closure.timeTo.substring(0,5)}`;

        // إجمالي الكاشير هو grandTotal الذي سجله الكاشير (يشمل الكاش في الدرج ويستثني المرتجعات)
        row.insertCell().textContent = closure.grandTotal.toFixed(2);

        row.insertCell().textContent = closure.newMindTotal > 0 ? closure.newMindTotal.toFixed(2) : '--';

        const differenceCell = row.insertCell();
        const diffValue = closure.difference;
        differenceCell.textContent = diffValue.toFixed(2);
        if (diffValue < 0) { // إذا كان نيو مايند أقل من الإجمالي الذي قارنه المحاسب (الكاشير أعلى)
            differenceCell.style.color = 'green';
            differenceCell.title = 'زيادة عند الكاشير';
        } else if (diffValue > 0) { // إذا كان نيو مايند أعلى من الإجمالي الذي قارنه المحاسب (الكاشير أقل)
            differenceCell.style.color = 'red';
            differenceCell.title = 'عجز على الكاشير';
        } else {
            differenceCell.style.color = 'blue';
            differenceCell.title = 'مطابق';
        }

        const statusCell = row.insertCell();
        statusCell.innerHTML = `<span class="status ${closure.status === 'مغلق' || closure.status === 'مغلق بواسطة المحاسب' ? 'closed' : 'open'}">${closure.status}</span>`;

        row.insertCell().textContent = `${closure.closureDate} ${closure.closureTime.substring(0, 5)}`;

        const actionsCell = row.insertCell();
        actionsCell.innerHTML = `
            <button class="view-btn" onclick="viewClosureDetails('${closure.id}')">
                <i class="fas fa-eye"></i> عرض
            </button>
            <button class="edit-btn" onclick="promptForEditPassword('${closure.id}')">
                <i class="fas fa-edit"></i> تعديل
            </button>
            ${closure.status !== 'مغلق بواسطة المحاسب' ? `
            <button class="accountant-close-btn" onclick="showAccountantClosureModal('${closure.id}')">
                <i class="fas fa-check-double"></i> تقفيل المحاسب
            </button>` : ''}
        `;
    }
}

// --- New Modal for Accountant Closure Details ---
async function showAccountantClosureModal(closureId, isEdit = false) {
    showLoading(true);
    try {
        const allClosures = await loadShiftClosures({});
        const closure = allClosures.find(c => c.id === closureId);
        if (!closure) {
            showMessage('لم يتم العثور على تفاصيل التقفيلة.', 'error');
            return;
        }

        // Populate the modal with closure data
        document.getElementById('accountantClosureModalCashierName').textContent = users.find(u => u.username === closure.cashier)?.name || closure.cashier;
        document.getElementById('accountantClosureModalPeriod').textContent = `${closure.dateFrom} ${closure.timeFrom.substring(0,5)} - ${closure.dateTo} ${closure.timeTo.substring(0,5)}`;
        document.getElementById('accountantClosureModalTotalExpenses').textContent = closure.totalExpenses.toFixed(2);
        document.getElementById('accountantClosureModalTotalInsta').textContent = closure.totalInsta.toFixed(2);
        document.getElementById('accountantClosureModalTotalVisa').textContent = closure.totalVisa.toFixed(2);
        document.getElementById('accountantClosureModalTotalOnline').textContent = closure.totalOnline.toFixed(2);
        document.getElementById('accountantClosureModalDrawerCash').textContent = closure.drawerCash.toFixed(2);
        
        // grandTotal for modal should be the cashier's recorded grandTotal (includes drawerCash, excludes returns)
        document.getElementById('accountantClosureModalGrandTotal').textContent = closure.grandTotal.toFixed(2);
        
        // إضافة حقول المرتجعات والإجمالي بعد خصم المرتجعات
        document.getElementById('accountantClosureModalTotalReturns').textContent = closure.totalReturns.toFixed(2);

        // Set the state of the deduct returns switch based on the saved closure data
        const deductReturnsSwitch = document.getElementById('accountantClosureModalDeductReturns');
        if (deductReturnsSwitch) {
            // إذا كان grandTotalAfterReturns (الذي سجله المحاسب) لا يساوي grandTotal (الذي سجله الكاشير)، فهذا يعني أنه تم إضافة المرتجعات
            deductReturnsSwitch.checked = (closure.grandTotalAfterReturns !== closure.grandTotal);
        }

        document.getElementById('accountantClosureModalNewMindTotal').value = closure.newMindTotal > 0 ? closure.newMindTotal.toFixed(2) : '';
        document.getElementById('accountantClosureModalDifference').textContent = closure.difference.toFixed(2);
        document.getElementById('accountantClosureModalStatus').textContent = closure.status;

        // Store current closure data for processing
        window.currentAccountantClosure = closure;
        window.isEditMode = isEdit; // Set edit mode flag

        // Show the modal
        const accountantClosureDetailsModal = document.getElementById('accountantClosureDetailsModal');
        if (accountantClosureDetailsModal) accountantClosureDetailsModal.classList.add('active');
        updateAccountantClosureDifference(); // Calculate initial difference if newMindTotal is pre-filled

        // Update modal title and save button text based on edit mode
        const modalTitle = document.querySelector('#accountantClosureDetailsModal .modal-header h3');
        const saveButton = document.getElementById('saveAccountantClosureBtn');
        if (modalTitle && saveButton) {
            if (isEdit) {
                modalTitle.innerHTML = `<i class="fas fa-edit"></i> تعديل تقفيل الشيفت`;
                saveButton.textContent = 'حفظ التعديلات';
                saveButton.onclick = saveEditedAccountantClosure; // Assign new save function for edit
            } else {
                modalTitle.innerHTML = `<i class="fas fa-check-double"></i> تقفيل المحاسب للشيفت`;
                saveButton.textContent = 'حفظ التقفيل';
                saveButton.onclick = saveAccountantClosure; // Assign original save function
            }
        }

    } catch (error) {
        console.error('Error showing accountant closure modal:', error);
        showMessage('حدث خطأ أثناء عرض تفاصيل تقفيل المحاسب.', 'error');
    } finally {
        showLoading(false);
    }
}

function updateAccountantClosureDifference() {
    const newMindTotalInput = document.getElementById('accountantClosureModalNewMindTotal');
    const differenceDisplay = document.getElementById('accountantClosureModalDifference');
    const statusDisplay = document.getElementById('accountantClosureModalStatus');
    const saveButton = document.getElementById('saveAccountantClosureBtn');
    const addReturnsSwitch = document.getElementById('accountantClosureModalDeductReturns');
    const grandTotalAfterReturnsContainer = document.getElementById('accountantClosureModalGrandTotalAfterReturnsContainer');
    const grandTotalAfterReturnsDisplay = document.getElementById('accountantClosureModalGrandTotalAfterReturns');
    const accClosureModalGrandTotal = document.getElementById('accountantClosureModalGrandTotal');

    if (!window.currentAccountantClosure || !accClosureModalGrandTotal || !newMindTotalInput || !differenceDisplay || !statusDisplay || !saveButton) return;

    const cashierRecordedGrandTotal = parseFloat(accClosureModalGrandTotal.textContent); // هذا هو grandTotal الذي سجله الكاشير
    const totalReturns = parseFloat(document.getElementById('accountantClosureModalTotalReturns')?.textContent || '0');
    const newMindTotal = parseFloat(newMindTotalInput.value);

    let grandTotalForComparison = cashierRecordedGrandTotal; // الإجمالي الذي سيتم مقارنته مع نيو مايند
    let grandTotalAfterReturnsDisplayValue = cashierRecordedGrandTotal; // القيمة التي ستعرض في "الإجمالي الكلي للكاشير بعد إضافة المرتجع"

    if (addReturnsSwitch?.checked) {
        grandTotalForComparison = cashierRecordedGrandTotal + totalReturns;
        grandTotalAfterReturnsDisplayValue = grandTotalForComparison;
        if (grandTotalAfterReturnsContainer) grandTotalAfterReturnsContainer.style.display = 'block';
        if (grandTotalAfterReturnsDisplay) grandTotalAfterReturnsDisplay.textContent = grandTotalForComparison.toFixed(2);
        accClosureModalGrandTotal.style.textDecoration = 'line-through';
        accClosureModalGrandTotal.style.color = '#888';
    } else {
        if (grandTotalAfterReturnsContainer) grandTotalAfterReturnsContainer.style.display = 'none';
        accClosureModalGrandTotal.style.textDecoration = 'none';
        accClosureModalGrandTotal.style.color = '#2c3e50';
    }

    if (isNaN(newMindTotal)) {
        differenceDisplay.textContent = '0.00';
        statusDisplay.textContent = 'في انتظار الإدخال';
        statusDisplay.className = 'status open';
        saveButton.disabled = true;
        return;
    }

    const difference = newMindTotal - grandTotalForComparison;
    differenceDisplay.textContent = difference.toFixed(2);

    if (difference === 0) {
        statusDisplay.textContent = 'مطابق ✓';
        statusDisplay.className = 'status closed';
    } else if (difference < 0) {
        statusDisplay.textContent = 'زيادة عند الكاشير';
        statusDisplay.className = 'status active';
    } else {
        statusDisplay.textContent = 'عجز على الكاشير';
        statusDisplay.className = 'status inactive';
    }
    saveButton.disabled = false;
}


async function saveAccountantClosure() {
    if (!window.currentAccountantClosure) {
        showMessage('لا توجد بيانات تقفيلة لحفظها.', 'error');
        return;
    }

    const newMindTotalInput = document.getElementById('accountantClosureModalNewMindTotal');
    const newMindTotal = newMindTotalInput ? parseFloat(newMindTotalInput.value) : NaN;
    if (isNaN(newMindTotal) || newMindTotal < 0) {
        showMessage('يرجى إدخال قيمة صحيحة لإجمالي نيو مايند.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const closure = window.currentAccountantClosure;
        const cashierRecordedGrandTotal = parseFloat(document.getElementById('accountantClosureModalGrandTotal')?.textContent || '0'); // grandTotal الذي سجله الكاشير
        const totalReturns = parseFloat(document.getElementById('accountantClosureModalTotalReturns')?.textContent || '0');
        const addReturns = document.getElementById('accountantClosureModalDeductReturns')?.checked || false;

        let grandTotalForComparison = cashierRecordedGrandTotal; // الإجمالي الذي سيتم مقارنته مع نيو مايند
        let grandTotalAfterReturnsValue = cashierRecordedGrandTotal; // القيمة التي ستخزن في grandTotalAfterReturns في الشيت

        if (addReturns) {
            grandTotalForComparison = cashierRecordedGrandTotal + totalReturns;
            grandTotalAfterReturnsValue = grandTotalForComparison;
        } else {
            grandTotalAfterReturnsValue = cashierRecordedGrandTotal;
        }

        const difference = newMindTotal - grandTotalForComparison;
        const now = new Date();

        // إذا كانت هذه تقفيلة جديدة يقوم بها المحاسب، نضيفها كصف جديد
        // إذا كانت تعديل لتقفيلة سابقة (من الكاشير)، نحدث الصف الموجود
        // في هذا السيناريو، المحاسب يقوم بإنشاء تقفيلة جديدة بناءً على بيانات الكاشير
        const shiftId = 'SHIFT_ACC_' + now.getTime();

        const updatedData = [
            shiftId, // ID جديد للتقفيلة التي أنشأها المحاسب
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
            cashierRecordedGrandTotal.toFixed(2), // grandTotal (الكاشير)
            closure.drawerCash.toFixed(2),
            newMindTotal.toFixed(2),
            difference.toFixed(2),
            'مغلق بواسطة المحاسب',
            now.toISOString().split('T')[0],
            now.toTimeString().split(' ')[0],
            currentUser.username,
            totalReturns.toFixed(2),
            grandTotalAfterReturnsValue.toFixed(2) // الإجمالي الذي قارنه المحاسب مع نيو مايند
        ];

        const result = await appendToSheet(SHEETS.SHIFT_CLOSURES, updatedData);

        if (result.success) {
            showMessage('تم تقفيل الشيفت بنجاح بواسطة المحاسب.', 'success');
            closeModal('accountantClosureDetailsModal');
            loadAccountantShiftClosuresHistory();
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

// --- Edit Closure Functionality ---
function promptForEditPassword(closureId) {
    const password = prompt('أدخل كلمة المرور لتعديل التقفيلة:');
    if (password === EDIT_PASSWORD) {
        showAccountantClosureModal(closureId, true); // Open modal in edit mode
    } else if (password !== null) { // If user didn't cancel
        showMessage('كلمة المرور غير صحيحة.', 'error');
    }
}

async function saveEditedAccountantClosure() {
    if (!window.currentAccountantClosure) {
        showMessage('لا توجد بيانات تقفيلة لحفظها.', 'error');
        return;
    }

    const newMindTotalInput = document.getElementById('accountantClosureModalNewMindTotal');
    const newMindTotal = newMindTotalInput ? parseFloat(newMindTotalInput.value) : NaN;
    if (isNaN(newMindTotal) || newMindTotal < 0) {
        showMessage('يرجى إدخال قيمة صحيحة لإجمالي نيو مايند.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const closure = window.currentAccountantClosure;
        const cashierRecordedGrandTotal = parseFloat(document.getElementById('accountantClosureModalGrandTotal')?.textContent || '0');
        const totalReturns = parseFloat(document.getElementById('accountantClosureModalTotalReturns')?.textContent || '0');
        const addReturns = document.getElementById('accountantClosureModalDeductReturns')?.checked || false;

        let grandTotalForComparison = cashierRecordedGrandTotal;
        let grandTotalAfterReturnsValue = cashierRecordedGrandTotal;

        if (addReturns) {
            grandTotalForComparison = cashierRecordedGrandTotal + totalReturns;
            grandTotalAfterReturnsValue = grandTotalForComparison;
        } else {
            grandTotalAfterReturnsValue = cashierRecordedGrandTotal;
        }

        const difference = newMindTotal - grandTotalForComparison;
        const now = new Date();

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
            cashierRecordedGrandTotal.toFixed(2),
            closure.drawerCash.toFixed(2),
            newMindTotal.toFixed(2),
            difference.toFixed(2),
            'مغلق بواسطة المحاسب', // الحالة تظل مغلقة بواسطة المحاسب
            now.toISOString().split('T')[0], // تحديث تاريخ التقفيل
            now.toTimeString().split(' ')[0], // تحديث وقت التقفيل
            currentUser.username, // تحديث المحاسب الذي قام بالتعديل
            totalReturns.toFixed(2),
            grandTotalAfterReturnsValue.toFixed(2)
        ];

        const result = await updateSheet(SHEETS.SHIFT_CLOSURES, `A${rowIndex}:X${rowIndex}`, [updatedData]);

        if (result.success) {
            showMessage('تم تعديل التقفيلة بنجاح.', 'success');
            closeModal('accountantClosureDetailsModal');
            loadAccountantShiftClosuresHistory();
        } else {
            showMessage('فشل تعديل التقفيلة.', 'error');
        }
    } catch (error) {
        console.error('Error saving edited accountant closure:', error);
        showMessage('حدث خطأ أثناء حفظ تعديلات التقفيلة.', 'error');
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
            <p><strong>الفترة:</strong> ${closure.dateFrom} ${closure.timeFrom.substring(0,5)} - ${closure.dateTo} ${closure.timeTo.substring(0,5)}</p>
            <p><strong>إجمالي المصروفات (عادي):</strong> ${closure.totalExpenses.toFixed(2)} (${closure.expenseCount} فاتورة) <a href="#" onclick="viewExpenseDetails('${closure.cashier}', '${closure.dateFrom}', '${closure.timeFrom}', '${closure.dateTo}', '${closure.timeTo}', 'normal'); return false;"><i class="fas fa-eye"></i></a></p>
            <p><strong>إجمالي الإنستا:</strong> ${closure.totalInsta.toFixed(2)} (${closure.instaCount} فاتورة) <a href="#" onclick="viewExpenseDetails('${closure.cashier}', '${closure.dateFrom}', '${closure.timeFrom}', '${closure.dateTo}', '${closure.timeTo}', 'إنستا'); return false;"><i class="fas fa-eye"></i></a></p>
            <p><strong>إجمالي الفيزا:</strong> ${closure.totalVisa.toFixed(2)} (${closure.visaCount} فاتورة) <a href="#" onclick="viewExpenseDetails('${closure.cashier}', '${closure.dateFrom}', '${closure.timeFrom}', '${closure.dateTo}', '${closure.timeTo}', 'فيزا'); return false;"><i class="fas fa-eye"></i></a></p>
            <p><strong>إجمالي الأونلاين:</strong> ${closure.totalOnline.toFixed(2)} (${closure.onlineCount} فاتورة) <a href="#" onclick="viewExpenseDetails('${closure.cashier}', '${closure.dateFrom}', '${closure.timeFrom}', '${closure.dateTo}', '${closure.timeTo}', 'اونلاين'); return false;"><i class="fas fa-eye"></i></a></p>
            <p><strong>إجمالي المرتجعات:</strong> ${closure.totalReturns.toFixed(2)} <a href="#" onclick="viewExpenseDetails('${closure.cashier}', '${closure.dateFrom}', '${closure.timeFrom}', '${closure.dateTo}', '${closure.timeTo}', 'مرتجع'); return false;"><i class="fas fa-eye"></i></a></p>
            <p><strong>إجمالي الكاش في الدرج:</strong> ${closure.drawerCash.toFixed(2)}</p>
            <p><strong>الإجمالي الكلي للكاشير (قبل خصم المرتجعات):</strong> ${closure.grandTotal.toFixed(2)}</p>
            ${closure.totalReturns > 0 && closure.grandTotalAfterReturns !== closure.grandTotal ? `<p><strong>الإجمالي الكلي الذي قارنه المحاسب (بعد إضافة المرتجع):</strong> ${closure.grandTotalAfterReturns.toFixed(2)}</p>` : ''}
            <p><strong>إجمالي نيو مايند:</strong> ${closure.newMindTotal.toFixed(2)}</p>
            <p><strong>الفرق:</strong> ${closure.difference.toFixed(2)}</p>
            <p><strong>الحالة:</strong> ${closure.status}</p>
            <p><strong>تاريخ التقفيل:</strong> ${closure.closureDate} ${closure.closureTime.substring(0,5)}</p>
            ${closure.accountant ? `<p><strong>تم التقفيل بواسطة المحاسب:</strong> ${accountantDisplayName}</p>` : ''}
        `;

        // Display in a generic modal
        const genericModal = document.getElementById('genericDetailsModal');
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

// دالة جديدة لعرض تفاصيل المصروفات حسب النوع
async function viewExpenseDetails(cashierUsername, dateFrom, timeFrom, dateTo, timeTo, formType) {
    showLoading(true);
    try {
        const filters = {
            cashier: cashierUsername,
            dateFrom: dateFrom,
            dateTo: dateTo,
            timeFrom: timeFrom,
            timeTo: timeTo
        };
        
        // إذا كان formType هو 'normal'، نحتاج إلى استبعاد أنواع معينة
        if (formType === 'normal') {
            // لا نمرر formType هنا، بل نفلتر بعد تحميل جميع المصروفات
        } else {
            filters.formType = formType;
        }

        const expenses = await loadExpenses(filters);

        let filteredExpenses = [];
        if (formType === 'normal') {
            filteredExpenses = expenses.filter(exp => {
                const category = categories.find(c => c.name === exp.category || c.code === exp.categoryCode);
                // استبعاد أنواع الفورم التي لها تبويبات خاصة بها
                return category && !['فيزا', 'إنستا', 'اونلاين', 'مرتجع', 'اجل', 'سلف_موظف'].includes(category.formType);
            });
        } else {
            filteredExpenses = expenses; // المصروفات التي تم تحميلها بالفعل مفلترة حسب formType
        }

        let detailsHtml = `
            <h3>تفاصيل ${formType === 'normal' ? 'المصروفات العادية' : formType} للكاشير ${users.find(u => u.username === cashierUsername)?.name || cashierUsername}</h3>
            <p>الفترة: ${dateFrom} ${timeFrom.substring(0,5)} - ${dateTo} ${timeTo.substring(0,5)}</p>
        `;

        if (filteredExpenses.length === 0) {
            detailsHtml += '<p>لا توجد فواتير لهذا النوع في الفترة المحددة.</p>';
        } else {
            detailsHtml += `
                <table>
                    <thead>
                        <tr>
                            <th>التصنيف</th>
                            <th>رقم الفاتورة</th>
                            <th>القيمة</th>
                            <th>التاريخ</th>
                            <th>الوقت</th>
                            <th>الملاحظات</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            filteredExpenses.sort((a, b) => new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`));

            filteredExpenses.forEach(exp => {
                detailsHtml += `
                    <tr>
                        <td>${exp.category}</td>
                        <td>${exp.invoiceNumber || '--'}</td>
                        <td>${exp.amount.toFixed(2)}</td>
                        <td>${exp.date}</td>
                        <td>${exp.time.substring(0, 5)}</td>
                        <td>${exp.notes || '--'}</td>
                        <td>
                            <button class="edit-btn" onclick="showEditExpenseModal('${exp.id}')"><i class="fas fa-edit"></i> تعديل</button>
                            <button class="delete-btn" onclick="deleteExpense('${exp.id}', '${exp.category}', ${exp.amount}, '${exp.invoiceNumber}')"><i class="fas fa-trash"></i> حذف</button>
                        </td>
                    </tr>
                `;
            });

            detailsHtml += `
                    </tbody>
                </table>
                <p><strong>إجمالي: ${filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(2)}</strong> (${filteredExpenses.length} فاتورة)</p>
            `;
        }

        // عرض التفاصيل في نافذة منبثقة عامة
        const genericModal = document.getElementById('genericDetailsModal');
        const genericModalContent = document.getElementById('genericDetailsModalContent');
        if (genericModal && genericModalContent) {
            genericModalContent.innerHTML = detailsHtml;
            genericModal.classList.add('active');
        } else {
            alert(detailsHtml.replace(/<[^>]*>?/gm, '\n').replace(/\n\n/g, '\n').trim());
        }

    } catch (error) {
        console.error('Error viewing expense details:', error);
        showMessage('حدث خطأ أثناء عرض تفاصيل المصروفات.', 'error');
    } finally {
        showLoading(false);
    }
}

// --- Utility Functions ---
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// دالة لإغلاق الـ modal عند الضغط خارجها
function setupModalCloseOnOutsideClick() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                // إذا كان الفورم مثبتًا، لا تغلق المودال
                const pinButton = document.getElementById('pinExpenseFormBtn');
                if (modal.id === 'addExpenseModal' && pinButton && pinButton.dataset.pinned === 'true') {
                    return;
                }
                closeModal(modal.id);
            }
        });
    });
}

// دالة لعرض الرسائل
function showMessage(message, type = 'info') {
    const messageContainer = document.getElementById('messageContainer');
    if (!messageContainer) return;

    // إزالة الرسائل السابقة
    const existingMessages = messageContainer.querySelectorAll('.message');
    existingMessages.forEach(msg => {
        setTimeout(() => msg.remove(), 5000); // إزالة تلقائية بعد 5 ثوان
    });

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
        ${message}
    `;
    messageDiv.onclick = () => messageDiv.remove(); // إغلاق عند الضغط

    messageContainer.appendChild(messageDiv);

    // إزالة تلقائية بعد 5 ثوان
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

// دالة لعرض/إخفاء شاشة التحميل
function showLoading(show = true) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        if (show) {
            loadingOverlay.classList.remove('hidden');
        } else {
            loadingOverlay.classList.add('hidden');
        }
    }
}

// دالة لتبديل حالة تثبيت فورم المصروفات
function togglePinExpenseForm() {
    const pinButton = document.getElementById('pinExpenseFormBtn');
    if (pinButton) {
        const isPinned = pinButton.dataset.pinned === 'true';
        pinButton.dataset.pinned = (!isPinned).toString();
        pinButton.classList.toggle('active', !isPinned);
        showMessage(`تم ${isPinned ? 'إلغاء تثبيت' : 'تثبيت'} الفورم.`, 'info');
    }
}


// --- Event Listeners and Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // إعداد إغلاق الـ modals عند الضغط خارجها
    setupModalCloseOnOutsideClick();

    // تحميل Google Scripts والبيانات الأولية
    try {
        await loadGoogleScripts();
    } catch (error) {
        console.error('Failed to load Google Scripts:', error);
        showMessage('فشل تحميل الخدمات الخارجية. يرجى إعادة تحميل الصفحة.', 'error');
    }

    // تعيين التواريخ الافتراضية
    setDefaultDatesAndTimes();

    // إخفاء صفحات غير الافتراضية
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('cashierPage').classList.remove('active');
    document.getElementById('accountantPage').classList.remove('active');

    // إضافة event listener للـ close buttons في الـ modals
    const closeButtons = document.querySelectorAll('.close-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.target.closest('.modal').id;
            closeModal(modalId);
        });
    });

    console.log('DOM loaded and initialized successfully.');
});

// --- Error Handling for Authentication ---
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // showMessage('حدث خطأ غير متوقع. يرجى إعادة تحميل الصفحة.', 'error'); // قد تكون مزعجة
});

// --- End of Script ---
