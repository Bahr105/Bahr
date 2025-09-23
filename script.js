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

async function maybeEnableButtons() {
    if (gapiInited && gisInited && !isAuthenticated) {
        await handleAuthClick().then(() => {
            loadInitialData();
        }).catch(error => {
            console.error('Authentication failed:', error);
            // Optionally, show a persistent error message or disable login
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

        // Check if a token already exists and is valid
        const existingToken = gapi.client.getToken();
        if (existingToken && existingToken.expires_at && existingToken.expires_at > Date.now()) {
            // If token exists and is not expired, try to use it silently
            tokenClient.requestAccessToken({prompt: ''}); 
        } else {
            // If no token or expired, request a new one with consent
            tokenClient.requestAccessToken({prompt: 'consent'});
        }
    });
}

// --- Google Sheets API Functions ---
  async function readSheet(sheetName, range = 'A:Z') {  // افتراضي A:Z للشيت كامل
      try {
          if (!isAuthenticated) {
              await handleAuthClick();
          }
          
          const fullRange = range ? `${sheetName}!${range}` : `${sheetName}!A:Z`;  // دائماً نطاق كامل إذا لم يحدد
          const response = await gapi.client.sheets.spreadsheets.values.get({
              spreadsheetId: SPREADSHEET_ID,
              range: fullRange,
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
          const [expHours, expMinutes] = exp.time.split(':').map(Number);  // تحويل إلى أرقام
          const [fromHours, fromMinutes] = filters.timeFrom.split(':').map(Number);
          const [toHours, toMinutes] = filters.timeTo.split(':').map(Number);
          const expTotalMinutes = expHours * 60 + expMinutes;
          const fromTotalMinutes = fromHours * 60 + fromMinutes;
          const toTotalMinutes = toHours * 60 + toMinutes;
          return expTotalMinutes >= fromTotalMinutes && expTotalMinutes <= toTotalMinutes;
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
      const fromDateTime = new Date(`${filters.dateFrom}T${filters.timeFrom || '00:00'}:00`);  // افتراضي إذا لم يكن timeFrom
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
    // Clear Google token on logout
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token, () => {
            console.log('Access token revoked.');
            isAuthenticated = false;
        });
    }
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
        populateAccountantFilters(); // Ensure filters are populated before updating dashboard
        updateAccountantDashboard();
    } else if (tabId === 'usersTabAccountant') {
        displayUsers();
    } else if (tabId === 'reportsTabAccountant') {
        populateReportFilters();
    } else if (tabId === 'shiftCloseTabAccountant') {
        populateAccountantShiftCashierFilter(); 
        loadAccountantShiftClosuresHistory();
        // إعادة تعيين نموذج إغلاق شيفت المحاسب
        const closureResultsAccountant = document.getElementById('closureResultsAccountant');
        if (closureResultsAccountant) { 
            closureResultsAccountant.style.display = 'none';
        }
        const closeCashierByAccountant = document.getElementById('closeCashierByAccountant');
        if (closeCashierByAccountant) { 
            closeCashierByAccountant.style.display = 'none';
        }
        const newmindTotalAccountant = document.getElementById('newmindTotalAccountant');
        if (newmindTotalAccountant) { 
            newmindTotalAccountant.value = '';
        }
        const differenceResultAccountant = document.getElementById('differenceResultAccountant');
        if (differenceResultAccountant) { 
            differenceResultAccountant.style.display = 'none';
        }
        // Reset date/time filters for accountant shift closure
        const today = new Date().toISOString().split('T')[0];
        const timeNow = new Date().toTimeString().split(' ')[0].substring(0, 5);
        document.getElementById('accountantShiftDateFrom').value = today;
        document.getElementById('accountantShiftDateTo').value = today;
        document.getElementById('accountantShiftTimeFrom').value = timeNow;
        document.getElementById('accountantShiftTimeTo').value = timeNow;
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
    
    let formHtml = ``;

    // إضافة حقل رقم الفاتورة لجميع الأنواع التي تتطلبها، بما في ذلك "أجل"
    if (['عادي', 'فيزا', 'اونلاين', 'مرتجع', 'خصم عميل', 'إنستا', 'اجل', 'شحن_تاب', 'شحن_كهربا', 'بنزين', 'سلف', 'دفعة_شركة', 'عجوزات'].includes(formType)) {
        formHtml += `
            <div class="form-group">
                <label for="expenseInvoiceNumber">رقم الفاتورة:</label>
                <input type="text" id="expenseInvoiceNumber" required placeholder="أدخل رقم الفاتورة">
            </div>
        `;
    }

    formHtml += `
        <div class="form-group">
            <label for="expenseAmount">القيمة:</label>
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

    if (['عادي', 'فيزا', 'اونلاين', 'مرتجع', 'خصم عميل', 'إنستا', 'اجل', 'شحن_تاب', 'شحن_كهربا', 'بنزين', 'سلف', 'دفعة_شركة', 'عجوزات'].includes(formType)) {
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
                const expenseCount = parseInt(document.getElementById('expenseCountCashier').textContent) || 0;
        const totalInsta = parseFloat(document.getElementById('totalInstaCashier').textContent) || 0;
        const instaCount = parseInt(document.getElementById('instaCountCashier').textContent) || 0;
        const totalVisa = parseFloat(document.getElementById('totalVisaCashier').textContent) || 0;
        const visaCount = parseInt(document.getElementById('visaCountCashier').textContent) || 0;
        const totalOnline = parseFloat(document.getElementById('totalOnlineCashier').textContent) || 0;
        const onlineCount = parseInt(document.getElementById('onlineCountCashier').textContent) || 0;
        const grandTotal = parseFloat(document.getElementById('grandTotalCashier').textContent) || 0;

         const shiftClosureData = [
      shiftId,
      currentUser .username,  // إزالة المسافة قبل النقطة
      document.getElementById('shiftDateFromCashier').value,
            document.getElementById('shiftTimeFromCashier').value,
            document.getElementById('shiftDateToCashier').value,
            document.getElementById('shiftTimeToCashier').value,
            totalExpenses,
            expenseCount,
            totalInsta,
            instaCount,
            totalVisa,
            visaCount,
            totalOnline,
            onlineCount,
            grandTotal,
            drawerCash,
            0, // newMindTotal (not used for cashier self-closure)
            0, // difference (not calculated for cashier)
            'مغلق', // status
            now.toISOString().split('T')[0],
            now.toTimeString().split(' ')[0],
            '' // accountant (empty for self-closure)
        ];

        const result = await appendToSheet(SHEETS.SHIFT_CLOSURES, shiftClosureData);

        if (result.success) {
            showSuccessMessage('تم تقفيل الشيفت بنجاح.');
            resetCashierDailyData();
            document.getElementById('shiftSummaryCashier').style.display = 'none';
        } else {
            showErrorMessage('فشل تقفيل الشيفت.');
        }
    } catch (error) {
        console.error('Error finalizing shift closeout:', error);
        showErrorMessage('حدث خطأ أثناء تقفيل الشيفت.');
    } finally {
        showLoading(false);
    }
}

// --- Accountant Page Functions ---
 async function showAccountantPage() {
      document.getElementById('loginPage').classList.remove('active');
      document.getElementById('cashierPage').classList.remove('active');
      document.getElementById('accountantPage').classList.add('active');
      document.getElementById('accountantNameDisplay').textContent = currentUserName;  // إزالة المسافة
      document.getElementById('currentDateAccountant').textContent = new Date().toLocaleDateString('ar-EG');
      
      await loadUsers();
      await loadCategories();
      await loadCustomers();
      populateAccountantFilters();
      updateAccountantDashboard();
      showTab('dashboardTabAccountant');
  }
  

function populateAccountantFilters() {
    // Populate cashier filter
    const cashierSelect = document.getElementById('dashboardCashierFilter');
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

    // Populate category filter for reports
    populateReportFilters();
}

async function updateAccountantDashboard() {
    const cashierFilter = document.getElementById('dashboardCashierFilter')?.value || '';
    const dateFromFilter = document.getElementById('dashboardDateFrom')?.value || '';
    const dateToFilter = document.getElementById('dashboardDateTo')?.value || '';

    const filters = { cashier: cashierFilter };
    if (dateFromFilter) filters.dateFrom = dateFromFilter;
    if (dateToFilter) filters.dateTo = dateToFilter;

    showLoading(true);
    try {
        // Load all expenses with filters
        const allExpenses = await loadExpenses(filters);

        // Categorize expenses
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

        // Calculate totals
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
        showErrorMessage('حدث خطأ أثناء تحديث لوحة التحكم.');
    } finally {
        showLoading(false);
    }

    async function updateAccountantDashboard() {
    try {
        console.log('بدء تحديث لوحة التحكم للمحاسب...'); // للتحقق في Console

        // قائمة الـ IDs التي يجب التحقق منها (بناءً على HTML الخاص بك)
        const requiredIds = [
            'totalNormalExpensesAccountant',
            'countNormalExpensesAccountant',
            'totalVisaAccountant',
            'countVisaAccountant',
            'totalInstaAccountant',
            'countInstaAccountant',
            'totalOnlineAccountant',
            'countOnlineAccountant',
            'totalActiveCashiersAccountant',
            'totalInactiveCashiersAccountant',
            'totalBlockedCashiersAccountant',
            'totalCustomersAccountant',
            'customersWithCreditAccountant',
            'totalCreditAmountAccountant',
            'customersWithZeroCreditAccountant'
        ];

        // تحقق من وجود جميع الـ IDs
        requiredIds.forEach(id => {
            const element = document.getElementById(id);
            if (!element) {
                console.error(`العنصر غير موجود في HTML: ${id}`);
                throw new Error(`ID غير موجود: ${id}`);
            } else {
                console.log(`العنصر موجود: ${id}`);
            }
        });

        // باقي الكود الخاص بجلب البيانات (مثل fetch للـ expenses و users و customers)
        // ... (اترك باقي الدالة كما هي، لكن تأكد من التعديلات السابقة)

        // الآن، قم بتحديث الإحصائيات (هذا هو الجزء الذي يسبب الخطأ)
        // Update stats grid
        document.getElementById('totalNormalExpensesAccountant').textContent = totalNormal.toFixed(2);
        document.getElementById('countNormalExpensesAccountant').textContent = normalCount;
        // ... باقي الأسطر كما في الإصلاحات السابقة

    } catch (error) {
        console.error('خطأ في تحديث لوحة التحكم:', error);
        alert('خطأ في تحديث لوحة التحكم: ' + error.message); // لعرض الخطأ لك
    }
}

}

function updateAccountantCashierOverview(filters) {
    const tableBody = document.getElementById('cashierOverviewBody');
    if (!tableBody) return;

    // For overview, we need aggregated data per cashier
    const cashiers = users.filter(u => u.role === 'كاشير');
    tableBody.innerHTML = '';

    cashiers.forEach(cashier => {
        // Load expenses for this cashier with filters
        loadExpenses({ ...filters, cashier: cashier.username }).then(expenses => {
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

            // Find the row for this cashier and update it (or create new)
            let row = Array.from(tableBody.rows).find(r => r.cells[0].textContent === cashier.name);
            if (!row) {
                row = tableBody.insertRow();
                row.insertCell().textContent = cashier.name;
                row.insertCell().textContent = totalNormal.toFixed(2);
                row.insertCell().textContent = normalCount;
                row.insertCell().textContent = totalVisa.toFixed(2);
                row.insertCell().textContent = visaCount;
                row.insertCell().textContent = totalInsta.toFixed(2);
                row.insertCell().textContent = instaCount;
                row.insertCell().textContent = totalOnline.toFixed(2);
                row.insertCell().textContent = onlineCount;
            } else {
                row.cells[1].textContent = totalNormal.toFixed(2);
                row.cells[2].textContent = normalCount;
                row.cells[3].textContent = totalVisa.toFixed(2);
                row.cells[4].textContent = visaCount;
                row.cells[5].textContent = totalInsta.toFixed(2);
                row.cells[6].textContent = instaCount;
                row.cells[7].textContent = totalOnline.toFixed(2);
                row.cells[8].textContent = onlineCount;
            }
        });
    });

    if (tableBody.rows.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9">لا توجد بيانات للكاشيرز.</td></tr>';
    }
}

function clearAccountantDashboardFilters() {
    const cashierFilter = document.getElementById('dashboardCashierFilter');
    const dateFromFilter = document.getElementById('dashboardDateFrom');
    const dateToFilter = document.getElementById('dashboardDateTo');

    if (cashierFilter) cashierFilter.value = '';
    if (dateFromFilter) dateFromFilter.value = '';
    if (dateToFilter) dateToFilter.value = '';

    updateAccountantDashboard();
}

function populateReportFilters() {
    const categorySelect = document.getElementById('reportCategoryFilter');
    if (categorySelect) {
        categorySelect.innerHTML = '<option value="">جميع التصنيفات</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            categorySelect.appendChild(option);
        });
    }

    const cashierSelect = document.getElementById('reportCashierFilter');
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

async function generateReport() {
    const categoryFilter = document.getElementById('reportCategoryFilter')?.value || '';
    const cashierFilter = document.getElementById('reportCashierFilter')?.value || '';
    const dateFrom = document.getElementById('reportDateFrom')?.value || '';
    const dateTo = document.getElementById('reportDateTo')?.value || '';

    const filters = { cashier: cashierFilter };
    if (categoryFilter) filters.category = categoryFilter;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    const expenses = await loadExpenses(filters);
    const tableBody = document.getElementById('reportTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (expenses.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8">لا توجد بيانات مطابقة.</td></tr>';
        return;
    }

    expenses.forEach(exp => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = exp.category;
        row.insertCell().textContent = exp.invoiceNumber || '--';
        row.insertCell().textContent = exp.amount.toFixed(2);
        row.insertCell().textContent = exp.date;
        row.insertCell().textContent = exp.time;
        row.insertCell().textContent = exp.cashier;
        row.insertCell().textContent = exp.notes || '--';
        const actionsCell = row.insertCell();
        actionsCell.innerHTML = `<button class="view-btn" onclick="showWarningMessage('عرض التفاصيل غير متاح حالياً.')"><i class="fas fa-eye"></i></button>`;
    });

    showSuccessMessage('تم إنشاء التقرير بنجاح.');
}

function displayUsers() {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6">لا توجد مستخدمين.</td></tr>';
        return;
    }

    users.forEach(user => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = user.name;
        row.insertCell().textContent = user.username;
        row.insertCell().textContent = user.role;
        row.insertCell().textContent = user.status;
        row.insertCell().textContent = user.creationDate;
        const actionsCell = row.insertCell();
        actionsCell.innerHTML = `
            <button class="edit-btn" onclick="showWarningMessage('وظيفة تعديل المستخدم غير متاحة حالياً.')"><i class="fas fa-edit"></i></button>
            <button class="delete-btn" onclick="showWarningMessage('وظيفة حذف المستخدم غير متاحة حالياً.')"><i class="fas fa-trash"></i></button>
            <button class="block-btn" onclick="showWarningMessage('وظيفة حظر/إيقاف المستخدم غير متاحة حالياً.')"><i class="fas fa-ban"></i></button>
        `;
    });
}

// --- Shift Closure for Accountant ---
async function searchCashierClosuresAccountant() {
    const selectedCashier = document.getElementById('selectedCashierAccountant').value;
    const dateFrom = document.getElementById('accountantShiftDateFrom').value;
    const dateTo = document.getElementById('accountantShiftDateTo').value;
    const timeFrom = document.getElementById('accountantShiftTimeFrom').value;
    const timeTo = document.getElementById('accountantShiftTimeTo').value;

    if (!selectedCashier || !dateFrom || !dateTo || !timeFrom || !timeTo) {
        showWarningMessage('يرجى ملء جميع الحقول للبحث عن تقفيلة الكاشير.');
        return;
    }

    showLoading(true);
    try {
        const filters = {
            cashier: selectedCashier,
            dateFrom: dateFrom,
            dateTo: dateTo,
            timeFrom: timeFrom,
            timeTo: timeTo
        };

        const expenses = await loadExpenses(filters);

        // Categorize expenses
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

        // Get last drawer cash from previous closure (simplified: assume 0 if no previous)
        const lastClosures = await loadShiftClosures({ cashier: selectedCashier });
        const lastClosure = lastClosures.sort((a, b) => new Date(b.closureDate) - new Date(a.closureDate))[0];
        const drawerCash = lastClosure ? lastClosure.drawerCash : 0;

        // Calculate totals
        const totalNormal = normalExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const totalVisa = visaExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const totalInsta = instaExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const totalOnline = onlineExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const grandTotal = totalNormal + totalVisa + totalInsta + totalOnline + drawerCash;

                // Display results
        document.getElementById('closureResultsAccountant').style.display = 'block';
        // تأكد أن هذا العنصر موجود في HTML ولديه ID 'closeCashierByAccountant'
        // إذا كان هذا الزر جزءًا من قسم 'closureResultsAccountant'، فقد لا تحتاج إلى إظهاره بشكل منفصل إذا كان القسم بأكمله يظهر.
        // ولكن بناءً على HTML، يبدو أنه زر منفصل يحتاج إلى إظهار.
        const closeCashierBtn = document.getElementById('closeCashierByAccountant');
        if (closeCashierBtn) { // إضافة تحقق للتأكد من وجود العنصر
            closeCashierBtn.style.display = 'block';
        }

        document.getElementById('accTotalNormalExpenses').textContent = totalNormal.toFixed(2);
        document.getElementById('normalExpensesCountAccountant').textContent = normalExpenses.length; // هذا الـ ID صحيح
        document.getElementById('accTotalVisa').textContent = totalVisa.toFixed(2);
        document.getElementById('visaCountAccountant').textContent = visaExpenses.length; // هذا الـ ID صحيح
        document.getElementById('accTotalInsta').textContent = totalInsta.toFixed(2);
        document.getElementById('instaCountAccountant').textContent = instaExpenses.length; // هذا الـ ID صحيح
        document.getElementById('accTotalOnline').textContent = totalOnline.toFixed(2);
        document.getElementById('onlineCountAccountant').textContent = onlineExpenses.length; // هذا الـ ID صحيح
        document.getElementById('accDrawerCash').textContent = drawerCash.toFixed(2);
        document.getElementById('accGrandTotalCashier').textContent = grandTotal.toFixed(2);
        document.getElementById('newmindTotalAccountant').value = ''; // Clear newmind input
        document.getElementById('differenceResultAccountant').style.display = 'none'; // Hide difference initially

        // Store data for later use (e.g., closure)
        window.currentClosureData = {
            cashier: selectedCashier,
            dateFrom: dateFrom,
            timeFrom: timeFrom,
            dateTo: dateTo,
            timeTo: timeTo,
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

        showSuccessMessage(`تم البحث عن بيانات الكاشير ${selectedCashier} للفترة المحددة.`);
    } catch (error) {
        console.error('Error searching cashier closures:', error);
        showErrorMessage('حدث خطأ أثناء البحث عن بيانات الكاشير.');
    } finally {
        showLoading(false);
    }
}

function calculateDifferenceAccountant() {
    const grandTotal = parseFloat(document.getElementById('grandTotalAccountant').textContent) || 0;
    const newMindTotal = parseFloat(document.getElementById('newmindTotalAccountant').value) || 0;
    const difference = newMindTotal - grandTotal;
    const differenceResult = document.getElementById('differenceResultAccountant');

    if (isNaN(newMindTotal) || newMindTotal < 0) {
        showWarningMessage('يرجى إدخال قيمة صحيحة لإجمالي نيو مايند.');
        return;
    }

    differenceResult.style.display = 'block';
    document.getElementById('calculatedDifference').textContent = Math.abs(difference).toFixed(2);

    const statusElement = document.getElementById('differenceStatus');
    if (difference === 0) {
        statusElement.textContent = 'مطابق';
        statusElement.className = 'status-match';
    } else if (difference > 0) {
        statusElement.textContent = 'زيادة';
        statusElement.className = 'status-surplus';
    } else {
        statusElement.textContent = 'عجز';
        statusElement.className = 'status-deficit';
    }
}

async function closeCashierShiftByAccountant() {
    if (!window.currentClosureData) {
        showWarningMessage('يرجى البحث عن بيانات الكاشير أولاً.');
        return;
    }

    const newMindTotal = parseFloat(document.getElementById('newmindTotalAccountant').value);
    if (isNaN(newMindTotal) || newMindTotal < 0) {
        showWarningMessage('يرجى إدخال قيمة صحيحة لإجمالي نيو مايند.');
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
            window.currentClosureData.totalNormal,
            window.currentClosureData.normalCount,
            window.currentClosureData.totalInsta,
            window.currentClosureData.instaCount,
            window.currentClosureData.totalVisa,
            window.currentClosureData.visaCount,
            window.currentClosureData.totalOnline,
            window.currentClosureData.onlineCount,
            window.currentClosureData.grandTotal,
            window.currentClosureData.drawerCash,
            
            newMindTotal,
            difference,
            'مغلق بواسطة المحاسب', // status
            now.toISOString().split('T')[0],
            now.toTimeString().split(' ')[0],
            currentUser .username // accountant
        ];

        const result = await appendToSheet(SHEETS.SHIFT_CLOSURES, shiftClosureData);

        if (result.success) {
            showSuccessMessage('تم تقفيل شيفت الكاشير بنجاح بواسطة المحاسب.');
            // Reset form
            document.getElementById('selectedCashierAccountant').value = '';
            document.getElementById('accountantShiftDateFrom').value = '';
            document.getElementById('accountantShiftDateTo').value = '';
            document.getElementById('accountantShiftTimeFrom').value = '';
            document.getElementById('accountantShiftTimeTo').value = '';
            document.getElementById('closureResultsAccountant').style.display = 'none';
            document.getElementById('closeCashierByAccountant').style.display = 'none';
            document.getElementById('newmindTotalAccountant').value = '';
            document.getElementById('differenceResultAccountant').style.display = 'none';
            window.currentClosureData = null;
            // Reload history
            loadAccountantShiftClosuresHistory();
        } else {
            showErrorMessage('فشل تقفيل شيفت الكاشير.');
        }
    } catch (error) {
        console.error('Error closing cashier shift by accountant:', error);
        showErrorMessage('حدث خطأ أثناء تقفيل شيفت الكاشير.');
    } finally {
        showLoading(false);
    }
}

async function loadAccountantShiftClosuresHistory() {
    const closures = await loadShiftClosures({});
    const tableBody = document.getElementById('shiftClosuresHistoryBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (closures.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="10">لا توجد سجلات تقفيلات.</td></tr>';
        return;
    }

    // Sort by closure date descending
    closures.sort((a, b) => new Date(b.closureDate) - new Date(a.closureDate));

    closures.forEach(closure => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = closure.cashier;
        row.insertCell().textContent = `${closure.dateFrom} ${closure.timeFrom}`;
        row.insertCell().textContent = `${closure.dateTo} ${closure.timeTo}`;
        row.insertCell().textContent = (closure.totalNormal + closure.totalVisa + closure.totalInsta + closure.totalOnline + closure.drawerCash).toFixed(2); // إجمالي الكاشير
        row.insertCell().textContent = closure.newMindTotal.toFixed(2);
        row.insertCell().textContent = closure.difference.toFixed(2);
        row.insertCell().textContent = closure.status;
        row.insertCell().textContent = closure.closureDate;
        row.insertCell().textContent = closure.closureTime;
        row.insertCell().textContent = closure.accountant || 'الكاشير نفسه';
    });
}

// --- Utility Functions ---
function showLoading(show = true) {
    const loading = document.getElementById('loadingOverlay');
    if (loading) {
        loading.style.display = show ? 'flex' : 'none';
    }
}

function showSuccessMessage(message) {
    const successMsg = document.getElementById('successMessage');
    if (successMsg) {
        successMsg.textContent = message;
        successMsg.style.display = 'block';
        setTimeout(() => {
            successMsg.style.display = 'none';
        }, 3000);
    }
}

function showErrorMessage(message) {
    const errorMsg = document.getElementById('errorMessage');
    if (errorMsg) {
        errorMsg.textContent = message;
        errorMsg.style.display = 'block';
        setTimeout(() => {
            errorMsg.style.display = 'none';
        }, 5000);
    }
}

function showWarningMessage(message) {
    const warningMsg = document.getElementById('warningMessage');
    if (warningMsg) {
        warningMsg.textContent = message;
        warningMsg.style.display = 'block';
        setTimeout(() => {
            warningMsg.style.display = 'none';
        }, 4000);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// Close modals when clicking outside
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
    loadGoogleScripts().then(() => {
        console.log('Google Scripts loaded successfully.');
    }).catch(error => {
        console.error('Failed to load Google Scripts:', error);
        showErrorMessage('فشل تحميل مكتبات Google. يرجى التحقق من الاتصال بالإنترنت.');
    });

    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            login();
        });
    }

    // Add category form
    const addCategoryForm = document.getElementById('addCategoryForm');
    if (addCategoryForm) {
        addCategoryForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addCategory();
        });
    }

    // Add expense form
    const addExpenseForm = document.getElementById('addExpenseForm');
    if (addExpenseForm) {
        addExpenseForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addExpense();
        });
    }

    // Add customer form
    const addCustomerForm = document.getElementById('addCustomerForm');
    if (addCustomerForm) {
        addCustomerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addCustomer();
        });
    }

    // Dashboard filters
    const dashboardCashierFilter = document.getElementById('dashboardCashierFilter');
    if (dashboardCashierFilter) {
        dashboardCashierFilter.addEventListener('change', updateAccountantDashboard);
    }
    const dashboardDateFrom = document.getElementById('dashboardDateFrom');
    if (dashboardDateFrom) {
        dashboardDateFrom.addEventListener('change', updateAccountantDashboard);
    }
    const dashboardDateTo = document.getElementById('dashboardDateTo');
    if (dashboardDateTo) {
        dashboardDateTo.addEventListener('change', updateAccountantDashboard);
    }

    // Report filters
    const reportCategoryFilter = document.getElementById('reportCategoryFilter');
    if (reportCategoryFilter) {
        reportCategoryFilter.addEventListener('change', generateReport);
    }
    const reportCashierFilter = document.getElementById('reportCashierFilter');
    if (reportCashierFilter) {
        reportCashierFilter.addEventListener('change', generateReport);
    }
    const reportDateFrom = document.getElementById('reportDateFrom');
    if (reportDateFrom) {
        reportDateFrom.addEventListener('change', generateReport);
    }
    const reportDateTo = document.getElementById('reportDateTo');
    if (reportDateTo) {
        reportDateTo.addEventListener('change', generateReport);
    }

    // Expense filters for cashier
    const expenseCategoryFilter = document.getElementById('expenseCategoryFilterCashier');
    if (expenseCategoryFilter) {
        expenseCategoryFilter.addEventListener('change', filterCashierExpenses);
    }
    const expenseDateFromFilter = document.getElementById('expenseDateFromFilterCashier');
    if (expenseDateFromFilter) {
        expenseDateFromFilter.addEventListener('change', filterCashierExpenses);
    }
    const expenseDateToFilter = document.getElementById('expenseDateToFilterCashier');
    if (expenseDateToFilter) {
        expenseDateToFilter.addEventListener('change', filterCashierExpenses);
    }

    // Set default dates for filters
    const today = new Date().toISOString().split('T')[0];
    const timeNow = new Date().toTimeString().split(' ')[0].substring(0, 5);

    // Dashboard filters
    if (document.getElementById('dashboardDateFrom')) document.getElementById('dashboardDateFrom').value = today;
    if (document.getElementById('dashboardDateTo')) document.getElementById('dashboardDateTo').value = today;

    // Report filters
    if (document.getElementById('reportDateFrom')) document.getElementById('reportDateFrom').value = today;
    if (document.getElementById('reportDateTo')) document.getElementById('reportDateTo').value = today;

    // Cashier shift filters
    if (document.getElementById('shiftDateFromCashier')) document.getElementById('shiftDateFromCashier').value = today;
    if (document.getElementById('shiftDateToCashier')) document.getElementById('shiftDateToCashier').value = today;
    if (document.getElementById('shiftTimeFromCashier')) document.getElementById('shiftTimeFromCashier').value = timeNow;
    if (document.getElementById('shiftTimeToCashier')) document.getElementById('shiftTimeToCashier').value = timeNow;

    // Expense filters
    if (document.getElementById('expenseDateFromFilterCashier')) document.getElementById('expenseDateFromFilterCashier').value = today;
    if (document.getElementById('expenseDateToFilterCashier')) document.getElementById('expenseDateToFilterCashier').value = today;

    // Accountant shift filters
    if (document.getElementById('accountantShiftDateFrom')) document.getElementById('accountantShiftDateFrom').value = today;
    if (document.getElementById('accountantShiftDateTo')) document.getElementById('accountantShiftDateTo').value = today;
    if (document.getElementById('accountantShiftTimeFrom')) document.getElementById('accountantShiftTimeFrom').value = timeNow;
    if (document.getElementById('accountantShiftTimeTo')) document.getElementById('accountantShiftTimeTo').value = timeNow;
});

// Handle logout button
const logoutBtn = document.querySelector('.logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
}

// Handle password toggle
const passwordToggle = document.querySelector('.show-password');
if (passwordToggle) {
    passwordToggle.addEventListener('click', togglePasswordVisibility);
}
