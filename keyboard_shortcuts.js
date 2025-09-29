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
 * عرض رسالة للمستخدم - الإصدار الآمن
 */
function showMessage(message, type = 'info', duration = 3000) {
    // تجنب التكرار اللانهائي
    if (window._showingMessage) {
        console.log('⚠️ منع تكرار الرسالة:', String(message).substring(0, 50));
        return;
    }
    
    try {
        window._showingMessage = true;
        
        // إذا كانت هناك دالة showMessage أصلية، استخدمها
        if (typeof window._originalShowMessage === 'function') {
            window._originalShowMessage(message, type, duration);
            return;
        }
        
        // إنشاء رسالة مخصصة
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
    // تنظيف الرسائل القديمة
    const oldToasts = document.querySelectorAll('.safe-toast-message');
    oldToasts.forEach(toast => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    });
    
    const toast = document.createElement('div');
    toast.className = 'safe-toast-message';
    
    // تحديد اللون حسب النوع
    let backgroundColor;
    switch(type) {
        case 'error': backgroundColor = '#dc3545'; break;
        case 'success': backgroundColor = '#28a745'; break;
        case 'warning': backgroundColor = '#ffc107'; break;
        default: backgroundColor = '#17a2b8';
    }
    
    // إعداد الأنماط
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
    
    // إزالة تلقائية
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
    
    // 1. محاولة إغلاق النوافذ المحسّن
    if (closeModalsEnhanced()) {
        console.log('✅ تم إغلاق النوافذ بنجاح');
        setTimeout(removeBlurEffects, 100);
        return;
    }
    
    // 2. إغلاق القوائم المنسدلة
    if (closeSuggestions()) {
        console.log('✅ تم إغلاق القوائم المنسدلة');
        return;
    }

    // 3. مسح محتوى الحقول النشطة
    const activeInput = document.activeElement;
    if (isInputField(activeInput) && activeInput.value.trim() !== '') {
        activeInput.value = '';
        console.log('✅ تم مسح محتوى الحقل');
        return;
    }

    // 4. الخروج من الحقول النشطة
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
    
    // أولاً: محاولة إغلاق نافذة المصروف المثبت تحديداً
    if (closeExpenseModalSpecific()) {
        console.log('✅ تم إغلاق نافذة المصروف المثبت بنجاح');
        return true;
    }
    
    let closed = false;
    
    // إغلاق النوافذ المرئية
    const visibleModals = document.querySelectorAll(`
        .modal.show, .dialog.show,
        .modal[style*="display: block"], .dialog[style*="display: block"]
    `);
    
    console.log(`🎯 عدد النوافذ المرئية: ${visibleModals.length}`);
    
    visibleModals.forEach(modal => {
        console.log('🚪 محاولة إغلاق:', modal.id || modal.className);
        
        modal.style.display = 'none';
        modal.classList.remove('show', 'active', 'open');
        
        // Bootstrap modal
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
        
        // أحداث الإغلاق
        ['close', 'hide', 'hidden'].forEach(eventName => {
            try {
                modal.dispatchEvent(new Event(eventName, { bubbles: true }));
            } catch (e) {}
        });
        
        // أزرار الإغلاق
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
    
    // إزالة backdrop
    const backdrops = document.querySelectorAll('.modal-backdrop, .backdrop');
    backdrops.forEach(backdrop => {
        console.log('🗑️ إزالة backdrop');
        backdrop.remove();
        closed = true;
    });
    
    // إصلاح body
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
