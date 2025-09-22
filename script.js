// --- Google Sheets API Configuration ---
const API_KEY = 'AIzaSyAFKAWVM6Y7V3yxuD7c-9u0e11Ki1z-5VU'; // Replace with your actual API Key
const CLIENT_ID = '514562869133-nuervm5carqqctkqudvqkcolup7s12ve.apps.googleusercontent.com'; // Replace with your actual Client ID
const SPREADSHEET_ID = '16WsTQuebZDGErC8NwPRYf7qsHDVWhfDvUtvQ7u7IC9Q'; // Replace with your actual Spreadsheet ID
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets'; // Full read/write access

// Sheet names
const SHEETS = {
    USERS: 'Users',
    CATEGORIES: 'Categories',
    EXPENSES: 'Expenses',
    CUSTOMERS: 'Customers',
    SHIFT_CLOSURES: 'ShiftClosures'
};

let gapiInited = false;
let gisInited = false;
let tokenClient;

// --- Global Application State ---
let users = []; // Loaded from Google Sheets (ID, Name, Phone, Username, Password, Role, Status, CreationDate)
let categories = []; // Loaded from Google Sheets (Code, Name, FormType, CreationDate, CreatedBy)
let customers = []; // Loaded from Google Sheets (ID, Name, Phone, TotalCredit, CreationDate, LastUpdate)
let currentUser = null;
let currentUserName = '';
let currentUserRole = '';

let cashierDailyData = {
    expenses: [], // All expenses for the current cashier for the current shift
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
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
    });
    gapiInited = true;
    maybeEnableButtons();
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later
    });
    gisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        loadInitialData();
    }
}

async function handleAuthClick() {
    return new Promise((resolve, reject) => {
        tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) {
                console.error('Authentication failed:', resp);
                showErrorMessage('فشل المصادقة مع Google Sheets. يرجى التحقق من الأذونات.');
                reject(resp);
            } else {
                console.log('Authentication successful.');
                resolve();
            }
        };

        if (gapi.client.getToken() === null) {
            // Prompt user for consent if no token exists
            tokenClient.requestAccessToken({prompt: 'consent'});
        } else {
            // Attempt to get a token silently if one exists
            tokenClient.requestAccessToken({prompt: ''});
        }
    });
}

// --- Google Sheets API Functions ---
async function readSheet(sheetName, range = '') {
    try {
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
    const data = await readSheet(SHEETS.USERS);
    if (data.length > 1) {
        users = data.slice(1).map(row => ({
            id: row[0],
            name: row[1],
            phone: row[2],
            username: row[3],
            password: row[4],
            role: row[5],
            status: row[6],
            creationDate: row[7]
        }));
    } else {
        users = [];
    }
}

async function loadCategories() {
    const data = await readSheet(SHEETS.CATEGORIES);
    if (data.length > 1) {
        categories = data.slice(1).map(row => ({
            code: row[0],
            name: row[1],
            formType: row[2],
            creationDate: row[3],
            createdBy: row[4]
        }));
    } else {
        categories = [];
    }
}

async function loadCustomers() {
    const data = await readSheet(SHEETS.CUSTOMERS);
    if (data.length > 1) {
        customers = data.slice(1).map(row => ({
            id: row[0],
            name: row[1],
            phone: row[2],
            totalCredit: parseFloat(row[3] || 0),
            creationDate: row[4],
            lastUpdate: row[5]
        }));
    } else {
        customers = [];
    }
}

async function loadExpenses(filters = {}) {
    const data = await readSheet(SHEETS.EXPENSES);
    if (data.length <= 1) return [];

    let expenses = data.slice(1).map(row => ({
        id: row[0],
        category: row[1],
        categoryCode: row[2],
        invoiceNumber: row[3],
        amount: parseFloat(row[4] || 0),
        notes: row[5],
        date: row[6],
        time: row[7],
        cashier: row[8],
        year: row[9],
        referenceNumber: row[10],
        tabName: row[11],
        tabPhone: row[12],
        location: row[13],
        personName: row[14],
        companyName: row[15],
        companyCode: row[16],
        customer: row[17]
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
}

async function loadShiftClosures(filters = {}) {
    const data = await readSheet(SHEETS.SHIFT_CLOSURES);
    if (data.length <= 1) return [];

    let closures = data.slice(1).map(row => ({
        id: row[0],
        cashier: row[1],
        dateFrom: row[2],
        timeFrom: row[3],
        dateTo: row[4],
        timeTo: row[5],
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
        status: row[18],
        closureDate: row[19],
        closureTime: row[20],
        accountant: row[21]
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
}

// --- Initial Data Loading on Page Load ---
async function loadInitialData() {
    await handleAuthClick();
    await loadUsers();
    await loadCategories();
    await loadCustomers();
    populateUserDropdown();
}

function populateUserDropdown() {
    const usernameSelect = document.getElementById('username');
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
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

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
    localStorage.removeItem('currentUser');
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

    document.getElementById(tabId).classList.add('active');
    document.querySelector(`.nav-tab[onclick="showTab('${tabId}')"]`).classList.add('active');

    // Specific actions for each tab
    if (tabId === 'categoriesTabCashier' || tabId === 'categoriesTabAccountant') {
        displayCategories(tabId === 'categoriesTabCashier' ? 'categoriesGridCashier' : 'categoriesGridAccountant');
    } else if (tabId === 'expensesTabCashier') {
        loadCashierExpenses();
        populateExpenseCategoryFilter();
    } else if (tabId === 'customersTabCashier') {
        displayCustomers('customersTableBodyCashier');
    } else if (tabId === 'dashboardTabAccountant') {
        updateAccountantDashboard();
    } else if (tabId === 'usersTabAccountant') {
        displayUsers();
    } else if (tabId === 'reportsTabAccountant') {
        populateReportFilters();
    } else if (tabId === 'shiftCloseTabAccountant') {
        loadAccountantShiftClosuresHistory();
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
    document.getElementById('expensesTableBodyCashier').innerHTML = '';
    document.getElementById('shiftSummaryCashier').style.display = 'none';
    document.getElementById('drawerCashCashier').value = '';
    updateCashierShiftSummary();
}

// --- Categories Management ---
function displayCategories(gridId) {
    const categoriesGrid = document.getElementById(gridId);
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
                <button class="edit-btn" onclick="editCategory('${cat.code}')"><i class="fas fa-edit"></i> تعديل</button>
                <button class="delete-btn" onclick="deleteCategory('${cat.code}')"><i class="fas fa-trash"></i> حذف</button>
            </div>
        `;
        categoriesGrid.appendChild(categoryCard);
    });
}

function showAddCategoryModal() {
    document.getElementById('addCategoryForm').reset();
    document.getElementById('addCategoryModal').classList.add('active');
}

async function addCategory() {
    const code = document.getElementById('categoryCode').value.trim();
    const name = document.getElementById('categoryName').value.trim();
    const formType = document.getElementById('formType').value;

    if (!code || !name || !formType) {
        showWarningMessage('يرجى ملء جميع حقول التصنيف.');
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
        populateReportFilters();
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
    document.getElementById('addExpenseForm').reset();
    document.getElementById('expenseCategorySearch').value = '';
    document.getElementById('expenseCategorySuggestions').innerHTML = '';
    document.getElementById('selectedExpenseCategoryCode').value = '';
    document.getElementById('selectedExpenseCategoryName').value = '';
    document.getElementById('selectedExpenseCategoryFormType').value = '';
    document.getElementById('dynamicExpenseForm').innerHTML = '';
    document.getElementById('addExpenseModal').classList.add('active');
}

function searchExpenseCategories(searchTerm) {
    const suggestionsDiv = document.getElementById('expenseCategorySuggestions');
    suggestionsDiv.innerHTML = '';
    if (searchTerm.length < 2) return;

    const filtered = categories.filter(cat => 
        cat.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        cat.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.forEach(cat => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.textContent = `${cat.name} (${cat.code})`;
        item.onclick = () => selectExpenseCategory(cat);
        suggestionsDiv.appendChild(item);
    });
}

function selectExpenseCategory(category) {
    document.getElementById('expenseCategorySearch').value = category.name;
    document.getElementById('selectedExpenseCategoryCode').value = category.code;
    document.getElementById('selectedExpenseCategoryName').value = category.name;
    document.getElementById('selectedExpenseCategoryFormType').value = category.formType;
    document.getElementById('expenseCategorySuggestions').innerHTML = '';
    generateDynamicExpenseForm(category.formType);
}

function generateDynamicExpenseForm(formType) {
    const dynamicFormDiv = document.getElementById('dynamicExpenseForm');
    dynamicFormDiv.innerHTML = '';

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

    if (formType === 'عادي' || formType === 'اجل' || formType === 'فيزا' || formType === 'اونلاين' || formType === 'مرتجع' || formType === 'خصم عميل' || formType === 'إنستا') {
        formHtml = `
            <div class="form-group">
                <label for="expenseInvoiceNumber">رقم الفاتورة:</label>
                <input type="text" id="expenseInvoiceNumber" ${formType !== 'اجل' ? 'required' : ''} placeholder="أدخل رقم الفاتورة">
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
    } else if (formType === 'بنزين' || formType === 'سلف' || formType === 'عجوزات') {
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
                <input type="text" id="customerSearch" placeholder="ابحث بالاسم أو الرقم" onkeyup="searchCustomersForExpense(this.value)">
                <div id="customerSuggestions" class="suggestions"></div>
                <input type="hidden" id="selectedCustomerId">
                <input type="hidden" id="selectedCustomerName">
            </div>
            <button type="button" class="add-btn" onclick="showAddCustomerModal(true)">
                <i class="fas fa-plus"></i> عميل جديد
            </button>
        `;
    }

    dynamicFormDiv.innerHTML = formHtml;
}

function searchCustomersForExpense(searchTerm) {
    const suggestionsDiv = document.getElementById('customerSuggestions');
    suggestionsDiv.innerHTML = '';
    if (searchTerm.length < 2) return;

    const filtered = customers.filter(cust => 
        cust.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        cust.phone.includes(searchTerm)
    );

    filtered.forEach(cust => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.textContent = `${cust.name} (${cust.phone})`;
        item.onclick = () => selectCustomerForExpense(cust);
        suggestionsDiv.appendChild(item);
    });
}

function selectCustomerForExpense(customer) {
    document.getElementById('customerSearch').value = customer.name;
    document.getElementById('selectedCustomerId').value = customer.id;
    document.getElementById('selectedCustomerName').value = customer.name;
    document.getElementById('customerSuggestions').innerHTML = '';
}

async function addExpense() {
    const categoryCode = document.getElementById('selectedExpenseCategoryCode').value;
    const categoryName = document.getElementById('selectedExpenseCategoryName').value;
    const formType = document.getElementById('selectedExpenseCategoryFormType').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const notes = document.getElementById('expenseNotes').value.trim();

    if (!categoryCode || isNaN(amount) || amount <= 0) {
        showWarningMessage('يرجى اختيار تصنيف وإدخال قيمة صحيحة.');
        return;
    }

    const now = new Date();
    const expenseId = 'EXP_' + now.getTime();
    
    let expenseData = [
        expenseId,
        categoryName,
        categoryCode,
        '', // Invoice number - will be set below
        amount,
        notes,
        now.toISOString().split('T')[0], // Date
        now.toTimeString().split(' ')[0], // Time
        currentUser.username,
        now.getFullYear().toString(),
        '', // Reference number
        '', // Tab name
        '', // Tab phone
        '', // Location
        '', // Person name
        '', // Company name
        '', // Company code
        ''  // Customer ID
    ];

    // Set specific fields based on formType
    if (formType === 'عادي' || formType === 'اجل' || formType === 'فيزا' || formType === 'اونلاين' || formType === 'مرتجع' || formType === 'خصم عميل' || formType === 'إنستا') {
        const invoiceNumber = document.getElementById('expenseInvoiceNumber').value.trim();
        if (formType !== 'اجل' && !invoiceNumber) {
            showWarningMessage('يرجى إدخال رقم الفاتورة.');
            return;
        }
        expenseData[3] = invoiceNumber;
    }

    if (formType === 'فيزا') {
        const visaRef = document.getElementById('visaReferenceNumber').value.trim();
        expenseData[9] = visaRef;
    } else if (formType === 'شحن_تاب') {
        expenseData[10] = document.getElementById('tabName').value.trim();
        expenseData[11] = document.getElementById('tabPhone').value.trim();
    } else if (formType === 'شحن_كهربا') {
        expenseData[12] = document.getElementById('electricityLocation').value.trim();
    } else if (formType === 'بنزين' || formType === 'سلف' || formType === 'عجوزات') {
        expenseData[13] = document.getElementById('personName').value.trim();
    } else if (formType === 'دفعة_شركة') {
        expenseData[14] = document.getElementById('companyName').value.trim();
        expenseData[15] = document.getElementById('companyCode').value.trim();
    } else if (formType === 'اجل') {
        const customerId = document.getElementById('selectedCustomerId').value;
        if (!customerId) {
            showWarningMessage('يرجى اختيار العميل الآجل.');
            return;
        }
        expenseData[16] = customerId;
    }

    const result = await appendToSheet(SHEETS.EXPENSES, expenseData);

    if (result.success) {
        showSuccessMessage(`تم إضافة ${categoryName} بنجاح.`);
        closeModal('addExpenseModal');
        
        // Update local cashierDailyData
        const newEntry = {
            id: expenseId,
            category: categoryName,
            categoryCode: categoryCode,
            invoiceNumber: expenseData[3],
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
        updateCashierShiftSummary();
    } else {
        showErrorMessage('فشل إضافة المصروف.');
    }
}

async function loadCashierExpenses() {
    const expenses = await loadExpenses({ cashier: currentUser.username });
    
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
    updateCashierShiftSummary();
}

function populateExpenseCategoryFilter() {
    const filterSelect = document.getElementById('expenseCategoryFilterCashier');
    filterSelect.innerHTML = '<option value="">جميع التصنيفات</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        filterSelect.appendChild(option);
    });
}

function filterCashierExpenses() {
    const categoryFilter = document.getElementById('expenseCategoryFilterCashier').value;
    const dateFromFilter = document.getElementById('expenseDateFromFilterCashier').value;
    const dateToFilter = document.getElementById('expenseDateToFilterCashier').value;
    const tableBody = document.getElementById('expensesTableBodyCashier');
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
    document.getElementById('expenseCategoryFilterCashier').value = '';
    document.getElementById('expenseDateFromFilterCashier').value = '';
    document.getElementById('expenseDateToFilterCashier').value = '';
    filterCashierExpenses();
}

// --- Customers Management ---
function displayCustomers(tableBodyId) {
    const tableBody = document.getElementById(tableBodyId);
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
        actionsCell.innerHTML = `
            <button class="edit-btn" onclick="showWarningMessage('وظيفة تعديل العميل غير متاحة حالياً.')"><i class="fas fa-edit"></i> تعديل</button>
            <button class="delete-btn" onclick="showWarningMessage('وظيفة حذف العميل غير متاحة حالياً.')"><i class="fas fa-trash"></i> حذف</button>
            <button class="add-btn" onclick="showWarningMessage('وظيفة سداد/أجل العميل غير متاحة حالياً.')"><i class="fas fa-money-bill-wave"></i> سداد/أجل</button>
        `;
    });
}

function showAddCustomerModal(fromExpense = false) {
    document.getElementById('addCustomerForm').reset();
    document.getElementById('addCustomerModal').classList.add('active');
    document.getElementById('addCustomerModal').dataset.fromExpense = fromExpense;
}

async function addCustomer() {
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();

    if (!name || !phone) {
        showWarningMessage('يرجى ملء جميع حقول العميل.');
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
        if (document.getElementById('addCustomerModal').dataset.fromExpense === 'true') {
            const currentFormType = document.getElementById('selectedExpenseCategoryFormType').value;
            if (currentFormType === 'اجل') {
                const newCustomerObj = { id: customerId, name: name, phone: phone };
                selectCustomerForExpense(newCustomerObj);
            }
        }
    } else {
        showErrorMessage('فشل إضافة العميل.');
    }
}

// --- Shift Management ---
function updateCashierShiftSummary() {
    const summaryDiv = document.getElementById('shiftSummaryCashier');
    const totalExpenses = cashierDailyData.totalExpenses;
    const totalInsta = cashierDailyData.totalInsta;
    const totalVisa = cashierDailyData.totalVisa;
    const totalOnline = cashierDailyData.totalOnline;
    const grandTotal = totalExpenses + totalInsta + totalVisa + totalOnline;
    const drawerCash = parseFloat(document.getElementById('drawerCashCashier').value) || 0;

    summaryDiv.innerHTML = `
        <div class="summary-item">
            <span>إجمالي المصروفات العادية:</span>
            <span>${totalExpenses.toFixed(2)}</span>
        </div>
        <div class="summary-item">
            <span>إجمالي إنستا:</span>
            <span>${totalInsta.toFixed(2)}</span>
        </div>
        <div class="summary-item">
            <span>إجمالي فيزا:</span>
            <span>${totalVisa.toFixed(2)}</span>
        </div>
        <div class="summary-item">
            <span>إجمالي أونلاين:</span>
            <span>${totalOnline.toFixed(2)}</span>
        </div>
        <div class="summary-item total">
            <span>الإجمالي الكلي:</span>
            <span>${grandTotal.toFixed(2)}</span>
        </div>
        <div class="summary-item">
            <span>النقدية في الدرج:</span>
            <span>${drawerCash.toFixed(2)}</span>
        </div>
        <div class="summary-item">
            <span>الفرق:</span>
            <span>${(drawerCash - grandTotal).toFixed(2)}</span>
        </div>
    `;
    summaryDiv.style.display = 'block';
}

function showCloseShiftModal() {
    const drawerCash = parseFloat(document.getElementById('drawerCashCashier').value) || 0;
    const totalExpenses = cashierDailyData.totalExpenses;
    const totalInsta = cashierDailyData.totalInsta;
    const totalVisa = cashierDailyData.totalVisa;
    const totalOnline = cashierDailyData.totalOnline;
    const grandTotal = totalExpenses + totalInsta + totalVisa + totalOnline;
    const difference = drawerCash - grandTotal;

    document.getElementById('closeShiftCashierName').textContent = currentUserName;
    document.getElementById('closeShiftDate').textContent = new Date().toLocaleDateString('ar-EG');
    document.getElementById('closeShiftExpenseCount').textContent = cashierDailyData.expenses.length;
    document.getElementById('closeShiftTotalExpenses').textContent = totalExpenses.toFixed(2);
    document.getElementById('closeShiftInstaCount').textContent = cashierDailyData.insta.length;
    document.getElementById('closeShiftTotalInsta').textContent = totalInsta.toFixed(2);
    document.getElementById('closeShiftVisaCount').textContent = cashierDailyData.visa.length;
    document.getElementById('closeShiftTotalVisa').textContent = totalVisa.toFixed(2);
    document.getElementById('closeShiftOnlineCount').textContent = cashierDailyData.online.length;
    document.getElementById('closeShiftTotalOnline').textContent = totalOnline.toFixed(2);
    document.getElementById('closeShiftGrandTotal').textContent = grandTotal.toFixed(2);
    document.getElementById('closeShiftDrawerCash').textContent = drawerCash.toFixed(2);
    document.getElementById('closeShiftDifference').textContent = difference.toFixed(2);

    document.getElementById('closeShiftModal').classList.add('active');
}

async function closeShift() {
    const now = new Date();
    const shiftId = 'SHIFT_' + now.getTime();
    const drawerCash = parseFloat(document.getElementById('drawerCashCashier').value) || 0;
    const totalExpenses = cashierDailyData.totalExpenses;
    const totalInsta = cashierDailyData.totalInsta;
    const totalVisa = cashierDailyData.totalVisa;
    const totalOnline = cashierDailyData.totalOnline;
    const grandTotal = totalExpenses + totalInsta + totalVisa + totalOnline;
    const difference = drawerCash - grandTotal;

    const newShift = [
        shiftId,
        currentUser.username,
        cashierDailyData.shiftStartDate || now.toISOString().split('T')[0],
        cashierDailyData.shiftStartTime || now.toTimeString().split(' ')[0],
        now.toISOString().split('T')[0],
        now.toTimeString().split(' ')[0],
        totalExpenses,
        cashierDailyData.expenses.length,
        totalInsta,
        cashierDailyData.insta.length,
        totalVisa,
        cashierDailyData.visa.length,
        totalOnline,
        cashierDailyData.online.length,
        grandTotal,
        drawerCash,
        grandTotal, // NewMindTotal (same as grandTotal for now)
        difference,
        'مغلق',
        now.toISOString().split('T')[0],
        now.toTimeString().split(' ')[0],
        '' // Accountant (empty for now)
    ];

    const result = await appendToSheet(SHEETS.SHIFT_CLOSURES, newShift);

    if (result.success) {
        showSuccessMessage('تم إغلاق الشيفت بنجاح.');
        closeModal('closeShiftModal');
        resetCashierDailyData();
    } else {
        showErrorMessage('فشل إغلاق الشيفت.');
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
    showTab('dashboardTabAccountant');
}

function updateAccountantDashboard() {
    const totalUsers = users.length;
    const totalCategories = categories.length;
    const totalCustomers = customers.length;
    const today = new Date().toISOString().split('T')[0];
    
    // Load today's expenses for dashboard
    loadExpenses({ dateFrom: today, dateTo: today }).then(expenses => {
        const totalTodayExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
        
        document.getElementById('dashboardStats').innerHTML = `
            <div class="stat-card">
                <h3>إجمالي المستخدمين</h3>
                <p>${totalUsers}</p>
            </div>
            <div class="stat-card">
                <h3>إجمالي التصنيفات</h3>
                <p>${totalCategories}</p>
            </div>
            <div class="stat-card">
                <h3>إجمالي العملاء</h3>
                <p>${totalCustomers}</p>
            </div>
            <div class="stat-card">
                <h3>مصروفات اليوم</h3>
                <p>${totalTodayExpenses.toFixed(2)}</p>
            </div>
        `;
    });
}

// --- Users Management (Accountant) ---
function displayUsers() {
    const tableBody = document.getElementById('usersTableBodyAccountant');
    tableBody.innerHTML = '';
    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6">لا توجد مستخدمين مسجلين.</td></tr>';
        return;
    }

    users.forEach(user => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = user.name;
        row.insertCell().textContent = user.phone;
        row.insertCell().textContent = user.username;
        row.insertCell().textContent = user.role;
        row.insertCell().textContent = user.status;
        const actionsCell = row.insertCell();
        actionsCell.innerHTML = `
            <button class="edit-btn" onclick="showWarningMessage('وظيفة تعديل المستخدم غير متاحة حالياً.')"><i class="fas fa-edit"></i> تعديل</button>
            <button class="delete-btn" onclick="showWarningMessage('وظيفة حذف المستخدم غير متاحة حالياً.')"><i class="fas fa-trash"></i> حذف</button>
        `;
    });
}

function showAddUserModal() {
    document.getElementById('addUserForm').reset();
    document.getElementById('addUserModal').classList.add('active');
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
    } else {
        showErrorMessage('فشل إضافة المستخدم.');
    }
}

// --- Reports (Accountant) ---
function populateReportFilters() {
    const categorySelect = document.getElementById('reportCategoryFilter');
    const cashierSelect = document.getElementById('reportCashierFilter');
    
    categorySelect.innerHTML = '<option value="">جميع التصنيفات</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        categorySelect.appendChild(option);
    });

    cashierSelect.innerHTML = '<option value="">جميع الكاشير</option>';
    const cashiers = users.filter(u => u.role === 'كاشير');
    cashiers.forEach(cashier => {
        const option = document.createElement('option');
        option.value = cashier.username;
        option.textContent = cashier.name;
        cashierSelect.appendChild(option);
    });
}

async function generateReport() {
    const category = document.getElementById('reportCategoryFilter').value;
    const cashier = document.getElementById('reportCashierFilter').value;
    const dateFrom = document.getElementById('reportDateFrom').value;
    const dateTo = document.getElementById('reportDateTo').value;

    if (!dateFrom || !dateTo) {
        showWarningMessage('يرجى تحديد تاريخ البداية والنهاية.');
        return;
    }

    const filters = { dateFrom, dateTo };
    if (cashier) filters.cashier = cashier;
    
    const expenses = await loadExpenses(filters);
    
    let filteredExpenses = expenses;
    if (category) {
        filteredExpenses = expenses.filter(exp => exp.category === category);
    }

    displayReportResults(filteredExpenses);
}

function displayReportResults(expenses) {
    const resultsDiv = document.getElementById('reportResults');
    const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    resultsDiv.innerHTML = `
        <div class="report-summary">
            <h3>ملخص التقرير</h3>
            <p>عدد المصروفات: ${expenses.length}</p>
            <p>إجمالي القيمة: ${totalAmount.toFixed(2)}</p>
        </div>
        <table class="report-table">
            <thead>
                <tr>
                    <th>التصنيف</th>
                    <th>رقم الفاتورة</th>
                    <th>القيمة</th>
                    <th>التاريخ</th>
                    <th>الوقت</th>
                    <th>الكاشير</th>
                    <th>ملاحظات</th>
                </tr>
            </thead>
            <tbody>
                ${expenses.map(exp => `
                    <tr>
                        <td>${exp.category}</td>
                        <td>${exp.invoiceNumber || '--'}</td>
                        <td>${exp.amount.toFixed(2)}</td>
                        <td>${exp.date}</td>
                        <td>${exp.time}</td>
                        <td>${exp.cashier}</td>
                        <td>${exp.notes || '--'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function exportReport() {
    showWarningMessage('وظيفة تصدير التقرير غير متاحة حالياً.');
}

// --- Shift Closures History (Accountant) ---
async function loadAccountantShiftClosuresHistory() {
    const closures = await loadShiftClosures();
    const tableBody = document.getElementById('shiftClosuresTableBodyAccountant');
    tableBody.innerHTML = '';
    
    if (closures.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8">لا توجد شيفتات مغلقة.</td></tr>';
        return;
    }

    closures.sort((a, b) => new Date(`${b.dateTo} ${b.timeTo}`) - new Date(`${a.dateTo} ${a.timeTo}`));

    closures.forEach(closure => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = closure.cashier;
        row.insertCell().textContent = closure.dateFrom;
        row.insertCell().textContent = closure.timeFrom;
        row.insertCell().textContent = closure.dateTo;
        row.insertCell().textContent = closure.timeTo;
        row.insertCell().textContent = closure.grandTotal.toFixed(2);
        row.insertCell().textContent = closure.difference.toFixed(2);
        row.insertCell().textContent = closure.status;
    });
}

// --- Utility Functions ---
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
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
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', function() {
    // Check for saved user session
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        currentUserName = currentUser.name;
        currentUserRole = currentUser.role;
        
        if (currentUserRole === 'كاشير') {
            showCashierPage();
        } else if (currentUserRole === 'محاسب') {
            showAccountantPage();
        }
    }
});

// --- Google API Scripts ---
// Add these scripts to your HTML head section
// <script src="https://apis.google.com/js/api.js" onload="gapiLoaded()"></script>
// <script src="https://accounts.google.com/gsi/client" onload="gisLoaded()"></script>
