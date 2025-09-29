// --- Main Application Entry Point ---

document.addEventListener('DOMContentLoaded', async () => {
    // Setup modal closing behavior
    setupModalCloseOnOutsideClick();

    // Load Google Scripts and initial data
    try {
        await loadGoogleScripts();
    } catch (error) {
        console.error('Failed to load Google Scripts:', error);
        showMessage('فشل تحميل الخدمات الخارجية. يرجى إعادة تحميل الصفحة.', 'error');
    }

    // Set default dates and times for inputs
    setDefaultDatesAndTimes();

    // Hide non-default pages
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('cashierPage').classList.remove('active');
    document.getElementById('accountantPage').classList.remove('active');

    // Add event listeners for close buttons in modals
    const closeButtons = document.querySelectorAll('.close-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.target.closest('.modal').id;
            closeModal(modalId);
        });
    });

// إضافة مستمع لحدث الضغط على لوحة المفاتيح لتشغيل الاختصارات
        document.addEventListener('keydown', handleKeyboardShortcuts);

    console.log('DOM loaded and initialized successfully.');
});



/**
 * Handles keyboard shortcuts for the application.
 * @param {KeyboardEvent} event - The keyboard event object.
 */
/**
 * Handles keyboard shortcuts for the application.
 * @param {KeyboardEvent} event - The keyboard event object.
 */
function handleKeyboardShortcuts(event) {
    console.log('Key pressed:', event.key, 'Ctrl:', event.ctrlKey);
    
    // فقط استجب لـ Ctrl + z أو Ctrl + s
    if (!event.ctrlKey || (event.key !== 'z' && event.key !== 's')) {
        return;
    }
    
    event.preventDefault();
    event.stopPropagation();
    
    console.log('Shortcut detected:', event.key);
    
    // التحقق من صفحة الكاشير
    const cashierPage = document.getElementById('cashierPage');
    if (!cashierPage) {
        console.log('Cashier page not found');
        return;
    }
    
    if (!cashierPage.classList.contains('active')) {
        console.log('Cashier page is not active');
        return;
    }
    
    console.log('Cashier page is active');
    
    // التحقق من المودالات النشطة
    const activeModals = document.querySelectorAll('.modal.active');
    console.log('Active modals count:', activeModals.length);
    
    if (activeModals.length > 0) {
        console.log('Active modal ID:', activeModals[0].id);
    }
    
    if (event.key === 'z') {
        // Ctrl+Z: فتح مودال إضافة المصروف
        if (activeModals.length === 0) {
            console.log('Opening add expense modal with Ctrl+Z');
            showAddExpenseModal();
        } else {
            console.log('Modal already open, ignoring Ctrl+Z');
        }
    } 
    else if (event.key === 's') {
        // Ctrl+S: حفظ في مودال إضافة المصروف
        if (activeModals.length > 0 && activeModals[0].id === 'addExpenseModal') {
            console.log('Saving expense with Ctrl+S');
            const saveButton = document.getElementById('addExpenseModalSaveBtn');
            if (saveButton) {
                saveButton.click();
            } else {
                console.error('Save button not found');
            }
        } else {
            console.log('Add expense modal not active, ignoring Ctrl+S');
        }
    }
}

// دالة لفتح مودال إضافة المصروف
function showAddExpenseModal() {
    console.log('showAddExpenseModal called');
    const modal = document.getElementById('addExpenseModal');
    if (modal) {
        modal.classList.add('active');
        console.log('Add expense modal opened successfully');
    } else {
        console.error('addExpenseModal element not found');
        // إنشاء المودال ديناميكياً إذا لم يكن موجوداً (للتجربة)
        createTestModal();
    }
}

// إنشاء مودال تجريبي إذا لم يكن موجوداً
function createTestModal() {
    console.log('Creating test modal...');
    const modalHTML = `
        <div id="addExpenseModal" class="modal active">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>إضافة مصروف جديد (تجريبي)</h2>
                    <button class="close-btn" onclick="closeModal('addExpenseModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <p>هذا مودال تجريبي للاختبار</p>
                    <button id="addExpenseModalSaveBtn" onclick="console.log('تم الحفظ')">حفظ</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    console.log('Test modal created');
}

// دالة لإغلاق المودال
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}





// --- Global Error Handling ---
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // showMessage('حدث خطأ غير متوقع. يرجى إعادة تحميل الصفحة.', 'error'); // Can be annoying
});

// --- Expose global functions for HTML event handlers ---
// This is necessary because HTML event attributes (like onclick) look for functions in the global scope.
// If you were using modern event listeners (addEventListener) exclusively, this might not be needed.
window.login = login;
window.logout = logout;
window.togglePasswordVisibility = togglePasswordVisibility;
window.showTab = showTab;
window.showCashierPage = showCashierPage;
window.showAccountantPage = showAccountantPage;
window.setDefaultDatesAndTimes = setDefaultDatesAndTimes;
window.displayCategories = displayCategories;
window.verifyModificationPassword = verifyModificationPassword;
window.showAddCategoryModal = showAddCategoryModal;
window.showEditCategoryModal = showEditCategoryModal;
window.addCustomFieldToEditor = addCustomFieldToEditor;
window.toggleOptionsInput = toggleOptionsInput;
window.addCategory = addCategory;
window.updateCategory = updateCategory;
window.deleteCategory = deleteCategory;
window.showAddExpenseModal = showAddExpenseModal;
window.showEditExpenseModal = showEditExpenseModal;
window.searchExpenseCategories = searchExpenseCategories;
window.selectExpenseCategory = selectExpenseCategory;
window.generateDynamicExpenseForm = generateDynamicExpenseForm;
window.searchCustomersForExpense = searchCustomersForExpense;
window.selectCustomerForExpense = selectCustomerForExpense;
window.showAddCustomerModalFromExpense = showAddCustomerModalFromExpense;
window.searchEmployeesForExpense = searchEmployeesForExpense;
window.selectEmployeeForExpense = selectEmployeeForExpense;
window.showAddEmployeeModalFromExpense = showAddEmployeeModalFromExpense;
window.addExpense = addExpense;
window.updateExpense = updateExpense;
window.deleteExpense = deleteExpense;
window.loadCashierExpenses = loadCashierExpenses;
window.displayCashierExpensesTable = displayCashierExpensesTable;
window.populateExpenseCategoryFilter = populateExpenseCategoryFilter;
window.filterCashierExpenses = filterCashierExpenses;
window.clearCashierExpenseFilters = clearCashierExpenseFilters;
window.displayCustomers = displayCustomers;
window.viewCustomerDetails = viewCustomerDetails;
window.processCustomerPayment = processCustomerPayment;
window.showAddCustomerModal = showAddCustomerModal;
window.showEditCustomerModal = showEditCustomerModal;
window.addCustomer = addCustomer;
window.updateCustomer = updateCustomer;
window.deleteCustomer = deleteCustomer;
window.displayEmployees = displayEmployees;
window.viewEmployeeDetails = viewEmployeeDetails;
window.processEmployeePayment = processEmployeePayment;
window.showAddEmployeeModal = showAddEmployeeModal;
window.showEditEmployeeModal = showEditEmployeeModal;
window.addEmployee = addEmployee;
window.updateEmployee = updateEmployee;
window.deleteEmployee = deleteEmployee;
window.deleteUser = deleteUser;
window.handleKeyboardShortcuts = handleKeyboardShortcuts;
window.calculateCashierShift = calculateCashierShift;
window.finalizeCashierShiftCloseout = finalizeCashierShiftCloseout;
window.loadCashierPreviousClosures = loadCashierPreviousClosures;
window.populateAccountantFilters = populateAccountantFilters;
window.populateAccountantShiftCashierFilter = populateAccountantShiftCashierFilter;
window.updateAccountantDashboard = updateAccountantDashboard;
window.updateAccountantCashierOverview = updateAccountantCashierOverview;
window.searchInvoiceAccountant = searchInvoiceAccountant;
window.populateReportFilters = populateReportFilters;
window.generateAccountantReport = generateAccountantReport;

function testShortcuts() {
    console.log('=== Testing Shortcuts ===');
    console.log('showAddExpenseModal exists:', typeof showAddExpenseModal);
    console.log('addExpenseModal element:', document.getElementById('addExpenseModal'));
    console.log('save button element:', document.getElementById('addExpenseModalSaveBtn'));
    console.log('cashierPage element:', document.getElementById('cashierPage'));
    console.log('cashierPage active:', document.getElementById('cashierPage')?.classList.contains('active'));
    
    // اختبار أن المستمع يعمل
    console.log('Testing event listener...');
    const testEvent = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true
    });
    document.dispatchEvent(testEvent);
}

// اختبر بعد تحميل الصفحة
setTimeout(testShortcuts, 2000);

// أيضا اختبر عند الانتقال لصفحة الكاشير
function showCashierPage() {
    // ... الكود الأصلي ...
    document.getElementById('cashierPage').classList.add('active');
    console.log('Cashier page shown - shortcuts should work now');
    testShortcuts(); // اختبر مرة أخرى
}
