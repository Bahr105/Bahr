// --- Accountant Dashboard and Reports Functions ---

       /**
     * Shows the cashier page.
     */
    async function showCashierPage() {
        document.getElementById('loginPage').classList.remove('active');
        document.getElementById('accountantPage').classList.remove('active');
        document.getElementById('cashierPage').classList.add('active');
        const cashierNameDisplay = document.getElementById('cashierNameDisplay');
        if (cashierNameDisplay) cashierNameDisplay.textContent = currentUserName;
        const currentDateCashier = document.getElementById('currentDateCashier');
        if (currentDateCashier) currentDateCashier.textContent = new Date().toLocaleDateString('ar-EG');

        showTab('expensesTabCashier'); // تم التعديل هنا
    }
    
    

/**
 * Shows the accountant page.
 */
async function showAccountantPage() {
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('accountantPage').classList.remove('active');
    document.getElementById('accountantPage').classList.add('active');
    const accountantNameDisplay = document.getElementById('accountantNameDisplay');
    if (accountantNameDisplay) accountantNameDisplay.textContent = currentUserName;
    const currentDateAccountant = document.getElementById('currentDateAccountant');
    if (currentDateAccountant) currentDateAccountant.textContent = new Date().toLocaleDateString('ar-EG');

    showTab('dashboardTabAccountant');
}

/**
 * Populates filter dropdowns for the accountant's dashboard and reports.
 */
function populateAccountantFilters() {
    const cashierSelect = document.getElementById('cashierFilterAccountant');
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

    populateAccountantShiftCashierFilter();

    populateReportFilters();
}

/**
 * Populates the cashier filter for the accountant's shift closure tab.
 */
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

/**
 * Updates the accountant's dashboard with current data and statistics.
 */
async function updateAccountantDashboard() {
    const cashierFilter = document.getElementById('cashierFilterAccountant')?.value || '';
    const dateFromFilter = document.getElementById('dashboardDateFromAccountant')?.value || '';
    const dateToFilter = document.getElementById('dashboardDateToAccountant')?.value || '';

    const filters = { cashier: cashierFilter };
    if (dateFromFilter) filters.dateFrom = dateFromFilter;
    if (dateToFilter) filters.dateTo = dateToFilter;

    showLoading(true);
    try {
        const allExpenses = await loadExpenses(filters);

        let normalExpenses = [];
        let visaExpenses = [];
        let instaExpenses = [];
        let onlineExpenses = [];
        let returnExpenses = [];

        allExpenses.forEach(expense => {
            const category = categories.find(cat => cat.name === expense.category || cat.code === expense.categoryCode);
            const formType = category ? category.formType : 'عادي';

            if (formType === 'فيزا') {
                visaExpenses.push(expense);
            } else if (formType === 'إنستا') {
                instaExpenses.push(expense);
            } else if (formType === 'اونلاين') {
                onlineExpenses.push(expense);
            } else if (formType === 'مرتجع') {
                returnExpenses.push(expense);
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
        const totalReturns = returnExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const returnsCount = returnExpenses.length;

        document.getElementById('totalNormalExpensesAccountant').textContent = totalNormal.toFixed(2);
        document.getElementById('countNormalExpensesAccountant').textContent = normalCount;

        document.getElementById('totalVisaAccountant').textContent = totalVisa.toFixed(2);
        document.getElementById('countVisaAccountant').textContent = visaCount;

        document.getElementById('totalInstaAccountant').textContent = totalInsta.toFixed(2);
        document.getElementById('instaCountAccountant').textContent = instaCount;

        document.getElementById('totalOnlineAccountant').textContent = totalOnline.toFixed(2);
        document.getElementById('countOnlineAccountant').textContent = onlineCount;
        
        document.getElementById('totalReturnsAccountant').textContent = totalReturns.toFixed(2);
        document.getElementById('countReturnsAccountant').textContent = returnsCount;

        const activeCashiers = users.filter(u => u.role === 'كاشير' && u.status === 'نشط').length;
        const suspendedCashiers = users.filter(u => u.role === 'كاشير' && u.status === 'موقوف').length;
        const blockedCashiers = users.filter(u => u.role === 'كاشير' && u.status === 'محظور').length;

        document.getElementById('totalActiveCashiersAccountant').textContent = activeCashiers;
        document.getElementById('totalInactiveCashiersAccountant').textContent = suspendedCashiers;
        document.getElementById('totalBlockedCashiersAccountant').textContent = blockedCashiers;

        const totalCustomers = customers.length;
        const customersWithCredit = customers.filter(c => c.totalCredit > 0).length;
        const totalCredit = customers.reduce((sum, c) => sum + c.totalCredit, 0);
        const zeroCreditCustomers = customers.filter(c => c.totalCredit === 0).length;

        document.getElementById('totalCustomersAccountant').textContent = totalCustomers;
        document.getElementById('customersWithCreditAccountant').textContent = customersWithCredit;
        document.getElementById('totalCreditAmountAccountant').textContent = totalCredit.toFixed(2);
        document.getElementById('customersWithZeroCreditAccountant').textContent = zeroCreditCustomers;

        const totalEmployees = employees.length;
        const employeesWithAdvance = employees.filter(e => e.totalAdvance > 0).length;
        const totalAdvance = employees.reduce((sum, e) => sum + e.totalAdvance, 0);
        const zeroAdvanceEmployees = employees.filter(e => e.totalAdvance === 0).length;

        document.getElementById('totalEmployeesAccountant').textContent = totalEmployees;
        document.getElementById('employeesWithAdvanceAccountant').textContent = employeesWithAdvance;
        document.getElementById('totalAdvanceAmountAccountant').textContent = totalAdvance.toFixed(2);
        document.getElementById('employeesWithZeroAdvanceAccountant').textContent = zeroAdvanceEmployees;

        await updateAccountantCashierOverview(filters);
    } catch (error) {
        console.error('Error updating dashboard:', error);
        showMessage('حدث خطأ أثناء تحديث لوحة التحكم.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Updates the cashier overview table on the accountant's dashboard.
 * @param {object} filters - Filters to apply to cashier expenses.
 */
async function updateAccountantCashierOverview(filters) {
    const tableBody = document.getElementById('cashiersOverviewBodyAccountant');
    if (!tableBody) return;

    const cashiers = users.filter(u => u.role === 'كاشير');
    tableBody.innerHTML = '';

    for (const cashier of cashiers) {
        const expenses = await loadExpenses({ ...filters, cashier: cashier.username });

        let normalExpenses = [];
        let visaExpenses = [];
        let instaExpenses = [];
        let onlineExpenses = [];
        let returnExpenses = [];

        expenses.forEach(expense => {
            const category = categories.find(cat => cat.name === expense.category || cat.code === expense.categoryCode);
            const formType = category ? category.formType : 'عادي';

            if (formType === 'فيزا') {
                visaExpenses.push(expense);
            } else if (formType === 'إنستا') {
                instaExpenses.push(expense);
            } else if (formType === 'اونلاين') {
                onlineExpenses.push(expense);
            } else if (formType === 'مرتجع') {
                returnExpenses.push(expense);
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
        const totalReturns = returnExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const returnsCount = returnExpenses.length;

        const lastActivity = expenses.length > 0 ?
            new Date(Math.max(...expenses.map(exp => new Date(`${exp.date}T${exp.time}`)))) :
            null;
        const lastActivityStr = lastActivity ?
            lastActivity.toLocaleDateString('ar-EG') :
            'لا يوجد نشاط';

        const row = tableBody.insertRow();
        row.insertCell().textContent = cashier.name;
        row.insertCell().textContent = totalNormal.toFixed(2);
        row.insertCell().textContent = normalCount;
        row.insertCell().textContent = totalVisa.toFixed(2);
        row.insertCell().textContent = visaCount;
        row.insertCell().textContent = totalInsta.toFixed(2);
        row.insertCell().textContent = instaCount;
        row.insertCell().textContent = totalOnline.toFixed(2);
        row.insertCell().textContent = onlineCount;
        row.insertCell().textContent = totalReturns.toFixed(2);
        row.insertCell().textContent = returnsCount;
        row.insertCell().textContent = lastActivityStr;

        const statusCell = row.insertCell();
        statusCell.innerHTML = `<span class="status ${cashier.status === 'نشط' ? 'active' : 'inactive'}">${cashier.status}</span>`;
    }

    if (tableBody.rows.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="13">لا توجد بيانات للكاشيرز.</td></tr>';
    }
}

/**
 * Searches for invoices on the accountant's dashboard.
 */
async function searchInvoiceAccountant() {
    const searchInput = document.getElementById('searchInputAccountant');
    const invoiceNumber = searchInput?.value.trim();
    const resultDiv = document.getElementById('invoiceSearchResultAccountant');

    if (!invoiceNumber) {
        showMessage('يرجى إدخال رقم الفاتورة للبحث.', 'warning');
        return;
    }

    if (!resultDiv) return;

    showLoading(true);
    try {
        const allExpenses = await loadExpenses({});
        const matchingExpenses = allExpenses.filter(exp =>
            exp.invoiceNumber && exp.invoiceNumber.toLowerCase().includes(invoiceNumber.toLowerCase())
        );

        resultDiv.innerHTML = '';

        if (matchingExpenses.length === 0) {
            resultDiv.innerHTML = '<p>لم يتم العثور على فواتير مطابقة لرقم الفاتورة المدخل.</p>';
            resultDiv.style.display = 'block';
            return;
        }

        let tableHtml = `
            <h4>نتائج البحث عن فاتورة رقم: ${invoiceNumber}</h4>
            <table>
                <thead>
                    <tr>
                        <th>التصنيف</th>
                        <th>رقم الفاتورة</th>
                        <th>القيمة</th>
                        <th>التاريخ</th>
                        <th>الوقت</th>
                        <th>الكاشير</th>
                        <th>الملاحظات</th>
                        <th>الإجراءات</th>
                    </tr>
                </thead>
                <tbody>
        `;

        matchingExpenses.forEach(exp => {
            tableHtml += `
                <tr>
                    <td>${exp.category}</td>
                    <td>${exp.invoiceNumber}</td>
                    <td>${exp.amount.toFixed(2)}</td>
                    <td>${exp.date}</td>
                    <td>${exp.time.substring(0, 5)}</td>
                    <td>${users.find(u => u.username === exp.cashier)?.name || exp.cashier}</td>
                    <td>${exp.notes || '--'}</td>
                    <td>
                        <button class="edit-btn" onclick="showEditExpenseModal('${exp.id}')"><i class="fas fa-edit"></i> تعديل</button>
                        <button class="delete-btn" onclick="deleteExpense('${exp.id}', '${exp.category}', ${exp.amount}, '${exp.invoiceNumber}')"><i class="fas fa-trash"></i> حذف</button>
                    </td>
                </tr>
            `;
        });

        tableHtml += '</tbody></table>';
        resultDiv.innerHTML = tableHtml;
        resultDiv.style.display = 'block';

        showMessage(`تم العثور على ${matchingExpenses.length} فاتورة مطابقة.`, 'success');
    } catch (error) {
        console.error('Error searching invoice:', error);
        showMessage('حدث خطأ أثناء البحث عن الفاتورة.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Populates filter dropdowns for the accountant's reports.
 */
function populateReportFilters() {
    const categorySelect = document.getElementById('reportCategoryAccountant');
    if (categorySelect) {
        categorySelect.innerHTML = '<option value="">جميع التصنيفات</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            categorySelect.appendChild(option);
        });
    }

    const cashierSelect = document.getElementById('reportCashierAccountant');
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

/**
 * Generates an expense report for the accountant based on selected filters.
 */
async function generateAccountantReport() {
    const categoryFilter = document.getElementById('reportCategoryAccountant')?.value || '';
    const cashierFilter = document.getElementById('reportCashierAccountant')?.value || '';
    const dateFrom = document.getElementById('reportDateFromAccountant')?.value || '';
    const dateTo = document.getElementById('reportDateToAccountant')?.value || '';

    const filters = { cashier: cashierFilter };
    if (categoryFilter) filters.category = categoryFilter;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    showLoading(true);
    try {
        const expenses = await loadExpenses(filters);
        const allClosures = await loadShiftClosures({});
        const reportContent = document.getElementById('reportContentAccountant');
        if (!reportContent) return;

        reportContent.innerHTML = '';

        if (expenses.length === 0 && allClosures.length === 0) {
            reportContent.innerHTML = '<p>لا توجد بيانات مطابقة لمعايير التقرير المحددة.</p>';
            return;
        }

        const expensesByCashier = {};
        expenses.forEach(exp => {
            if (!expensesByCashier[exp.cashier]) {
                expensesByCashier[exp.cashier] = {
                    normal: [],
                    visa: [],
                    insta: [],
                    online: [],
                    returns: []
                };
            }

            const category = categories.find(cat => cat.name === exp.category || cat.code === exp.categoryCode);
            const formType = category ? category.formType : 'عادي';

            if (formType === 'فيزا') {
                expensesByCashier[exp.cashier].visa.push(exp);
            } else if (formType === 'إنستا') {
                expensesByCashier[exp.cashier].insta.push(exp);
            } else if (formType === 'اونلاين') {
                expensesByCashier[exp.cashier].online.push(exp);
            } else if (formType === 'مرتجع') {
                expensesByCashier[exp.cashier].returns.push(exp);
            } else {
                expensesByCashier[exp.cashier].normal.push(exp);
            }
        });

        const drawerCashByCashierAndDate = {};
        const fromDateObj = dateFrom ? new Date(dateFrom) : null;
        const toDateObj = dateTo ? new Date(dateTo) : null;
        if (toDateObj) toDateObj.setHours(23, 59, 59, 999);

        allClosures.forEach(closure => {
            const closureDate = new Date(closure.closureDate);
            if (fromDateObj && closureDate < fromDateObj) return;
            if (toDateObj && closureDate > toDateObj) return;
            if (cashierFilter && closure.cashier !== cashierFilter) return;

            if (!drawerCashByCashierAndDate[closure.cashier]) {
                drawerCashByCashierAndDate[closure.cashier] = {};
            }
            const dateKey = closure.closureDate;
            if (!drawerCashByCashierAndDate[closure.cashier][dateKey]) {
                drawerCashByCashierAndDate[closure.cashier][dateKey] = [];
            }
            drawerCashByCashierAndDate[closure.cashier][dateKey].push(parseFloat(closure.drawerCash) || 0);
        });


        let reportHtml = `
            <div class="report-header">
                <h3>تقرير المصروفات</h3>
                <p>من ${dateFrom || 'البداية'} إلى ${dateTo || 'النهاية'}</p>
                ${cashierFilter ? `<p>الكاشير: ${users.find(u => u.username === cashierFilter)?.name || cashierFilter}</p>` : ''}
                ${categoryFilter ? `<p>التصنيف: ${categoryFilter}</p>` : ''}
            </div>
        `;

        let grandTotalNormal = 0;
        let grandTotalVisa = 0;
        let grandTotalInsta = 0;
        let grandTotalOnline = 0;
        let grandTotalReturns = 0;
        let grandTotalDrawerCash = 0;

        const allCashiersInReport = new Set([...Object.keys(expensesByCashier), ...Object.keys(drawerCashByCashierAndDate)]);

        allCashiersInReport.forEach(cashierUsername => {
            const cashierData = expensesByCashier[cashierUsername] || { normal: [], visa: [], insta: [], online: [], returns: [] };
            const cashierUser = users.find(u => u.username === cashierUsername);
            const displayName = cashierUser ? cashierUser.name : cashierUsername;

            const totalNormal = cashierData.normal.reduce((sum, exp) => sum + exp.amount, 0);
            const totalVisa = cashierData.visa.reduce((sum, exp) => sum + exp.amount, 0);
            const totalInsta = cashierData.insta.reduce((sum, exp) => sum + exp.amount, 0);
            const totalOnline = cashierData.online.reduce((sum, exp) => sum + exp.amount, 0);
            const totalReturns = cashierData.returns.reduce((sum, exp) => sum + exp.amount, 0);

            grandTotalNormal += totalNormal;
            grandTotalVisa += totalVisa;
            grandTotalInsta += totalInsta;
            grandTotalOnline += totalOnline;
            grandTotalReturns += totalReturns;

            reportHtml += `
                <div class="cashier-section">
                    <h4>${displayName}</h4>
                    <div class="stats-summary">
                        <p>إجمالي المصروفات العادية: ${totalNormal.toFixed(2)} (${cashierData.normal.length} فاتورة)</p>
                        <p>إجمالي الفيزا: ${totalVisa.toFixed(2)} (${cashierData.visa.length} فاتورة)</p>
                        <p>إجمالي الإنستا: ${totalInsta.toFixed(2)} (${cashierData.insta.length} فاتورة)</p>
                        <p>إجمالي الأونلاين: ${totalOnline.toFixed(2)} (${cashierData.online.length} فاتورة)</p>
                        <p>إجمالي المرتجعات: ${totalReturns.toFixed(2)} (${cashierData.returns.length} فاتورة)</p>
                        <p><strong>الإجمالي الكلي (بدون الكاش في الدرج والمرتجعات): ${(totalNormal + totalVisa + totalInsta + totalOnline).toFixed(2)}</strong></p>
                    </div>
            `;

            if (drawerCashByCashierAndDate[cashierUsername]) {
                reportHtml += `
                    <h5>تفاصيل الكاش في الدرج:</h5>
                    <ul>
                `;
                let dailyDrawerCashTotal = 0;
                Object.keys(drawerCashByCashierAndDate[cashierUsername]).sort().forEach(date => {
                    const dailyCashValues = drawerCashByCashierAndDate[cashierUsername][date];
                    const sumDailyCash = dailyCashValues.reduce((sum, val) => sum + parseFloat(val), 0);
                    dailyDrawerCashTotal += sumDailyCash;
                    reportHtml += `<li>${date}: ${sumDailyCash.toFixed(2)} (${dailyCashValues.length} إدخال)</li>`;
                });
                reportHtml += `
                    </ul>
                    <p><strong>إجمالي الكاش في الدرج للفترة: ${dailyDrawerCashTotal.toFixed(2)}</strong></p>
                `;
                grandTotalDrawerCash += dailyDrawerCashTotal;
            }


            if (cashierFilter === cashierUsername || !cashierFilter) {
                const allCashierExpenses = [...cashierData.normal, ...cashierData.visa, ...cashierData.insta, ...cashierData.online, ...cashierData.returns];
                allCashierExpenses.sort((a, b) => new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`));

                if (allCashierExpenses.length > 0) {
                    reportHtml += `
                        <table>
                            <thead>
                                <tr>
                                    <th>التصنيف</th>
                                    <th>رقم الفاتورة</th>
                                    <th>القيمة</th>
                                    <th>التاريخ</th>
                                    <th>الوقت</th>
                                    <th>الملاحظات</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;

                    allCashierExpenses.forEach(exp => {
                        reportHtml += `
                            <tr>
                                <td>${exp.category}</td>
                                <td>${exp.invoiceNumber || '--'}</td>
                                <td>${exp.amount.toFixed(2)}</td>
                                <td>${exp.date}</td>
                                <td>${exp.time.substring(0, 5)}</td>
                                <td>${exp.notes || '--'}</td>
                                <td>
                                    <button class="edit-btn" onclick="showEditExpenseModal('${exp.id}')"><i class="fas fa-edit"></i> تعديل</button>
                                    <button class="delete-btn" onclick="deleteExpense('${exp.id}', '${exp.category}', ${exp.amount}, '${exp.invoiceNumber}')"><i class="fas fa-trash"></i> حذف</button>
                                </td>
                            </tr>
                        `;
                    });

                    reportHtml += '</tbody></table>';
                }
            }

            reportHtml += '</div>';
        });

        reportHtml += `
            <div class="report-footer">
                <h4>الإجمالي العام</h4>
                <p>إجمالي المصروفات العادية: ${grandTotalNormal.toFixed(2)}</p>
                <p>إجمالي الفيزا: ${grandTotalVisa.toFixed(2)}</p>
                <p>إجمالي الإنستا: ${grandTotalInsta.toFixed(2)}</p>
                <p>إجمالي الأونلاين: ${grandTotalOnline.toFixed(2)}</p>
                <p>إجمالي المرتجعات: ${grandTotalReturns.toFixed(2)}</p>
                <p><strong>إجمالي الكاش في الدرج: ${grandTotalDrawerCash.toFixed(2)}</strong></p>
                <p><strong>الإجمالي الكلي الصافي (المصروفات + الكاش في الدرج - المرتجعات): ${(grandTotalNormal + grandTotalVisa + grandTotalInsta + grandTotalOnline + grandTotalDrawerCash - grandTotalReturns).toFixed(2)}</strong></p>
            </div>
        `;

        reportContent.innerHTML = reportHtml;
        showMessage('تم إنشاء التقرير بنجاح.', 'success');
    } catch (error) {
        console.error('Error generating report:', error);
        showMessage('حدث خطأ أثناء إنشاء التقرير.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Prints the generated report.
 */
function printReport() {
    const reportContent = document.getElementById('reportContentAccountant');
    if (!reportContent || !reportContent.innerHTML.trim()) {
        showMessage('لا يوجد تقرير للطباعة. يرجى إنشاء التقرير أولاً.', 'warning');
        return;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>تقرير المصروفات</title>
                <link rel="stylesheet" href="styles.css">
                <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'Tajawal', sans-serif; direction: rtl; text-align: right; }
                    .report-header, .cashier-section, .report-footer { margin-bottom: 20px; border: 1px solid #eee; padding: 15px; border-radius: 8px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                    th { background-color: #f2f2f2; }
                    .edit-btn, .delete-btn { display: none; }
                </style>
            </head>
            <body>
                ${reportContent.innerHTML}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

/**
 * Shows the WhatsApp modal for sending the report.
 */
function showWhatsAppModal() {
    const reportContent = document.getElementById('reportContentAccountant');
    if (!reportContent || !reportContent.innerHTML.trim()) {
        showMessage('لا يوجد تقرير للإرسال. يرجى إنشاء التقرير أولاً.', 'warning');
        return;
    }

    const modal = document.getElementById('whatsappModal');
    if (modal) {
        modal.classList.add('active');
        const whatsappNumber = document.getElementById('whatsappNumber');
        if (whatsappNumber) whatsappNumber.value = '';
    }
}

/**
 * Sends the generated report via WhatsApp.
 */
function sendReportViaWhatsApp() {
    const phoneNumber = document.getElementById('whatsappNumber')?.value.trim();
    const reportContent = document.getElementById('reportContentAccountant');

    if (!phoneNumber) {
        showMessage('يرجى إدخال رقم الواتساب.', 'warning');
        return;
    }

    if (!reportContent || !reportContent.innerHTML.trim()) {
        showMessage('لا يوجد تقرير للإرسال.', 'error');
        return;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = reportContent.innerHTML;
    const reportText = tempDiv.textContent || tempDiv.innerText || '';

    const encodedText = encodeURIComponent(`تقرير المصروفات\n\n${reportText.substring(0, 1000)}...`);
    const whatsappUrl = `https://wa.me/${phoneNumber.replace(/\D/g, '')}?text=${encodedText}`;

    window.open(whatsappUrl, '_blank');
    closeModal('whatsappModal');
    showMessage('تم فتح واتساب لإرسال التقرير.', 'success');
}
