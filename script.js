// --- Google Sheets API Configuration ---
const API_KEY = 'AIzaSyAFKAWVM6Y7V3yxuD7c-9u0e11Ki1z-5VU'; // Replace with your actual API Key
const CLIENT_ID = '514562869133-nuervm5carqqctkqudvqkcolup7s12ve.apps.googleusercontent.com'; // Replace with your actual Client ID
const SPREADSHEET_ID = '16WsTQuebZDGErC8NwPRYf7qsHDVWhfDvUtvQ7u7IC9Q'; // Replace with your actual Spreadsheet ID
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets'; // Full read/write access

// IMPORTANT: Replace this with your deployed Google Apps Script Web App URL
const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyYjss75eDav5tcY-8l3W1mJTwAArPCrSMDOKZwOmj2H1pH5JOP3AUFg29HQioRhQF-5g/exec'; 

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

// --- Google Apps Script Interaction ---
async function callAppScript(action, data = {}) {
    showLoadingOverlay();
    try {
        const response = await fetch(APP_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action, ...data }),
        });
        const result = await response.json();
        if (!result.success) {
            showErrorMessage(result.message || 'حدث خطأ غير معروف.');
        }
        return result;
    } catch (error) {
        console.error('Error calling App Script:', error);
        showErrorMessage('خطأ في الاتصال بالخادم. يرجى التحقق من الاتصال بالإنترنت.');
        return { success: false, message: 'خطأ في الاتصال بالخادم.' };
    } finally {
        hideLoadingOverlay();
    }
}

// --- Initial Data Loading on Page Load ---
async function loadInitialData() {
    await loadUsers();
    await loadCategories();
    await loadCustomers();
    populateUserDropdown();
}

async function loadUsers() {
    const result = await callAppScript('getUsers');
    if (result.success) {
        users = result.data.map(row => ({
            id: row[0],
            name: row[1],
            phone: row[2],
            username: row[3],
            password: row[4], // Note: In a real app, passwords should be hashed and never sent to client.
            role: row[5],
            status: row[6],
            creationDate: row[7]
        }));
    } else {
        users = [];
    }
}

async function loadCategories() {
    const result = await callAppScript('getCategories');
    if (result.success) {
        categories = result.data.map(row => ({
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
    const result = await callAppScript('getCustomers');
    if (result.success) {
        customers = result.data.map(row => ({
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

    const result = await callAppScript('login', { username, password });

    if (result.success) {
        currentUser = result.user;
        currentUserName = result.user.name;
        currentUserRole = result.user.role;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        if (currentUserRole === 'كاشير') {
            showCashierPage();
        } else if (currentUserRole === 'محاسب') {
            showAccountantPage();
        }
        showSuccessMessage(`مرحباً بك، ${currentUserName}!`);
    } else {
        showErrorMessage(result.message || 'اسم المستخدم أو كلمة المرور غير صحيحة.');
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
    
    await loadCategories(); // Reload categories in case accountant changed them
    await loadCustomers(); // Reload customers in case accountant changed them
    resetCashierDailyData(); // Clear previous shift data
    showTab('expensesTabCashier'); // Default to expenses tab
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
    // Clear UI elements
    document.getElementById('expensesTableBodyCashier').innerHTML = '';
    document.getElementById('shiftSummaryCashier').style.display = 'none';
    document.getElementById('drawerCashCashier').value = '';
    updateCashierShiftSummary();
}

// --- Categories Management (Cashier & Accountant) ---
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

    const result = await callAppScript('addCategory', {
        code,
        name,
        formType,
        createdBy: currentUserName
    });

    if (result.success) {
        showSuccessMessage('تم إضافة التصنيف بنجاح.');
        closeModal('addCategoryModal');
        await loadCategories();
        displayCategories('categoriesGridCashier'); // Refresh for cashier
        displayCategories('categoriesGridAccountant'); // Refresh for accountant
        populateExpenseCategoryFilter(); // Update filter dropdowns
        populateReportFilters(); // Update report filter dropdowns
    } else {
        showErrorMessage(result.message || 'فشل إضافة التصنيف.');
    }
}

function editCategory(code) {
    showWarningMessage('وظيفة تعديل التصنيف غير متاحة حالياً.');
    // Implement logic to load category data into modal and update
}

function deleteCategory(code) {
    showWarningMessage('وظيفة حذف التصنيف غير متاحة حالياً.');
    // Implement logic to confirm and delete category
}

// --- Expenses Management (Cashier) ---
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
    if (searchTerm.length < 2) {
        return;
    }

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
    if (searchTerm.length < 2) {
        return;
    }

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

    let expenseData = {
        category: categoryName,
        categoryCode: categoryCode,
        amount: amount,
        notes: notes,
        cashier: currentUserName,
    };

    // Collect specific fields based on formType
    if (formType === 'عادي' || formType === 'اجل' || formType === 'فيزا' || formType === 'اونلاين' || formType === 'مرتجع' || formType === 'خصم عميل' || formType === 'إنستا') {
        const invoiceNumber = document.getElementById('expenseInvoiceNumber').value.trim();
        if (formType !== 'اجل' && !invoiceNumber) { // Invoice is optional for 'اجل' if customer is selected
            showWarningMessage('يرجى إدخال رقم الفاتورة.');
            return;
        }
        expenseData.invoiceNumber = invoiceNumber;
    }

    if (formType === 'فيزا') {
        const visaRef = document.getElementById('visaReferenceNumber').value.trim();
        if (visaRef && !/^\d{4}$/.test(visaRef)) {
            showWarningMessage('الرقم المرجعي للفيزا يجب أن يكون 4 أرقام.');
            return;
        }
        expenseData.referenceNumber = visaRef;
    } else if (formType === 'شحن_تاب') {
        const tabName = document.getElementById('tabName').value.trim();
        const tabPhone = document.getElementById('tabPhone').value.trim();
        if (!tabPhone) {
            showWarningMessage('يرجى إدخال رقم تليفون التاب.');
            return;
        }
        expenseData.tabName = tabName;
        expenseData.tabPhone = tabPhone;
    } else if (formType === 'شحن_كهربا') {
        const location = document.getElementById('electricityLocation').value.trim();
        if (!location) {
            showWarningMessage('يرجى إدخال مكان الشحن.');
            return;
        }
        expenseData.location = location;
    } else if (formType === 'بنزين' || formType === 'سلف' || formType === 'عجوزات') {
        const personName = document.getElementById('personName').value.trim();
        if (!personName) {
            showWarningMessage('يرجى إدخال اسم الشخص.');
            return;
        }
        expenseData.personName = personName;
    } else if (formType === 'دفعة_شركة') {
        const companyName = document.getElementById('companyName').value.trim();
        const companyCode = document.getElementById('companyCode').value.trim();
        if (!companyName) {
            showWarningMessage('يرجى إدخال اسم الشركة.');
            return;
        }
        expenseData.companyName = companyName;
        expenseData.companyCode = companyCode;
    } else if (formType === 'اجل') {
        const customerId = document.getElementById('selectedCustomerId').value;
        const customerName = document.getElementById('selectedCustomerName').value;
        if (!customerId) {
            showWarningMessage('يرجى اختيار العميل الآجل.');
            return;
        }
        expenseData.customer = customerId; // Send customer ID to App Script
        expenseData.customerName = customerName; // For local display
    }

    const result = await callAppScript('addExpense', expenseData);

    if (result.success) {
        showSuccessMessage(`تم إضافة ${categoryName} بنجاح.`);
        closeModal('addExpenseModal');
        // Update local cashierDailyData
        const newEntry = {
            id: result.id, // ID from App Script
            category: categoryName,
            categoryCode: categoryCode,
            invoiceNumber: expenseData.invoiceNumber || '',
            amount: amount,
            notes: notes,
            date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD for consistency
            time: new Date().toLocaleTimeString('en-GB', { hour12: false }), // HH:MM:SS
            ...expenseData // Include all specific fields for local tracking
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
            await loadCustomers(); // Reload customers to get updated credit
            displayCustomers('customersTableBodyCashier');
        }
        loadCashierExpenses(); // Refresh expenses table
        updateCashierShiftSummary(); // Update shift summary
    } else {
        showErrorMessage(result.message || 'فشل إضافة المصروف.');
    }
}

async function loadCashierExpenses() {
    // This function should ideally fetch expenses for the current cashier for the current day/shift
    // For simplicity, it currently fetches all expenses for the current cashier.
    // A more robust solution would involve passing date/time range to the App Script.
    const result = await callAppScript('getExpenses', { cashier: currentUser.username });
    if (result.success) {
        // Clear previous data and populate from fresh load
        cashierDailyData.expenses = [];
        cashierDailyData.insta = [];
        cashierDailyData.visa = [];
        cashierDailyData.online = [];
        cashierDailyData.totalExpenses = 0;
        cashierDailyData.totalInsta = 0;
        cashierDailyData.totalVisa = 0;
        cashierDailyData.totalOnline = 0;

        result.data.forEach(row => {
            const categoryName = row[1];
            // Find category by name or code, then get formType
            const category = categories.find(c => c.name === categoryName || c.code === row[2]);
            const formType = category ? category.formType : 'عادي'; // Default to 'عادي' if not found
            
            const expense = {
                id: row[0],
                category: categoryName,
                categoryCode: row[2],
                invoiceNumber: row[3],
                amount: parseFloat(row[4]),
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
                customer: row[17],
                formType: formType // Add formType for local processing
            };

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
        filterCashierExpenses(); // Display all loaded expenses initially
        updateCashierShiftSummary();
    } else {
        showErrorMessage('فشل تحميل المصروفات.');
    }
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
        const fromDate = new Date(dateFromFilter);
        filtered = filtered.filter(exp => new Date(exp.date) >= fromDate);
    }
    if (dateToFilter) {
        const toDate = new Date(dateToFilter);
        // Set time to end of day for 'toDate' filter to include full day
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
        // Delete functionality is currently disabled as per original code's warning
        actionsCell.innerHTML = `<button class="delete-btn" onclick="showWarningMessage('وظيفة حذف المصروفات غير متاحة حالياً.')"><i class="fas fa-trash"></i> حذف</button>`;
    });
}

function clearCashierExpenseFilters() {
    document.getElementById('expenseCategoryFilterCashier').value = '';
    document.getElementById('expenseDateFromFilterCashier').value = '';
    document.getElementById('expenseDateToFilterCashier').value = '';
    filterCashierExpenses();
}

async function deleteExpense(id, formType, amount) {
    showWarningMessage('وظيفة حذف المصروفات غير متاحة حالياً.');
    // Implement logic to delete from Google Sheets and update local data
    // if (confirm('هل أنت متأكد من حذف هذا المصروف؟')) {
    //     const result = await callAppScript('deleteExpense', { id });
    //     if (result.success) {
    //         showSuccessMessage('تم حذف المصروف بنجاح.');
    //         // Update local data
    //         if (formType === 'إنستا') {
    //             cashierDailyData.insta = cashierDailyData.insta.filter(exp => exp.id !== id);
    //             cashierDailyData.totalInsta -= amount;
    //         } else if (formType === 'فيزا') {
    //             cashierDailyData.visa = cashierDailyData.visa.filter(exp => exp.id !== id);
    //             cashierDailyData.totalVisa -= amount;
    //         } else if (formType === 'اونلاين') {
    //             cashierDailyData.online = cashierDailyData.online.filter(exp => exp.id !== id);
    //             cashierDailyData.totalOnline -= amount;
    //         } else {
    //             cashierDailyData.expenses = cashierDailyData.expenses.filter(exp => exp.id !== id);
    //             cashierDailyData.totalExpenses -= amount;
    //         }
    //         loadCashierExpenses(); // Refresh table
    //         updateCashierShiftSummary(); // Update summary
    //     } else {
    //         showErrorMessage(result.message || 'فشل حذف المصروف.');
    //     }
    // }
}

// --- Customers Management (Cashier) ---
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
        // Edit/Delete/Payment functionalities are currently disabled as per original code's warning
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
    // You might want to pass a flag to know if it's opened from expense modal
    // to refresh the customer select in expense modal after adding
    document.getElementById('addCustomerModal').dataset.fromExpense = fromExpense;
}

async function addCustomer() {
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();

    if (!name || !phone) {
        showWarningMessage('يرجى ملء جميع حقول العميل.');
        return;
    }

    const result = await callAppScript('addCustomer', { name, phone });

    if (result.success) {
        showSuccessMessage('تم إضافة العميل بنجاح.');
        closeModal('addCustomerModal');
        await loadCustomers(); // Reload customers
        displayCustomers('customersTableBodyCashier'); // Refresh table
        // If opened from expense modal, refresh customer select
        if (document.getElementById('addCustomerModal').dataset.fromExpense === 'true') {
            // Re-generate dynamic form to refresh customer list if it was open
            const currentFormType = document.getElementById('selectedExpenseCategoryFormType').value;
            if (currentFormType === 'اجل') {
                generateDynamicExpenseForm('اجل'); 
            }
        }
    } else {
        showErrorMessage(result.message || 'فشل إضافة العميل.');
    }
}

function editCustomer(id) {
    showWarningMessage('وظيفة تعديل العميل غير متاحة حالياً.');
}

function deleteCustomer(id) {
    showWarningMessage('وظيفة حذف العميل غير متاحة حالياً.');
}

function showCustomerPaymentModal(customerId, customerName) {
    showWarningMessage('وظيفة سداد/أجل العميل غير متاحة حالياً.');
}

// --- Cashier Shift Closeout ---
async function calculateCashierShift() {
    const shiftDateFrom = document.getElementById('shiftDateFromCashier').value;
    const shiftDateTo = document.getElementById('shiftDateToCashier').value;
    const shiftTimeFrom = document.getElementById('shiftTimeFromCashier').value;
    const shiftTimeTo = document.getElementById('shiftTimeToCashier').value;

    if (!shiftDateFrom || !shiftDateTo || !shiftTimeFrom || !shiftTimeTo) {
        showWarningMessage('يرجى تحديد فترة الشيفت كاملة.');
        return;
    }

    cashierDailyData.shiftStartDate = shiftDateFrom;
    cashierDailyData.shiftEndDate = shiftDateTo;
    cashierDailyData.shiftStartTime = shiftTimeFrom;
    cashierDailyData.shiftEndTime = shiftTimeTo;

    // Filter local data based on selected shift period
    const fromDateTime = new Date(`${shiftDateFrom}T${shiftTimeFrom}`);
    const toDateTime = new Date(`${shiftDateTo}T${shiftTimeTo}`);

    let filteredExpenses = [];
    let filteredInsta = [];
    let filteredVisa = [];
    let filteredOnline = [];

    const filterByDateTime = (item) => {
        const itemDateTime = new Date(`${item.date}T${item.time}`);
        return itemDateTime >= fromDateTime && itemDateTime <= toDateTime;
    };

    // Re-fetch expenses for the specified period from the backend
    const result = await callAppScript('getExpenses', {
        cashier: currentUser.username,
        dateFrom: shiftDateFrom,
        dateTo: shiftDateTo,
        timeFrom: shiftTimeFrom,
        timeTo: shiftTimeTo
    });

    if (result.success) {
        // Reset local cashierDailyData totals for recalculation
        cashierDailyData.totalExpenses = 0;
        cashierDailyData.totalInsta = 0;
        cashierDailyData.totalVisa = 0;
        cashierDailyData.totalOnline = 0;
        cashierDailyData.expenses = [];
        cashierDailyData.insta = [];
        cashierDailyData.visa = [];
        cashierDailyData.online = [];

        result.data.forEach(row => {
            const categoryName = row[1];
            const category = categories.find(c => c.name === categoryName || c.code === row[2]);
            const formType = category ? category.formType : 'عادي';
            const amount = parseFloat(row[4]);

            const expense = {
                id: row[0], category: categoryName, categoryCode: row[2], invoiceNumber: row[3],
                amount: amount, notes: row[5], date: row[6], time: row[7], cashier: row[8],
                year: row[9], referenceNumber: row[10], tabName: row[11], tabPhone: row[12],
                location: row[13], personName: row[14], companyName: row[15], companyCode: row[16],
                customer: row[17], formType: formType
            };

            if (formType === 'إنستا') {
                cashierDailyData.insta.push(expense);
                cashierDailyData.totalInsta += amount;
            } else if (formType === 'فيزا') {
                cashierDailyData.visa.push(expense);
                cashierDailyData.totalVisa += amount;
            } else if (formType === 'اونلاين') {
                cashierDailyData.online.push(expense);
                cashierDailyData.totalOnline += amount;
            } else {
                cashierDailyData.expenses.push(expense);
                cashierDailyData.totalExpenses += amount;
            }
        });

        document.getElementById('shiftSummaryCashier').style.display = 'block';
        updateCashierShiftSummary();
        showSuccessMessage('تم حساب الشيفت بنجاح.');
    } else {
        showErrorMessage('فشل في جلب بيانات الشيفت.');
    }
}

function updateCashierShiftSummary() {
    const totalExpenses = cashierDailyData.totalExpenses;
    const totalInsta = cashierDailyData.totalInsta;
    const totalVisa = cashierDailyData.totalVisa;
    const totalOnline = cashierDailyData.totalOnline;
    const drawerCash = parseFloat(document.getElementById('drawerCashCashier').value) || 0;

    // الإجمالي الكلي للمقارنة مع نيو مايند = إجمالي المصروفات + إجمالي الإنستا + إجمالي الفيزا + إجمالي الأونلاين + نقدية الدرج
    const grandTotal = totalExpenses + totalInsta + totalVisa + totalOnline + drawerCash;

    document.getElementById('totalExpensesCashier').textContent = totalExpenses.toFixed(2);
    document.getElementById('expenseCountCashier').textContent = cashierDailyData.expenses.length;
    document.getElementById('totalInstaCashier').textContent = totalInsta.toFixed(2);
    document.getElementById('instaCountCashier').textContent = cashierDailyData.insta.length;
    document.getElementById('totalVisaCashier').textContent = totalVisa.toFixed(2);
    document.getElementById('visaCountCashier').textContent = cashierDailyData.visa.length;
    document.getElementById('totalOnlineCashier').textContent = totalOnline.toFixed(2);
    document.getElementById('onlineCountCashier').textContent = cashierDailyData.online.length;
    document.getElementById('grandTotalCashier').textContent = grandTotal.toFixed(2);

    cashierDailyData.drawerCash = drawerCash; // Update drawer cash in daily data
}

async function finalizeCashierShiftCloseout() {
    if (!confirm('هل أنت متأكد من تقفيل الشيفت نهائياً؟ لا يمكن التراجع بعد التقفيل.')) {
        return;
    }

    const drawerCash = parseFloat(document.getElementById('drawerCashCashier').value);
    if (isNaN(drawerCash) || drawerCash < 0) {
        showWarningMessage('يرجى إدخال مبلغ صحيح لنقدية الدرج.');
        return;
    }

    // Recalculate grand total with final drawer cash
    const grandTotal = cashierDailyData.totalExpenses + cashierDailyData.totalInsta + cashierDailyData.totalVisa + cashierDailyData.totalOnline + drawerCash;

    const closeoutData = {
        cashier: currentUser.username,
        dateFrom: cashierDailyData.shiftStartDate,
        dateTo: cashierDailyData.shiftEndDate,
        timeFrom: cashierDailyData.shiftStartTime,
        timeTo: cashierDailyData.shiftEndTime,
        totalExpenses: cashierDailyData.totalExpenses,
        expenseCount: cashierDailyData.expenses.length,
        totalInsta: cashierDailyData.totalInsta,
        instaCount: cashierDailyData.insta.length,
        totalVisa: cashierDailyData.totalVisa,
        visaCount: cashierDailyData.visa.length,
        totalOnline: cashierDailyData.online.length,
        onlineCount: cashierDailyData.online.length,
        grandTotal: grandTotal,
        drawerCash: drawerCash,
        finalResult: 'بانتظار المحاسب' // Status for accountant
    };

    const result = await callAppScript('closeShift', closeoutData);

    if (result.success) {
        showSuccessMessage('تم تقفيل الشيفت بنجاح! يمكنك الآن الخروج من النظام.');
        logout(); // Log out after successful closeout
    } else {
        showErrorMessage(result.message || 'فشل تقفيل الشيفت.');
    }
}

// --- Accountant Page Functions ---
async function showAccountantPage() {
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('cashierPage').classList.remove('active');
    document.getElementById('accountantPage').classList.add('active');
    document.getElementById('accountantNameDisplay').textContent = currentUserName;
    document.getElementById('currentDateAccountant').textContent = new Date().toLocaleDateString('ar-EG');

    await loadUsers(); // Ensure users are up-to-date for filters
    await loadCategories(); // Ensure categories are up-to-date for filters
    populateAccountantFilters();
    showTab('dashboardTabAccountant'); // Default to dashboard
}

function populateAccountantFilters() {
    const cashierFilter = document.getElementById('cashierFilterAccountant');
    const reportCashierFilter = document.getElementById('reportCashierAccountant');
    const reportCategoryFilter = document.getElementById('reportCategoryAccountant');

    // Populate Cashier filters
    const cashierOptions = users.filter(u => u.role === 'كاشير');
    [cashierFilter, reportCashierFilter].forEach(select => {
        select.innerHTML = '<option value="">جميع الكاشيرز</option>';
        cashierOptions.forEach(user => {
            const option = document.createElement('option');
            option.value = user.username;
            option.textContent = user.name;
            select.appendChild(option);
        });
    });

    // Populate Category filter for reports
    reportCategoryFilter.innerHTML = '<option value="">جميع التصنيفات</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        reportCategoryFilter.appendChild(option);
    });
}

async function updateAccountantDashboard() {
    const dateFrom = document.getElementById('dashboardDateFromAccountant').value;
    const dateTo = document.getElementById('dashboardDateToAccountant').value;
    const cashierUsername = document.getElementById('cashierFilterAccountant').value;

    // Fetch all expenses for the given period and cashier
    const expensesResult = await callAppScript('getExpenses', {
        cashier: cashierUsername,
        dateFrom: dateFrom,
        dateTo: dateTo
    });

    let totalExpenses = 0;
    let totalSales = 0; // Assuming 'عادي', 'إنستا', 'فيزا', 'اونلاين', 'اجل' categories are sales
    let totalInvoices = 0;
    let cashiersOverview = {}; // { cashierUsername: { totalSales: 0, totalInvoices: 0, lastActivity: '' } }

    if (expensesResult.success) {
        expensesResult.data.forEach(row => {
            const amount = parseFloat(row[4] || 0);
            const categoryName = row[1];
            const cashier = row[8];
            const date = row[6];
            const time = row[7];

            const category = categories.find(c => c.name === categoryName);
            if (category) {
                if (['عادي', 'إنستا', 'فيزا', 'اونلاين', 'اجل'].includes(category.formType)) {
                    totalSales += amount;
                }
                totalExpenses += amount; // All expenses contribute to total expenses
            } else {
                totalExpenses += amount; // If category not found, still count as expense
            }
            totalInvoices++;

            if (!cashiersOverview[cashier]) {
                cashiersOverview[cashier] = { totalSales: 0, totalInvoices: 0, lastActivity: '' };
            }
            if (category && ['عادي', 'إنستا', 'فيزا', 'اونلاين', 'اجل'].includes(category.formType)) {
                cashiersOverview[cashier].totalSales += amount;
            }
            cashiersOverview[cashier].totalInvoices++;
            const currentActivity = new Date(`${date}T${time}`);
            if (!cashiersOverview[cashier].lastActivity || currentActivity > new Date(cashiersOverview[cashier].lastActivity)) {
                cashiersOverview[cashier].lastActivity = currentActivity.toLocaleString('ar-EG');
            }
        });
    }

    document.getElementById('totalExpensesAccountant').textContent = totalExpenses.toFixed(2);
    document.getElementById('totalSalesAccountant').textContent = totalSales.toFixed(2);
    document.getElementById('totalCashiersAccountant').textContent = users.filter(u => u.role === 'كاشير').length;
    document.getElementById('totalCustomersAccountant').textContent = customers.length;

    const cashiersOverviewBody = document.getElementById('cashiersOverviewBodyAccountant');
    cashiersOverviewBody.innerHTML = '';
    for (const cashier in cashiersOverview) {
        const row = cashiersOverviewBody.insertRow();
        row.insertCell().textContent = users.find(u => u.username === cashier)?.name || cashier;
        row.insertCell().textContent = cashiersOverview[cashier].totalInvoices;
        row.insertCell().textContent = cashiersOverview[cashier].totalSales.toFixed(2);
        row.insertCell().textContent = cashiersOverview[cashier].lastActivity || '--';
        row.insertCell().textContent = 'نشط'; // Placeholder for status
    }
    if (Object.keys(cashiersOverview).length === 0) {
        cashiersOverviewBody.innerHTML = '<tr><td colspan="5">لا توجد بيانات للكاشيرز في الفترة المحددة.</td></tr>';
    }
}

async function searchInvoiceAccountant() {
    const invoiceNumber = document.getElementById('searchInputAccountant').value.trim();
    const searchResultDiv = document.getElementById('invoiceSearchResultAccountant');
    searchResultDiv.innerHTML = '';
    searchResultDiv.style.display = 'none';

    if (!invoiceNumber) {
        showWarningMessage('يرجى إدخال رقم الفاتورة للبحث.');
        return;
    }

    const result = await callAppScript('searchInvoice', { invoiceNumber });

    if (result.success && result.data.length > 0) {
        searchResultDiv.style.display = 'block';
        let html = '<h4>نتائج البحث عن فاتورة:</h4>';
        result.data.forEach(item => {
            html += `<div class="report-item">
                <strong>الورقة:</strong> ${item.sheetName}<br>
                <strong>التاريخ:</strong> ${item.date}، <strong>الوقت:</strong> ${item.time}، <strong>الكاشير:</strong> ${item.cashier}<br>
                <strong>التصنيف:</strong> ${item.category}، <strong>رقم الفاتورة:</strong> ${item.invoiceNumber}<br>
                <strong>القيمة:</strong> ${item.amount} جنيه، <strong>الملاحظات:</strong> ${item.notes || 'لا توجد'}<br>
                ${item.extraDetails ? `<strong>تفاصيل إضافية:</strong> ${item.extraDetails}<br>` : ''}
            </div><hr>`;
        });
        searchResultDiv.innerHTML = html;
    } else {
        searchResultDiv.style.display = 'block';
        searchResultDiv.innerHTML = '<p>لم يتم العثور على فاتورة بهذا الرقم.</p>';
    }
}

// --- Users Management (Accountant) ---
function displayUsers() {
    const usersTableBody = document.getElementById('usersTableBodyAccountant');
    usersTableBody.innerHTML = '';
    if (users.length === 0) {
        usersTableBody.innerHTML = '<tr><td colspan="7">لا توجد مستخدمون مسجلون.</td></tr>';
        return;
    }

    users.forEach(user => {
        const row = usersTableBody.insertRow();
        row.insertCell().textContent = user.name;
        row.insertCell().textContent = user.phone;
        row.insertCell().textContent = user.username;
        row.insertCell().textContent = user.role;
        row.insertCell().textContent = user.status;
        row.insertCell().textContent = new Date(user.creationDate).toLocaleDateString('ar-EG');
        const actionsCell = row.insertCell();
        // Edit/Delete functionalities are currently disabled as per original code's warning
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
    const password = document.getElementById('userPassword').value.trim();
    const role = document.getElementById('userRole').value;

    if (!name || !phone || !username || !password || !role) {
        showWarningMessage('يرجى ملء جميع حقول المستخدم.');
        return;
    }

    const result = await callAppScript('addUser', { name, phone, username, password, role });

    if (result.success) {
        showSuccessMessage('تم إضافة المستخدم بنجاح.');
        closeModal('addUserModal');
        await loadUsers(); // Reload users
        displayUsers(); // Refresh table
        populateAccountantFilters(); // Update filters
        populateUserDropdown(); // Update login dropdown
    } else {
        showErrorMessage(result.message || 'فشل إضافة المستخدم.');
    }
}

function editUser(id) {
    showWarningMessage('وظيفة تعديل المستخدم غير متاحة حالياً.');
}

function deleteUser(id) {
    showWarningMessage('وظيفة حذف المستخدم غير متاحة حالياً.');
}

// --- Reports (Accountant) ---
function populateReportFilters() {
    // Already handled by populateAccountantFilters()
}

async function generateAccountantReport() {
    const dateFrom = document.getElementById('reportDateFromAccountant').value;
    const dateTo = document.getElementById('reportDateToAccountant').value;
    const cashierUsername = document.getElementById('reportCashierAccountant').value;
    const categoryName = document.getElementById('reportCategoryAccountant').value;
    const reportContentDiv = document.getElementById('reportContentAccountant');
    reportContentDiv.innerHTML = '';

    if (!dateFrom || !dateTo) {
        showWarningMessage('يرجى تحديد نطاق التاريخ للتقرير.');
        return;
    }

    const result = await callAppScript('getExpenses', {
        cashier: cashierUsername,
        dateFrom: dateFrom,
        dateTo: dateTo
    });

    if (result.success) {
        let filteredExpenses = result.data;

        if (categoryName) {
            filteredExpenses = filteredExpenses.filter(row => row[1] === categoryName);
        }

        if (filteredExpenses.length === 0) {
            reportContentDiv.innerHTML = '<p>لا توجد بيانات مطابقة لمعايير التقرير.</p>';
            return;
        }

        let reportHtml = `<h4>تقرير المصروفات والمبيعات (${dateFrom} - ${dateTo})</h4>`;
        if (cashierUsername) reportHtml += `<p><strong>الكاشير:</strong> ${users.find(u => u.username === cashierUsername)?.name || cashierUsername}</p>`;
        if (categoryName) reportHtml += `<p><strong>التصنيف:</strong> ${categoryName}</p>`;
        reportHtml += `<hr><table><thead><tr>
            <th>التاريخ</th><th>الوقت</th><th>الكاشير</th><th>التصنيف</th><th>رقم الفاتورة</th><th>القيمة</th><th>الملاحظات</th>
        </tr></thead><tbody>`;

        let totalReportAmount = 0;
        filteredExpenses.forEach(row => {
            const amount = parseFloat(row[4] || 0);
            totalReportAmount += amount;
            reportHtml += `<tr>
                <td>${row[6]}</td>
                <td>${row[7]}</td>
                <td>${users.find(u => u.username === row[8])?.name || row[8]}</td>
                <td>${row[1]}</td>
                <td>${row[3] || '--'}</td>
                <td>${amount.toFixed(2)}</td>
                <td>${row[5] || '--'}</td>
            </tr>`;
        });
        reportHtml += `</tbody></table><p><strong>الإجمالي الكلي للتقرير:</strong> ${totalReportAmount.toFixed(2)} جنيه</p>`;
        reportContentDiv.innerHTML = reportHtml;
        showSuccessMessage('تم إنشاء التقرير بنجاح.');
    } else {
        showErrorMessage(result.message || 'فشل إنشاء التقرير.');
    }
}

function printReport() {
    const reportContent = document.getElementById('reportContentAccountant').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>تقرير</title>');
    printWindow.document.write('<link rel="stylesheet" href="styles.css">'); // Link to your CSS for styling
    printWindow.document.write('</head><body dir="rtl">');
    printWindow.document.write(reportContent);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}

function showWhatsAppModal() {
    document.getElementById('whatsappForm').reset();
    document.getElementById('whatsappModal').classList.add('active');
}

function sendReportViaWhatsApp() {
    const whatsappNumber = document.getElementById('whatsappNumber').value.trim();
    const reportContent = document.getElementById('reportContentAccountant').innerText; // Get plain text content

    if (!whatsappNumber || !reportContent) {
        showWarningMessage('يرجى إدخال رقم الواتساب وإنشاء التقرير أولاً.');
        return;
    }

    const message = encodeURIComponent(`*تقرير نظام إدارة الكاشير*\n\n${reportContent}`);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;
    window.open(whatsappUrl, '_blank');
    closeModal('whatsappModal');
    showSuccessMessage('تم فتح نافذة الواتساب لإرسال التقرير.');
}

// --- Accountant Shift Closeout ---
async function loadAccountantShiftClosuresHistory() {
    const tableBody = document.getElementById('closuresHistoryBodyAccountant');
    tableBody.innerHTML = '';

    const result = await callAppScript('getShiftClosures');
    if (result.success) {
        if (result.data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8">لا توجد تقفيلات سابقة.</td></tr>';
            return;
        }

        result.data.forEach(closure => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = users.find(u => u.username === closure.cashier)?.name || closure.cashier;
            row.insertCell().textContent = `${closure.dateFrom} ${closure.timeFrom} - ${closure.dateTo} ${closure.timeTo}`;
            row.insertCell().textContent = parseFloat(closure.grandTotal).toFixed(2);
            row.insertCell().textContent = parseFloat(closure.newMindTotal || 0).toFixed(2);
            row.insertCell().textContent = parseFloat(closure.difference || 0).toFixed(2);
            row.insertCell().textContent = closure.status;
            row.insertCell().textContent = new Date(`${closure.closureDate} ${closure.closureTime}`).toLocaleString('ar-EG');
            const actionsCell = row.insertCell();
            // View/Delete functionalities are currently disabled as per original code's warning
            actionsCell.innerHTML = `
                <button class="edit-btn" onclick="showWarningMessage('وظيفة عرض تفاصيل التقفيل غير متاحة حالياً.')"><i class="fas fa-eye"></i> عرض</button>
                <button class="delete-btn" onclick="showWarningMessage('وظيفة حذف التقفيل غير متاحة حالياً.')"><i class="fas fa-trash"></i> حذف</button>
            `;
        });
    } else {
        showErrorMessage(result.message || 'فشل تحميل سجل التقفيلات.');
    }
}

async function searchCashierClosuresAccountant() {
    const selectedCashier = document.getElementById('selectedCashierAccountant').value.trim();
    const dateFrom = document.getElementById('accountantShiftDateFrom').value;
    const dateTo = document.getElementById('accountantShiftDateTo').value;
    const timeFrom = document.getElementById('accountantShiftTimeFrom').value;
    const timeTo = document.getElementById('accountantShiftTimeTo').value;
    const closureResultsDiv = document.getElementById('closureResultsAccountant');
    const closureSummaryDiv = document.getElementById('closureSummaryAccountant');
    closureSummaryDiv.innerHTML = '';
    closureResultsDiv.style.display = 'none';
    document.getElementById('differenceResultAccountant').style.display = 'none';
    // Ensure the button ID is correct, it was 'closeCashierByAccountantBtn' in HTML but not in JS
    const closeCashierBtn = document.querySelector('#closureResultsAccountant .close-cashier-btn');
    if (closeCashierBtn) closeCashierBtn.style.display = 'none';


    if (!selectedCashier || !dateFrom || !dateTo || !timeFrom || !timeTo) {
        showWarningMessage('يرجى إدخال اسم الكاشير وتحديد فترة البحث كاملة.');
        return;
    }

    // Find cashier username from name/phone/code
    const targetCashier = users.find(u => 
        u.name.includes(selectedCashier) || 
        u.phone.includes(selectedCashier) || 
        u.username === selectedCashier
    );

    if (!targetCashier) {
        showErrorMessage('لم يتم العثور على كاشير بهذا الاسم/الرقم/الكود.');
        return;
    }

    const result = await callAppScript('getShiftClosures', {
        cashier: targetCashier.username,
        dateFrom: dateFrom,
        dateTo: dateTo,
        timeFrom: timeFrom,
        timeTo: timeTo
    });

    if (result.success && result.data.length > 0) {
        const closure = result.data[0]; // Assuming one closure per cashier per period for simplicity
        closureResultsDiv.style.display = 'block';
        closureSummaryDiv.innerHTML = `
            <p><strong>الكاشير:</strong> ${users.find(u => u.username === closure.cashier)?.name || closure.cashier}</p>
            <p><strong>الفترة:</strong> ${closure.dateFrom} ${closure.timeFrom} - ${closure.dateTo} ${closure.timeTo}</p>
            <p><strong>إجمالي المصروفات:</strong> ${parseFloat(closure.totalExpenses).toFixed(2)} جنيه</p>
            <p><strong>إجمالي الإنستا:</strong> ${parseFloat(closure.totalInsta).toFixed(2)} جنيه</p>
            <p><strong>إجمالي الفيزا:</strong> ${parseFloat(closure.totalVisa).toFixed(2)} جنيه</p>
            <p><strong>إجمالي الأونلاين:</strong> ${parseFloat(closure.totalOnline).toFixed(2)} جنيه</p>
            <p><strong>نقدية الدرج (الكاشير):</strong> ${parseFloat(closure.drawerCash).toFixed(2)} جنيه</p>
            <p><strong>الإجمالي الكلي (الكاشير):</strong> ${parseFloat(closure.grandTotal).toFixed(2)} جنيه</p>
            <input type="hidden" id="currentClosureId" value="${closure.id}">
            <input type="hidden" id="currentCashierGrandTotal" value="${closure.grandTotal}">
        `;
        document.getElementById('newmindTotalAccountant').value = closure.newMindTotal !== 'N/A' ? parseFloat(closure.newMindTotal).toFixed(2) : '';
        if (closeCashierBtn) closeCashierBtn.style.display = 'block';
        showSuccessMessage('تم العثور على تقفيلة الكاشير.');
    } else {
        closureResultsDiv.style.display = 'block';
        closureSummaryDiv.innerHTML = '<p>لم يتم العثور على تقفيلة للكاشير في الفترة المحددة.</p>';
        showWarningMessage('لم يتم العثور على تقفيلة للكاشير في الفترة المحددة.');
    }
}

function calculateDifferenceAccountant() {
    const cashierGrandTotal = parseFloat(document.getElementById('currentCashierGrandTotal').value);
    const newmindTotal = parseFloat(document.getElementById('newmindTotalAccountant').value);
    const differenceResultDiv = document.getElementById('differenceResultAccountant');
    differenceResultDiv.style.display = 'none';

    if (isNaN(cashierGrandTotal) || isNaN(newmindTotal)) {
        showWarningMessage('يرجى حساب تقفيلة الكاشير وإدخال إجمالي نيو مايند.');
        return;
    }

    const difference = cashierGrandTotal - newmindTotal;
    let status = 'مطابق';
    let className = 'balanced';
    if (difference > 0) {
        status = 'زيادة';
        className = 'surplus';
    } else if (difference < 0) {
        status = 'عجز';
        className = 'deficit';
    }

    differenceResultDiv.className = `difference-result ${className}`;
    differenceResultDiv.innerHTML = `
        <p><strong>الفرق:</strong> ${Math.abs(difference).toFixed(2)} جنيه</p>
        <p><strong>الحالة:</strong> ${status}</p>
    `;
    differenceResultDiv.style.display = 'block';
    showSuccessMessage('تم حساب الفرق.');
}

async function closeCashierByAccountant() {
    if (!confirm('هل أنت متأكد من تقفيل حساب الكاشير؟ سيتم تسجيل النتيجة النهائية.')) {
        return;
    }

    const closureId = document.getElementById('currentClosureId').value;
    const cashierGrandTotal = parseFloat(document.getElementById('currentCashierGrandTotal').value);
    const newmindTotal = parseFloat(document.getElementById('newmindTotalAccountant').value);

    if (!closureId || isNaN(cashierGrandTotal) || isNaN(newmindTotal)) {
        showWarningMessage('يرجى التأكد من حساب الفرق أولاً.');
        return;
    }

    const difference = cashierGrandTotal - newmindTotal;
    let status = 'مطابق';
    if (difference > 0) status = 'زيادة';
    else if (difference < 0) status = 'عجز';

    const result = await callAppScript('updateAccountantClosure', {
        id: closureId,
        newMindTotal: newmindTotal,
        difference: difference,
        status: status,
        accountant: currentUser.username
    });

    if (result.success) {
        showSuccessMessage('تم تقفيل حساب الكاشير بنجاح.');
        document.getElementById('closureResultsAccountant').style.display = 'none';
        document.getElementById('differenceResultAccountant').style.display = 'none';
        const closeCashierBtn = document.querySelector('#closureResultsAccountant .close-cashier-btn');
        if (closeCashierBtn) closeCashierBtn.style.display = 'none';
        loadAccountantShiftClosuresHistory(); // Refresh history table
    } else {
        showErrorMessage(result.message || 'فشل تقفيل حساب الكاشير.');
    }
}

function viewClosureDetails(id) {
    showWarningMessage('وظيفة عرض تفاصيل التقفيل غير متاحة حالياً.');
}

function deleteClosure(id) {
    showWarningMessage('وظيفة حذف التقفيل غير متاحة حالياً.');
}

// --- Utility Functions ---
function showLoadingOverlay() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoadingOverlay() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function showMessage(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${type}`;
    alertDiv.innerHTML = `
        <span>${message}</span>
        <button class="alert-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    alertContainer.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.remove();
    }, 5000); // Remove after 5 seconds
}

function showSuccessMessage(message) {
    showMessage(message, 'success');
}

function showErrorMessage(message) {
    showMessage(message, 'error');
}

function showWarningMessage(message) {
    showMessage(message, 'warning');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// --- Initialize on Page Load ---
window.onload = async function() {
    gapiLoaded();
    gisLoaded();

    // Check for existing login session
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        currentUserName = currentUser.name;
        currentUserRole = currentUser.role;
        
        // Attempt to re-authenticate silently
        try {
            await handleAuthClick(); // This will try to get a token without prompt if possible
            if (currentUserRole === 'كاشير') {
                showCashierPage();
            } else if (currentUserRole === 'محاسب') {
                showAccountantPage();
            }
        } catch (error) {
            console.warn('Failed to re-authenticate, showing login page.', error);
            logout();
        }
    }
};
