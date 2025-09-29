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
        // استخدام النسخة المحسنة من معالج Escape
        handleEscapeKeyEnhanced(event);
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

    // منع اختصارات المتصفح المتعارضة، باستثناء F12
    if (shouldPreventDefault(event)) {
        event.preventDefault();
        event.stopPropagation();
    }

    // معالجة Function Keys
    if (key.startsWith('F') && key.length <= 3 && key !== 'F12') { // استبعاد F12
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
 * معالجة زر Escape - الإصدار المحسّن
 */
function handleEscapeKeyEnhanced(event) {
    event.preventDefault();
    event.stopPropagation();

    console.log('⎋ زر ESC - بدء الإغلاق الآمن...');

    // التشخيص أولاً
    debugModalClosing();

    // 1. محاولة إغلاق النوافذ بشكل أقوى (Enhanced)
    if (closeModalsEnhanced()) { // استخدام closeModalsEnhanced بدلاً من closeModalsSafe
        console.log('✅ تم إغلاق النوافذ بنجاح');
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

    // 5. إذا لم يكن هناك شيء لإغلاقه، نفتح نافذة المساعدة
    console.log('ℹ️ لا يوجد شيء لإغلاقه - عرض المساعدة');
    openHelpModal();
}

/**
 * إغلاق نافذة المصروف المثبت تحديداً (تم تحسينها)
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
                // تحقق مما إذا كانت النافذة مرئية أو تحمل كلاسات تدل على أنها مفتوحة
                if (style.display !== 'none' &&
                    (style.display === 'block' ||
                     style.display === 'flex' ||
                     modal.classList.contains('show') ||
                     modal.classList.contains('active') ||
                     modal.classList.contains('open'))) { // أضفنا 'open'
                    
                    console.log('🎯 عثرت على نافذة مصروف مرئية أو نشطة:', modal.id || modal.className);

                    // الطريقة الآمنة: استخدام Bootstrap إذا كان متاحاً
                    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                        try {
                            const bsModal = bootstrap.Modal.getInstance(modal);
                            if (bsModal) {
                                console.log('✅ استخدام Bootstrap لإغلاق النافذة');
                                bsModal.hide();
                                foundAndClosed = true;
                                // تأكد من إزالة الكلاسات يدوياً أيضاً لضمان التناسق
                                modal.classList.remove('show', 'active', 'open');
                                modal.style.display = 'none'; // تأكيد الإخفاء
                                return;
                            }
                        } catch (e) {
                            console.log('❌ خطأ في Bootstrap modal instance:', e);
                        }
                    }

                    // الطريقة الثانية: البحث عن زر إغلاق والنقر عليه
                    const closeBtn = modal.querySelector(
                        '[data-dismiss="modal"], ' +
                        '[data-bs-dismiss="modal"], ' +
                        '.close, ' +
                        '.btn-close, ' +
                        'button[aria-label="Close"], ' +
                        '.modal-header button, ' +
                        '[onclick*="hide"], [onclick*="close"]'
                    );

                    if (closeBtn) {
                        console.log('✅ تم العثور على زر الإغلاق. جاري النقر عليه:', closeBtn);
                        closeBtn.click();
                        foundAndClosed = true;
                    } else {
                        console.log('⚠️ لم يتم العثور على زر إغلاق محدد. جاري إخفاء النافذة بلطف وقوة.');
                        // إخفاء النافذة دون إزالة كاملة
                        modal.style.display = 'none';
                        modal.classList.remove('show', 'active', 'open'); // تأكيد إزالة الكلاسات
                        
                        // إطلاق event للإغلاق
                        modal.dispatchEvent(new Event('hidden.bs.modal', { bubbles: true }));
                        modal.dispatchEvent(new Event('close', { bubbles: true }));
                        
                        foundAndClosed = true;
                    }
                    // إزالة أي backdrop مرتبط بنافذة المصروف هذه
                    const backdrop = document.querySelector('.modal-backdrop.show, .backdrop.show');
                    if (backdrop) {
                        console.log('🗑️ إزالة backdrop مرتبط بنافذة المصروف');
                        backdrop.remove();
                    }
                }
            });
        } catch (e) {
            console.log('❌ خطأ في البحث عن:', selector, e);
        }
    });

    // بعد محاولة إغلاق النافذة، تأكد من إزالة أي تأثيرات بلور
    if (foundAndClosed) {
        removeBlurEffectsForce(); // استخدام الإزالة القوية للبلور
    }

    return foundAndClosed;
}

/**
 * إزالة تأثيرات البلور من الصفحة (النسخة الأصلية - تم استبدالها بـ removeBlurEffectsForce في handleEscapeKey)
 */
function removeBlurEffectsSafe() {
    console.log('🛡️ تشغيل الإزالة الآمنة للبلور...');

    // 1. إزالة classes المشتبه بها فقط من body
    const suspectClasses = [
        'modal-open', 'overflow-hidden', 'no-scroll'
    ];

    document.body.classList.remove(...suspectClasses);
    document.body.style.overflow = '';

    // 2. إزالة backdrop فقط إذا كان موجوداً
    const backdrops = document.querySelectorAll('.modal-backdrop, .backdrop');
    backdrops.forEach(backdrop => {
        // التأكد من أن الـ backdrop مرتبط بنافذة مغلقة
        const relatedModal = document.querySelector('.modal.show, .modal[style*="display: block"]');
        if (!relatedModal) {
            console.log('🗑️ إزالة backdrop آمنة');
            backdrop.remove();
        }
    });

    console.log('✅ تمت الإزالة الآمنة للبلور');
}

/**
 * إغلاق جميع النوافذ المنبثقة (النسخة الأصلية - تم استبدالها بـ closeModalsEnhanced في handleEscapeKey)
 */
function closeModalsSafe() {
    console.log('🛡️ محاولة إغلاق النوافذ الآمن...');

    let closed = false;

    // أولاً: محاولة إغلاق نافذة المصروف المثبت تحديداً
    if (closeExpenseModalSpecific()) {
        console.log('✅ تم إغلاق نافذة المصروف المثبت بنجاح');
        closed = true;
    }

    // ثانياً: إغلاق النوافذ الأخرى المرئية
    const visibleModals = document.querySelectorAll(`
        .modal.show, .dialog.show,
        .modal[style*="display: block"], .dialog[style*="display: block"],
        .modal[style*="display: flex"]
    `);

    visibleModals.forEach(modal => {
        if (modal.id !== 'addExpenseModal') { // تجنب نافذة المصروف التي عالجناها
            console.log('🚪 إغلاق نافذة آمن:', modal.id || modal.className);
            
            // استخدام Bootstrap إذا كان متاحاً
            if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                try {
                    const bsModal = bootstrap.Modal.getInstance(modal);
                    if (bsModal) {
                        bsModal.hide();
                        closed = true;
                        return;
                    }
                } catch (e) {
                    console.log('❌ خطأ في Bootstrap modal:', e);
                }
            }

            // إخفاء النافذة بلطف
            modal.style.display = 'none';
            modal.classList.remove('show', 'active');
            closed = true;
        }
    });

    // إزالة البلور بعد الإغلاق
    if (closed) {
        setTimeout(removeBlurEffectsSafe, 50);
    }

    return closed;
}

/**
 * التنقل إلى الواجهة الرئيسية
 */
function navigateToMainInterface() {
    const loginPage = document.getElementById('loginPage');
    const cashierPage = document.getElementById('cashierPage');
    const accountantPage = document.getElementById('accountantPage');

    if (loginPage && !loginPage.classList.contains('active')) {
        if (cashierPage && cashierPage.classList.contains('active')) {
            console.log('✓ ESC: أنت بالفعل في صفحة الكاشير');
        } else if (accountantPage && accountantPage.classList.contains('active')) {
            console.log('✓ ESC: أنت بالفعل في صفحة المحاسب');
        } else {
            // الرجوع إلى صفحة الكاشير بشكل افتراضي
            if (cashierPage) cashierPage.classList.add('active');
            if (accountantPage) accountantPage.classList.remove('active');
            if (loginPage) loginPage.classList.remove('active');
            console.log('✓ ESC: تم الرجوع إلى صفحة الكاشير');
        }

        // إزالة البلور بعد التنقل
        removeBlurEffectsForce(); // استخدام الإزالة القوية
    }
}

/**
 * إضافة CSS إضافي لمعالجة مشكلة البلور
 */
function addEnhancedBlurStyles() {
    if (document.querySelector('#enhancedBlurStyles')) return;

    const style = document.createElement('style');
    style.id = 'enhancedBlurStyles';
    style.textContent = `
        /* إزالة البلور عند إغلاق النوافذ */
        body.modal-open {
            overflow: auto !important;
            padding-right: 0 !important;
        }

        /* التأكد من إزالة تأثيرات البلور */
        .modal-blur-removed {
            backdrop-filter: none !important;
            filter: none !important;
        }

        /* إصلاح لبعض مكتبات CSS الشائعة */
        .modal-backdrop {
            display: none !important;
            opacity: 0 !important;
        }

        /* Bootstrap modal fixes */
        .modal {
            backdrop-filter: none !important;
        }

        .modal.show ~ .modal-backdrop {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
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
        { key: 'f9' },                 // تبديل القائمة الجانبية
        { alt: true, key: '1' },
        { alt: true, key: '2' },
        { alt: true, key: '3' },
        { alt: true, key: '4' }
    ];

    // لا تمنع السلوك الافتراضي لـ F12
    if (key === 'f12') {
        return false;
    }

    return conflicts.some(conflict => {
        const ctrlMatch = !conflict.ctrl || (event.ctrlKey || event.metaKey);
        const altMatch = !conflict.alt || event.altKey;
        const keyMatch = conflict.key === key;
        return ctrlMatch && altMatch && keyMatch;
    });
}

/**
 * معالجة Function Keys - الإصدار المحسّن
 */
function handleFunctionKeys(event) {
    // لا تمنع السلوك الافتراضي لـ F12 هنا
    if (event.key === 'F12') {
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    const actions = {
        'F1': () => openHelpModal(),
        'F2': () => openQuickSearch(),
        'F3': () => {
            console.log('🎯 F3 - فتح مصروف عادي');
            openRegularExpenseModal();
        },
        'F4': () => {
            console.log('🎯 F4 - فتح مصروف مثبت');
            openPinnedExpenseModalEnhanced(); // تم التصحيح: استدعاء الدالة المحسنة مباشرة
        },
        'F5': () => refreshCurrentView(),
        'F9': () => toggleSidebar()
    };

    const action = actions[event.key];
    if (action) {
        action();
    } else {
        console.log(`ℹ️ مفتاح ${event.key} بدون إجراء مخصص`);
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
        'p': () => openPinnedExpenseModalEnhanced(), // تم التصحيح: استدعاء الدالة المحسنة مباشرة
        'f': () => openQuickSearch(),
        's': () => saveCurrentData(),
        'r': () => {
            // دعم إعادة تحميل الصفحة عند Ctrl+R
            if (typeof refreshCurrentView === 'function') {
                refreshCurrentView();
            } else if (typeof location !== 'undefined') {
                location.reload();
            }
        },
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

    // Scroll only if item is out of view
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
 * إغلاق جميع النوافذ المنبثقة (النسخة الأصلية)
 */
// هذه الدالة لم تعد تستخدم مباشرة في handleEscapeKey بعد التحديث
// ولكن يمكن الاحتفاظ بها كدالة مساعدة إذا كانت هناك استخدامات أخرى
function closeModalsOld() {
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
 * فتح نافذة المصروف المثبت - الإصدار المحسّن (تم تحسينها)
 */
function openPinnedExpenseModalEnhanced() {
    if (!checkUserPermission()) return;
    
    console.log('🎯 محاولة فتح نافذة المصروف المثبت...');
    
    const existingModal = document.getElementById('addExpenseModal');

    // فحص أكثر دقة لحالة النافذة
    const isModalVisuallyOpen = existingModal && (
        existingModal.style.display === 'flex' || 
        existingModal.style.display === 'block' ||
        existingModal.classList.contains('show') ||
        existingModal.classList.contains('active') ||
        existingModal.classList.contains('open') // أضفنا 'open'
    );

    if (isModalVisuallyOpen) {
        console.log('ℹ️ النافذة مفتوحة بالفعل - جلب التركيز');
        existingModal.focus();
        return;
    }
    
    // إذا كانت النافذة موجودة ولكنها ليست مفتوحة بصرياً، قم بإعادة تعيينها
    if (existingModal) {
        console.log('🔧 النافذة موجودة ولكنها ليست مرئية، جاري إعادة تعيين حالتها.');
        existingModal.style.cssText = ''; // إزالة أي display:none قسري أو أنماط أخرى
        existingModal.classList.remove('force-closed', 'broken', 'show', 'active', 'open'); // إزالة جميع كلاسات الحالة
        // إزالة أي backdrop قد يكون عالقاً
        const backdrop = document.querySelector('.modal-backdrop, .backdrop');
        if (backdrop) backdrop.remove();
        document.body.classList.remove('modal-open', 'overflow-hidden', 'no-scroll');
        document.body.style.overflow = '';
    }
    
    // إعادة تعيين النموذج أولاً
    if (typeof showAddExpenseModal === 'function') {
        showAddExpenseModal();
        console.log('✅ تم فتح نافذة المصروف الأساسية');
        
        // تفعيل خيار التثبيت بعد فتح النافذة
        setTimeout(() => {
            const pinToggle = document.getElementById('pinExpenseFormToggle');
            if (pinToggle) {
                pinToggle.checked = true;
                console.log('✅ تم تفعيل خيار التثبيت');
                
                // تشغيل event التغيير إذا كان موجوداً
                if (typeof pinToggle.onchange === 'function') {
                    pinToggle.onchange(new Event('change'));
                } else {
                    pinToggle.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else {
                console.log('⚠️ لم يتم العثور على زر التثبيت');
            }
        }, 300);
        
    } else {
        console.error('❌ دالة showAddExpenseModal غير موجودة');
        showMessage('وظيفة إضافة المصروفات غير متوفرة', 'error');
    }
}

/**
 * فحص حالة نافذة المصروف
 */
function checkExpenseModalState() {
    const modal = document.getElementById('addExpenseModal');
    if (!modal) {
        console.log('❌ نافذة المصروف غير موجودة في DOM');
        return false;
    }
    
    const style = window.getComputedStyle(modal);
    console.log('🔍 حالة نافذة المصروف:', {
        display: style.display,
        visibility: style.visibility,
        classes: modal.className,
        parent: modal.parentElement ? modal.parentElement.tagName : 'no-parent'
    });
    
    return style.display !== 'none';
}

/**
 * إصلاح نافذة المصروف إذا كانت معطلة
 */
function repairExpenseModal() {
    const modal = document.getElementById('addExpenseModal');
    if (!modal) return false;
    
    console.log('🔧 محاولة إصلاح نافذة المصروف...');
    
    // إعادة تعيين الأنماط
    modal.style.cssText = '';
    modal.classList.remove('force-closed', 'broken', 'show', 'active', 'open'); // أضفنا 'show', 'active', 'open'
    
    // إعادة إرفاق الأحداث إذا أمكن
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        try {
            // محاولة إعادة إنشاء instance
            const bsModal = new bootstrap.Modal(modal);
            console.log('✅ تم إصلاح instance Bootstrap');
        } catch (e) {
            console.log('❌ لا يمكن إصلاح Bootstrap instance:', e);
        }
    }
    
    return true;
}
/**
 * التحقق مما إذا كانت نافذة المصروف مفتوحة
 */
function isExpenseModalOpen() {
    const modal = document.getElementById('addExpenseModal');
    return modal && (modal.style.display === 'flex' || modal.classList.contains('active') || modal.classList.contains('show') || modal.classList.contains('open'));
}

/**
 * إغلاق نافذة المصروف بشكل آمن
 */
function closeExpenseModalSafely() {
    const modal = document.getElementById('addExpenseModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active', 'show', 'open'); // أضفنا 'open'
        
        // إزالة أي backdrop مرتبط
        const backdrop = document.querySelector('.modal-backdrop, .backdrop');
        if (backdrop) {
            backdrop.remove();
        }
        
        // إعادة ضبط حالة body
        document.body.classList.remove('modal-open', 'overflow-hidden', 'no-scroll'); // أضفنا 'overflow-hidden', 'no-scroll'
        document.body.style.overflow = '';
        
        console.log('✅ تم إغلاق نافذة المصروف بشكل آمن');
        return true;
    }
    return false;
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
 * حل مشكلة handleLoginShortcuts المفقودة
 */
if (typeof handleLoginShortcuts === 'undefined') {
    window.handleLoginShortcuts = function(event) {
        // دالة بديلة بسيطة
        if (event.key === 'Enter') {
            const loginBtn = document.querySelector('#loginButton, .login-btn, [type="submit"]');
            if (loginBtn) {
                loginBtn.click();
            }
        }
    };
    console.log('✅ تم إنشاء handleLoginShortcuts بديلة');
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

/**
 * إضافة أنماط CSS لرسائل التوست الآمنة (افتراضية)
 * هذه الدالة غير موجودة في الكود الأصلي، لذا تم إضافتها كدالة فارغة
 * يجب عليك ملء محتواها إذا كان لديك نظام رسائل توست مخصص.
 */
function addSafeToastStyles() {
    if (document.querySelector('#safeToastStyles')) return;

    const style = document.createElement('style');
    style.id = 'safeToastStyles';
    style.textContent = `
        /* أضف هنا أي أنماط CSS لرسائل التوست الخاصة بك لضمان عدم تسببها في البلور */
        /* مثال: */
        .toast-message {
            backdrop-filter: none !important;
            filter: none !important;
        }
        .toast-container {
            z-index: 9999 !important; /* تأكد من أنها فوق كل شيء */
        }
    `;
    document.head.appendChild(style);
}

/**
 * كود تشخيصي آمن لاكتشاف مصدر البلور
 */
function diagnoseBlurIssue() {
    try {
        console.group('🔍 تشخيص مشكلة البلور');

        // 1. فحص classes في body
        console.log('📋 Body classes:', document.body.className);

        // 2. فحص styles في body
        const bodyStyle = window.getComputedStyle(document.body);
        console.log('🎨 Body styles - backdrop-filter:', bodyStyle.backdropFilter);
        console.log('🎨 Body styles - filter:', bodyStyle.filter);

        // 3. البحث عن عناصر البلور (بحد أقصى 100 عنصر)
        const allElements = document.querySelectorAll('body, .modal, .modal-backdrop, .backdrop');
        let foundBlur = false;

        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            const style = window.getComputedStyle(el);

            if (style.backdropFilter.includes('blur') || style.filter.includes('blur')) {
                console.log('❌ عنصر به بلور:', el.tagName, {
                    backdropFilter: style.backdropFilter,
                    filter: style.filter,
                    classes: el.className
                });
                foundBlur = true;
                break; // اكتفِ بأول عنصر
            }
        }

        // 4. فحص النوافذ النشطة
        const modals = document.querySelectorAll('.modal, .dialog');
        console.log('🪟 عدد النوافذ:', modals.length);

        // 5. فحص عناصر backdrop
        const backdrops = document.querySelectorAll('.modal-backdrop, .backdrop');
        console.log('🎭 عناصر backdrop:', backdrops.length);

        console.groupEnd();
        return foundBlur || backdrops.length > 0;

    } catch (error) {
        console.error('❌ خطأ في التشخيص:', error);
        console.groupEnd();
        return false;
    }
}

/**
 * الإصدار القوي لإزالة البلور
 */
function removeBlurEffectsForce() {
    console.log('🛠️ تشغيل الإزالة القوية للبلور...');

    // 1. إزالة جميع classes المشتبه بها
    const suspectClasses = [
        'blur', 'blurred', 'backdrop-blur', 'modal-open', 'overflow-hidden',
        'no-scroll', 'scroll-lock', 'dialog-open', 'modal-active'
    ];

    document.body.classList.remove(...suspectClasses);
    document.documentElement.classList.remove(...suspectClasses);

    // 2. إزالة جميع عناصر backdrop
    const backdrops = document.querySelectorAll(`
        .modal-backdrop, .backdrop, [class*="backdrop"],
        .overlay, [class*="overlay"],
        .dialog-backdrop, [class*="dialog"]
    `);

    backdrops.forEach(el => {
        console.log('🗑️ إزالة backdrop:', el);
        el.remove();
    });

    // 3. إعادة ضبط جميع الـ styles
    document.body.style.cssText = '';
    document.documentElement.style.cssText = '';

    // 4. إعادة ضبط overflow في جميع العناصر
    document.querySelectorAll('*').forEach(el => {
        if (el.style.overflow === 'hidden') {
            el.style.overflow = '';
        }
    });

    // 5. إغلاق جميع النوافذ بالقوة
    const modals = document.querySelectorAll(`
        .modal, .dialog, [role="dialog"],
        .popup, [class*="modal"], [class*="popup"]
    `);

    modals.forEach(modal => {
        modal.style.display = 'none';
        modal.classList.remove('show', 'active', 'open');

        // إطلاق events الإغلاق
        modal.dispatchEvent(new Event('close', { bubbles: true }));
        modal.dispatchEvent(new Event('hidden', { bubbles: true }));
    });

    // 6. إزالة أي event listeners قد تسبب المشكلة (وإعادة إضافتها)
    document.removeEventListener('keydown', handleKeyboardShortcuts);
    setTimeout(() => {
        document.addEventListener('keydown', handleKeyboardShortcuts, true);
    }, 100);

    console.log('✅ تمت الإزالة القوية للبلور');
}

/**
 * تشخيص تفصيلي لإغلاق النوافذ
 */
function debugModalClosing() {
    console.group('🔍 تشخيص إغلاق النوافذ');

    // 1. فحص جميع النوافذ
    const modals = document.querySelectorAll('.modal, .dialog, [role="dialog"]');
    console.log('📊 عدد النوافذ المكتشفة:', modals.length);

    modals.forEach((modal, index) => {
        const style = window.getComputedStyle(modal);
        const isVisible = style.display !== 'none' && style.visibility !== 'hidden';

        console.log(`🪟 نافذة ${index + 1}:`, {
            tag: modal.tagName,
            id: modal.id,
            classes: modal.className,
            display: style.display,
            visibility: style.visibility,
            isVisible: isVisible
        });
    });

    // 2. فحص النافذة النشطة
    const activeModal = document.querySelector('.modal.show, .dialog.show, [style*="display: block"]');
    console.log('🎯 النافذة النشطة:', activeModal);

    console.groupEnd();
    return activeModal;
}

/**
 * إغلاق النوافذ بشكل أقوى (تم تحسينها)
 */
function closeModalsEnhanced() {
    console.log('🔧 محاولة إغلاق النوافذ المحسّن...');

    // أولاً: محاولة إغلاق نافذة المصروف المثبت تحديداً
    if (closeExpenseModalSpecific()) {
        console.log('✅ تم إغلاق نافذة المصروف المثبت بنجاح');
        return true;
    }

    let closed = false;

    // الطريقة 1: إغلاق النوافذ المرئية
    const visibleModals = document.querySelectorAll(`
        .modal.show, .dialog.show,
        .modal[style*="display: block"], .dialog[style*="display: block"],
        .modal:not([style*="display: none"]), .dialog:not([style*="display: none"]),
        .modal.active, .dialog.active, .modal.open, .dialog.open
    `); // أضفنا .active و .open للفحص

    console.log(`🎯 عدد النوافذ المرئية أو النشطة: ${visibleModals.length}`);

    visibleModals.forEach(modal => {
        console.log('🚪 محاولة إغلاق:', modal.id || modal.className);

        // الطريقة 1: إخفاء مباشر
        modal.style.display = 'none';
        modal.classList.remove('show', 'active', 'open');

        // الطريقة 2: إذا كان هناك Bootstrap modal
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            try {
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) {
                    bsModal.hide();
                    console.log('✅ تم إغلاق نافذة Bootstrap');
                }
            } catch (e) {
                console.log('❌ خطأ في إغلاق Bootstrap modal:', e);
            }
        }

        // الطريقة 3: تشغيل events الإغلاق
        const events = ['close', 'hide', 'hidden', 'modalClose', 'hidden.bs.modal']; // أضفنا hidden.bs.modal
        events.forEach(eventName => {
            try {
                modal.dispatchEvent(new Event(eventName, { bubbles: true }));
            } catch (e) {
                // تجاهل الأخطاء في events
            }
        });

        // الطريقة 4: البحث عن زر إغلاق والنقر عليه
        const closeButtons = modal.querySelectorAll(`
            [data-dismiss="modal"], [data-bs-dismiss="modal"],
            .close, .btn-close, [class*="close"], [class*="dismiss"]
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

    // الطريقة 5: إغلاق backdrop
    const backdrops = document.querySelectorAll(`
        .modal-backdrop, .backdrop,
        [class*="backdrop"], [class*="overlay"]
    `);

    backdrops.forEach(backdrop => {
        console.log('🗑️ إزالة backdrop:', backdrop.className);
        backdrop.remove();
        closed = true;
    });

    // إزالة classes من body
    const bodyClasses = ['modal-open', 'dialog-open', 'no-scroll', 'overflow-hidden']; // أضفنا overflow-hidden
    bodyClasses.forEach(className => {
        if (document.body.classList.contains(className)) {
            document.body.classList.remove(className);
            closed = true;
        }
    });

    // إعادة ضبط overflow
    if (document.body.style.overflow === 'hidden') {
        document.body.style.overflow = '';
        closed = true;
    }

    console.log(closed ? '✅ تم إغلاق النوافذ' : 'ℹ️ لا توجد نوافذ مفتوحة');
    return closed;
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
        // 1. إعداد الحماية من التكرار أولاً (إذا كانت دالة showMessage موجودة)
        if (typeof window.showMessage === 'function') {
            window._showingMessage = false;
            if (window.showMessage !== showMessage) {
                window._originalShowMessage = window.showMessage;
            }
        } else {
            // تعريف دالة showMessage افتراضية إذا لم تكن موجودة
            window.showMessage = function(message, type = 'info', duration = 3000) {
                console.log(`[Message - ${type.toUpperCase()}]: ${message}`);
                // يمكنك إضافة منطق لعرض رسالة بسيطة هنا (مثل alert أو إضافة عنصر DOM مؤقت)
            };
        }


        // 2. إضافة الأنماط
        addKeyboardShortcutsStyles();
        addEnhancedBlurStyles();
        addSafeToastStyles(); // تأكد من وجود هذه الدالة أو استبدالها بما يناسب نظام التوست الخاص بك

        // 3. تهيئة الاختصارات
        initializeKeyboardShortcuts();

        console.log('✅ نظام اختصارات الكيبورد جاهز للاستخدام!');

    } catch (error) {
        console.error('❌ خطأ في تهيئة النظام:', error);
    }
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
    openPinnedExpense: openPinnedExpenseModalEnhanced, // تأكد من تصدير النسخة المحسنة
    refresh: refreshCurrentView,
    toggleSidebar: toggleSidebar,
    save: saveCurrentData,
    logout: quickLogout
};

// للتوافق مع الكود القديم
window.initializeKeyboardShortcuts = initializeKeyboardShortcuts;
window.handleKeyboardShortcuts = handleKeyboardShortcuts;
// تأكد من أن openPinnedExpenseModal تشير إلى النسخة المحسنة
window.openPinnedExpenseModal = openPinnedExpenseModalEnhanced;


console.log('✨ نظام اختصارات الكيبورد المحسن - جاهز!');
