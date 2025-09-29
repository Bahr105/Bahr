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

    // Initialize global search boxes for autocomplete (with arrow keys and Enter support)
    initGlobalSearchBoxes();

    // Restore menu pin state on load
    restoreMenuPinState();

    console.log('DOM loaded and initialized successfully.');
});

/**
 * Handles keyboard shortcuts for the application.
 * @param {KeyboardEvent} event - The keyboard event object.
 */
function handleKeyboardShortcuts(event) {
    // 1. التحقق مما إذا كانت صفحة الكاشير هي النشطة حاليًا
    const cashierPage = document.getElementById('cashierPage');
    if (!cashierPage || !cashierPage.classList.contains('active')) {
        return; // إذا لم تكن صفحة الكاشير نشطة، لا تفعل شيئًا
    }

    // 2. اختصار Ctrl + z: لفتح نافذة إضافة مصروف جديد
    //    تم إزالة شرط عدم وجود مودال مفتوح آخر للسماح بفتح مودال المصروف في أي وقت بصفحة الكاشير.
    if (event.ctrlKey && event.key === 'z') {
        event.preventDefault(); // منع السلوك الافتراضي للمتصفح (مثل تحديد كل النص)
        showAddExpenseModal(); // استدعاء الدالة التي تفتح نافذة إضافة المصروف
    }

    // 3. اختصار Ctrl + S: لحفظ المصروف (إذا كانت نافذة إضافة المصروف مفتوحة)
    //    تم إزالة شرط عدم وجود مودال مفتوح آخر للسماح بحفظ المصروف في أي وقت بصفحة الكاشير.
    if (event.ctrlKey && event.key === 's') {
        const addExpenseModal = document.getElementById('addExpenseModal');
        // التحقق مما إذا كانت نافذة إضافة المصروف مفتوحة ونشطة
        if (addExpenseModal && addExpenseModal.classList.contains('active')) {
            event.preventDefault(); // منع السلوك الافتراضي للمتصفح (مثل حفظ الصفحة)
            const saveButton = document.getElementById('addExpenseModalSaveBtn');
            if (saveButton) {
                saveButton.click(); // محاكاة النقر على زر الحفظ
            }
        }
    }
}

// ------------------ [اختصار Ctrl + Shift + Z لفتح وتثبيت القائمة] ------------------
// مفتاح حفظ حالة التثبيت في localStorage
const MENU_PIN_STORAGE_KEY = 'app_menu_pinned_state';

/**
 * يحصل على عنصر القائمة الرئيسي (يمكن تخصيصه حسب ID القائمة في HTML).
 */
function getMenuElement() {
  return document.getElementById('sideMenu') || document.getElementById('mainMenu') || document.getElementById('appMenu') || document.querySelector('.nav-tabs');
}

/**
 * يقوم بتبديل حالة تثبيت القائمة (فتح/إغلاق وتثبيت).
 */
function togglePinMenu() {
  const menu = getMenuElement();
  if (!menu) {
    console.warn('لم يتم العثور على عنصر القائمة.');
    return;
  }
  const pinned = menu.classList.toggle('pinned');
  menu.classList.add('open'); // فتح القائمة دائماً عند الضغط
  localStorage.setItem(MENU_PIN_STORAGE_KEY, pinned ? '1' : '0');
  console.log('تم تبديل حالة القائمة:', pinned ? 'مثبتة' : 'غير مثبتة');
}

/**
 * يستعيد حالة تثبيت القائمة من localStorage عند تحميل الصفحة.
 */
function restoreMenuPinState() {
  const menu = getMenuElement();
  if (!menu) return;
  const pinned = localStorage.getItem(MENU_PIN_STORAGE_KEY) === '1';
  if (pinned) {
    menu.classList.add('pinned', 'open');
    console.log('تم استعادة حالة تثبيت القائمة.');
  }
}

/**
 * مستمع لاختصار Ctrl + Shift + Z لتثبيت/فتح القائمة.
 * @param {KeyboardEvent} e - حدث الضغط على المفاتيح.
 */
function handlePinShortcut(e) {
  // يعمل فقط في صفحة الكاشير
  const cashierPage = document.getElementById('cashierPage');
  if (!cashierPage || !cashierPage.classList.contains('active')) {
    return;
  }

  if (e.ctrlKey && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault();
    togglePinMenu();
  }
}

// إضافة المستمع للاختصار
document.addEventListener('keydown', handlePinShortcut);

// ------------------ [Autocomplete مع دعم الأسهم والـ Enter] ------------------
// يعمل على أي input بكلاس 'search-box' (مثل حقل البحث عن التصنيفات)
/**
 * تهيئة صناديق البحث العامة للـ autocomplete.
 * تم تعديل هذا الجزء ليشمل جميع حقول الإدخال التي تحمل الفئة 'search-box'.
 * يجب إضافة الفئة 'search-box' إلى أي حقل إدخال تريد تفعيل ميزة الإكمال التلقائي عليه.
 */
function initGlobalSearchBoxes() {
  const inputs = document.querySelectorAll('input.search-box, #expenseCategorySearch');
  inputs.forEach(setupSearchBox);
}

/**
 * إعداد صندوق بحث واحد للـ autocomplete مع دعم الأسهم والـ Enter.
 * @param {HTMLInputElement} input - عنصر الإدخال.
 */
function setupSearchBox(input) {
  if (input._autocompleteInitialized) return;
  input._autocompleteInitialized = true;

  const container = document.createElement('div');
  container.className = 'search-suggestions';
  container.style.position = 'absolute';
  container.style.zIndex = 9999;
  container.style.display = 'none';
  container.style.background = '#fff';
  container.style.border = '1px solid #ccc';
  container.style.borderRadius = '6px';
  container.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
  container.style.maxHeight = '200px';
  container.style.overflowY = 'auto';
  input.parentNode.insertBefore(container, input.nextSibling);

  let suggestions = [];
  let focusedIndex = -1;

  // مستمع للكتابة في الحقل
  input.addEventListener('input', async () => {
    const q = input.value.trim().toLowerCase();
    if (!q || q.length < 1) {
      container.style.display = 'none';
      return;
    }

    // --- نقطة التوسع: هنا يمكنك تحديد مصدر البيانات بناءً على حقل الإدخال ---
    // مثال:
    let dataList = [];
    if (input.id === 'expenseCategorySearch' || input.classList.contains('category-search-box')) {
        dataList = await getCategoriesList();
    } else if (input.id === 'customerSearch' || input.classList.contains('customer-search-box')) {
        // افترض وجود دالة getCustomersList()
        dataList = await getCustomersList();
    } else if (input.id === 'employeeSearch' || input.classList.contains('employee-search-box')) {
        // افترض وجود دالة getEmployeesList()
        dataList = await getEmployeesList();
    } else {
        // افتراضيًا، استخدم التصنيفات إذا لم يتم تحديد نوع آخر
        dataList = await getCategoriesList();
    }
    // ---------------------------------------------------------------------

    suggestions = dataList.filter(item =>
      item.name.toLowerCase().includes(q) ||
      (item.code && item.code.toLowerCase().includes(q)) // افترض أن جميع العناصر لديها 'name' و 'code'
    ).slice(0, 10); // أقصى 10 اقتراحات

    renderSuggestions();
  });

  // مستمع للأسهم والـ Enter
  input.addEventListener('keydown', e => {
    if (container.style.display === 'none' || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusedIndex = (focusedIndex + 1) % suggestions.length;
      highlightItem();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusedIndex = (focusedIndex - 1 + suggestions.length) % suggestions.length;
      highlightItem();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < suggestions.length) {
        chooseSuggestion(suggestions[focusedIndex]);
      }
    } else if (e.key === 'Escape') {
      container.style.display = 'none';
      focusedIndex = -1;
    }
  });

  // إخفاء الاقتراحات عند فقدان التركيز
  input.addEventListener('blur', () => {
    setTimeout(() => {
      container.style.display = 'none';
      focusedIndex = -1;
    }, 150);
  });

  /**
   * عرض الاقتراحات في الحاوية.
   */
  function renderSuggestions() {
    container.innerHTML = '';
    focusedIndex = -1;
    if (suggestions.length === 0) {
      container.style.display = 'none';
      return;
    }

    suggestions.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'suggestion-item';
      // عرض الاسم والكود، أو الاسم فقط إذا لم يكن هناك كود
      row.textContent = `${item.name} ${item.code ? `(${item.code})` : ''}`;
      row.style.padding = '8px 12px';
      row.style.cursor = 'pointer';
      row.style.borderBottom = '1px solid #eee';
      row.addEventListener('mouseenter', () => {
        focusedIndex = i;
        highlightItem();
      });
      row.addEventListener('mousedown', e => {
        e.preventDefault();
        chooseSuggestion(item);
      });
      container.appendChild(row);
    });

    container.style.display = 'block';
    input.parentNode.style.position = 'relative'; // لضمان موضع الحاوية الصحيح
  }

  /**
   * تسليط الضوء على الاقتراح المحدد.
   */
  function highlightItem() {
    const items = container.querySelectorAll('.suggestion-item');
    items.forEach((el, i) => {
      if (i === focusedIndex) {
        el.style.backgroundColor = '#f0f8ff';
        el.style.color = '#000';
      } else {
        el.style.backgroundColor = '';
        el.style.color = '';
      }
    });
  }

  /**
   * اختيار اقتراح وتحديث الحقل.
   * @param {Object} item - العنصر المختار (تصنيف، عميل، موظف، إلخ).
   */
  function chooseSuggestion(item) {
    input.value = `${item.name} ${item.code ? `(${item.code})` : ''}`;
    container.style.display = 'none';
    focusedIndex = -1;

    // استدعاء دالة الاختيار المناسبة بناءً على حقل الإدخال
    if (input.id === 'expenseCategorySearch' && typeof window.selectExpenseCategory === 'function') {
      window.selectExpenseCategory(item);
    } else if (input.id === 'customerSearch' && typeof window.selectCustomerForExpense === 'function') {
      window.selectCustomerForExpense(item);
    } else if (input.id === 'employeeSearch' && typeof window.selectEmployeeForExpense === 'function') {
      window.selectEmployeeForExpense(item);
    }
    // يمكنك إضافة المزيد من الشروط هنا لدوال اختيار أخرى
    console.log('تم اختيار العنصر:', item);
  }
}

/**
 * جلب قائمة التصنيفات للـ autocomplete.
 * @returns {Promise<Array>} قائمة التصنيفات.
 */
async function getCategoriesList() {
  if (Array.isArray(window.categories) && window.categories.length > 0) {
    return window.categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      code: cat.code
    }));
  }

  // إذا لم تكن محملة، جلبها من DOM أو تحميلها
  try {
    await window.loadCategories ? window.loadCategories() : null;
    return window.categories || [];
  } catch (error) {
    console.error('خطأ في جلب التصنيفات:', error);
    // fallback: جلب من DOM إذا كانت موجودة
    const domItems = document.querySelectorAll('.category-item, .suggestion-item');
    return Array.from(domItems).map(el => ({
      id: el.dataset.id || '',
      name: el.textContent.trim(),
      code: el.dataset.code || ''
    })).slice(0, 20);
  }
}

// --- نقطة التوسع: دوال لجلب بيانات أخرى (عملاء، موظفين، إلخ) ---
// يجب عليك تعريف هذه الدوال إذا كنت تريد استخدام الإكمال التلقائي لبيانات غير التصنيفات.
/*
async function getCustomersList() {
    // مثال: جلب العملاء من API أو من متغير عام
    if (Array.isArray(window.customers) && window.customers.length > 0) {
        return window.customers.map(cust => ({
            id: cust.id,
            name: cust.name,
            code: cust.phone || '' // افترض أن الكود هو رقم الهاتف
        }));
    }
    // يمكنك إضافة منطق لجلب العملاء من الخادم هنا
    console.warn('دالة getCustomersList() لم يتم تعريفها أو لم يتم تحميل بيانات العملاء.');
    return [];
}

async function getEmployeesList() {
    // مثال: جلب الموظفين من API أو من متغير عام
    if (Array.isArray(window.employees) && window.employees.length > 0) {
        return window.employees.map(emp => ({
            id: emp.id,
            name: emp.name,
            code: emp.employeeId || '' // افترض أن الكود هو معرف الموظف
        }));
    }
    // يمكنك إضافة منطق لجلب الموظفين من الخادم هنا
    console.warn('دالة getEmployeesList() لم يتم تعريفها أو لم يتم تحميل بيانات الموظفين.');
    return [];
}
*/
// ---------------------------------------------------------------------


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
window.print
