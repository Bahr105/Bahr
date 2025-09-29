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

    // منع اختصارات المتصفح المتعارضة، باستثناء F12
    if (shouldPreventDefault(event)) {
        event.preventDefault();
        event.stopPropagation();
    }

    // معالجة Function Keys
    if (key.startsWith('F') && key.length <= 3 && key !== 'F12') {
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
 * معالجة زر Escape
 */
function handleEscapeKey(event) {
    console.log('⎋ معالجة زر Escape...');

    // 1. أولاً: إغلاق القوائم المنسدلة إذا كانت مفتوحة
    if (closeSuggestions()) {
        console.log('✅ تم إغلاق القوائم المنسدلة');
        event.preventDefault();
        return;
    }

    // 2. ثانياً: إغلاق النوافذ المنبثقة
    if (closeModalsEnhanced()) {
        console.log('✅ تم إغلاق النوافذ المنبثقة');
        event.preventDefault();
        return;
    }

    // 3. ثالثاً: إزالة تأثيرات البلور
    removeBlurEffectsForce();
    
    // 4. رابعاً: التنقل للواجهة الرئيسية إذا لزم الأمر
    navigateToMainInterface();

    console.log('✅ تم معالجة زر Escape');
}

/**
 * إغلاق جميع النوافذ المنبثقة
 */
function closeModalsEnhanced() {
    console.log('🔧 محاولة إغلاق النوافذ المحسّن...');

    let closed = false;

    // إغلاق نافذة المصروف المثبت أولاً
    if (closeExpenseModalSpecific()) {
        console.log('✅ تم إغلاق نافذة المصروف المثبت بنجاح');
        closed = true;
    }

    // إغلاق النوافذ المرئية الأخرى
    const visibleModals = document.querySelectorAll(`
        .modal.show, .dialog.show,
        .modal[style*="display: block"], .dialog[style*="display: block"],
        .modal:not([style*="display: none"]), .dialog:not([style*="display: none"])
    `);

    console.log(`🎯 عدد النوافذ المرئية: ${visibleModals.length}`);

    visibleModals.forEach(modal => {
        console.log('🚪 محاولة إغلاق:', modal.id || modal.className);

        // إخفاء مباشر
        modal.style.display = 'none';
        modal.classList.remove('show', 'active', 'open');
        closed = true;

        // البحث عن زر إغلاق والنقر عليه
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
    });

    // إزالة backdrop
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
    const bodyClasses = ['modal-open', 'dialog-open', 'no-scroll'];
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

/**
 * إغلاق نافذة المصروف المثبت تحديداً
 */
function closeExpenseModalSpecific() {
    console.log('🎯 البحث عن نافذة المصروف المثبت...');

    // كل الأسماء المحتملة لنوافذ المصروفات
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
                // تحقق مما إذا كانت النافذة مرئية
                if (style.display === 'block' || modal.classList.contains('show') || modal.classList.contains('active')) {
                    console.log('🎯 عثرت على نافذة مصروف مرئية:', modal.id || modal.className);

                    // البحث عن زر إغلاق والنقر عليه
                    const closeBtn = modal.querySelector(
                        '[data-dismiss="modal"], ' +
                        '[data-bs-dismiss="modal"], ' +
                        '.close, ' +
                        '.btn-close, ' +
                        'button[aria-label="Close"], ' +
                        '.modal-header button'
                    );

                    if (closeBtn) {
                        console.log('✅ تم العثور على زر الإغلاق. جاري النقر عليه:', closeBtn);
                        closeBtn.click();
                        foundAndClosed = true;
                    } else {
                        console.log('⚠️ لم يتم العثور على زر إغلاق محدد. جاري إغلاق النافذة مباشرة.');
                        modal.style.display = 'none';
                        modal.classList.remove('show', 'active');
                        foundAndClosed = true;
                    }

                    // إزالة أي backdrop
                    const backdrop = document.querySelector('.modal-backdrop, .backdrop, [class*="backdrop"]');
                    if (backdrop) {
                        console.log('🗑️ إزالة backdrop.');
                        backdrop.remove();
                    }

                    // إزالة فئات الجسم
                    document.body.classList.remove('modal-open', 'dialog-open', 'no-scroll', 'overflow-hidden');
                    document.body.style.overflow = '';

                    if (foundAndClosed) return;
                }
            });
        } catch (e) {
            console.log('❌ خطأ في البحث عن:', selector, e);
        }
        if (foundAndClosed) return;
    });

    return foundAndClosed;
}

/**
 * الإصدار القوي لإزالة البلور
 */
function removeBlurEffectsForce() {
    console.log('🛠️ تشغيل الإزالة القوية للبلور...');

    // إزالة جميع classes المشتبه بها
    const suspectClasses = [
        'blur', 'blurred', 'backdrop-blur', 'modal-open', 'overflow-hidden',
        'no-scroll', 'scroll-lock', 'dialog-open', 'modal-active'
    ];

    document.body.classList.remove(...suspectClasses);
    document.documentElement.classList.remove(...suspectClasses);

    // إزالة جميع عناصر backdrop
    const backdrops = document.querySelectorAll(`
        .modal-backdrop, .backdrop, [class*="backdrop"],
        .overlay, [class*="overlay"],
        .dialog-backdrop, [class*="dialog"]
    `);

    backdrops.forEach(el => {
        console.log('🗑️ إزالة backdrop:', el);
        el.remove();
    });

    // إعادة ضبط الـ styles
    document.body.style.cssText = '';
    document.documentElement.style.cssText = '';

    // إعادة ضبط overflow
    document.querySelectorAll('*').forEach(el => {
        if (el.style.overflow === 'hidden') {
            el.style.overflow = '';
        }
    });

    console.log('✅ تمت الإزالة القوية للبلور');
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
    }
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

    // Ctrl/Cmd + Enter لإرسال النماذج
    if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        submitParentForm(target);
        return;
    }

    // Enter عادي في textarea يبقى سطر جديد
    if (target.tagName.toLowerCase() === 'textarea') {
        return;
    }

    // Enter عادي في input ينتقل للحقل التالي
    event.preventDefault();
    const form = target.closest('form');
    if (form) {
        const inputs = Array.from(form.querySelectorAll('input, select, textarea, button'));
        const currentIndex = inputs.indexOf(target);
        const nextInput = inputs[currentIndex + 1];

        if (nextInput && nextInput.type !== 'submit' && nextInput.tagName !== 'BUTTON') {
            nextInput.focus();
        }
    }
}

/**
 * التحقق من ضرورة منع السلوك الافتراضي
 */
function shouldPreventDefault(event) {
    const key = event.key.toLowerCase();

    const conflicts = [
        { ctrl: true, key: 'p' },
        { ctrl: true, key: 'n' },
        { ctrl: true, key: 's' },
        { ctrl: true, key: 'f' },
        { ctrl: true, key: 'h' },
        { key: 'f1' },
        { key: 'f3' },
        { key: 'f4' },
        { key: 'f5' },
        { key: 'f9' },
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
 * معالجة Function Keys
 */
function handleFunctionKeys(event) {
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
            openPinnedExpenseModal();
        },
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

    // Scroll if needed
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

// =====================================
// 🛠️ دوال التطبيق الأساسية
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
    console.log('🎯 فتح نافذة المصروف المثبت...');
    
    // إغلاق أي نافذة سابقة
    closeExpenseModalSpecific();
    
    setTimeout(() => {
        if (typeof showAddExpenseModal === 'function') {
            try {
                showAddExpenseModal();
                console.log('✅ تم استدعاء showAddExpenseModal()');
                
                // تفعيل التثبيت بعد فتح النافذة
                setTimeout(() => {
                    activatePinning();
                }, 500);
            } catch (error) {
                console.error('❌ خطأ في showAddExpenseModal:', error);
                openExpenseModalManually();
            }
        } else {
            openExpenseModalManually();
        }
    }, 100);
}

/**
 * تفعيل خيار التثبيت
 */
function activatePinning() {
    console.log('📍 محاولة تفعيل التثبيت...');
    
    const maxAttempts = 5;
    let attempts = 0;
    
    const tryActivatePinning = () => {
        attempts++;
        const pinToggle = document.getElementById('pinExpenseFormToggle');
        
        if (pinToggle) {
            pinToggle.checked = true;
            console.log('✅ تم تفعيل خيار التثبيت');
            
            const events = ['change', 'click', 'input'];
            events.forEach(eventType => {
                pinToggle.dispatchEvent(new Event(eventType, { bubbles: true }));
            });
            
            return true;
        } else if (attempts < maxAttempts) {
            console.log(`🔄 محاولة ${attempts}/${maxAttempts} للعثور على زر التثبيت...`);
            setTimeout(tryActivatePinning, 200);
            return false;
        } else {
            console.error('❌ فشل العثور على زر التثبيت');
            return false;
        }
    };
    
    setTimeout(tryActivatePinning, 300);
}

/**
 * فتح النافذة يدوياً
 */
function openExpenseModalManually() {
    console.log('🔧 فتح النافذة يدوياً...');
    
    const modal = document.getElementById('addExpenseModal');
    if (!modal) {
        console.error('❌ نافذة addExpenseModal غير موجودة');
        showMessage('نافذة المصروف غير متاحة', 'error');
        return;
    }
    
    // إظهار النافذة
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';
    modal.classList.add('active', 'show');
    
    // إضافة backdrop
    let backdrop = document.querySelector('.modal-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop fade show';
        document.body.appendChild(backdrop);
    }
    backdrop.style.display = 'block';
    
    // منع التمرير
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    
    // إعادة تعيين النموذج
    const form = document.getElementById('addExpenseForm');
    if (form) form.reset();
    
    // تفعيل التثبيت
    setTimeout(() => {
        activatePinning();
    }, 200);
    
    console.log('✅ تم فتح النافذة يدوياً بنجاح');
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
 * إضافة أنماط CSS
 */
function addKeyboardShortcutsStyles() {
    if (document.querySelector('#keyboardShortcutsStyles')) return;

    const style = document.createElement('style');
    style.id = 'keyboardShortcutsStyles';
    style.textContent = `
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

// =====================================
// 🚀 التهيئة التلقائية
// =====================================

/**
 * تهيئة النظام عند تحميل الصفحة
 */
function initSystem() {
    console.log('🚀 بدء تهيئة نظام اختصارات الكيبورد...');

    try {
        // إضافة الأنماط
        addKeyboardShortcutsStyles();

        // تهيئة الاختصارات
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
