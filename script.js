// في بداية script.js - حل بديل
function loadGoogleScripts() {
    return new Promise((resolve) => {
        const script1 = document.createElement('script');
        script1.src = 'https://apis.google.com/js/api.js';
        script1.onload = gapiLoaded;
        document.head.appendChild(script1);

        const script2 = document.createElement('script');
        script2.src = 'https://accounts.google.com/gsi/client';
        script2.onload = function() {
            gisLoaded();
            resolve();
        };
        document.head.appendChild(script2);
    });
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
    CUSTOMER_CREDIT_HISTORY: 'CustomerCreditHistory' // New sheet
};

let gapiInited = false;
let gisInited = false;
let tokenClient;
let isAuthenticated = false;

// --- Global Application State ---
let users = [];
let categories = [];
let customers = [];
let currentUser = null;
let currentUserName = '';
let currentUserRole = '';
let currentSelectedCustomerId = null; // To keep track of the customer being viewed in accountant page

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

// --- Google API Initialization ---
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
        });
        gapiInited = true;
        maybeEnableButtons();
    } catch (error) {
        console.error('Error initializing GAPI client:', error);
        showErrorMessage('فشل تهيئة Google API');
    }
}

function gisLoaded() {
    try {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '', // defined later
        });
        gisInited = true;
        maybeEnableButtons();
    } catch (error) {
        console.error('Error initializing GIS:', error);
        showErrorMessage('فشل تهيئة Google Identity Services');
    }
}

function maybeEnableButtons() {
    if (gapiInited && gisInited && !isAuthenticated) {
        handleAuthClick().then(() => {
            loadInitialData();
        }).catch(error => {
            console.error('Authentication failed:', error);
        });
    }
}

async function handleAuthClick() {
    if (isAuthenticated) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
        tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) {
                console.error('Authentication failed:', resp);
                showErrorMessage('فشل المصادقة مع Google Sheets. يرجى التحقق من الأذونات.');
                reject(resp);
            } else {
                console.log('Authentication successful.');
                isAuthenticated = true;
                resolve();
            }
        };

        if (gapi.client.getToken() === null) {
            tokenClient.requestAccessToken({prompt: 'consent'});
        } else {
            tokenClient.requestAccessToken({prompt: ''});
        }
    });
}

// --- Google Sheets API Functions ---
async function readSheet(sheetName, range = '') {
    try {
        if (!isAuthenticated) {
            await handleAuthClick();
        }
        
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}${range ? '!' + range : ''}`,
        });
        return response.result.values || [];
    } catch (error) {
        console.error(`Error reading sheet ${sheetName}:`, error);
        showErrorMessage(`خطأ في قراءة البيانات من ${sheetName}`);
        return [];
    }
}

async function appendToSheet(sheetName, values) {
    try {
        if (!isAuthenticated) {
            await handleAuthClick();
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
            await handleAuthClick();
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
            return i + 1; // +1 because sheets are 1-indexed
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
                status: row[6] || 'نشط', // Assuming status is at index 6
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
                totalCredit: parseFloat(row[3] || 0), // Assuming totalCredit is at index 3
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
            type: row[3] || '', // 'أجل' or 'سداد'
            amount: parseFloat(row[4] || 0),
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
            amount: parseFloat(row[4] || 0),
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
                const expTime = exp.time;
                return expTime >= filters.timeFrom && expTime <= filters.timeTo;
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
            totalExpenses: parseFloat(row[6] || 0),
            expenseCount: parseInt(row[7] || 0),
            totalInsta: parseFloat(row[8] || 0),
            instaCount: parseInt(row[9] || 0),
            totalVisa: parseFloat(row[10] || 0),
            visaCount: parseInt(row[11] || 0),
            totalOnline: parseFloat(row[12] || 0),
            onlineCount: parseInt(row[13] || 0),
            grandTotal: parseFloat(row[14] || 0),
            drawerCash: parseFloat(row[15] || 0),
            newMindTotal: parseFloat(row[16] || 0),
            difference: parseFloat(row[17] || 0),
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
            closures = closures.filter(closure => 
                closure.dateFrom === filters.dateFrom && closure.dateTo === filters.dateTo
            );
        }

        return closures;
    } catch (error) {
        console.error('Error loading shift closures:', error);
        return [];
    }
}

// --- Initial Data Loading ---
async function loadInitialData() {
    try {
        showLoading(true);
        await Promise.all([
            loadUsers(),
            loadCategories(),
            loadCustomers()
        ]);
        populateUserDropdown();
        showSuccessMessage('تم تحميل البيانات بنجاح');
    } catch (error) {
        console.error('Error loading initial data:', error);
        showErrorMessage('حدث خطأ أثناء تحميل البيانات');
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
        showWarningMessage('يرجى اختيار المستخدم وإدخال كلمة المرور.');
        return;
    }

    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        currentUser = user;
        currentUserName = user.name;
        currentUserRole = user.role;

        if (currentUserRole === 'كاشير') {
            showCashierPage();
        } else if (currentUserRole === 'محاسب') {
            showAccountantPage();
        }
        showSuccessMessage(`مرحباً بك، ${currentUserName}!`);
    } else {
        showErrorMessage('اسم المستخدم أو كلمة المرور غير صحيحة.');
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
    showSuccessMessage('تم تسجيل الخروج بنجاح.');
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

    // Specific actions for each tab
    if (tabId === 'categoriesTabCashier' || tabId === 'categoriesTabAccountant') {
        displayCategories(tabId === 'categoriesTabCashier' ? 'categoriesGridCashier' : 'categoriesGridAccountant');
    } else if (tabId === 'expensesTabCashier') {
        loadCashierExpenses();
        populateExpenseCategoryFilter();
    } else if (tabId === 'customersTabCashier') {
        displayCustomers('customersTableBodyCashier');
    } else if (tabId === 'customersTabAccountant') { // New
        displayCustomers('customersTableBodyAccountant');
        document.getElementById('customerDetailsAccountant').style.display = 'none'; // Hide details when switching tab
    } else if (tabId === 'dashboardTabAccountant') {
        updateAccountantDashboard();
    } else if (tabId === 'usersTabAccountant') {
        displayUsers();
    } else if (tabId === 'reportsTabAccountant') {
        populateReportFilters();
    } else if (tabId === 'shiftCloseTabAccountant') {
        populateAccountantShiftCashierFilter(); // New
        loadAccountantShiftClosuresHistory();
        // Reset accountant shift closure form
        document.getElementById('closureResultsAccountant').style.display = 'none';
        document.getElementById('closeCashierByAccountant').style.display = 'none';
        document.getElementById('newmindTotalAccountant').value = '';
        document.getElementById('differenceResultAccountant').style.display = 'none';
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
    showTab('expensesTabCashier');
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
    // Reset shift date/time inputs
    const today = new Date().toISOString().split('T')[0];
    const timeNow = new Date().toTimeString().split(' ')[0].substring(0, 5);
    document.getElementById('shiftDateFromCashier').value = today;
    document.getElementById('shiftDateToCashier').value = today;
    document.getElementById('shiftTimeFromCashier').value = timeNow;
    document.getElementById('shiftTimeToCashier').value = timeNow;
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
                <button class="edit-btn" onclick="showWarningMessage('وظيفة تعديل التصنيف غير متاحة حالياً.')"><i class="fas fa-edit"></i> تعديل</button>
                <button class="delete-btn" onclick="showWarningMessage('وظيفة حذف التصنيف غير متاحة حالياً.')"><i class="fas fa-trash"></i> حذف</button>
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
        showWarningMessage('يرجى ملء جميع حقول التصنيف.');
        return;
    }

    // Check for duplicate category code
    const existingCategory = categories.find(cat => cat.code === code);
    if (existingCategory) {
        showWarningMessage('كود التصنيف موجود بالفعل. يرجى استخدام كود آخر.');
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
        showSuccessMessage('تم إضافة التصنيف بنجاح.');
        closeModal('addCategoryModal');
        await loadCategories();
        displayCategories('categoriesGridCashier');
        displayCategories('categoriesGridAccountant');
        populateExpenseCategoryFilter();
        populateAccountantFilters(); // Update accountant filters as well
    } else {
        showErrorMessage('فشل إضافة التصنيف.');
    }
}

function editCategory(code) {
    showWarningMessage('وظيفة تعديل التصنيف غير متاحة حالياً.');
}

function deleteCategory(code) {
    showWarningMessage('وظيفة حذف التصنيف غير متاحة حالياً.');
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
    
    let formHtml = `
        <div class="form-group">
            <label for="expenseAmount">القيمة:</label>
            <input type="number" id="expenseAmount" step="0.01" required placeholder="أدخل القيمة">
        </div>
        <div class="form-group">
            <label for="expenseNotes">الملاحظات (اختياري):</label>
            <input type="text" id="expenseNotes" placeholder="أدخل ملاحظات">
        </div>
    `;

    // إضافة حقل رقم الفاتورة لجميع الأنواع التي تتطلبها، بما في ذلك "أجل"
    if (['عادي', 'فيزا', 'اونلاين', 'مرتجع', 'خصم عميل', 'إنستا', 'اجل'].includes(formType)) {
        formHtml = `
            <div class="form-group">
                <label for="expenseInvoiceNumber">رقم الفاتورة:</label>
                <input type="text" id="expenseInvoiceNumber" required placeholder="أدخل رقم الفاتورة">
            </div>
            ${formHtml}
        `;
    }
    
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
                <label for="customerSearch">البحث عن العميل:</label>
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
    const now = new Date();
    
    const categoryCode = document.getElementById('selectedExpenseCategoryCode').value;
    const categoryName = document.getElementById('selectedExpenseCategoryName').value;
    const formType = document.getElementById('selectedExpenseCategoryFormType').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const notes = document.getElementById('expenseNotes').value.trim();
    const invoiceNumber = document.getElementById('expenseInvoiceNumber')?.value.trim() || '';

    if (!categoryCode || isNaN(amount) || amount <= 0) {
        showWarningMessage('يرجى اختيار تصنيف وإدخال قيمة صحيحة.');
        return;
    }

    if (['عادي', 'فيزا', 'اونلاين', 'مرتجع', 'خصم عميل', 'إنستا', 'اجل'].includes(formType)) {
        if (!invoiceNumber) {
            showWarningMessage('يرجى إدخال رقم الفاتورة.');
            return;
        }
    }

    if (formType === 'اجل') {
        const customerId = document.getElementById('selectedCustomerId').value;
        if (!customerId) {
            showWarningMessage('يرجى اختيار العميل الآجل.');
            return;
        }
        
        const customerIndex = customers.findIndex(c => c.id === customerId);
        if (customerIndex !== -1) {
            const currentCustomer = customers[customerIndex];
            const newTotalCredit = currentCustomer.totalCredit + amount;
            
            const rowIndex = await findRowIndex(SHEETS.CUSTOMERS, 0, customerId);
            if (rowIndex !== -1) {
                const updateResult = await updateSheet(SHEETS.CUSTOMERS, `D${rowIndex}`, [newTotalCredit.toFixed(2)]);
                if (!updateResult.success) {
                    showErrorMessage('فشل تحديث إجمالي الأجل للعميل.');
                    return;
                }
                // Update last update date
                await updateSheet(SHEETS.CUSTOMERS, `F${rowIndex}`, [now.toISOString().split('T')[0]]);
            } else {
                showErrorMessage('لم يتم العثور على العميل لتحديث الأجل.');
                return;
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
                showErrorMessage('فشل تسجيل حركة الأجل.');
                return;
            }
        } else {
            showErrorMessage('العميل المختار غير موجود.');
            return;
        }
    }

    const expenseId = 'EXP_' + now.getTime();
    
    let expenseData = [
        expenseId,
        categoryName,
        categoryCode,
        invoiceNumber,
        amount,
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
        showSuccessMessage(`تم إضافة ${categoryName} بنجاح.`);
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
            await loadCustomers(); // Reload customers to get updated totalCredit
            displayCustomers('customersTableBodyCashier');
        }
        loadCashierExpenses();
    } else {
        showErrorMessage('فشل إضافة المصروف.');
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
        row.insertCell().textContent = exp.amount.toFixed(2);
        row.insertCell().textContent = exp.date;
        row.insertCell().textContent = exp.time;
        row.insertCell().textContent = exp.notes || '--';
        const actionsCell = row.insertCell();
        actionsCell.innerHTML = `<button class="delete-btn" onclick="showWarningMessage('وظيفة حذف المصروفات غير متاحة حالياً.')"><i class="fas fa-trash"></i> حذف</button>`;
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
        // Add view details button for accountant
        if (tableBodyId === 'customersTableBodyAccountant') {
            actionsCell.innerHTML = `
                <button class="edit-btn" onclick="showWarningMessage('وظيفة تعديل العميل غير متاحة حالياً.')"><i class="fas fa-edit"></i> تعديل</button>
                <button class="delete-btn" onclick="showWarningMessage('وظيفة حذف العميل غير متاحة حالياً.')"><i class="fas fa-trash"></i> حذف</button>
                <button class="view-btn" onclick="viewCustomerDetails('${cust.id}', '${cust.name}')"><i class="fas fa-eye"></i> تفاصيل</button>
            `;
        } else { // Cashier
            actionsCell.innerHTML = `
                <button class="edit-btn" onclick="showWarningMessage('وظيفة تعديل العميل غير متاحة حالياً.')"><i class="fas fa-edit"></i> تعديل</button>
                <button class="delete-btn" onclick="showWarningMessage('وظيفة حذف العميل غير متاحة حالياً.')"><i class="fas fa-trash"></i> حذف</button>
                <button class="add-btn" onclick="showWarningMessage('وظيفة سداد/أجل العميل غير متاحة حالياً.')"><i class="fas fa-money-bill-wave"></i> سداد/أجل</button>
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
        document.getElementById('customerPaymentAmount').value = ''; // Clear payment input

        const history = await loadCustomerCreditHistory(customerId);
        const tableBody = document.getElementById('customerCreditHistoryBody');
        if (!tableBody) return;

        tableBody.innerHTML = '';
        if (history.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">لا توجد حركات أجل/سداد لهذا العميل.</td></tr>';
            return;
        }

        history.sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date descending

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
        showErrorMessage('حدث خطأ أثناء عرض تفاصيل العميل.');
    } finally {
        showLoading(false);
    }
}

async function processCustomerPayment() {
    if (!currentSelectedCustomerId) {
        showWarningMessage('يرجى اختيار عميل أولاً.');
        return;
    }

    const paymentAmount = parseFloat(document.getElementById('customerPaymentAmount').value);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
        showWarningMessage('يرجى إدخال مبلغ سداد صحيح وموجب.');
        return;
    }

    showLoading(true);
    try {
        const customerIndex = customers.findIndex(c => c.id === currentSelectedCustomerId);
        if (customerIndex === -1) {
            showErrorMessage('العميل غير موجود.');
            return;
        }

        const currentCustomer = customers[customerIndex];
        if (currentCustomer.totalCredit < paymentAmount) {
            showWarningMessage('مبلغ السداد أكبر من إجمالي الأجل المستحق.');
            return;
        }

        const newTotalCredit = currentCustomer.totalCredit - paymentAmount;
        const now = new Date();
        const date = now.toISOString().split('T')[0];

        // Update customer's total credit in Google Sheet
        const rowIndex = await findRowIndex(SHEETS.CUSTOMERS, 0, currentSelectedCustomerId); // Assuming ID is in column 0
        if (rowIndex !== -1) {
            const updateResult = await updateSheet(SHEETS.CUSTOMERS, `D${rowIndex}`, [newTotalCredit.toFixed(2)]); // Assuming totalCredit is in column D
            if (!updateResult.success) {
                showErrorMessage('فشل تحديث إجمالي الأجل للعميل.');
                return;
            }
            // Update last update date
            await updateSheet(SHEETS.CUSTOMERS, `F${rowIndex}`, [date]);
        } else {
            showErrorMessage('لم يتم العثور على العميل لتحديث الأجل.');
            return;
        }

        // Record payment in CustomerCreditHistory sheet
        const historyId = 'CRH_' + now.getTime();
        const newHistoryEntry = [
            historyId,
            currentSelectedCustomerId,
            date,
            'سداد',
            paymentAmount,
            '', // Invoice number (not applicable for payment)
            `سداد من المحاسب ${currentUserName}`,
            currentUser.username
        ];
        const historyResult = await appendToSheet(SHEETS.CUSTOMER_CREDIT_HISTORY, newHistoryEntry);
        if (!historyResult.success) {
            showErrorMessage('فشل تسجيل حركة السداد.');
            return;
        }

        // Update local data
        currentCustomer.totalCredit = newTotalCredit;
        customers[customerIndex] = currentCustomer;

        showSuccessMessage('تم سداد الأجل بنجاح.');
        document.getElementById('customerPaymentAmount').value = '';
        await viewCustomerDetails(currentSelectedCustomerId, currentCustomer.name); // Refresh details
        displayCustomers('customersTableBodyAccountant'); // Refresh customers table
        updateAccountantDashboard(); // Update dashboard stats
    } catch (error) {
        console.error('Error processing customer payment:', error);
        showErrorMessage('حدث خطأ أثناء معالجة السداد.');
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
        showWarningMessage('يرجى ملء جميع حقول العميل.');
        return;
    }

    // Check for duplicate phone
    const existingCustomer = customers.find(cust => cust.phone === phone);
    if (existingCustomer) {
        showWarningMessage('رقم التليفون موجود بالفعل.');
        return;
    }

    const customerId = 'CUST_' + new Date().getTime();
    const newCustomer = [
        customerId,
        name,
        phone,
        '0', // Total credit
        new Date().toISOString().split('T')[0], // Creation date
        new Date().toISOString().split('T')[0]  // Last update
    ];

    const result = await appendToSheet(SHEETS.CUSTOMERS, newCustomer);

    if (result.success) {
        showSuccessMessage('تم إضافة العميل بنجاح.');
        closeModal('addCustomerModal');
        await loadCustomers();
        displayCustomers('customersTableBodyCashier');
        displayCustomers('customersTableBodyAccountant'); // Update accountant's customer list
        updateAccountantDashboard(); // Update dashboard stats

        const modal = document.getElementById('addCustomerModal');
        if (modal && modal.dataset.fromExpense === 'true') {
            showAddExpenseModal();
            const newCustomerObj = { id: customerId, name: name, phone: phone, totalCredit: 0 };
            selectCustomerForExpense(newCustomerObj);
        }
    } else {
        showErrorMessage('فشل إضافة العميل.');
    }
}

// --- Shift Management ---
async function calculateCashierShift() {
    const dateFrom = document.getElementById('shiftDateFromCashier').value;
    const dateTo = document.getElementById('shiftDateToCashier').value;
    const timeFrom = document.getElementById('shiftTimeFromCashier').value;
    const timeTo = document.getElementById('shiftTimeToCashier').value;

    if (!dateFrom || !dateTo || !timeFrom || !timeTo) {
        showWarningMessage('يرجى ملء جميع حقول التاريخ والوقت.');
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
        
        // تصنيف المصروفات حسب النوع
        let categorizedExpenses = {
            expenses: [], // Normal expenses
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

        // حساب الإجماليات
        const totalExpenses = categorizedExpenses.expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const totalInsta = categorizedExpenses.insta.reduce((sum, exp) => sum + exp.amount, 0);
        const totalVisa = categorizedExpenses.visa.reduce((sum, exp) => sum + exp.amount, 0);
        const totalOnline = categorizedExpenses.online.reduce((sum, exp) => sum + exp.amount, 0);
        const grandTotal = totalExpenses + totalInsta + totalVisa + totalOnline;

        // تحديث الواجهة
        document.getElementById('totalExpensesCashier').textContent = totalExpenses.toFixed(2);
        document.getElementById('expenseCountCashier').textContent = categorizedExpenses.expenses.length;
        document.getElementById('totalInstaCashier').textContent = totalInsta.toFixed(2);
        document.getElementById('instaCountCashier').textContent = categorizedExpenses.insta.length;
        document.getElementById('totalVisaCashier').textContent = totalVisa.toFixed(2);
        document.getElementById('visaCountCashier').textContent = categorizedExpenses.visa.length;
        document.getElementById('totalOnlineCashier').textContent = totalOnline.toFixed(2);
        document.getElementById('onlineCountCashier').textContent = categorizedExpenses.online.length;
        document.getElementById('grandTotalCashier').textContent = grandTotal.toFixed(2);

        document.getElementById('shiftSummaryCashier').style.display = 'block';
        
        showSuccessMessage('تم حساب الشيفت بنجاح.');
    } catch (error) {
        showErrorMessage('حدث خطأ أثناء حساب الشيفت.');
        console.error(error);
    } finally {
        showLoading(false);
    }
}

async function finalizeCashierShiftCloseout() {
    const drawerCash = parseFloat(document.getElementById('drawerCashCashier').value);
    
    if (isNaN(drawerCash) || drawerCash < 0) {
        showWarningMessage('يرجى إدخال قيمة صحيحة للنقدية في الدرج.');
        return;
    }

    showLoading(true);
    
    try {
        const now = new Date();
        const shiftId = 'SHIFT_' + now.getTime();
        
        const totalExpenses = parseFloat(document.getElementById('totalExpensesCashier').textContent) || 0;
        const totalInsta = parseFloat(document.getElementById('totalInstaCashier').textContent) || 0;
        const totalVisa = parseFloat(document.getElementById('totalVisaCashier').textContent) || 0;
        const totalOnline = parseFloat(document.getElementById('totalOnlineCashier').textContent) || 0;
        const grandTotal = parseFloat(document.getElementById('grandTotalCashier').textContent) || 0;

        const newShift = [
            shiftId,
            currentUser.username,
            document.getElementById('shiftDateFromCashier').value,
            document.getElementById('shiftTimeFromCashier').value,
            document.getElementById('shiftDateToCashier').value,
            document.getElementById('shiftTimeToCashier').value,
            totalExpenses,
            parseInt(document.getElementById('expenseCountCashier').textContent) || 0,
            totalInsta,
            parseInt(document.getElementById('instaCountCashier').textContent) || 0,
            totalVisa,
            parseInt(document.getElementById('visaCountCashier').textContent) || 0,
            totalOnline,
            parseInt(document.getElementById('onlineCountCashier').textContent) || 0,
            grandTotal,
            drawerCash,
            grandTotal, // NewMind total (افتراضي)
            drawerCash - grandTotal, // الفرق
            'مغلق',
            now.toISOString().split('T')[0],
            now.toTimeString().split(' ')[0],
            '' // المحاسب (يتم تعبئته لاحقاً)
        ];

        const result = await appendToSheet(SHEETS.SHIFT_CLOSURES, newShift);

        if (result.success) {
            showSuccessMessage('تم تقفيل الشيفت بنجاح.');
            resetCashierDailyData();
            loadAccountantShiftClosuresHistory(); // Refresh accountant's history
        } else {
            showErrorMessage('فشل تقفيل الشيفت.');
        }
    } catch (error) {
        showErrorMessage('حدث خطأ أثناء تقفيل الشيفت.');
        console.error(error);
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
    
    await loadCategories();
    await loadCustomers();
    await loadUsers();
    populateAccountantFilters(); // Ensure filters are populated
    showTab('dashboardTabAccountant');
}

async function updateAccountantDashboard() {
    const dateFrom = document.getElementById('dashboardDateFromAccountant')?.value;
    const dateTo = document.getElementById('dashboardDateToAccountant')?.value;
    const cashierFilter = document.getElementById('cashierFilterAccountant')?.value;

    showLoading(true);
    try {
        const filters = {};
        if (dateFrom) filters.dateFrom = dateFrom;
        if (dateTo) filters.dateTo = dateTo;
        if (cashierFilter) filters.cashier = cashierFilter;

        const expenses = await loadExpenses(filters);
        
        let totalNormalExpenses = 0;
        let countNormalExpenses = 0;
        let totalVisa = 0;
        let countVisa = 0;
        let totalInsta = 0;
        let countInsta = 0;
        let totalOnline = 0;
        let countOnline = 0;

        expenses.forEach(exp => {
            const category = categories.find(c => c.name === exp.category || c.code === exp.categoryCode);
            const formType = category ? category.formType : 'عادي';

            if (formType === 'فيزا') {
                totalVisa += exp.amount;
                countVisa++;
            } else if (formType === 'إنستا') {
                totalInsta += exp.amount;
                countInsta++;
            } else if (formType === 'اونلاين') {
                totalOnline += exp.amount;
                countOnline++;
            } else {
                totalNormalExpenses += exp.amount;
                countNormalExpenses++;
            }
        });

        document.getElementById('totalNormalExpensesAccountant').textContent = totalNormalExpenses.toFixed(2);
        document.getElementById('countNormalExpensesAccountant').textContent = countNormalExpenses;
        document.getElementById('totalVisaAccountant').textContent = totalVisa.toFixed(2);
        document.getElementById('countVisaAccountant').textContent = countVisa;
        document.getElementById('totalInstaAccountant').textContent = totalInsta.toFixed(2);
        document.getElementById('countInstaAccountant').textContent = countInsta;
        document.getElementById('totalOnlineAccountant').textContent = totalOnline.toFixed(2);
        document.getElementById('countOnlineAccountant').textContent = countOnline;

        // Cashiers stats
        const activeCashiers = users.filter(u => u.role === 'كاشير' && u.status === 'نشط').length;
        const inactiveCashiers = users.filter(u => u.role === 'كاشير' && u.status === 'موقوف').length;
        const blockedCashiers = users.filter(u => u.role === 'كاشير' && u.status === 'محظور').length;
        document.getElementById('totalActiveCashiersAccountant').textContent = activeCashiers;
        document.getElementById('totalInactiveCashiersAccountant').textContent = inactiveCashiers;
        document.getElementById('totalBlockedCashiersAccountant').textContent = blockedCashiers;

        // Customers stats
        const totalCustomers = customers.length;
        const customersWithCredit = customers.filter(c => c.totalCredit > 0).length;
        const totalCreditAmount = customers.reduce((sum, c) => sum + c.totalCredit, 0);
        const customersWithZeroCredit = customers.filter(c => c.totalCredit === 0).length;

        document.getElementById('totalCustomersAccountant').textContent = totalCustomers;
        document.getElementById('customersWithCreditAccountant').textContent = customersWithCredit;
        document.getElementById('totalCreditAmountAccountant').textContent = totalCreditAmount.toFixed(2);
        document.getElementById('customersWithZeroCreditAccountant').textContent = customersWithZeroCredit;


        // Update cashiers overview
        await updateCashiersOverview(filters);
    } catch (error) {
        console.error('Error updating dashboard:', error);
        showErrorMessage('حدث خطأ أثناء تحديث لوحة التحكم.');
    } finally {
        showLoading(false);
    }
}

async function updateCashiersOverview(filters = {}) {
    const tableBody = document.getElementById('cashiersOverviewBodyAccountant');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    
    const cashiers = users.filter(u => u.role === 'كاشير');
    
    for (const cashier of cashiers) {
        const cashierFilters = { ...filters, cashier: cashier.username };
        const expenses = await loadExpenses(cashierFilters);

        let normalExpensesTotal = 0;
        let normalExpensesCount = 0;
        let visaTotal = 0;
        let visaCount = 0;
        let instaTotal = 0;
        let instaCount = 0;
        let onlineTotal = 0;
        let onlineCount = 0;

        expenses.forEach(exp => {
            const category = categories.find(c => c.name === exp.category || c.code === exp.categoryCode);
            const formType = category ? category.formType : 'عادي';

            if (formType === 'فيزا') {
                visaTotal += exp.amount;
                visaCount++;
            } else if (formType === 'إنستا') {
                instaTotal += exp.amount;
                instaCount++;
            } else if (formType === 'اونلاين') {
                onlineTotal += exp.amount;
                onlineCount++;
            } else {
                normalExpensesTotal += exp.amount;
                normalExpensesCount++;
            }
        });
        
        const row = tableBody.insertRow();
        row.insertCell().textContent = cashier.name;
        row.insertCell().textContent = normalExpensesTotal.toFixed(2);
        row.insertCell().textContent = normalExpensesCount;
        row.insertCell().textContent = visaTotal.toFixed(2);
        row.insertCell().textContent = visaCount;
        row.insertCell().textContent = instaTotal.toFixed(2);
        row.insertCell().textContent = instaCount;
        row.insertCell().textContent = onlineTotal.toFixed(2);
        row.insertCell().textContent = onlineCount;
        row.insertCell().textContent = 'غير محدد'; // Last activity - placeholder
        row.insertCell().innerHTML = `<span class="status ${cashier.status === 'نشط' ? 'active' : 'inactive'}">${cashier.status}</span>`;
    }
}

async function searchInvoiceAccountant() {
    const invoiceNumber = document.getElementById('searchInputAccountant')?.value.trim();
    
    if (!invoiceNumber) {
        showWarningMessage('يرجى إدخال رقم الفاتورة للبحث.');
        return;
    }

    showLoading(true);
    
    try {
        const expenses = await loadExpenses();
        const filteredExpenses = expenses.filter(exp => 
            exp.invoiceNumber && exp.invoiceNumber.includes(invoiceNumber)
        );

        const resultDiv = document.getElementById('invoiceSearchResultAccountant');
        
        if (filteredExpenses.length === 0) {
            resultDiv.innerHTML = '<p class="message warning">لا توجد فواتير مطابقة للرقم المدخل.</p>';
        } else {
            let html = '<h4>نتائج البحث:</h4>';
            html += '<table class="expenses-table"><thead><tr><th>رقم الفاتورة</th><th>التصنيف</th><th>القيمة</th><th>التاريخ</th><th>الكاشير</th></tr></thead><tbody>';
            
            filteredExpenses.forEach(exp => {
                html += `<tr>
                    <td>${exp.invoiceNumber}</td>
                    <td>${exp.category}</td>
                    <td>${exp.amount.toFixed(2)}</td>
                    <td>${exp.date}</td>
                    <td>${exp.cashier}</td>
                </tr>`;
            });
            
            html += '</tbody></table>';
            resultDiv.innerHTML = html;
        }
        
        resultDiv.style.display = 'block';
    } catch (error) {
        showErrorMessage('حدث خطأ أثناء البحث.');
        console.error(error);
    } finally {
        showLoading(false);
    }
}

// --- Users Management (Accountant) ---
function displayUsers() {
    const tableBody = document.getElementById('usersTableBodyAccountant');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7">لا توجد مستخدمين مسجلين.</td></tr>';
        return;
    }

    users.forEach(user => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = user.name;
        row.insertCell().textContent = user.phone;
        row.insertCell().textContent = user.username;
        row.insertCell().textContent = user.role;
        row.insertCell().innerHTML = `<span class="status ${user.status === 'نشط' ? 'active' : 'inactive'}">${user.status}</span>`;
        row.insertCell().textContent = new Date(user.creationDate).toLocaleDateString('ar-EG');
        const actionsCell = row.insertCell();
        actionsCell.innerHTML = `
            <button class="edit-btn" onclick="showWarningMessage('وظيفة تعديل المستخدم غير متاحة حالياً.')"><i class="fas fa-edit"></i> تعديل</button>
            <button class="delete-btn" onclick="showWarningMessage('وظيفة حذف المستخدم غير متاحة حالياً.')"><i class="fas fa-trash"></i> حذف</button>
        `;
    });
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
    const password = document.getElementById('userPassword').value;
    const role = document.getElementById('userRole').value;

    if (!name || !phone || !username || !password || !role) {
        showWarningMessage('يرجى ملء جميع حقول المستخدم.');
        return;
    }

    // Check for duplicate username
    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
        showWarningMessage('اسم المستخدم موجود بالفعل.');
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
        showSuccessMessage('تم إضافة المستخدم بنجاح.');
        closeModal('addUserModal');
        await loadUsers();
        displayUsers();
        populateUserDropdown();
        populateAccountantFilters();
    } else {
        showErrorMessage('فشل إضافة المستخدم.');
    }
}

// --- Reports (Accountant) ---
function populateReportFilters() {
    populateAccountantFilters();
}

function populateAccountantFilters() {
    // Populate category filters
    const categorySelects = [
        'reportCategoryAccountant',
    ];

    categorySelects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = '<option value="">جميع التصنيفات</option>';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.name;
                option.textContent = cat.name;
                select.appendChild(option);
            });
        }
    });

    // Populate cashier filters
    const cashierSelects = [
        'reportCashierAccountant',
        'cashierFilterAccountant',
        'selectedCashierAccountant' // Added for accountant shift closure
    ];

    cashierSelects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = '<option value="">جميع الكاشيرز</option>';
            const cashiers = users.filter(u => u.role === 'كاشير');
            cashiers.forEach(cashier => {
                const option = document.createElement('option');
                option.value = cashier.username;
                option.textContent = cashier.name;
                select.appendChild(option);
            });
        }
    });
}

async function generateAccountantReport() {
    const dateFrom = document.getElementById('reportDateFromAccountant')?.value;
    const dateTo = document.getElementById('reportDateToAccountant')?.value;
    const cashier = document.getElementById('reportCashierAccountant')?.value;
    const category = document.getElementById('reportCategoryAccountant')?.value;

    if (!dateFrom || !dateTo) {
        showWarningMessage('يرجى تحديد تاريخ البداية والنهاية.');
        return;
    }

    showLoading(true);
    
    try {
        const filters = { dateFrom, dateTo };
        if (cashier) filters.cashier = cashier;
        
        const expenses = await loadExpenses(filters);
        let filteredExpenses = expenses;
        
        if (category) {
            filteredExpenses = expenses.filter(exp => exp.category === category);
        }

        displayAccountantReport(filteredExpenses, dateFrom, dateTo);
    } catch (error) {
        showErrorMessage('حدث خطأ أثناء إنشاء التقرير.');
        console.error(error);
    } finally {
        showLoading(false);
    }
}

function displayAccountantReport(expenses, dateFrom, dateTo) {
    const reportContent = document.getElementById('reportContentAccountant');
    if (!reportContent) return;
    
    const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const cashiers = [...new Set(expenses.map(exp => exp.cashier))];
    
    let html = `
        <div class="report-header">
            <h3>تقرير المصروفات</h3>
            <p>الفترة: من ${dateFrom} إلى ${dateTo}</p>
            <p>إجمالي عدد الفواتير: ${expenses.length}</p>
            <p>إجمالي القيمة: ${totalAmount.toFixed(2)}</p>
        </div>
    `;

    // تفصيل حسب الكاشير
    cashiers.forEach(cashier => {
        const cashierExpenses = expenses.filter(exp => exp.cashier === cashier);
        const cashierTotal = cashierExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        
        html += `
            <div class="cashier-section">
                <h4>الكاشير: ${cashier}</h4>
                <p>عدد الفواتير: ${cashierExpenses.length} | الإجمالي: ${cashierTotal.toFixed(2)}</p>
                <table>
                    <thead>
                        <tr>
                            <th>التاريخ</th>
                            <th>رقم الفاتورة</th>
                            <th>التصنيف</th>
                            <th>القيمة</th>
                            <th>الوقت</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        cashierExpenses.forEach(exp => {
            html += `
                <tr>
                    <td>${exp.date}</td>
                    <td>${exp.invoiceNumber || '--'}</td>
                    <td>${exp.category}</td>
                    <td>${exp.amount.toFixed(2)}</td>
                    <td>${exp.time}</td>
                </tr>
            `;
        });
        
        html += `</tbody></table></div>`;
    });

    reportContent.innerHTML = html;
}

function printReport() {
    const reportContent = document.getElementById('reportContentAccountant');
    if (!reportContent || !reportContent.innerHTML.trim()) {
        showWarningMessage('لا يوجد تقرير لطباعته. يرجى إنشاء التقرير أولاً.');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <title>تقرير المصروفات</title>
            <style>
                body { font-family: Arial, sans-serif; direction: rtl; text-align: right; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                th { background-color: #f2f2f2; }
                .report-header { margin-bottom: 30px; }
                .cashier-section { margin-bottom: 40px; }
                h3, h4 { color: #333; }
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
        showWarningMessage('لا يوجد تقرير للإرسال. يرجى إنشاء التقرير أولاً.');
        return;
    }
    
    const form = document.getElementById('whatsappForm');
    if (form) form.reset();
    
    const modal = document.getElementById('whatsappModal');
    if (modal) modal.classList.add('active');
}

function sendReportViaWhatsApp() {
    const phoneNumber = document.getElementById('whatsappNumber')?.value.trim();
    
    if (!phoneNumber) {
        showWarningMessage('يرجى إدخال رقم الواتساب.');
        return;
    }
    
    // Create a simple text version of the report
    const reportContent = document.getElementById('reportContentAccountant');
    if (!reportContent) return;
    
    const reportText = reportContent.innerText;
    const encodedText = encodeURIComponent(`تقرير المصروفات:\n${reportText}`);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedText}`;
    
    window.open(whatsappUrl, '_blank');
    closeModal('whatsappModal');
    showSuccessMessage('تم فتح واتساب لإرسال التقرير.');
}

// --- Shift Closures History (Accountant) ---
async function loadAccountantShiftClosuresHistory() {
    try {
        const closures = await loadShiftClosures();
        const tableBody = document.getElementById('closuresHistoryBodyAccountant');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        if (closures.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8">لا توجد شيفتات مغلقة.</td></tr>';
            return;
        }

        closures.sort((a, b) => new Date(`${b.dateTo} ${b.timeTo}`) - new Date(`${a.dateTo} ${a.timeTo}`));

        closures.forEach(closure => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = closure.cashier;
            row.insertCell().textContent = `${closure.dateFrom} - ${closure.dateTo}`;
            // Calculate "إجمالي الكاشير" as sum of all relevant totals + drawer cash
            const totalCashierCalculated = closure.totalExpenses + closure.totalInsta + closure.totalVisa + closure.totalOnline + closure.drawerCash;
            row.insertCell().textContent = totalCashierCalculated.toFixed(2); // Display calculated total
            row.insertCell().textContent = closure.newMindTotal.toFixed(2);
            row.insertCell().textContent = closure.difference.toFixed(2);
            row.insertCell().innerHTML = `<span class="status ${closure.status === 'مغلق' || closure.status.includes('مغلق (بواسطة المحاسب)') ? 'closed' : 'open'}">${closure.status}</span>`;
            row.insertCell().textContent = closure.closureDate;
            const actionsCell = row.insertCell();
            actionsCell.innerHTML = `<button class="view-btn" onclick="viewClosureDetails('${closure.id}')"><i class="fas fa-eye"></i> عرض</button>`;
        });
    } catch (error) {
        console.error('Error loading closures history:', error);
        showErrorMessage('حدث خطأ أثناء تحميل سجل التقفيلات.');
    }
}

async function searchCashierClosuresAccountant() {
    const selectedCashierUsername = document.getElementById('selectedCashierAccountant').value;
    const dateFrom = document.getElementById('accountantShiftDateFrom').value;
    const dateTo = document.getElementById('accountantShiftDateTo').value;
    const timeFrom = document.getElementById('accountantShiftTimeFrom').value;
    const timeTo = document.getElementById('accountantShiftTimeTo').value;

    if (!selectedCashierUsername) {
        showWarningMessage('يرجى اختيار كاشير للبحث.');
        return;
    }
    if (!dateFrom || !dateTo || !timeFrom || !timeTo) {
        showWarningMessage('يرجى تحديد فترة البحث (تاريخ ووقت).');
        return;
    }

    showLoading(true);
    try {
        const filters = {
            cashier: selectedCashierUsername,
            dateFrom: dateFrom,
            dateTo: dateTo,
            timeFrom: timeFrom,
            timeTo: timeTo
        };
        const expenses = await loadExpenses(filters);

        let totalNormalExpenses = 0;
        let totalVisa = 0;
        let totalInsta = 0;
        let totalOnline = 0;

        expenses.forEach(exp => {
            const category = categories.find(c => c.name === exp.category || c.code === exp.categoryCode);
            const formType = category ? category.formType : 'عادي';

            if (formType === 'فيزا') {
                totalVisa += exp.amount;
            } else if (formType === 'إنستا') {
                totalInsta += exp.amount;
            } else if (formType === 'اونلاين') {
                totalOnline += exp.amount;
            } else {
                totalNormalExpenses += exp.amount;
            }
        });

        // Find if there's a previous closure for this cashier in this period to get drawer cash
        const existingClosures = await loadShiftClosures({ cashier: selectedCashierUsername, dateFrom: dateFrom, dateTo: dateTo });
        let drawerCashFromPreviousClosure = 0;
        if (existingClosures.length > 0) {
            // Assuming we take the drawer cash from the most recent closure in the period
            const latestClosure = existingClosures.sort((a, b) => new Date(`${b.closureDate} ${b.closureTime}`) - new Date(`${a.closureDate} ${a.closureTime}`))[0];
            drawerCashFromPreviousClosure = latestClosure.drawerCash;
        }

        const grandTotalCashier = totalNormalExpenses + totalVisa + totalInsta + totalOnline + drawerCashFromPreviousClosure;

        document.getElementById('accTotalNormalExpenses').textContent = totalNormalExpenses.toFixed(2);
        document.getElementById('accTotalVisa').textContent = totalVisa.toFixed(2);
        document.getElementById('accTotalInsta').textContent = totalInsta.toFixed(2);
        document.getElementById('accTotalOnline').textContent = totalOnline.toFixed(2);
        document.getElementById('accDrawerCash').textContent = drawerCashFromPreviousClosure.toFixed(2); 
        document.getElementById('accGrandTotalCashier').textContent = grandTotalCashier.toFixed(2);

        document.getElementById('closureResultsAccountant').style.display = 'block';
        document.getElementById('newmindTotalAccountant').value = '';
        document.getElementById('differenceResultAccountant').style.display = 'none';
        document.getElementById('closeCashierByAccountant').style.display = 'block'; // Show close button

        showSuccessMessage('تم حساب الشيفت للكاشير بنجاح.');
    } catch (error) {
        console.error('Error searching cashier closures:', error);
        showErrorMessage('حدث خطأ أثناء البحث عن تقفيلات الكاشير.');
    } finally {
        showLoading(false);
    }
}

async function calculateDifferenceAccountant() {
    const cashierTotal = parseFloat(document.getElementById('accGrandTotalCashier').textContent);
    const newMindTotal = parseFloat(document.getElementById('newmindTotalAccountant').value);

    if (isNaN(newMindTotal)) {
        showWarningMessage('يرجى إدخال إجمالي نظام نيو مايند.');
        return;
    }

    const difference =  cashierTotal - newMindTotal;
    const resultDiv = document.getElementById('differenceResultAccountant');
    resultDiv.style.display = 'block';

    let message = `الفرق: ${difference.toFixed(2)}`;
    resultDiv.className = 'difference-result';

    if (difference > 0) {
        message += ' (زيادة)';
        resultDiv.classList.add('surplus');
    } else if (difference < 0) {
        message += ' (عجز)';
        resultDiv.classList.add('deficit');
    } else {
        message += ' (متطابق)';
        resultDiv.classList.add('balanced');
    }
    resultDiv.textContent = message;
}

async function closeCashierByAccountant() {
    const selectedCashierUsername = document.getElementById('selectedCashierAccountant').value;
    const dateFrom = document.getElementById('accountantShiftDateFrom').value;
    const dateTo = document.getElementById('accountantShiftDateTo').value;
    const timeFrom = document.getElementById('accountantShiftTimeFrom').value;
    const timeTo = document.getElementById('accountantShiftTimeTo').value;
    const newMindTotal = parseFloat(document.getElementById('newmindTotalAccountant').value);
    const cashierGrandTotal = parseFloat(document.getElementById('accGrandTotalCashier').textContent);
    const difference = newMindTotal - cashierGrandTotal;

    if (!selectedCashierUsername || !dateFrom || !dateTo || !timeFrom || !timeTo || isNaN(newMindTotal)) {
        showWarningMessage('يرجى التأكد من اختيار الكاشير وتحديد الفترة وإدخال إجمالي نيو مايند.');
        return;
    }

    showLoading(true);
    try {
        const now = new Date();
        const shiftId = 'SHIFT_ACC_' + now.getTime(); // Unique ID for accountant closure

        // Get individual totals from the displayed results
        const totalExpenses = parseFloat(document.getElementById('accTotalNormalExpenses').textContent) || 0;
        const totalVisa = parseFloat(document.getElementById('accTotalVisa').textContent) || 0;
        const totalInsta = parseFloat(document.getElementById('accTotalInsta').textContent) || 0;
        const totalOnline = parseFloat(document.getElementById('accTotalOnline').textContent) || 0;
        const drawerCash = parseFloat(document.getElementById('accDrawerCash').textContent) || 0;

        // We need to get counts for these as well, which are not currently displayed in acc closure results.
        // For simplicity, we'll re-calculate them or assume 0 if not available.
        const filters = {
            cashier: selectedCashierUsername,
            dateFrom: dateFrom,
            dateTo: dateTo,
            timeFrom: timeFrom,
            timeTo: timeTo
        };
        const expenses = await loadExpenses(filters);
        let expenseCount = 0;
        let visaCount = 0;
        let instaCount = 0;
        let onlineCount = 0;

        expenses.forEach(exp => {
            const category = categories.find(c => c.name === exp.category || c.code === exp.categoryCode);
            const formType = category ? category.formType : 'عادي';
            if (formType === 'فيزا') visaCount++;
            else if (formType === 'إنستا') instaCount++;
            else if (formType === 'اونلاين') onlineCount++;
            else expenseCount++;
        });


        const newShiftClosure = [
            shiftId,
            selectedCashierUsername,
            dateFrom,
            timeFrom,
            dateTo,
            timeTo,
            totalExpenses,
            expenseCount,
            totalInsta,
            instaCount,
            totalVisa,
            visaCount,
            totalOnline,
            onlineCount,
            cashierGrandTotal, // Grand total calculated by accountant
            drawerCash, // Drawer cash from previous closure or 0
            newMindTotal,
            difference,
            `مغلق (بواسطة المحاسب ${currentUserName})`,
            now.toISOString().split('T')[0],
            now.toTimeString().split(' ')[0],
            currentUser.username
        ];

        const result = await appendToSheet(SHEETS.SHIFT_CLOSURES, newShiftClosure);

        if (result.success) {
            showSuccessMessage('تم تقفيل شيفت الكاشير بنجاح بواسطة المحاسب.');
            // Reset the accountant shift closure form
            document.getElementById('closureResultsAccountant').style.display = 'none';
            document.getElementById('closeCashierByAccountant').style.display = 'none';
            document.getElementById('newmindTotalAccountant').value = '';
            document.getElementById('differenceResultAccountant').style.display = 'none';
            document.getElementById('selectedCashierAccountant').value = '';
            document.getElementById('accountantShiftDateFrom').value = new Date().toISOString().split('T')[0];
            document.getElementById('accountantShiftDateTo').value = new Date().toISOString().split('T')[0];
            document.getElementById('accountantShiftTimeFrom').value = new Date().toTimeString().split(' ')[0].substring(0, 5);
            document.getElementById('accountantShiftTimeTo').value = new Date().toTimeString().split(' ')[0].substring(0, 5);

            loadAccountantShiftClosuresHistory(); // Refresh history
        } else {
            showErrorMessage('فشل تقفيل شيفت الكاشير بواسطة المحاسب.');
        }
    } catch (error) {
        console.error('Error closing cashier shift by accountant:', error);
        showErrorMessage('حدث خطأ أثناء تقفيل شيفت الكاشير.');
    } finally {
        showLoading(false);
    }
}


function viewClosureDetails(closureId) {
    showWarningMessage('وظيفة عرض تفاصيل التقفيل قيد التطوير.');
}

// --- Utility Functions ---
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

function showSuccessMessage(message) {
    showMessage(message, 'success');
}

function showWarningMessage(message) {
    showMessage(message, 'warning');
}

function showErrorMessage(message) {
    showMessage(message, 'error');
}

function showMessage(message, type) {
    const container = document.getElementById('messageContainer');
    if (!container) {
        console.warn('Message container not found');
        return;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.style.cssText = `
        background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#fff3cd'};
        color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#856404'};
        border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#ffeaa7'};
        padding: 15px 20px;
        border-radius: 8px;
        margin-bottom: 10px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        animation: slideIn 0.3s ease;
    `;
    messageDiv.textContent = message;
    
    container.appendChild(messageDiv);
    
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, 5000);
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', function() {
    // Set default dates to today
    const today = new Date().toISOString().split('T')[0];
    const timeNow = new Date().toTimeString().split(' ')[0].substring(0, 5);
    
    document.querySelectorAll('input[type="date"]').forEach(input => {
        if (!input.value) {
            input.value = today;
        }
    });
    
    document.querySelectorAll('input[type="time"]').forEach(input => {
        if (!input.value) {
            input.value = timeNow;
        }
    });

    // Initialize Google APIs
    if (typeof gapi !== 'undefined') {
        gapiLoaded();
    }
    
    if (typeof google !== 'undefined') {
        gisLoaded();
    }
});

// Close suggestions when clicking outside
document.addEventListener('click', function(e) {
    const suggestionsElements = document.querySelectorAll('.suggestions');
    suggestionsElements.forEach(suggestions => {
        const input = suggestions.previousElementSibling;
        if (input && e.target !== input && !suggestions.contains(e.target)) {
            suggestions.style.display = 'none';
        }
    });
});

// Load Google API scripts dynamically
function loadGoogleScripts() {
    return new Promise((resolve) => {
        // Load GAPI
        if (!window.gapi) {
            const script1 = document.createElement('script');
            script1.src = 'https://apis.google.com/js/api.js';
            script1.onload = () => {
                gapiLoaded();
            };
            document.head.appendChild(script1);
        }

        // Load GIS
        if (!window.google) {
            const script2 = document.createElement('script');
            script2.src = 'https://accounts.google.com/gsi/client';
            script2.onload = () => {
                gisLoaded();
                resolve();
            };
            document.head.appendChild(script2);
        } else {
            resolve();
        }
    });
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadGoogleScripts();
    });
} else {
    loadGoogleScripts();
}
