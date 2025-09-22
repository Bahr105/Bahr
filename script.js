// --- Google Sheets API Configuration ---
const SPREADSHEET_ID = '16WsTQuebZDGErC8NwPRYf7qsHDVWhfDvUtvQ7u7IC9Q';
const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyzZ34qCiYbWo8wOn52Kx-ws7H51ObGv2pFZ45oTSueNdzx74HnrYn99U1RUA3XvKrddg/exec';

// --- Global Application State ---
let users = [];
let categories = [];
let customers = [];
let currentUser = null;
let currentUserName = '';
let currentUserRole = '';

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
    
    const expensesTableBody = document.getElementById('expensesTableBodyCashier');
    if (expensesTableBody) expensesTableBody.innerHTML = '';
    
    const shiftSummary = document.getElementById('shiftSummaryCashier');
    if (shiftSummary) shiftSummary.style.display = 'none';
    
    const drawerCashInput = document.getElementById('drawerCashCashier');
    if (drawerCashInput) drawerCashInput.value = '';
    
    updateCashierShiftSummary();
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
        displayCategories('categoriesGridCashier');
        displayCategories('categoriesGridAccountant');
        populateExpenseCategoryFilter();
        populateReportFilters();
    } else {
        showErrorMessage(result.message || 'فشل إضافة التصنيف.');
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
    if (!suggestionsDiv) return;
    
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
    if (!dynamicFormDiv) return;
    
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
    if (!suggestionsDiv) return;
    
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
        formType: formType
    };

    // Collect specific fields based on formType
    if (formType === 'عادي' || formType === 'اجل' || formType === 'فيزا' || formType === 'اونلاين' || formType === 'مرتجع' || formType === 'خصم عميل' || formType === 'إنستا') {
        const invoiceNumber = document.getElementById('expenseInvoiceNumber').value.trim();
        if (formType !== 'اجل' && !invoiceNumber) {
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
        expenseData.customerId = customerId;
        expenseData.customerName = customerName;
    }

    const result = await callAppScript('addExpense', expenseData);

    if (result.success) {
        showSuccessMessage(`تم إضافة ${categoryName} بنجاح.`);
        closeModal('addExpenseModal');
        
        // Update local cashierDailyData
        const newEntry = {
            id: result.id,
            category: categoryName,
            categoryCode: categoryCode,
            invoiceNumber: expenseData.invoiceNumber || '',
            amount: amount,
            notes: notes,
            timestamp: new Date().toLocaleString('ar-EG'),
            formType: formType,
            ...expenseData
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
        showErrorMessage(result.message || 'فشل إضافة المصروف.');
    }
}

async function loadCashierExpenses() {
    const result = await callAppScript('getExpenses', { cashier: currentUser.username });
    if (result.success) {
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
            const formType = categories.find(c => c.name === categoryName || c.code === row[2])?.formType || 'عادي';
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
                formType: formType
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
        filterCashierExpenses();
        updateCashierShiftSummary();
    } else {
        showErrorMessage('فشل تحميل المصروفات.');
    }
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
    const categoryFilter = document.getElementById('expenseCategoryFilterCashier').value;
    const dateFromFilter = document.getElementById('expenseDateFromFilterCashier').value;
    const dateToFilter = document.getElementById('expenseDateToFilterCashier').value;
    const tableBody = document.getElementById('expensesTableBodyCashier');
    if (!tableBody) return;
    
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
        actionsCell.innerHTML = `<button class="delete-btn" onclick="deleteExpense('${exp.id}', '${exp.formType}', ${exp.amount})"><i class="fas fa-trash"></i> حذف</button>`;
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
        actionsCell.innerHTML = `
            <button class="edit-btn" onclick="editCustomer('${cust.id}')"><i class="fas fa-edit"></i> تعديل</button>
            <button class="delete-btn" onclick="deleteCustomer('${cust.id}')"><i class="fas fa-trash"></i> حذف</button>
            <button class="add-btn" onclick="showCustomerPaymentModal('${cust.id}', '${cust.name}')"><i class="fas fa-money-bill-wave"></i> سداد/أجل</button>
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

    const result = await callAppScript('addCustomer', { name, phone });

    if (result.success) {
        showSuccessMessage('تم إضافة العميل بنجاح.');
        closeModal('addCustomerModal');
        await loadCustomers();
        displayCustomers('customersTableBodyCashier');
        if (document.getElementById('addCustomerModal').dataset.fromExpense === 'true') {
            generateDynamicExpenseForm('اجل');
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

    filteredExpenses = cashierDailyData.expenses.filter(filterByDateTime);
    filteredInsta = cashierDailyData.insta.filter(filterByDateTime);
    filteredVisa = cashierDailyData.visa.filter(filterByDateTime);
    filteredOnline = cashierDailyData.online.filter(filterByDateTime);

    cashierDailyData.totalExpenses = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
    cashierDailyData.totalInsta = filteredInsta.reduce((sum, item) => sum + item.amount, 0);
    cashierDailyData.totalVisa = filteredVisa.reduce((sum, item) => sum + item.amount, 0);
    cashierDailyData.totalOnline = filteredOnline.reduce((sum, item) => sum + item.amount, 0);

    document.getElementById('shiftSummaryCashier').style.display = 'block';
    updateCashierShiftSummary();
    showSuccessMessage('تم حساب الشيفت بنجاح.');
}

function updateCashierShiftSummary() {
    const totalExpenses = cashierDailyData.totalExpenses;
    const totalInsta = cashierDailyData.totalInsta;
    const totalVisa = cashierDailyData.totalVisa;
    const totalOnline = cashierDailyData.totalOnline;
    const drawerCash = parseFloat(document.getElementById('drawerCashCashier').value) || 0;

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

    cashierDailyData.drawerCash = drawerCash;
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
        totalOnline: cashierDailyData.totalOnline,
        onlineCount: cashierDailyData.online.length,
        grandTotal: grandTotal,
        drawerCash: drawerCash,
        finalResult: 'بانتظار المحاسب'
    };

    const result = await callAppScript('closeShift', closeoutData);

    if (result.success) {
        showSuccessMessage('تم تقفيل الشيفت بنجاح! يمكنك الآن الخروج من النظام.');
        logout();
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
    
    await loadCategories();
    await loadCustomers();
    await loadUsers();
    showTab('dashboardTabAccountant');
}

function updateAccountantDashboard() {
    const totalUsers = users.length;
    const totalCategories = categories.length;
    const totalCustomers = customers.length;
    const activeCashiers = users.filter(u => u.role === 'كاشير' && u.status === 'نشط').length;
    const pendingShifts = 0; // Placeholder

    document.getElementById('totalUsersAccountant').textContent = totalUsers;
    document.getElementById('totalCategoriesAccountant').textContent = totalCategories;
    document.getElementById('totalCustomersAccountant').textContent = totalCustomers;
    document.getElementById('activeCashiersAccountant').textContent = activeCashiers;
    document.getElementById('pendingShiftsAccountant').textContent = pendingShifts;
}

// --- Users Management ---
function displayUsers() {
    const tableBody = document.getElementById('usersTableBodyAccountant');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8">لا توجد مستخدمين مسجلين.</td></tr>';
        return;
    }

    users.forEach(user => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = user.name;
        row.insertCell().textContent = user.phone;
        row.insertCell().textContent = user.username;
        row.insertCell().textContent = user.role;
        row.insertCell().textContent = user.status;
        row.insertCell().textContent = new Date(user.creationDate).toLocaleDateString('ar-EG');
        const actionsCell = row.insertCell();
        actionsCell.innerHTML = `
            <button class="edit-btn" onclick="editUser('${user.id}')"><i class="fas fa-edit"></i> تعديل</button>
            <button class="delete-btn" onclick="deleteUser('${user.id}')"><i class="fas fa-trash"></i> حذف</button>
            <button class="toggle-btn ${user.status === 'نشط' ? 'deactivate' : 'activate'}" onclick="toggleUserStatus('${user.id}', '${user.status}')">
                <i class="fas ${user.status === 'نشط' ? 'fa-ban' : 'fa-check'}"></i> ${user.status === 'نشط' ? 'إيقاف' : 'تفعيل'}
            </button>
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

    const result = await callAppScript('addUser', { name, phone, username, password, role });

    if (result.success) {
        showSuccessMessage('تم إضافة المستخدم بنجاح.');
        closeModal('addUserModal');
        await loadUsers();
        displayUsers();
        populateUserDropdown();
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

async function toggleUserStatus(id, currentStatus) {
    const newStatus = currentStatus === 'نشط' ? 'موقوف' : 'نشط';
    const result = await callAppScript('toggleUserStatus', { id, status: newStatus });

    if (result.success) {
        showSuccessMessage(`تم ${newStatus === 'نشط' ? 'تفعيل' : 'إيقاف'} المستخدم بنجاح.`);
        await loadUsers();
        displayUsers();
        populateUserDropdown();
    } else {
        showErrorMessage(result.message || 'فشل تغيير حالة المستخدم.');
    }
}

// --- Reports ---
function populateReportFilters() {
    const cashierFilter = document.getElementById('reportCashierFilter');
    const categoryFilter = document.getElementById('reportCategoryFilter');
    const dateFrom = document.getElementById('reportDateFrom');
    const dateTo = document.getElementById('reportDateTo');

    if (cashierFilter) {
        cashierFilter.innerHTML = '<option value="">جميع الكاشير</option>';
        users.filter(u => u.role === 'كاشير').forEach(user => {
            const option = document.createElement('option');
            option.value = user.username;
            option.textContent = user.name;
            cashierFilter.appendChild(option);
        });
    }

    if (categoryFilter) {
        categoryFilter.innerHTML = '<option value="">جميع التصنيفات</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            categoryFilter.appendChild(option);
        });
    }

    const today = new Date().toISOString().split('T')[0];
    if (dateFrom) dateFrom.value = today;
    if (dateTo) dateTo.value = today;
}

async function generateReport() {
    const cashier = document.getElementById('reportCashierFilter').value;
    const category = document.getElementById('reportCategoryFilter').value;
    const dateFrom = document.getElementById('reportDateFrom').value;
    const dateTo = document.getElementById('reportDateTo').value;

    const result = await callAppScript('generateReport', { cashier, category, dateFrom, dateTo });

    if (result.success) {
        displayReportResults(result.data);
    } else {
        showErrorMessage('فشل توليد التقرير.');
    }
}

function displayReportResults(data) {
    const resultsDiv = document.getElementById('reportResults');
    if (!resultsDiv) return;
    
    if (!data || data.length === 0) {
        resultsDiv.innerHTML = '<p>لا توجد بيانات مطابقة للمعايير.</p>';
        return;
    }

    let html = '<table class="report-table"><thead><tr><th>التصنيف</th><th>رقم الفاتورة</th><th>القيمة</th><th>التاريخ</th><th>الوقت</th><th>الكاشير</th><th>ملاحظات</th></tr></thead><tbody>';
    
    let total = 0;
    data.forEach(row => {
        html += `<tr>
            <td>${row[1]}</td>
            <td>${row[3] || '--'}</td>
            <td>${parseFloat(row[4]).toFixed(2)}</td>
            <td>${row[6]}</td>
            <td>${row[7]}</td>
            <td>${row[8]}</td>
            <td>${row[5] || '--'}</td>
        </tr>`;
        total += parseFloat(row[4]);
    });
    
    html += `</tbody><tfoot><tr><td colspan="2"><strong>المجموع:</strong></td><td><strong>${total.toFixed(2)}</strong></td><td colspan="4"></td></tr></tfoot></table>`;
    resultsDiv.innerHTML = html;
}

// --- Shift Closures Management ---
async function loadAccountantShiftClosuresHistory() {
    const result = await callAppScript('getShiftClosures');
    if (result.success) {
        displayShiftClosures(result.data);
    } else {
        showErrorMessage('فشل تحميل تقارير الشيفتات.');
    }
}

function displayShiftClosures(data) {
    const tableBody = document.getElementById('shiftClosuresTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    if (!data || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="11">لا توجد تقارير شيفتات.</td></tr>';
        return;
    }

    data.forEach(row => {
        const tr = tableBody.insertRow();
        tr.insertCell().textContent = row[1]; // Cashier
        tr.insertCell().textContent = row[2]; // Date From
        tr.insertCell().textContent = row[3]; // Date To
        tr.insertCell().textContent = row[4]; // Time From
        tr.insertCell().textContent = row[5]; // Time To
        tr.insertCell().textContent = parseFloat(row[6]).toFixed(2); // Total Expenses
        tr.insertCell().textContent = parseFloat(row[7]).toFixed(2); // Total Insta
        tr.insertCell().textContent = parseFloat(row[8]).toFixed(2); // Total Visa
        tr.insertCell().textContent = parseFloat(row[9]).toFixed(2); // Total Online
        tr.insertCell().textContent = parseFloat(row[10]).toFixed(2); // Grand Total
        tr.insertCell().textContent = row[11]; // Final Result
        
        const actionsCell = tr.insertCell();
        actionsCell.innerHTML = `
            <button class="approve-btn" onclick="approveShiftClosure('${row[0]}')"><i class="fas fa-check"></i> قبول</button>
            <button class="reject-btn" onclick="rejectShiftClosure('${row[0]}')"><i class="fas fa-times"></i> رفض</button>
        `;
    });
}

function approveShiftClosure(id) {
    showWarningMessage('وظيفة قبول الشيفت غير متاحة حالياً.');
}

function rejectShiftClosure(id) {
    showWarningMessage('وظيفة رفض الشيفت غير متاحة حالياً.');
}

// --- Utility Functions ---
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('active');
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('active');
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
    if (!messageDiv) return;
    
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

// --- Initialize Application ---
document.addEventListener('DOMContentLoaded', function() {
    loadInitialData();
    
    // Check for stored user session
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        currentUserName = currentUser.name;
        currentUserRole = currentUser.role;
        
        if (currentUserRole === 'كاشير') {
            showCashierPage();
        } else if (currentUserRole === 'محاسب') {
            showAccountantPage();
        }
    }
});

