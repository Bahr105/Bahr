// =====================================
// 🎯 نظام اختصارات الكيبورد المحسن
// =====================================

/**
 * حل مشكلة handleLoginShortcuts المفقودة
 */
if (typeof handleLoginShortcuts === 'undefined') {
    window.handleLoginShortcuts = function(event) {
        if (event.key === 'Enter') {
            const loginBtn = document.querySelector('#loginButton, .login-btn, [type="submit"]');
            if (loginBtn) {
                loginBtn.click();
            }
        }
    };
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
        { key: 'f5' },                 // تحديث
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
        'r': () => {
            if (typeof refreshCurrentView === 'function') {
                refreshCurrentView();
            } else if (typeof location !== 'undefined') {
                location.reload();
            }
        },
        'h': () => openHelpModal(),
        'q': () => quickLogout(),
        '/': () => openHelpModal()
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

/**
 * معالجة زر Enter في حقول الإدخال
 */
function handleEnterInInput(event) {
    const target = event.target;
    const searchId = target.id;

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

    if (target.type === 'search' || target.classList.contains('search-input')) {
        event.preventDefault();
        performSearch(target.value);
        return;
    }

    if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        submitParentForm(target);
        return;
    }

    if (target.tagName.toLowerCase() === 'textarea') {
        return;
    }

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

    const itemRect = items[index].getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    if (itemRect.top < containerRect.top || itemRect.bottom > containerRect.bottom) {
        items[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
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
 * عرض رسالة للمستخدم - الإصدار الآمن
 */
function showMessage(message, type = 'info', duration = 3000) {
    if (window._showingMessage) {
        console.log('⚠️ منع تكرار الرسالة:', String(message).substring(0, 50));
        return;
    }
    
    try {
        window._showingMessage = true;
        
        if (typeof window._originalShowMessage === 'function') {
            window._originalShowMessage(message, type, duration);
            return;
        }
        
        createSafeToast(message, type, duration);
        
    } catch (error) {
        console.error('❌ خطأ في showMessage:', error);
    } finally {
        setTimeout(() => {
            window._showingMessage = false;
        }, 100);
    }
}

/**
 * إنشاء رسالة آمنة بدون تكرار
 */
function createSafeToast(message, type = 'info', duration = 3000) {
    const oldToasts = document.querySelectorAll('.safe-toast-message');
    oldToasts.forEach(toast => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    });
    
    const toast = document.createElement('div');
    toast.className = 'safe-toast-message';
    
    let backgroundColor;
    switch(type) {
        case 'error': backgroundColor = '#dc3545'; break;
        case 'success': backgroundColor = '#28a745'; break;
        case 'warning': backgroundColor = '#ffc107'; break;
        default: backgroundColor = '#17a2b8';
    }
    
    Object.assign(toast.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '15px 25px',
        background: backgroundColor,
        color: 'white',
        borderRadius: '5px',
        zIndex: '99999',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        maxWidth: '400px',
        direction: 'rtl',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        animation: 'safeToastSlideIn 0.3s ease-out'
    });
    
    toast.textContent = typeof message === 'string' ? message : String(message);
    document.body.appendChild(toast);
    
    if (duration > 0) {
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'safeToastSlideOut 0.3s ease-in';
                setTimeout(() => {
                    if (toast.parentNode) toast.parentNode.removeChild(toast);
                }, 300);
            }
        }, duration);
    }
    
    return toast;
}

/**
 * إضافة أنماط CSS الآمنة
 */
function addSafeToastStyles() {
    if (document.querySelector('#safe-toast-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'safe-toast-styles';
    style.textContent = `
        @keyframes safeToastSlideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes safeToastSlideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        .safe-toast-message { pointer-events: none; }
    `;
    document.head.appendChild(style);
}

/**
 * تهيئة نظام اختصارات الكيبورد
 */
function initializeKeyboardShortcuts() {
    document.removeEventListener('keydown', handleKeyboardShortcuts);
    document.addEventListener('keydown', handleKeyboardShortcuts, true);
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

    if (key === 'Escape') {
        handleEscapeKey(event);
        return;
    }

    if (key === 'Enter' && isInput) {
        handleEnterInInput(event);
        return;
    }

    if ((key === 'ArrowUp' || key === 'ArrowDown') && isInput) {
        handleArrowKeysInSearch(target, event);
        return;
    }

    if (isInput && !event.ctrlKey && !event.metaKey && !event.altKey) {
        return;
    }

    if (shouldPreventDefault(event)) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (key.startsWith('F') && key.length <= 3) {
        handleFunctionKeys(event);
        return;
    }

    if (event.ctrlKey || event.metaKey) {
        handleCtrlShortcuts(event);
        return;
    }

    if (event.altKey) {
        handleAltShortcuts(event);
        return;
    }

    if (!isInput) {
        handleSingleKeyShortcuts(event);
    }
}

/**
 * معالجة زر Escape - الإصدار المحسّن
 */
function handleEscapeKey(event) {
    event.preventDefault();
    event.stopPropagation();

    console.log('⎋ زر ESC - بدء الإغلاق الذكي...');
    
    if (closeModalsEnhanced()) {
        console.log('✅ تم إغلاق النوافذ بنجاح');
        setTimeout(removeBlurEffects, 100);
        return;
    }
    
    if (closeSuggestions()) {
        console.log('✅ تم إغلاق القوائم المنسدلة');
        return;
    }

    const activeInput = document.activeElement;
    if (isInputField(activeInput) && activeInput.value.trim() !== '') {
        activeInput.value = '';
        console.log('✅ تم مسح محتوى الحقل');
        return;
    }

    if (isInputField(activeInput)) {
        activeInput.blur();
        console.log('✅ تم الخروج من حقل الإدخال');
        return;
    }

    console.log('ℹ️ لا يوجد شيء لإغلاقه');
}

/**
 * إغلاق نافذة المصروف المثبت تحديداً
 */
function closeExpenseModalSpecific() {
    console.log('🎯 البحث عن نافذة المصروف المثبت...');
    
    const modalSelectors = [
        '#addExpenseModal',
        '#expenseModal', 
        '.expense-modal',
        '[id*="expense"][id*="modal"]',
        '[class*="expense"][class*="modal"]'
    ];
    
    let foundAndClosed = false;
    
    modalSelectors.forEach(selector => {
        try {
            const modals = document.querySelectorAll(selector);
            modals.forEach(modal => {
                const style = window.getComputedStyle(modal);
                if (style.display === 'block' || modal.classList.contains('show')) {
                    console.log('🎯 عثرت على نافذة مصروف:', modal.id || modal.className);
                    
                    modal.style.display = 'none';
                    modal.classList.remove('show', 'active');
                    
                    const closeBtn = modal.querySelector('[data-dismiss="modal"], .close, .btn-close');
                    if (closeBtn) {
                        closeBtn.click();
                        console.log('✅ تم النقر على زر الإغلاق');
                    }
                    
                    foundAndClosed = true;
                }
            });
        } catch (e) {
            console.log('❌ خطأ في البحث عن:', selector);
        }
    });
    
    return foundAndClosed;
}

/**
 * إغلاق النوافذ بشكل أقوى
 */
function closeModalsEnhanced() {
    console.log('🔧 محاولة إغلاق النوافذ المحسّن...');
    
    if (closeExpenseModalSpecific()) {
        console.log('✅ تم إغلاق نافذة المصروف المثبت بنجاح');
        return true;
    }
    
    let closed = false;
    
    const visibleModals = document.querySelectorAll(`
        .modal.show, .dialog.show,
        .modal[style*="display: block"], .dialog[style*="display: block"]
    `);
    
    console.log(`🎯 عدد النوافذ المرئية: ${visibleModals.length}`);
    
    visibleModals.forEach(modal => {
        console.log('🚪 محاولة إغلاق:', modal.id || modal.className);
        
        modal.style.display = 'none';
        modal.classList.remove('show', 'active', 'open');
        
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            try {
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) {
                    bsModal.hide();
                    console.log('✅ تم إغلاق نافذة Bootstrap');
                }
            } catch (e) {
                console.log('❌ خطأ في إغلاق Bootstrap modal');
            }
        }
        
        ['close', 'hide', 'hidden'].forEach(eventName => {
            try {
                modal.dispatchEvent(new Event(eventName, { bubbles: true }));
            } catch (e) {}
        });
        
        const closeButtons = modal.querySelectorAll(`
            [data-dismiss="modal"], [data-bs-dismiss="modal"],
            .close, .btn-close
        `);
        
        closeButtons.forEach(btn => {
            try {
                btn.click();
                console.log('✅ تم النقر على زر الإغلاق');
            } catch (e) {
                console.log('❌ خطأ في النقر على زر الإغلاق');
            }
        });
        
        closed = true;
    });
    
    const backdrops = document.querySelectorAll('.modal-backdrop, .backdrop');
    backdrops.forEach(backdrop => {
        console.log('🗑️ إزالة backdrop');
        backdrop.remove();
        closed = true;
    });
    
    ['modal-open', 'dialog-open', 'no-scroll'].forEach(className => {
        if (document.body.classList.contains(className)) {
            document.body.classList.remove(className);
            closed = true;
        }
    });
    
    if (document.body.style.overflow === 'hidden') {
        document.body.style.overflow = '';
        closed = true;
    }
    
    console.log(closed ? '✅ تم إغلاق النوافذ' : 'ℹ️ لا توجد نوافذ مفتوحة');
    return closed;
}

/**
 * إزالة تأثيرات البلور من الصفحة
 */
function removeBlurEffects() {
    const blurClasses = ['blur', 'blurred', 'backdrop-blur', 'modal-backdrop', 'backdrop'];
    document.body.classList.remove(...blurClasses);
    
    document.querySelectorAll('*').forEach(element => {
        element.classList.remove(...blurClasses);
    });
    
    const backdropElements = document.querySelectorAll('.modal-backdrop, .backdrop, [class*="backdrop"]');
    backdropElements.forEach(el => {
        if (el.parentNode) el.parentNode.removeChild(el);
    });
    
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    
    document.querySelectorAll('[style*="backdrop-filter"], [style*="filter"]').forEach(el => {
        if (el.style.backdropFilter && el.style.backdropFilter.includes('blur')) {
            el.style.backdropFilter = '';
        }
        if (el.style.filter && el.style.filter.includes('blur')) {
            el.style.filter = '';
        }
    });
}

// =====================================
// 🔧 دوال مساعدة أساسية
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
 * إضافة أنماط CSS
 */
function addKeyboardShortcutsStyles() {
    if (document.querySelector('#keyboardShortcutsStyles')) return;
    
    const style = document.createElement('style');
    style.id = 'keyboardShortcutsStyles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
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
    `;
    document.head.appendChild(style);
}

/**
 * إضافة CSS إضافي لمعالجة مشكلة البلور
 */
function addEnhancedBlurStyles() {
    if (document.querySelector('#enhancedBlurStyles')) return;
    
    const style = document.createElement('style');
    style.id = 'enhancedBlurStyles';
    style.textContent = `
        body.modal-open {
            overflow: auto !important;
            padding-right: 0 !important;
        }
        .modal-backdrop {
            display: none !important;
            opacity: 0 !important;
        }
        .modal {
            backdrop-filter: none !important;
        }
        .modal.show ~ .modal-backdrop {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
}

// =====================================
// 🚀 التهيئة التلقائية
// =====================================

/**
 * تهيئة النظام عند تحميل الصفحة - الإصدار الآمن
 */
function initSystem() {
    console.log('🚀 بدء تهيئة نظام اختصارات الكيبورد...');

    try {
        window._showingMessage = false;
        
        if (typeof window.showMessage === 'function' && window.showMessage !== showMessage) {
            window._originalShowMessage = window.showMessage;
        }
        
        addKeyboardShortcutsStyles();
        addEnhancedBlurStyles();
        addSafeToastStyles();
        
        initializeKeyboardShortcuts();
        
        console.log('✅ نظام اختصارات الكيبورد جاهز للاستخدام!');
        
    } catch (error) {
        console.error('❌ خطأ في تهيئة النظام:', error);
    }
}

// تشغيل التهيئة
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

window.initializeKeyboardShortcuts = initializeKeyboardShortcuts;
window.handleKeyboardShortcuts = handleKeyboardShortcuts;

console.log('✨ نظام اختصارات الكيبورد المحسن - جاهز!');
