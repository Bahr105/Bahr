// =====================================
// 🎯 نظام اختصارات الكيبورد المحسن
// =====================================

/**
 * تهيئة نظام اختصارات الكيبورد
 */
function initializeKeyboardShortcuts() {
    // إزالة المستمع القديم إن وجد
    document.removeEventListener('keydown', handleKeyboardShortcuts);
    
    // إضافة المستمع الجديد
    document.addEventListener('keydown', handleKeyboardShortcuts, true);
    
    // إعداد التنقل في القوائم المنسدلة
    setupSearchSuggestionNavigation();
    
    console.log('✅ نظام اختصارات الكيبورد جاهز');
}

/**
 * معالج رئيسي لجميع اختصارات الكيبورد
 */
function handleKeyboardShortcuts(event) {
    const key = event.key;
    const target = event.target;
    const isInput = isInputField(target);
    
    // معالجة Escape بشكل خاص
    if (key === 'Escape') {
        handleEscapeKey(event);
        return;
    }
    
    // معالجة Enter في حقول الإدخال
    if (key === 'Enter' && isInput) {
        handleEnterInInput(event);
        return;
    }
    
    // معالجة الأسهم في حقول البحث
    if ((key === 'ArrowUp' || key === 'ArrowDown') && isInput) {
        handleArrowKeysInSearch(target, event);
        return;
    }
    
    // تجاهل الاختصارات إذا كان المستخدم يكتب
    if (isInput && !event.ctrlKey && !event.metaKey && !event.altKey) {
        return;
    }
    
    // منع اختصارات المتصفح المتعارضة
    if (shouldPreventDefault(event)) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // معالجة Function Keys
    if (key.startsWith('F') && key.length <= 3) {
        handleFunctionKeys(event);
        return;
    }
    
    // معالجة Ctrl/Cmd + مفتاح
    if (event.ctrlKey || event.metaKey) {
        handleCtrlShortcuts(event);
        return;
    }
    
    // معالجة Alt + مفتاح
    if (event.altKey) {
        handleAltShortcuts(event);
        return;
    }
    
    // معالجة مفاتيح منفردة
    if (!isInput) {
        handleSingleKeyShortcuts(event);
    }
}

/**
 * معالجة زر Escape بذكاء
 */
function handleEscapeKey(event) {
    event.preventDefault();
    event.stopPropagation();
    
    // 1. إغلاق القوائم المنسدلة أولاً
    if (closeSuggestions()) {
        console.log('✓ تم إغلاق القوائم المنسدلة');
        return;
    }
    
    // 2. إغلاق النوافذ المنبثقة
    if (closeModals()) {
        console.log('✓ تم إغلاق النوافذ المنبثقة');
        return;
    }
    
    // 3. مسح محتوى حقل الإدخال النشط
    const activeInput = document.activeElement;
    if (isInputField(activeInput) && activeInput.value.trim() !== '') {
        activeInput.value = '';
        console.log('✓ تم مسح محتوى الحقل');
        return;
    }
    
    // 4. الخروج من حقل الإدخال
    if (isInputField(activeInput)) {
        activeInput.blur();
        console.log('✓ تم الخروج من حقل الإدخال');
        return;
    }
    
    console.log('ℹ️ لا يوجد شيء لإغلاقه');
}

/**
 * معالجة زر Enter في حقول الإدخال
 */
function handleEnterInInput(event) {
    const target = event.target;
    const searchId = target.id;
    
    // البحث في القوائم المنسدلة
    const searchFields = {
        'expenseCategorySearch': 'expenseCategorySuggestions',
        'customerSearch': 'customerSuggestions',
        'employeeSearch': 'employeeSuggestions',
        'supplierSearch': 'supplierSuggestions',
        'productSearch': 'productSuggestions'
    };
    
    if (searchFields[searchId]) {
        event.preventDefault();
        selectActiveOrFirstSuggestion(searchFields[searchId]);
        return;
    }
    
    // حقول البحث العامة
    if (target.type === 'search' || target.classList.contains('search-input')) {
        event.preventDefault();
        performSearch(target.value);
        return;
    }
    
    // Ctrl/Cmd + Enter لإرسال النماذج
    if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        submitParentForm(target);
        return;
    }
    
    // Enter عادي في textarea يبقى سطر جديد
    if (target.tagName.toLowerCase() === 'textarea') {
        return; // اسمح بالسلوك الافتراضي
    }
    
    // Enter عادي في input ينتقل للحقل التالي أو يرسل النموذج
    event.preventDefault();
    const form = target.closest('form');
    if (form) {
        const inputs = Array.from(form.querySelectorAll('input, select, textarea, button'));
        const currentIndex = inputs.indexOf(target);
        const nextInput = inputs[currentIndex + 1];
        
        if (nextInput && nextInput.type !== 'submit' && nextInput.tagName !== 'BUTTON') {
            nextInput.focus();
        } else {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
    }
}

/**
 * التحقق من ضرورة منع السلوك الافتراضي
 */
function shouldPreventDefault(event) {
    const key = event.key.toLowerCase();
    
    const conflicts = [
        { ctrl: true, key: 'p' },      // طباعة
        { ctrl: true, key: 'n' },      // نافذة جديدة
        { ctrl: true, key: 's' },      // حفظ
        { ctrl: true, key: 'f' },      // بحث
        { ctrl: true, key: 'h' },      // سجل
        { key: 'f1' },                 // مساعدة
        { key: 'f3' },                 // بحث
        { key: 'f4' },                 // عنوان URL
        { key: 'f5' },                 // تحديث (نريد التحكم به)
        { alt: true, key: '1' },
        { alt: true, key: '2' },
        { alt: true, key: '3' },
        { alt: true, key: '4' }
    ];
    
    return conflicts.some(conflict => {
        const ctrlMatch = !conflict.ctrl || (event.ctrlKey || event.metaKey);
        const altMatch = !conflict.alt || event.altKey;
        const keyMatch = conflict.key === key;
        return ctrlMatch && altMatch && keyMatch;
    });
}

/**
 * معالجة Function Keys
 */
function handleFunctionKeys(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const actions = {
        'F1': () => openHelpModal(),
        'F2': () => openQuickSearch(),
        'F3': () => openRegularExpenseModal(),
        'F4': () => openPinnedExpenseModal(),
        'F5': () => refreshCurrentView(),
        'F9': () => toggleSidebar()
    };
    
    const action = actions[event.key];
    if (action) {
        action();
    }
}

/**
 * معالجة اختصارات Ctrl/Cmd
 */
function handleCtrlShortcuts(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const key = event.key.toLowerCase();
    const actions = {
        'n': () => openRegularExpenseModal(),
        'p': () => openPinnedExpenseModal(),
        'f': () => openQuickSearch(),
        's': () => saveCurrentData(),
        'r': () => refreshCurrentView(),
        'h': () => openHelpModal(),
        'q': () => quickLogout(),
        '/': () => openHelpModal() // مساعدة بديلة
    };
    
    const action = actions[key];
    if (action) {
        action();
    }
}

/**
 * معالجة اختصارات Alt
 */
function handleAltShortcuts(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const key = event.key;
    const sections = {
        '1': 'dashboard',
        '٧': 'dashboard',
        '2': 'expenses',
        '٢': 'expenses',
        '3': 'reports',
        '٣': 'reports',
        '4': 'settings',
        '٤': 'settings'
    };
    
    const section = sections[key];
    if (section) {
        navigateToSection(section);
    }
}

/**
 * معالجة المفاتيح المنفردة
 */
function handleSingleKeyShortcuts(event) {
    const key = event.key;
    
    const actions = {
        '/': () => {
            event.preventDefault();
            openQuickSearch();
        },
        '?': () => {
            event.preventDefault();
            openHelpModal();
        },
        ' ': () => {
            if (!event.ctrlKey && !event.altKey && !event.shiftKey) {
                event.preventDefault();
                executeQuickAction();
            }
        }
    };
    
    const action = actions[key];
    if (action) {
        action();
    }
}

// =====================================
// 🔍 دوال البحث والاقتراحات
// =====================================

/**
 * التنقل في الاقتراحات بالأسهم
 */
function handleArrowKeysInSearch(target, event) {
    const searchId = target.id;
    const suggestionsMap = {
        'expenseCategorySearch': 'expenseCategorySuggestions',
        'customerSearch': 'customerSuggestions',
        'employeeSearch': 'employeeSuggestions',
        'supplierSearch': 'supplierSuggestions',
        'productSearch': 'productSuggestions'
    };
    
    const suggestionsId = suggestionsMap[searchId];
    if (!suggestionsId) return;
    
    const suggestions = document.getElementById(suggestionsId);
    if (!suggestions || suggestions.style.display === 'none') return;
    
    event.preventDefault();
    navigateSuggestions(suggestions, event.key);
}

/**
 * التنقل في قائمة الاقتراحات
 */
function navigateSuggestions(container, direction) {
    const items = Array.from(container.querySelectorAll('.suggestion-item:not([style*="display: none"])'));
    if (items.length === 0) return;
    
    const current = container.querySelector('.suggestion-item.active');
    let index = current ? items.indexOf(current) : -1;
    
    if (direction === 'ArrowDown') {
        index = (index + 1) % items.length;
    } else if (direction === 'ArrowUp') {
        index = index <= 0 ? items.length - 1 : index - 1;
    }
    
    items.forEach(item => item.classList.remove('active'));
    items[index].classList.add('active');
    items[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/**
 * اختيار الاقتراح النشط أو الأول
 */
function selectActiveOrFirstSuggestion(suggestionsId) {
    const suggestions = document.getElementById(suggestionsId);
    if (!suggestions || suggestions.style.display === 'none') return false;
    
    const active = suggestions.querySelector('.suggestion-item.active');
    const target = active || suggestions.querySelector('.suggestion-item');
    
    if (target) {
        target.click();
        return true;
    }
    return false;
}

/**
 * إعداد التنقل في الاقتراحات
 */
function setupSearchSuggestionNavigation() {
    // إضافة active عند hover
    document.addEventListener('mouseover', (e) => {
        if (e.target.classList.contains('suggestion-item')) {
            const siblings = e.target.parentElement.querySelectorAll('.suggestion-item');
            siblings.forEach(s => s.classList.remove('active'));
            e.target.classList.add('active');
        }
    });
}

/**
 * إغلاق جميع القوائم المنسدلة
 */
function closeSuggestions() {
    const suggestions = document.querySelectorAll('.suggestions, .dropdown-menu, [class*="suggestion"]');
    let closed = false;
    
    suggestions.forEach(s => {
        if (s.style.display !== 'none' && s.offsetParent !== null) {
            s.style.display = 'none';
            s.querySelectorAll('.active').forEach(item => item.classList.remove('active'));
            closed = true;
        }
    });
    
    return closed;
}

/**
 * إغلاق جميع النوافذ المنبثقة
 */
function closeModals() {
    const modals = document.querySelectorAll('.modal, .dialog, [role="dialog"], [class*="modal"]');
    let closed = false;
    
    modals.forEach(modal => {
        const isVisible = modal.style.display === 'block' || 
                         modal.classList.contains('show') ||
                         (modal.offsetParent !== null && getComputedStyle(modal).display !== 'none');
        
        if (isVisible) {
            modal.style.display = 'none';
            modal.classList.remove('show');
            closed = true;
        }
    });
    
    return closed;
}

// =====================================
// 🛠️ دوال التطبيق
// =====================================

/**
 * فتح نافذة المصروف العادي
 */
function openRegularExpenseModal() {
    if (!checkUserPermission()) return;
    
    if (typeof showAddExpenseModal === 'function') {
        showAddExpenseModal();
        console.log('✓ فتح نافذة المصروف العادي');
    } else {
        showMessage('وظيفة إضافة المصروفات غير متوفرة', 'error');
    }
}

/**
 * فتح نافذة المصروف المثبت
 */
function openPinnedExpenseModal() {
    if (!checkUserPermission()) return;
    
    if (typeof showAddExpenseModal === 'function') {
        showAddExpenseModal();
        console.log('✓ فتح نافذة المصروف المثبت');
        
        // تفعيل خيار التثبيت تلقائياً
        setTimeout(() => {
            const pinToggle = document.getElementById('pinExpenseFormToggle');
            if (pinToggle && !pinToggle.checked) {
                pinToggle.checked = true;
                pinToggle.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, 150);
    } else {
        showMessage('وظيفة إضافة المصروفات غير متوفرة', 'error');
    }
}

/**
 * فتح البحث السريع
 */
function openQuickSearch() {
    const searchModal = document.getElementById('quickSearchModal');
    const searchInput = document.querySelector('input[type="search"], .search-input');
    
    if (searchModal) {
        searchModal.style.display = 'block';
        const input = searchModal.querySelector('input');
        if (input) {
            setTimeout(() => input.focus(), 100);
        }
    } else if (searchInput) {
        searchInput.focus();
        searchInput.select();
    } else {
        showMessage('حقل البحث غير متوفر حالياً', 'info');
    }
    
    console.log('✓ فتح البحث السريع');
}

/**
 * فتح نافذة المساعدة
 */
function openHelpModal() {
    const helpContent = `
        <div style="text-align: right; line-height: 2; padding: 20px; direction: rtl;">
            <h2 style="color: #007bff; margin-bottom: 20px;">🎯 اختصارات الكيبورد</h2>
            
            <div style="margin-bottom: 20px;">
                <h3 style="color: #28a745;">⚡ الأزرار الوظيفية</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td><strong>F1</strong></td><td>عرض هذه المساعدة</td></tr>
                    <tr><td><strong>F2</strong></td><td>بحث سريع</td></tr>
                    <tr><td><strong>F3</strong></td><td>مصروف جديد</td></tr>
                    <tr><td><strong>F4</strong></td><td>مصروف مثبت</td></tr>
                    <tr><td><strong>F5</strong></td><td>تحديث البيانات</td></tr>
                    <tr><td><strong>F9</strong></td><td>إظهار/إخفاء القائمة</td></tr>
                </table>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h3 style="color: #28a745;">⌨️ اختصارات Ctrl</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td><strong>Ctrl + N</strong></td><td>مصروف جديد</td></tr>
                    <tr><td><strong>Ctrl + P</strong></td><td>مصروف مثبت</td></tr>
                    <tr><td><strong>Ctrl + F</strong></td><td>بحث سريع</td></tr>
                    <tr><td><strong>Ctrl + S</strong></td><td>حفظ</td></tr>
                    <tr><td><strong>Ctrl + R</strong></td><td>تحديث</td></tr>
                    <tr><td><strong>Ctrl + H</strong></td><td>مساعدة</td></tr>
                    <tr><td><strong>Ctrl + Q</strong></td><td>تسجيل خروج</td></tr>
                    <tr><td><strong>Ctrl + Enter</strong></td><td>إرسال النموذج</td></tr>
                </table>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h3 style="color: #28a745;">🔢 اختصارات Alt</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td><strong>Alt + 1</strong></td><td>الصفحة الرئيسية</td></tr>
                    <tr><td><strong>Alt + 2</strong></td><td>المصروفات</td></tr>
                    <tr><td><strong>Alt + 3</strong></td><td>التقارير</td></tr>
                    <tr><td><strong>Alt + 4</strong></td><td>الإعدادات</td></tr>
                </table>
            </div>
            
            <div>
                <h3 style="color: #28a745;">🎮 مفاتيح أخرى</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td><strong>/</strong></td><td>بحث سريع</td></tr>
                    <tr><td><strong>?</strong></td><td>مساعدة</td></tr>
                    <tr><td><strong>Esc</strong></td><td>إغلاق/مسح</td></tr>
                    <tr><td><strong>Space</strong></td><td>إجراء سريع</td></tr>
                    <tr><td><strong>Enter</strong></td><td>اختيار/انتقال</td></tr>
                    <tr><td><strong>↑ ↓</strong></td><td>التنقل في القوائم</td></tr>
                </table>
            </div>
        </div>
    `;
    
    showMessage(helpContent, 'info', 15000);
}

/**
 * تحديث البيانات الحالية
 */
function refreshCurrentView() {
    console.log('🔄 جاري تحديث البيانات...');
    
    if (typeof refreshExpenses === 'function') {
        refreshExpenses();
    } else if (typeof loadDashboard === 'function') {
        loadDashboard();
    } else if (typeof location !== 'undefined') {
        location.reload();
    } else {
        showMessage('تم تحديث البيانات', 'success');
    }
}

/**
 * تبديل ظهور القائمة الجانبية
 */
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar, .side-nav, nav, [class*="sidebar"]');
    
    if (sidebar) {
        const isHidden = sidebar.style.display === 'none' || 
                        sidebar.classList.contains('hidden');
        
        if (isHidden) {
            sidebar.style.display = '';
            sidebar.classList.remove('hidden');
        } else {
            sidebar.style.display = 'none';
            sidebar.classList.add('hidden');
        }
        
        console.log(`✓ القائمة الجانبية: ${isHidden ? 'مرئية' : 'مخفية'}`);
    } else {
        showMessage('القائمة الجانبية غير موجودة', 'info');
    }
}

/**
 * حفظ البيانات الحالية
 */
function saveCurrentData() {
    const activeForm = document.querySelector('form:focus-within');
    
    if (activeForm) {
        const submitBtn = activeForm.querySelector('button[type="submit"], input[type="submit"]');
        if (submitBtn) {
            submitBtn.click();
        } else {
            activeForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
        console.log('💾 تم حفظ البيانات');
    } else {
        showMessage('لا يوجد نموذج نشط للحفظ', 'info');
    }
}

/**
 * تسجيل خروج سريع
 */
function quickLogout() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        console.log('👋 تسجيل خروج...');
        
        if (typeof logout === 'function') {
            logout();
        } else {
            window.location.href = 'logout.php';
        }
    }
}

/**
 * التنقل إلى قسم معين
 */
function navigateToSection(section) {
    const sections = {
        'dashboard': () => {
            if (typeof loadDashboard === 'function') {
                loadDashboard();
            } else {
                window.location.href = 'index.php';
            }
        },
        'expenses': () => {
            if (typeof loadExpenses === 'function') {
                loadExpenses();
            } else {
                window.location.href = 'expenses.php';
            }
        },
        'reports': () => {
            if (typeof loadReports === 'function') {
                loadReports();
            } else {
                window.location.href = 'reports.php';
            }
        },
        'settings': () => {
            if (typeof loadSettings === 'function') {
                loadSettings();
            } else {
                window.location.href = 'settings.php';
            }
        }
    };
    
    if (sections[section]) {
        sections[section]();
        console.log(`✓ الانتقال إلى: ${section}`);
    }
}

/**
 * تنفيذ إجراء سريع حسب السياق
 */
function executeQuickAction() {
    if (document.querySelector('.expense-list, [class*="expense"]')) {
        openRegularExpenseModal();
    } else if (document.querySelector('.dashboard')) {
        refreshCurrentView();
    } else {
        openQuickSearch();
    }
}

/**
 * إرسال النموذج الأب
 */
function submitParentForm(element) {
    const form = element.closest('form');
    if (form) {
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
        if (submitBtn) {
            submitBtn.click();
        } else {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
    }
}

/**
 * تنفيذ البحث
 */
function performSearch(query) {
    if (!query || query.trim() === '') return;
    
    console.log(`🔍 البحث عن: ${query}`);
    
    if (typeof window.globalSearch === 'function') {
        window.globalSearch(query);
    } else if (typeof searchExpenses === 'function') {
        searchExpenses(query);
    } else {
        showMessage(`جاري البحث عن: ${query}`, 'info');
    }
}

// =====================================
// 🔧 دوال مساعدة
// =====================================

/**
 * التحقق من أن العنصر هو حقل إدخال
 */
function isInputField(element) {
    if (!element) return false;
    
    const tag = element.tagName.toLowerCase();
    const isInput = ['input', 'textarea', 'select'].includes(tag);
    const isEditable = element.isContentEditable;
    
    return isInput || isEditable;
}

/**
 * التحقق من صلاحيات المستخدم
 */
function checkUserPermission() {
    const allowedRoles = ['كاشير', 'محاسب', 'admin', 'cashier', 'accountant'];
    
    if (typeof currentUserRole !== 'undefined') {
        if (!allowedRoles.includes(currentUserRole)) {
            showMessage('ليس لديك صلاحية لهذا الإجراء', 'error');
            return false;
        }
    }
    
    return true;
}

/**
 * عرض رسالة للمستخدم
 */
function showMessage(message, type = 'info', duration = 3000) {
    if (typeof window.showMessage === 'function') {
        window.showMessage(message, type, duration);
        return;
    }
    
    // إنشاء رسالة مخصصة إذا لم تكن الدالة موجودة
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'};
        color: white;
        border-radius: 5px;
        z-index: 9999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease-out;
        max-width: 400px;
        direction: rtl;
    `;
    toast.innerHTML = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * إضافة أنماط CSS
 */
function addKeyboardShortcutsStyles() {
    if (document.querySelector('#keyboardShortcutsStyles')) return;
    
    const style = document.createElement('style');
    style.id = 'keyboardShortcutsStyles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        .suggestion-item.active {
            background-color: #007bff !important;
            color: white !important;
        }
        
        .suggestion-item {
            padding: 8px 12px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .suggestion-item:hover {
            background-color: #e9ecef;
        }
        
        .suggestions {
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: white;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            margin-top: 2px;
        }
        
        .suggestions::-webkit-scrollbar {
            width: 8px;
        }
        
        .suggestions::-webkit-scrollbar-track {
            background: #f1f1f1;
        }
        
        .suggestions::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 4px;
        }
        
        .suggestions::-webkit-scrollbar-thumb:hover {
            background: #555;
        }
    `;
    document.head.appendChild(style);
}

// =====================================
// 🚀 التهيئة التلقائية
// =====================================

/**
 * تهيئة النظام عند تحميل الصفحة
 */
function initSystem() {
    console.log('🚀 بدء تهيئة نظام اختصارات الكيبورد...');
    
    // إضافة الأنماط
    addKeyboardShortcutsStyles();
    
    // تهيئة الاختصارات
    initializeKeyboardShortcuts();
    
    // عرض رسالة ترحيبية (مرة واحدة فقط)
    setTimeout(() => {
        const storageKey = 'keyboard_shortcuts_welcome_shown';
        try {
            if (!localStorage.getItem(storageKey)) {
                showMessage('💡 اضغط F1 لعرض جميع اختصارات الكيبورد', 'info', 5000);
                localStorage.setItem(storageKey, 'true');
            }
        } catch (e) {
            // تجاهل أخطاء localStorage
        }
    }, 2000);
    
    console.log('✅ نظام اختصارات الكيبورد جاهز للاستخدام!');
}

// تشغيل التهيئة عند تحميل DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSystem);
} else {
    initSystem();
}

// =====================================
// 📤 تصدير الوظائف للاستخدام الخارجي
// =====================================

window.KeyboardShortcuts = {
    init: initializeKeyboardShortcuts,
    openHelp: openHelpModal,
    openSearch: openQuickSearch,
    openExpense: openRegularExpenseModal,
    openPinnedExpense: openPinnedExpenseModal,
    refresh: refreshCurrentView,
    toggleSidebar: toggleSidebar,
    save: saveCurrentData,
    logout: quickLogout
};

// للتوافق مع الكود القديم
window.initializeKeyboardShortcuts = initializeKeyboardShortcuts;
window.handleKeyboardShortcuts = handleKeyboardShortcuts;

console.log('✨ نظام اختصارات الكيبورد المحسن - جاهز!');
