// main.js — نسخة مُحدَّثة لإضافة شورتكات وتكميل الـ autocomplete
// مؤرشف: 2025-09-29
// ملاحظات: هذا الملف يضيف ميزة Ctrl+Shift+Z لتثبيت/فتح القائمة
// ومحرّك autocomplete عام لعناصر البحث ذات الصنف "search-box".
// التكامل: عند اختيار عنصر من الاقتراحات، ستحاول الدالة استدعاء
// window.selectExpenseCategory إذا كانت موجودة، أو دالة اسمها
// محددة في data-select-callback على الـ input.

// -----------------------------------------------------------------------------
// INIT
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    // إعدادات عامة موجودة في نسختك السابقة — نحتفظ باستدعاءاتك
    setupModalCloseOnOutsideClick?.(); // تجنُّب الخطأ إن لم تكن معرفة
    try {
        await loadGoogleScripts?.();
    } catch (error) {
        console.error('Failed to load Google Scripts:', error);
        showMessage?.('فشل تحميل الخدمات الخارجية. يرجى إعادة تحميل الصفحة.', 'error');
    }
    setDefaultDatesAndTimes?.();

    // تأكد من صفحاتك (نفس السلوك الأصلي)
    document.getElementById('loginPage')?.classList.add('active');
    document.getElementById('cashierPage')?.classList.remove('active');
    document.getElementById('accountantPage')?.classList.remove('active');

    // close buttons
    const closeButtons = document.querySelectorAll('.close-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.target.closest('.modal')?.id;
            if (modalId) closeModal(modalId);
        });
    });

    // شورتكات لوحة المفاتيح (النسخة الأصلية + تحسين)
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // Register global autocomplete initializer for all existing and future inputs
    initGlobalSearchBoxes();

    // Restore pinned menu state (if موجود)
    restoreMenuPinState();

    console.log('DOM loaded and initialized successfully.');
});

// -----------------------------------------------------------------------------
// KEYBOARD SHORTCUTS (مُحدّث ليشمل Ctrl+Shift+Z pin/open menu)
// -----------------------------------------------------------------------------
function handleKeyboardShortcuts(event) {
    // إذا لم تكن صفحة الكاشير نشطة، نتبع نفس سياسة النسخة الأصلية
    const cashierPage = document.getElementById('cashierPage');
    if (!cashierPage || !cashierPage.classList.contains('active')) {
        return;
    }

    // منع التداخل إن كان هناك مودال غير مصرح به
    const activeModals = document.querySelectorAll('.modal.active');
    if (activeModals.length > 0 && activeModals[0].id !== 'addExpenseModal') {
        return;
    }

    // Ctrl + z : سلوكك الأصلي (فتح نافذة إضافة مصروف)
    if (event.ctrlKey && !event.shiftKey && (event.key === 'z' || event.key === 'Z')) {
        event.preventDefault();
        showAddExpenseModal?.();
    }

    // Ctrl + s : حفظ المصروف (النسخة الأصلية)
    if (event.ctrlKey && (event.key === 's' || event.key === 'S')) {
        const addExpenseModal = document.getElementById('addExpenseModal');
        if (addExpenseModal && addExpenseModal.classList.contains('active')) {
            event.preventDefault();
            const saveButton = document.getElementById('addExpenseModalSaveBtn');
            if (saveButton) saveButton.click();
        }
    }

    // ---------------------------------------------------------------------
    // الميزة المطلوبة: Ctrl + Shift + Z لفتح وتثبيت (pin) القائمة
    // ---------------------------------------------------------------------
    if (event.ctrlKey && event.shiftKey && (event.key === 'Z' || event.key === 'z')) {
        event.preventDefault();
        togglePinMenu();
    }
}

// -----------------------------------------------------------------------------
// MENU PINNING: فتح/غلق/تثبيت القائمة
// -----------------------------------------------------------------------------
const MENU_PIN_STORAGE_KEY = 'app_menu_pinned_state';

// افترض وجود عنصر قائمة له id = 'sideMenu' أو 'mainMenu' أو 'appMenu'.
// حاول العثور عليه: (يمكنك تعديل المعرف بما يناسب مشروعك)
function getMenuElement() {
    return document.getElementById('sideMenu') || document.getElementById('mainMenu') || document.getElementById('appMenu');
}

function togglePinMenu() {
    const menu = getMenuElement();
    if (!menu) {
        // لو ما فيش عنصر قائمة ظاهر، نحاول فتح مودال أو عنصر آخر
        // إذا عندك دالة showMenu، نستدعيها
        if (typeof showMenu === 'function') {
            // toggle pin state in storage and inform the showMenu to pin
            const currentlyPinned = loadMenuPinState();
            saveMenuPinState(!currentlyPinned);
            showMenu({ pinned: !currentlyPinned });
            showToast(`القائمة ${!currentlyPinned ? 'مثبتة' : 'غير مثبتة'}.`);
            return;
        }
        console.warn('menu element not found (expected id: sideMenu|mainMenu|appMenu).');
        showToast('القائمة غير موجودة في الواجهة.', 'warning');
        return;
    }

    const pinned = menu.classList.toggle('pinned');
    // visual feedback: add class 'open' to ensure visible
    menu.classList.add('open');
    saveMenuPinState(pinned);
    showToast(`القائمة ${pinned ? 'مثبتة' : 'غير مثبتة'}.`);
}

function saveMenuPinState(pinned) {
    try {
        localStorage.setItem(MENU_PIN_STORAGE_KEY, pinned ? '1' : '0');
    } catch (e) {
        console.warn('Could not save menu pin state:', e);
    }
}

function loadMenuPinState() {
    try {
        return localStorage.getItem(MENU_PIN_STORAGE_KEY) === '1';
    } catch (e) {
        return false;
    }
}

function restoreMenuPinState() {
    const pinned = loadMenuPinState();
    const menu = getMenuElement();
    if (menu) {
        if (pinned) {
            menu.classList.add('pinned', 'open');
        } else {
            menu.classList.remove('pinned');
        }
    } else if (pinned && typeof showMenu === 'function') {
        showMenu({ pinned: true });
    }
}

// helper toast (إن لم تكن موجودة)
function showToast(message, type = 'info') {
    if (typeof showMessage === 'function') {
        showMessage(message, type);
        return;
    }
    // بديل بسيط:
    console.log(`[TOAST:${type}] ${message}`);
}

// -----------------------------------------------------------------------------
// AUTOCOMPLETE GENERIC FOR .search-box
// -----------------------------------------------------------------------------
/*
  الطريقة:
    - أي <input class="search-box"> سيحصل على autocomplete.
    - لإعطاء callback مخصص: أضف attribute data-select-callback="functionName"
      (global function name string). إذا لم يوجد يتم استدعاء window.selectExpenseCategory.
    - يمكن تحديد مصدر التصنيفات عبر window.categories (مصوفة من كائنات {id, name})
      أو يستخلص من DOM عبر .category-item elements.
*/

function initGlobalSearchBoxes() {
    // Attach to existing inputs
    const inputs = document.querySelectorAll('input.search-box');
    inputs.forEach(setupSearchBox);

    // If inputs may be created later dynamically, you can use mutation observer:
    const observer = new MutationObserver(mutations => {
        for (const m of mutations) {
            m.addedNodes?.forEach(node => {
                if (node.nodeType === 1) {
                    if (node.matches && node.matches('input.search-box')) {
                        setupSearchBox(node);
                    }
                    // also look inside
                    node.querySelectorAll && node.querySelectorAll('input.search-box').forEach(setupSearchBox);
                }
            });
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function setupSearchBox(input) {
    if (input._autocompleteInitialized) return;
    input._autocompleteInitialized = true;

    // Create suggestion container
    const container = document.createElement('div');
    container.className = 'search-suggestions';
    container.style.position = 'absolute';
    container.style.zIndex = 9999;
    container.style.display = 'none';
    container.style.maxHeight = '240px';
    container.style.overflowY = 'auto';
    container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    container.style.background = '#fff';
    container.style.border = '1px solid #ddd';
    container.style.borderRadius = '6px';
    container.style.minWidth = (input.offsetWidth || 200) + 'px';
    container.setAttribute('role', 'listbox');

    // Insert container after input
    input.parentNode?.insertBefore(container, input.nextSibling);

    // position function (simple)
    function positionContainer() {
        const rect = input.getBoundingClientRect();
        const scrollY = window.scrollY || window.pageYOffset;
        container.style.left = rect.left + 'px';
        container.style.top = (rect.bottom + scrollY + 6) + 'px';
        container.style.minWidth = rect.width + 'px';
    }
    positionContainer();
    window.addEventListener('resize', positionContainer);
    window.addEventListener('scroll', positionContainer, true);

    // track keyboard navigation
    let suggestions = [];
    let focusedIndex = -1;

    input.addEventListener('input', async (e) => {
        const q = (e.target.value || '').trim();
        if (!q) {
            hideSuggestions();
            return;
        }
        // get all categories
        const cats = await getCategoriesList();
        const lower = q.toLowerCase();
        // filter: startsWith first, then includes
        const starts = cats.filter(c => c.name.toLowerCase().startsWith(lower));
        const others = cats.filter(c => !c.name.toLowerCase().startsWith(lower) && c.name.toLowerCase().includes(lower));
        suggestions = starts.concat(others).slice(0, 20);
        renderSuggestions(suggestions);
    });

    input.addEventListener('keydown', (e) => {
        if (container.style.display === 'none') return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            focusedIndex = Math.min(focusedIndex + 1, suggestions.length - 1);
            highlightItem(focusedIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            focusedIndex = Math.max(focusedIndex - 1, 0);
            highlightItem(focusedIndex);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (focusedIndex >= 0 && focusedIndex < suggestions.length) {
                chooseSuggestion(suggestions[focusedIndex]);
            } else if (suggestions.length === 1) {
                chooseSuggestion(suggestions[0]);
            } else {
                hideSuggestions();
            }
        } else if (e.key === 'Escape') {
            hideSuggestions();
        }
    });

    input.addEventListener('focus', () => {
        // If there's value, trigger input to show suggestions
        const ev = new Event('input');
        input.dispatchEvent(ev);
    });

    input.addEventListener('blur', () => {
        // delay hide so click event can register
        setTimeout(() => hideSuggestions(), 150);
    });

    function renderSuggestions(list) {
        container.innerHTML = '';
        focusedIndex = -1;
        if (!list || list.length === 0) {
            hideSuggestions();
            return;
        }
        list.forEach((item, idx) => {
            const row = document.createElement('div');
            row.className = 'search-suggestion-item';
            row.setAttribute('role', 'option');
            row.setAttribute('data-index', idx);
            row.style.padding = '8px 12px';
            row.style.cursor = 'pointer';
            row.textContent = item.name;
            row.addEventListener('mousedown', (ev) => {
                // mousedown قبل blur، لذا اختر هنا
                ev.preventDefault();
                chooseSuggestion(item);
            });
            row.addEventListener('mouseenter', () => {
                highlightItem(idx);
            });
            container.appendChild(row);
        });
        positionContainer();
        container.style.display = 'block';
    }

    function highlightItem(idx) {
        const items = container.querySelectorAll('.search-suggestion-item');
        items.forEach((el, i) => {
            if (i === idx) {
                el.style.background = '#f0f0f0';
            } else {
                el.style.background = '';
            }
        });
        focusedIndex = idx;
    }

    function hideSuggestions() {
        container.style.display = 'none';
        focusedIndex = -1;
        suggestions = [];
    }

    function chooseSuggestion(item) {
        // املأ الحقل بالاسم
        input.value = item.name;
        hideSuggestions();

        // استدعاء callback مخصص إن وُجد
        const callbackName = input.getAttribute('data-select-callback');
        if (callbackName && typeof window[callbackName] === 'function') {
            try { window[callbackName](item); return; } catch (e) { console.error('callback error', e); }
        }

        // الافتراضي: استدعاء selectExpenseCategory إذا متاحة
        if (typeof selectExpenseCategory === 'function') {
            try { selectExpenseCategory(item); return; } catch (e) { console.error('selectExpenseCategory error', e); }
        }

        // آخر بديل: أطلق حدث مخصص
        const ev = new CustomEvent('search-selection', { detail: item });
        input.dispatchEvent(ev);
    }
}

// -----------------------------------------------------------------------------
// الحصول على قائمة التصنيفات — يحاول من DOM أو من window.categories
// كل عنصر تصنيف مفترض: { id, name }
// -----------------------------------------------------------------------------
async function getCategoriesList() {
    // 1) إذا وُجدت مصفوفة جاهزة
    if (Array.isArray(window.categories) && window.categories.length > 0) {
        return window.categories.map(normalizeCategory);
    }
    // 2) حاول القراءة من عناصر DOM ذات الصنف '.category-item'
    const domItems = document.querySelectorAll('.category-item');
    if (domItems && domItems.length > 0) {
        const list = Array.from(domItems).map(el => {
            return { id: el.getAttribute('data-id') || el.dataset.id || el.textContent.trim(), name: el.textContent.trim() };
        });
        return list.map(normalizeCategory);
    }
    // 3) كحل أخير، حاول استدعاء دالة fetchCategories إن كانت موجودة (التي قد ترجع Promise)
    if (typeof fetchCategories === 'function') {
        try {
            const res = await fetchCategories();
            if (Array.isArray(res)) return res.map(normalizeCategory);
        } catch (e) {
            console.warn('fetchCategories error', e);
        }
    }
    // 4) fallback: مصفوفة فارغة لتجنب الأخطاء
    return [];
}

function normalizeCategory(c) {
    if (!c) return { id: '', name: '' };
    return { id: (c.id ?? c.value ?? c.key ?? ''), name: (c.name ?? c.label ?? c.title ?? String(c).trim()) };
}

// -----------------------------------------------------------------------------
// EXPORTS / Expose to global scope (للتوافق مع HTML onclick handlers)
// -----------------------------------------------------------------------------
window.handleKeyboardShortcuts = handleKeyboardShortcuts;
window.togglePinMenu = togglePinMenu;
window.getCategoriesList = getCategoriesList;
window.initGlobalSearchBoxes = initGlobalSearchBoxes;

// -----------------------------------------------------------------------------
// Placeholder stubs for functions that likely موجودة في main.js الأصلية.
// لا تغيّرها إذا كانت لديك تعريفات حقيقية — هذه مجرد دفعة أمان لمنع
// runtime errors إن بعض الدوال غير معرفة في السياق الحالي.
// -----------------------------------------------------------------------------
function setupModalCloseOnOutsideClick() { /* موجود في النسخة الأصلية */ }
async function loadGoogleScripts() { /* موجود في النسخة الأصلية */ }
function setDefaultDatesAndTimes() { /* موجود في النسخة الأصلية */ }
function showAddExpenseModal() { console.log('showAddExpenseModal called'); }
function selectExpenseCategory(item) { console.log('default selectExpenseCategory called', item); }
function showMenu(opts) { console.log('showMenu fallback', opts); }
function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('active'); }
function showMessage(msg, type) { console.log(`[MSG ${type}] ${msg}`); }

// -----------------------------------------------------------------------------
// نهاية الملف
// -----------------------------------------------------------------------------
