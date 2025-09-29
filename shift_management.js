// --- Shift Management Functions ---

/**
 * Calculates the cashier's shift summary based on expenses within a specified period.
 */
async function calculateCashierShift() {
    const dateFrom = document.getElementById('shiftDateFromCashier')?.value;
    const dateTo = document.getElementById('shiftDateToCashier')?.value;
    const timeFrom = document.getElementById('shiftTimeFromCashier')?.value;
    const timeTo = document.getElementById('shiftTimeToCashier')?.value;

    if (!dateFrom || !dateTo || !timeFrom || !timeTo) {
        showMessage('يرجى ملء جميع حقول التاريخ والوقت.', 'warning');
        return;
    }

    showLoading(true);

    try {
        const filters = {
            dateFrom: dateFrom,
            dateTo: dateTo,
            timeFrom: timeFrom,
            timeTo: timeTo,
            cashier: currentUser.username
        };

        const expenses = await loadExpenses(filters);

        let categorizedExpenses = {
            normal: [],
            insta: [],
            visa: [],
            online: [],
            returns: []
        };

        expenses.forEach(exp => {
            const category = categories.find(cat => cat.name === exp.category || cat.code === exp.categoryCode);
            const formType = category ? category.formType : 'عادي';

            if (formType === 'إنستا') {
                categorizedExpenses.insta.push(exp);
            } else if (formType === 'فيزا') {
                categorizedExpenses.visa.push(exp);
            } else if (formType === 'اونلاين') {
                categorizedExpenses.online.push(exp);
            } else if (formType === 'مرتجع') {
                categorizedExpenses.returns.push(exp);
            } else {
                categorizedExpenses.normal.push(exp);
            }
        });

        const totalExpenses = categorizedExpenses.normal.reduce((sum, exp) => sum + exp.amount, 0);
        const expenseCount = categorizedExpenses.normal.length;
        const totalInsta = categorizedExpenses.insta.reduce((sum, exp) => sum + exp.amount, 0);
        const instaCount = categorizedExpenses.insta.length;
        const totalVisa = categorizedExpenses.visa.reduce((sum, exp) => sum + exp.amount, 0);
        const visaCount = categorizedExpenses.visa.length;
        const totalOnline = categorizedExpenses.online.reduce((sum, exp) => sum + exp.amount, 0);
        const onlineCount = categorizedExpenses.online.length;
        const totalReturns = categorizedExpenses.returns.reduce((sum, exp) => sum + exp.amount, 0);
        const returnsCount = categorizedExpenses.returns.length;

        const grandTotalTransactions = totalExpenses + totalInsta + totalVisa + totalOnline;

        document.getElementById('totalExpensesCashier').textContent = totalExpenses.toFixed(2);
        document.getElementById('expenseCountCashier').textContent = expenseCount;
        document.getElementById('totalInstaCashier').textContent = totalInsta.toFixed(2);
        document.getElementById('instaCountCashier').textContent = instaCount;
        document.getElementById('totalVisaCashier').textContent = totalVisa.toFixed(2);
        document.getElementById('visaCountCashier').textContent = visaCount;
        document.getElementById('totalOnlineCashier').textContent = totalOnline.toFixed(2);
        document.getElementById('onlineCountCashier').textContent = onlineCount;
        document.getElementById('grandTotalCashier').textContent = grandTotalTransactions.toFixed(2);

        document.getElementById('totalReturnsCashier').textContent = totalReturns.toFixed(2);
        document.getElementById('returnsCountCashier').textContent = returnsCount;

        document.getElementById('shiftSummaryCashier').style.display = 'block';

        showMessage('تم حساب الشيفت بنجاح.', 'success');
    } catch (error) {
        showMessage('حدث خطأ أثناء حساب الشيفت.', 'error');
        console.error(error);
    } finally {
        showLoading(false);
    }
}

/**
 * Finalizes the cashier's shift closeout, saving the data to Google Sheets.
 */
async function finalizeCashierShiftCloseout() {
    const drawerCashInput = document.getElementById('drawerCashCashier');
    const drawerCash = drawerCashInput ? parseFloat(drawerCashInput.value) : NaN;

    if (isNaN(drawerCash) || drawerCash < 0) {
        showMessage('يرجى إدخال قيمة صحيحة للنقدية في الدرج.', 'warning');
        return;
    }

    showLoading(true);

    try {
        const now = new Date();
        const shiftId = 'SHIFT_' + now.getTime();

        const totalExpenses = parseFloat(document.getElementById('totalExpensesCashier')?.textContent) || 0;
        const expenseCount = parseInt(document.getElementById('expenseCountCashier')?.textContent) || 0;
        const totalInsta = parseFloat(document.getElementById('totalInstaCashier')?.textContent) || 0;
        const instaCount = parseInt(document.getElementById('instaCountCashier')?.textContent) || 0;
        const totalVisa = parseFloat(document.getElementById('totalVisaCashier')?.textContent) || 0;
        const visaCount = parseInt(document.getElementById('visaCountCashier')?.textContent) || 0;
        const totalOnline = parseFloat(document.getElementById('totalOnlineCashier')?.textContent) || 0;
        const onlineCount = parseInt(document.getElementById('onlineCountCashier')?.textContent) || 0;
        const totalReturns = parseFloat(document.getElementById('totalReturnsCashier')?.textContent) || 0;
        const returnsCount = parseInt(document.getElementById('returnsCountCashier')?.textContent) || 0;
        
        const grandTotalTransactions = totalExpenses + totalInsta + totalVisa + totalOnline;
        const grandTotalWithDrawerCash = grandTotalTransactions + drawerCash;

        const grandTotalAfterReturns = grandTotalWithDrawerCash - totalReturns;

        const shiftClosureData = [
            shiftId,
            currentUser.username,
            document.getElementById('shiftDateFromCashier')?.value,
            document.getElementById('shiftTimeFromCashier')?.value,
            document.getElementById('shiftDateToCashier')?.value,
            document.getElementById('shiftTimeToCashier')?.value,
            totalExpenses.toFixed(2),
            expenseCount,
            totalInsta.toFixed(2),
            instaCount,
            totalVisa.toFixed(2),
            visaCount,
            totalOnline.toFixed(2),
            onlineCount,
            grandTotalWithDrawerCash.toFixed(2),
            drawerCash.toFixed(2),
            0,
            0,
            'مغلق',
            now.toISOString().split('T')[0],
            now.toTimeString().split(' ')[0],
            '',
            totalReturns.toFixed(2),
            grandTotalAfterReturns.toFixed(2)
        ];

        const result = await appendToSheet(SHEETS.SHIFT_CLOSURES, shiftClosureData);

        if (result.success) {
            showMessage('تم تقفيل الشيفت بنجاح.', 'success');
            document.getElementById('shiftSummaryCashier').style.display = 'none';
            drawerCashInput.value = '';
            setDefaultDatesAndTimes();
            await loadCashierPreviousClosures();
            await loadCashierExpenses();
        } else {
            showMessage('فشل تقفيل الشيفت.', 'error');
        }
    } catch (error) {
        console.error('Error finalizing shift closeout:', error);
        showMessage('حدث خطأ أثناء تقفيل الشيفت.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Loads and displays the cashier's previous shift closures.
 */
async function loadCashierPreviousClosures() {
    const cashierPreviousClosuresDiv = document.getElementById('cashierPreviousClosures');
    const tableBody = document.getElementById('cashierClosuresHistoryBody');
    if (!tableBody || !cashierPreviousClosuresDiv) return;

    showLoading(true);
    try {
        const closures = await loadShiftClosures({ cashier: currentUser.username });
        tableBody.innerHTML = '';

        if (closures.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7">لا توجد تقفيلات سابقة لهذا الكاشير.</td></tr>';
            cashierPreviousClosuresDiv.style.display = 'none';
            return;
        }

        closures.sort((a, b) => new Date(`${b.closureDate}T${b.closureTime}`) - new Date(`${a.closureDate}T${a.closureTime}`));

        closures.forEach(closure => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = `${closure.dateFrom} ${closure.timeFrom} - ${closure.dateTo} ${closure.timeTo}`;
            
            row.insertCell().textContent = closure.grandTotal.toFixed(2);

            row.insertCell().textContent = closure.newMindTotal > 0 ? closure.newMindTotal.toFixed(2) : '--';

            const differenceCell = row.insertCell();
            const diffValue = closure.difference;
            differenceCell.textContent = diffValue.toFixed(2);
            if (diffValue < 0) {
                differenceCell.style.color = 'green';
                differenceCell.title = 'زيادة عند الكاشير';
            } else if (diffValue > 0) {
                differenceCell.style.color = 'red';
                differenceCell.title = 'عجز على الكاشير';
            } else {
                differenceCell.style.color = 'blue';
                differenceCell.title = 'مطابق';
            }

            const statusCell = row.insertCell();
            statusCell.innerHTML = `<span class="status ${closure.status === 'مغلق' || closure.status === 'مغلق بواسطة المحاسب' ? 'closed' : 'open'}">${closure.status}</span>`;

            row.insertCell().textContent = `${closure.closureDate} ${closure.closureTime.substring(0, 5)}`;

            const actionsCell = row.insertCell();
            actionsCell.innerHTML = `
                <button class="view-btn" onclick="viewClosureDetails('${closure.id}')">
                    <i class="fas fa-eye"></i> عرض
                </button>
            `;
        });
        cashierPreviousClosuresDiv.style.display = 'block';
    } catch (error) {
        console.error('Error loading cashier previous closures:', error);
        showMessage('حدث خطأ أثناء تحميل تقفيلاتك السابقة.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Resets the accountant's shift closure form.
 */
function resetAccountantShiftForm() {
    const closureResultsAccountant = document.getElementById('closureResultsAccountant');
    if (closureResultsAccountant) {
        closureResultsAccountant.style.display = 'none';
    }

    const differenceResultAccountant = document.getElementById('differenceResultAccountant');
    if (differenceResultAccountant) {
        differenceResultAccountant.style.display = 'none';
    }

    const newmindTotalAccountant = document.getElementById('newmindTotalAccountant');
    if (newmindTotalAccountant) {
        newmindTotalAccountant.value = '';
    }

    setDefaultDatesAndTimes();

    const selectedCashier = document.getElementById('selectedCashierAccountant');
    if (selectedCashier) {
        selectedCashier.value = '';
    }

    window.currentClosureData = null;

    const closeCashierBtn = document.querySelector('#shiftCloseTabAccountant .close-cashier-btn');
    if (closeCashierBtn) {
        closeCashierBtn.style.display = 'none';
    }

    const deductReturnsSwitch = document.getElementById('deductReturnsAccountant');
    if (deductReturnsSwitch) {
        deductReturnsSwitch.checked = false;
    }
    const grandTotalAfterReturnsContainer = document.getElementById('accGrandTotalAfterReturnsContainer');
    if (grandTotalAfterReturnsContainer) {
        grandTotalAfterReturnsContainer.style.display = 'none';
    }
    const accGrandTotalCashier = document.getElementById('accGrandTotalCashier');
    if (accGrandTotalCashier) {
        accGrandTotalCashier.style.textDecoration = 'none';
        accGrandTotalCashier.style.color = '#2c3e50';
    }
}

/**
 * Calculates the difference between cashier's total and NewMind total for accountant.
 */
function calculateDifferenceAccountant() {
    if (!window.currentClosureData) {
        showMessage('يرجى البحث عن بيانات الكاشير أولاً.', 'warning');
        return;
    }

    const newMindTotalInput = document.getElementById('newmindTotalAccountant');
    const newMindTotal = newMindTotalInput ? parseFloat(newMindTotalInput.value) : NaN;
    if (isNaN(newMindTotal) || newMindTotal < 0) {
        const differenceResult = document.getElementById('differenceResultAccountant');
        if (differenceResult) differenceResult.style.display = 'none';
        const closeCashierBtn = document.querySelector('#shiftCloseTabAccountant .close-cashier-btn');
        if (closeCashierBtn) closeCashierBtn.style.display = 'none';
        return;
    }

    const addReturns = document.getElementById('deductReturnsAccountant')?.checked || false;
    let cashierTotalForComparison = window.currentClosureData.grandTotal;
    let grandTotalAfterReturnsDisplayValue = cashierTotalForComparison;

    if (addReturns) {
        cashierTotalForComparison = cashierTotalForComparison + window.currentClosureData.totalReturns;
        grandTotalAfterReturnsDisplayValue = cashierTotalForComparison;
    }

    const difference = cashierTotalForComparison - newMindTotal;

    const differenceResult = document.getElementById('differenceResultAccountant');
    if (!differenceResult) return;

    let statusText = '';
    let statusClass = '';
    
    if (difference === 0) {
        statusText = 'مطابق ✓';
        statusClass = 'status-match';
    } else if (difference > 0) {
        statusText = `زيادة عند الكاشير: ${difference.toFixed(2)}`;
        statusClass = 'status-surplus';
    } else {
        statusText = `عجز على الكاشير: ${difference.toFixed(2)}`;
        statusClass = 'status-deficit';
    }

    differenceResult.innerHTML = `
        <div class="difference-card ${statusClass}">
            <h4>نتيجة المقارنة</h4>
            <p><strong>إجمالي الكاشير (شامل الكاش في الدرج، قبل إضافة المرتجع):</strong> ${window.currentClosureData.grandTotal.toFixed(2)}</p>
            ${addReturns ? `<p><strong>إجمالي المرتجعات المضافة:</strong> ${window.currentClosureData.totalReturns.toFixed(2)}</p>` : ''}
            <p><strong>الإجمالي الكلي للكاشير للمقارنة (بعد إضافة المرتجع إذا تم التحديد):</strong> ${grandTotalAfterReturnsDisplayValue.toFixed(2)}</p>
            <p><strong>إجمالي نيو مايند:</strong> ${newMindTotal.toFixed(2)}</p>
            <p><strong>الفرق:</strong> ${difference.toFixed(2)}</p>
            <p><strong>الحالة:</strong> ${statusText}</p>
        </div>
    `;

    differenceResult.style.display = 'block';
    const closeCashierBtn = document.querySelector('#shiftCloseTabAccountant .close-cashier-btn');
    if (closeCashierBtn) {
        closeCashierBtn.style.display = 'block';
    }
}

/**
 * Searches for cashier closures for the accountant.
 */
async function searchCashierClosuresAccountant() {
    const selectedCashier = document.getElementById('selectedCashierAccountant')?.value;
    const dateFrom = document.getElementById('accountantShiftDateFrom')?.value;
    const dateTo = document.getElementById('accountantShiftDateTo')?.value;
    const timeFrom = document.getElementById('accountantShiftTimeFrom')?.value;
    const timeTo = document.getElementById('accountantShiftTimeTo')?.value;

    if (!selectedCashier || !dateFrom || !dateTo || !timeFrom || !timeTo) {
        showMessage('يرجى ملء جميع الحقول للبحث عن تقفيلة الكاشير.', 'warning');
        return;
    }

    showLoading(true);

    try {
        const formattedTimeFrom = normalizeTimeToHHMMSS(timeFrom);
        const formattedTimeTo = normalizeTimeToHHMMSS(timeTo);

        if (!isValidDate(dateFrom) || !isValidDate(dateTo)) {
            throw new Error('تنسيق التاريخ غير صحيح. يرجى استخدام الصيغة YYYY-MM-DD.');
        }

        if (!isValidTime(formattedTimeFrom) || !isValidTime(formattedTimeTo)) {
            throw new Error('تنسيق الوقت غير صحيح.');
        }

        const searchStartDateTime = new Date(`${dateFrom}T${formattedTimeFrom}`);
        const searchEndDateTime = new Date(`${dateTo}T${formattedTimeTo}`);

        if (isNaN(searchStartDateTime.getTime()) || isNaN(searchEndDateTime.getTime())) {
            throw new Error('تنسيق التاريخ أو الوقت غير صحيح. تأكد من الإدخال.');
        }

        console.log(`البحث عن إغلاقات داخل الفترة: ${searchStartDateTime.toISOString()} إلى ${searchEndDateTime.toISOString()}`);
        console.log(`الكاشير المحدد: ${selectedCashier}, formattedTimeFrom: ${formattedTimeFrom}, formattedTimeTo: ${formattedTimeTo}`);

        const expenses = await loadExpenses({
            dateFrom: dateFrom,
            dateTo: dateTo,
            timeFrom: formattedTimeFrom.substring(0, 5),
            timeTo: formattedTimeTo.substring(0, 5),
            cashier: selectedCashier
        });

        let normalExpenses = [];
        let visaExpenses = [];
        let instaExpenses = [];
        let onlineExpenses = [];
        let returnExpenses = [];

        expenses.forEach(exp => {
            const category = categories.find(cat => cat.name === exp.category || cat.code === exp.categoryCode);
            const formType = category ? category.formType : 'عادي';

            if (formType === 'فيزا') {
                visaExpenses.push(exp);
            } else if (formType === 'إنستا') {
                instaExpenses.push(exp);
            } else if (formType === 'اونلاين') {
                onlineExpenses.push(exp);
            } else if (formType === 'مرتجع') {
                returnExpenses.push(exp);
            } else {
                normalExpenses.push(exp);
            }
        });

        let drawerCash = 0;
        let drawerCashCount = 0;
        let previousClosureMessage = '';

        const allClosures = await loadShiftClosures({});

        const closuresInPeriod = allClosures.filter(closure => {
            if (!closure.dateTo || !closure.timeTo || closure.drawerCash === undefined) return false;

            const normalizedClosureTimeTo = normalizeTimeToHHMMSS(closure.timeTo);
            const closureEndDateTimeStr = `${closure.dateTo}T${normalizedClosureTimeTo}`;
            const closureEndDateTime = new Date(closureEndDateTimeStr);
            
            if (isNaN(closureEndDateTime.getTime())) {
                console.error(`وقت غير صالح للإغلاق ${closure.id}: ${closureEndDateTimeStr} (normalized: ${normalizedClosureTimeTo})`);
                return false;
            }

            return closure.cashier === selectedCashier && 
                   closureEndDateTime >= searchStartDateTime && 
                   closureEndDateTime <= searchEndDateTime;
        });

        if (closuresInPeriod.length > 0) {
            drawerCash = closuresInPeriod.reduce((sum, closure) => sum + (parseFloat(closure.drawerCash) || 0), 0);
            drawerCashCount = closuresInPeriod.length;
        } else {
            const previousClosures = allClosures.filter(closure => {
                if (!closure.dateTo || !closure.timeTo || closure.drawerCash === undefined) return false;

                const normalizedClosureTimeTo = normalizeTimeToHHMMSS(closure.timeTo);
                const closureEndDateTimeStr = `${closure.dateTo}T${normalizedClosureTimeTo}`;
                const closureEndDateTime = new Date(closureEndDateTimeStr);
                
                if (isNaN(closureEndDateTime.getTime())) {
                    console.error(`وقت غير صالح للإغلاق السابق ${closure.id}: ${closureEndDateTimeStr}`);
                    return false;
                }

                return closure.cashier === selectedCashier && closureEndDateTime < searchStartDateTime;
            });

            if (previousClosures.length > 0) {
                const latestPrevious = previousClosures.sort((a, b) => {
                    const timeA = normalizeTimeToHHMMSS(a.timeTo);
                    const timeB = normalizeTimeToHHMMSS(b.timeTo);
                    return new Date(`${b.dateTo}T${timeB}`) - new Date(`${a.dateTo}T${timeA}`);
                })[0];
                previousClosureMessage = `(يوجد إغلاق سابق في ${latestPrevious.closureDate} ${latestPrevious.closureTime.substring(0,5)} بقيمة ${parseFloat(latestPrevious.drawerCash).toFixed(2)}، لم يتم تضمينه في الحساب الحالي)`;
            }
            drawerCash = 0;
            drawerCashCount = 0;
        }

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
        
        const grandTotal = totalNormal + totalVisa + totalInsta + totalOnline + drawerCash;

        const closureResultsAccountant = document.getElementById('closureResultsAccountant');
        if (closureResultsAccountant) closureResultsAccountant.style.display = 'block';

        document.getElementById('accTotalNormalExpenses').innerHTML = `${totalNormal.toFixed(2)} (<span class="invoice-count">${normalCount} فاتورة</span>)`;
        document.getElementById('accTotalVisa').innerHTML = `${totalVisa.toFixed(2)} (<span class="invoice-count">${visaCount} فاتورة</span>)`;
        document.getElementById('accTotalInsta').innerHTML = `${totalInsta.toFixed(2)} (<span class="invoice-count">${instaCount} فاتورة</span>)`;
        document.getElementById('accTotalOnline').innerHTML = `${totalOnline.toFixed(2)} (<span class="invoice-count">${onlineCount} فاتورة</span>)`;
        document.getElementById('accTotalReturns').textContent = totalReturns.toFixed(2);
        document.getElementById('accReturnsCount').textContent = returnsCount;
        document.getElementById('accDrawerCash').innerHTML = `${drawerCash.toFixed(2)} (<span class="invoice-count">${drawerCashCount} إدخال</span>)`;
        document.getElementById('accGrandTotalCashier').textContent = grandTotal.toFixed(2);

        document.getElementById('newmindTotalAccountant').value = '';
        document.getElementById('differenceResultAccountant').style.display = 'none';
        document.querySelector('#shiftCloseTabAccountant .close-cashier-btn').style.display = 'none';

        window.currentClosureData = {
            cashier: selectedCashier,
            dateFrom: dateFrom,
            timeFrom: formattedTimeFrom.substring(0, 5),
            dateTo: dateTo,
            timeTo: formattedTimeTo.substring(0, 5),
            totalNormal: totalNormal,
            normalCount: normalCount,
            totalVisa: totalVisa,
            visaCount: visaCount,
            totalInsta: totalInsta,
            instaCount: instaCount,
            totalOnline: totalOnline,
            onlineCount: onlineCount,
            totalReturns: totalReturns,
            returnsCount: returnsCount,
            drawerCash: drawerCash,
            drawerCashCount: drawerCashCount,
            grandTotal: grandTotal
        };
        const deductReturnsSwitch = document.getElementById('deductReturnsAccountant');
        if (deductReturnsSwitch) {
            deductReturnsSwitch.checked = false;
        }
        updateAccountantClosureDisplay();

        const cashierUser  = users.find(u => u.username === selectedCashier);
        const cashierDisplayName = cashierUser  ? cashierUser .name : selectedCashier;
        let cashSource = '';
        if (closuresInPeriod.length > 0) {
            cashSource = ` (مجموع من ${closuresInPeriod.length} إغلاق داخل الفترة)`;
        } else if (previousClosureMessage) {
            cashSource = ` (لا توجد إغلاقات داخل الفترة. ${previousClosureMessage})`;
        } else {
            cashSource = ` (لا توجد إغلاقات سابقة)`;
        }
        showMessage(`تم البحث عن بيانات الكاشير ${cashierDisplayName} للفترة المحددة. إجمالي الكاش في الدرج: ${drawerCash.toFixed(2)}${cashSource}.`, 'success');
    } catch (error) {
        console.error('Error searching cashier closures:', error);
        showMessage(`حدث خطأ أثناء البحث عن بيانات الكاشير: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Updates the display of the accountant's closure form, especially for return deduction.
 */
function updateAccountantClosureDisplay() {
    if (!window.currentClosureData) return;

    const addReturns = document.getElementById('deductReturnsAccountant')?.checked || false;
    const grandTotalAfterReturnsContainer = document.getElementById('accGrandTotalAfterReturnsContainer');
    const grandTotalAfterReturnsDisplay = document.getElementById('accGrandTotalAfterReturns');
    const accGrandTotalCashier = document.getElementById('accGrandTotalCashier');

    let currentGrandTotal = window.currentClosureData.grandTotal;
    const totalReturns = window.currentClosureData.totalReturns;
    let grandTotalForComparisonDisplay = currentGrandTotal;

    if (addReturns) {
        grandTotalForComparisonDisplay = currentGrandTotal + totalReturns;
        if (grandTotalAfterReturnsContainer) grandTotalAfterReturnsContainer.style.display = 'block';
        if (grandTotalAfterReturnsDisplay) grandTotalAfterReturnsDisplay.textContent = grandTotalForComparisonDisplay.toFixed(2);
        if (accGrandTotalCashier) {
            accGrandTotalCashier.style.textDecoration = 'line-through';
            accGrandTotalCashier.style.color = '#888';
        }
    } else {
        if (grandTotalAfterReturnsContainer) grandTotalAfterReturnsContainer.style.display = 'none';
        if (accGrandTotalCashier) {
            accGrandTotalCashier.style.textDecoration = 'none';
            accGrandTotalCashier.style.color = '#2c3e50';
        }
    }

    const newmindTotalAccountant = document.getElementById('newmindTotalAccountant');
    if (newmindTotalAccountant && newmindTotalAccountant.value) {
        calculateDifferenceAccountant();
    }
}

/**
 * Closes a cashier's shift by the accountant, saving the closure data.
 */
async function closeCashierByAccountant() {
    if (window.closingCashierInProgress) {
        showMessage('جاري تقفيل الشيفت، يرجى الانتظار...', 'warning');
        return;
    }
    window.closingCashierInProgress = true;

    if (!window.currentClosureData) {
        showMessage('يرجى البحث عن بيانات الكاشير أولاً.', 'warning');
        window.closingCashierInProgress = false;
        return;
    }

    const newMindTotalInput = document.getElementById('newmindTotalAccountant');
    const newMindTotal = newMindTotalInput ? parseFloat(newMindTotalInput.value) : NaN;
    if (isNaN(newMindTotal) || newMindTotal < 0) {
        showMessage('يرجى إدخال قيمة صحيحة لإجمالي نيو مايند.', 'warning');
        window.closingCashierInProgress = false;
        return;
    }

    showLoading(true);
    try {
        // البحث عن تقفيلة الكاشير الأصلية
        const allClosures = await loadShiftClosures({});
        const originalClosure = allClosures.find(closure => 
            closure.cashier === window.currentClosureData.cashier &&
            closure.dateFrom === window.currentClosureData.dateFrom &&
            closure.timeFrom === window.currentClosureData.timeFrom &&
            closure.dateTo === window.currentClosureData.dateTo &&
            closure.timeTo === window.currentClosureData.timeTo &&
            closure.status === 'مغلق' // التأكد أنها التقفيلة الأصلية للكاشير
        );

        if (!originalClosure) {
            showMessage('لم يتم العثور على تقفيلة الكاشير الأصلية.', 'error');
            window.closingCashierInProgress = false;
            return;
        }

        const addReturns = document.getElementById('deductReturnsAccountant')?.checked || false;
        let cashierTotalForComparison = window.currentClosureData.grandTotal;
        let grandTotalAfterReturnsValue = cashierTotalForComparison;

        if (addReturns) {
            cashierTotalForComparison = cashierTotalForComparison + window.currentClosureData.totalReturns;
            grandTotalAfterReturnsValue = cashierTotalForComparison;
        } else {
            grandTotalAfterReturnsValue = cashierTotalForComparison;
        }

        const difference = cashierTotalForComparison - newMindTotal;
        const now = new Date();

        // تحديث البيانات في السجل الأصلي
        const updatedData = [
            originalClosure.id, // استخدام نفس ال ID
            originalClosure.cashier,
            originalClosure.dateFrom,
            originalClosure.timeFrom,
            originalClosure.dateTo,
            originalClosure.timeTo,
            originalClosure.totalExpenses.toFixed(2),
            originalClosure.expenseCount,
            originalClosure.totalInsta.toFixed(2),
            originalClosure.instaCount,
            originalClosure.totalVisa.toFixed(2),
            originalClosure.visaCount,
            originalClosure.totalOnline.toFixed(2),
            originalClosure.onlineCount,
            originalClosure.grandTotal.toFixed(2),
            originalClosure.drawerCash.toFixed(2),
            newMindTotal.toFixed(2), // إضافة NewMind Total
            difference.toFixed(2),   // إضافة الفرق
            'مغلق بواسطة المحاسب',   // تحديث الحالة
            now.toISOString().split('T')[0], // تاريخ التقفيل
            now.toTimeString().split(' ')[0], // وقت التقفيل
            currentUser.username,    // اسم المحاسب
            originalClosure.totalReturns.toFixed(2),
            grandTotalAfterReturnsValue.toFixed(2)
        ];

        // البحث عن رقم الصف لتحديثه
        const rowIndex = await findRowIndex(SHEETS.SHIFT_CLOSURES, 0, originalClosure.id);
        
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على صف التقفيلة الأصلية.', 'error');
            window.closingCashierInProgress = false;
            return;
        }

        // تحديث السجل الأصلي بدلاً من إضافة سجل جديد
        const result = await updateSheet(SHEETS.SHIFT_CLOSURES, `A${rowIndex}:X${rowIndex}`, [updatedData]);

        if (result.success) {
            showMessage(`تم تقفيل شيفت الكاشير ${users.find(u => u.username === window.currentClosureData.cashier)?.name || window.currentClosureData.cashier} بنجاح بواسطة المحاسب.`, 'success');
            resetAccountantShiftForm();
            loadAccountantShiftClosuresHistory();
        } else {
            showMessage('فشل تقفيل شيفت الكاشير.', 'error');
        }
    } catch (error) {
        console.error('Error closing cashier shift by accountant:', error);
        showMessage('حدث خطأ أثناء تقفيل شيفت الكاشير.', 'error');
    } finally {
        showLoading(false);
        window.closingCashierInProgress = false;
    }
}
/**
 * Finds the row index of a record by its ID
 * @param {string} sheetName - The sheet name
 * @param {number} idColumn - The column index containing the ID
 * @param {string} id - The ID to search for
 * @returns {Promise<number>} The row index (1-based) or -1 if not found
 */
async function findRowIndex(sheetName, idColumn, id) {
    try {
        const data = await readSheet(sheetName);
        for (let i = 1; i < data.length; i++) {
            if (data[i][idColumn] === id) {
                return i + 1; // +1 because sheets are 1-based
            }
        }
        return -1;
    } catch (error) {
        console.error('Error finding row index:', error);
        return -1;
    }
}
/**
 * Loads and displays the accountant's shift closures history.
 */
async function loadAccountantShiftClosuresHistory() {
    const closures = await loadShiftClosures({});
    const tableBody = document.getElementById('closuresHistoryBodyAccountant');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (closures.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9">لا توجد سجلات تقفيلات.</td></tr>';
        return;
    }

    closures.sort((a, b) => new Date(`${b.closureDate}T${b.closureTime}`) - new Date(`${a.closureDate}T${a.closureTime}`));

    for (const closure of closures) {
        const row = tableBody.insertRow();

        const cashierUser = users.find(u => u.username === closure.cashier);
        const cashierDisplayName = cashierUser ? cashierUser.name : closure.cashier;

        row.insertCell().textContent = cashierDisplayName;
        row.insertCell().textContent = `${closure.dateFrom} ${closure.timeFrom.substring(0,5)} - ${closure.dateTo} ${closure.timeTo.substring(0,5)}`;

        row.insertCell().textContent = closure.grandTotal.toFixed(2);

        row.insertCell().textContent = closure.newMindTotal > 0 ? closure.newMindTotal.toFixed(2) : '--';

        const differenceCell = row.insertCell();
        const diffValue = closure.difference;
        
        let diffDisplay = '';
        if (diffValue > 0) {
            diffDisplay = `+${Math.abs(diffValue).toFixed(2)}`;
            differenceCell.style.color = 'green';
            differenceCell.title = 'زيادة عند الكاشير';
        } else if (diffValue < 0) {
            diffDisplay = `-${Math.abs(diffValue).toFixed(2)}`;
            differenceCell.style.color = 'red';
            differenceCell.title = 'عجز على الكاشير';
        } else {
            diffDisplay = '0.00';
            differenceCell.style.color = 'blue';
            differenceCell.title = 'مطابق';
        }
        
        differenceCell.textContent = diffDisplay;

        const statusCell = row.insertCell();
        statusCell.innerHTML = `<span class="status ${closure.status === 'مغلق' || closure.status === 'مغلق بواسطة المحاسب' ? 'closed' : 'open'}">${closure.status}</span>`;

        row.insertCell().textContent = `${closure.closureDate} ${closure.closureTime.substring(0, 5)}`;

        const actionsCell = row.insertCell();
        actionsCell.innerHTML = `
            <button class="view-btn" onclick="viewClosureDetails('${closure.id}')">
                <i class="fas fa-eye"></i> عرض
            </button>
            <button class="edit-btn" onclick="promptForEditPassword('${closure.id}')">
                <i class="fas fa-edit"></i> تعديل
            </button>
            ${closure.status !== 'مغلق بواسطة المحاسب' ? `
            <button class="accountant-close-btn" onclick="showAccountantClosureModal('${closure.id}')">
                <i class="fas fa-check-double"></i> تقفيل المحاسب
            </button>` : ''}
        `;
    }
}

/**
 * Shows the accountant's closure details modal.
 * @param {string} closureId - The ID of the closure.
 * @param {boolean} [isEdit=false] - True if opening in edit mode.
 */
async function showAccountantClosureModal(closureId, isEdit = false) {
    showLoading(true);
    try {
        const allClosures = await loadShiftClosures({});
        const closure = allClosures.find(c => c.id === closureId);
        if (!closure) {
            showMessage('لم يتم العثور على تفاصيل التقفيلة.', 'error');
            return;
        }

        document.getElementById('accountantClosureModalCashierName').textContent = users.find(u => u.username === closure.cashier)?.name || closure.cashier;
        document.getElementById('accountantClosureModalPeriod').textContent = `${closure.dateFrom} ${closure.timeFrom.substring(0,5)} - ${closure.dateTo} ${closure.timeTo.substring(0,5)}`;
        document.getElementById('accountantClosureModalTotalExpenses').textContent = closure.totalExpenses.toFixed(2);
        document.getElementById('accountantClosureModalTotalInsta').textContent = closure.totalInsta.toFixed(2);
        document.getElementById('accountantClosureModalTotalVisa').textContent = closure.totalVisa.toFixed(2);
        document.getElementById('accountantClosureModalTotalOnline').textContent = closure.totalOnline.toFixed(2);
        document.getElementById('accountantClosureModalDrawerCash').textContent = closure.drawerCash.toFixed(2);
        
        document.getElementById('accountantClosureModalGrandTotal').textContent = closure.grandTotal.toFixed(2);
        
        document.getElementById('accountantClosureModalTotalReturns').textContent = closure.totalReturns.toFixed(2);

        const deductReturnsSwitch = document.getElementById('accountantClosureModalDeductReturns');
        if (deductReturnsSwitch) {
            if (isEdit) {
                deductReturnsSwitch.checked = (closure.grandTotalAfterReturns !== closure.grandTotal);
            } else {
                deductReturnsSwitch.checked = false;
            }
        }

        document.getElementById('accountantClosureModalNewMindTotal').value = closure.newMindTotal > 0 ? closure.newMindTotal.toFixed(2) : '';
        document.getElementById('accountantClosureModalDifference').textContent = closure.difference.toFixed(2);
        document.getElementById('accountantClosureModalStatus').textContent = closure.status;

        window.currentAccountantClosure = closure;
        window.isEditMode = isEdit;

        const accountantClosureDetailsModal = document.getElementById('accountantClosureDetailsModal');
        if (accountantClosureDetailsModal) accountantClosureDetailsModal.classList.add('active');
        
        updateAccountantClosureDifference();

        const modalTitle = document.querySelector('#accountantClosureDetailsModal .modal-header h3');
        const saveButton = document.getElementById('saveAccountantClosureBtn');
        if (modalTitle && saveButton) {
            if (isEdit) {
                modalTitle.innerHTML = `<i class="fas fa-edit"></i> تعديل تقفيل الشيفت`;
                saveButton.textContent = 'حفظ التعديلات';
                saveButton.onclick = saveEditedAccountantClosure;
            } else {
                modalTitle.innerHTML = `<i class="fas fa-check-double"></i> تقفيل المحاسب للشيفت`;
                saveButton.textContent = 'حفظ التقفيل';
                saveButton.onclick = saveAccountantClosure;
            }
        }

    } catch (error) {
        console.error('Error showing accountant closure modal:', error);
        showMessage('حدث خطأ أثناء عرض تفاصيل تقفيل المحاسب.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Updates the difference calculation and display in the accountant's closure modal.
 */
function updateAccountantClosureDifference() {
    const newMindTotalInput = document.getElementById('accountantClosureModalNewMindTotal');
    const differenceDisplay = document.getElementById('accountantClosureModalDifference');
    const statusDisplay = document.getElementById('accountantClosureModalStatus');
    const saveButton = document.getElementById('saveAccountantClosureBtn');
    const addReturnsSwitch = document.getElementById('accountantClosureModalDeductReturns');
    const grandTotalAfterReturnsContainer = document.getElementById('accountantClosureModalGrandTotalAfterReturnsContainer');
    const grandTotalAfterReturnsDisplay = document.getElementById('accountantClosureModalGrandTotalAfterReturns');
    const accClosureModalGrandTotal = document.getElementById('accountantClosureModalGrandTotal');

    if (!window.currentAccountantClosure || !accClosureModalGrandTotal || !newMindTotalInput || !differenceDisplay || !statusDisplay || !saveButton) return;

    const cashierRecordedGrandTotal = parseFloat(accClosureModalGrandTotal.textContent);
    const totalReturns = parseFloat(document.getElementById('accountantClosureModalTotalReturns')?.textContent || '0');
    const newMindTotal = parseFloat(newMindTotalInput.value);

    let grandTotalForComparison = cashierRecordedGrandTotal;
    let grandTotalAfterReturnsDisplayValue = cashierRecordedGrandTotal;

    if (addReturnsSwitch?.checked) {
        grandTotalForComparison = cashierRecordedGrandTotal + totalReturns;
        grandTotalAfterReturnsDisplayValue = grandTotalForComparison;
        if (grandTotalAfterReturnsContainer) grandTotalAfterReturnsContainer.style.display = 'block';
        if (grandTotalAfterReturnsDisplay) grandTotalAfterReturnsDisplay.textContent = grandTotalForComparison.toFixed(2);
        accClosureModalGrandTotal.style.textDecoration = 'line-through';
        accClosureModalGrandTotal.style.color = '#888';
    } else {
        if (grandTotalAfterReturnsContainer) grandTotalAfterReturnsContainer.style.display = 'none';
        accClosureModalGrandTotal.style.textDecoration = 'none';
        accClosureModalGrandTotal.style.color = '#2c3e50';
    }

    if (isNaN(newMindTotal)) {
        differenceDisplay.textContent = '0.00';
        statusDisplay.textContent = 'في انتظار الإدخال';
        statusDisplay.className = 'status open';
        saveButton.disabled = true;
        return;
    }

    const difference = grandTotalForComparison - newMindTotal;
    differenceDisplay.textContent = difference.toFixed(2);

    if (difference === 0) {
        statusDisplay.textContent = 'مطابق ✓';
        statusDisplay.className = 'status closed';
    } else if (difference > 0) {
        statusDisplay.textContent = 'زيادة عند الكاشير';
        statusDisplay.className = 'status active';
    } else {
        statusDisplay.textContent = 'عجز على الكاشير';
        statusDisplay.className = 'status inactive';
    }
    saveButton.disabled = false;
}

/**
 * Saves a new accountant closure to Google Sheets.
 */
async function saveAccountantClosure() {
    if (!window.currentAccountantClosure) {
        showMessage('لا توجد بيانات تقفيلة لحفظها.', 'error');
        return;
    }

    const newMindTotalInput = document.getElementById('accountantClosureModalNewMindTotal');
    const newMindTotal = newMindTotalInput ? parseFloat(newMindTotalInput.value) : NaN;
    if (isNaN(newMindTotal) || newMindTotal < 0) {
        showMessage('يرجى إدخال قيمة صحيحة لإجمالي نيو مايند.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const closure = window.currentAccountantClosure;
        const cashierRecordedGrandTotal = parseFloat(document.getElementById('accountantClosureModalGrandTotal')?.textContent || '0');
        const totalReturns = parseFloat(document.getElementById('accountantClosureModalTotalReturns')?.textContent || '0');
        const addReturns = document.getElementById('accountantClosureModalDeductReturns')?.checked || false;

        let grandTotalForComparison = cashierRecordedGrandTotal;
        let grandTotalAfterReturnsValue = cashierRecordedGrandTotal;

        if (addReturns) {
            grandTotalForComparison = cashierRecordedGrandTotal + totalReturns;
            grandTotalAfterReturnsValue = grandTotalForComparison;
        } else {
            grandTotalAfterReturnsValue = cashierRecordedGrandTotal;
        }

        const difference = grandTotalForComparison - newMindTotal;
        const now = new Date();

        const shiftId = 'SHIFT_ACC_' + now.getTime();

        const updatedData = [
            shiftId,
            closure.cashier,
            closure.dateFrom,
            closure.timeFrom,
            closure.dateTo,
            closure.timeTo,
            closure.totalExpenses.toFixed(2),
            closure.expenseCount,
            closure.totalInsta.toFixed(2),
            closure.instaCount,
            closure.totalVisa.toFixed(2),
            closure.visaCount,
            closure.totalOnline.toFixed(2),
            closure.onlineCount,
            cashierRecordedGrandTotal.toFixed(2),
            closure.drawerCash.toFixed(2),
            newMindTotal.toFixed(2),
            difference.toFixed(2),
            'مغلق بواسطة المحاسب',
            now.toISOString().split('T')[0],
            now.toTimeString().split(' ')[0],
            currentUser.username,
            totalReturns.toFixed(2),
            grandTotalAfterReturnsValue.toFixed(2)
        ];

        const result = await appendToSheet(SHEETS.SHIFT_CLOSURES, updatedData);

        if (result.success) {
            showMessage('تم تقفيل الشيفت بنجاح بواسطة المحاسب.', 'success');
            closeModal('accountantClosureDetailsModal');
            loadAccountantShiftClosuresHistory();
        } else {
            showMessage('فشل تقفيل الشيفت بواسطة المحاسب.', 'error');
        }
    } catch (error) {
        console.error('Error saving accountant closure:', error);
        showMessage('حدث خطأ أثناء حفظ تقفيلة المحاسب.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Prompts for a password to allow editing of a closure.
 * @param {string} closureId - The ID of the closure to edit.
 */
function promptForEditPassword(closureId) {
    const password = prompt('أدخل كلمة المرور لتعديل التقفيلة:');
    if (password === EDIT_PASSWORD) {
        showAccountantClosureModal(closureId, true);
    } else if (password !== null) {
        showMessage('كلمة المرور غير صحيحة.', 'error');
    }
}

/**
 * Saves edited accountant closure data to Google Sheets.
 */
async function saveEditedAccountantClosure() {
    if (!window.currentAccountantClosure) {
        showMessage('لا توجد بيانات تقفيلة لحفظها.', 'error');
        return;
    }

    const newMindTotalInput = document.getElementById('accountantClosureModalNewMindTotal');
    const newMindTotal = newMindTotalInput ? parseFloat(newMindTotalInput.value) : NaN;
    if (isNaN(newMindTotal) || newMindTotal < 0) {
        showMessage('يرجى إدخال قيمة صحيحة لإجمالي نيو مايند.', 'warning');
        return;
    }

    showLoading(true);
    try {
        const closure = window.currentAccountantClosure;
        const cashierRecordedGrandTotal = parseFloat(document.getElementById('accountantClosureModalGrandTotal')?.textContent || '0');
        const totalReturns = parseFloat(document.getElementById('accountantClosureModalTotalReturns')?.textContent || '0');
        const addReturns = document.getElementById('accountantClosureModalDeductReturns')?.checked || false;

        let grandTotalForComparison = cashierRecordedGrandTotal;
        let grandTotalAfterReturnsValue = cashierRecordedGrandTotal;

        if (addReturns) {
            grandTotalForComparison = cashierRecordedGrandTotal + totalReturns;
            grandTotalAfterReturnsValue = grandTotalForComparison;
        } else {
            grandTotalAfterReturnsValue = cashierRecordedGrandTotal;
        }

        const difference = grandTotalForComparison - newMindTotal;
        const now = new Date();

        const rowIndex = await findRowIndex(SHEETS.SHIFT_CLOSURES, 0, closure.id);
        if (rowIndex === -1) {
            showMessage('لم يتم العثور على التقفيلة لتحديثها.', 'error');
            return;
        }

        const updatedData = [
            closure.id,
            closure.cashier,
            closure.dateFrom,
            closure.timeFrom,
            closure.dateTo,
            closure.timeTo,
            closure.totalExpenses.toFixed(2),
            closure.expenseCount,
            closure.totalInsta.toFixed(2),
            closure.instaCount,
            closure.totalVisa.toFixed(2),
            closure.visaCount,
            closure.totalOnline.toFixed(2),
            closure.onlineCount,
            cashierRecordedGrandTotal.toFixed(2),
            closure.drawerCash.toFixed(2),
            newMindTotal.toFixed(2),
            difference.toFixed(2),
            'مغلق بواسطة المحاسب',
            now.toISOString().split('T')[0],
            now.toTimeString().split(' ')[0],
            currentUser.username,
            totalReturns.toFixed(2),
            grandTotalAfterReturnsValue.toFixed(2)
        ];

        const result = await updateSheet(SHEETS.SHIFT_CLOSURES, `A${rowIndex}:X${rowIndex}`, [updatedData]);

        if (result.success) {
            showMessage('تم تعديل التقفيلة بنجاح.', 'success');
            closeModal('accountantClosureDetailsModal');
            loadAccountantShiftClosuresHistory();
        } else {
            showMessage('فشل تعديل التقفيلة.', 'error');
        }
    } catch (error) {
        console.error('Error saving edited accountant closure:', error);
        showMessage('حدث خطأ أثناء حفظ تعديلات التقفيلة.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Displays detailed information about a specific shift closure.
 * @param {string} closureId - The ID of the closure to view.
 */
async function viewClosureDetails(closureId) {
    showLoading(true);
    try {
        const allClosures = await loadShiftClosures({});
        const closure = allClosures.find(c => c.id === closureId);
        if (!closure) {
            showMessage('لم يتم العثور على تفاصيل التقفيلة.', 'error');
            return;
        }

        const cashierUser = users.find(u => u.username === closure.cashier);
        const cashierDisplayName = cashierUser ? cashierUser.name : closure.cashier;
        const accountantUser = users.find(u => u.username === closure.accountant);
        const accountantDisplayName = accountantUser ? accountantUser.name : closure.accountant;

        let detailsHtml = `
            <h3>تفاصيل تقفيلة الشيفت</h3>
            <p><strong>الكاشير:</strong> ${cashierDisplayName}</p>
            <p><strong>الفترة:</strong> ${closure.dateFrom} ${closure.timeFrom.substring(0,5)} - ${closure.dateTo} ${closure.timeTo.substring(0,5)}</p>
            <p><strong>إجمالي المصروفات (عادي):</strong> ${closure.totalExpenses.toFixed(2)} (${closure.expenseCount} فاتورة) <a href="#" onclick="viewExpenseDetails('${closure.cashier}', '${closure.dateFrom}', '${closure.timeFrom}', '${closure.dateTo}', '${closure.timeTo}', 'normal'); return false;"><i class="fas fa-eye"></i></a></p>
            <p><strong>إجمالي الإنستا:</strong> ${closure.totalInsta.toFixed(2)} (${closure.instaCount} فاتورة) <a href="#" onclick="viewExpenseDetails('${closure.cashier}', '${closure.dateFrom}', '${closure.timeFrom}', '${closure.dateTo}', '${closure.timeTo}', 'إنستا'); return false;"><i class="fas fa-eye"></i></a></p>
            <p><strong>إجمالي الفيزا:</strong> ${closure.totalVisa.toFixed(2)} (${closure.visaCount} فاتورة) <a href="#" onclick="viewExpenseDetails('${closure.cashier}', '${closure.dateFrom}', '${closure.timeFrom}', '${closure.dateTo}', '${closure.timeTo}', 'فيزا'); return false;"><i class="fas fa-eye"></i></a></p>
            <p><strong>إجمالي الأونلاين:</strong> ${closure.totalOnline.toFixed(2)} (${closure.onlineCount} فاتورة) <a href="#" onclick="viewExpenseDetails('${closure.cashier}', '${closure.dateFrom}', '${closure.timeFrom}', '${closure.dateTo}', '${closure.timeTo}', 'اونلاين'); return false;"><i class="fas fa-eye"></i></a></p>
            <p><strong>إجمالي المرتجعات:</strong> ${closure.totalReturns.toFixed(2)} <a href="#" onclick="viewExpenseDetails('${closure.cashier}', '${closure.dateFrom}', '${closure.timeFrom}', '${closure.dateTo}', '${closure.timeTo}', 'مرتجع'); return false;"><i class="fas fa-eye"></i></a></p>
            <p><strong>إجمالي الكاش في الدرج:</strong> ${closure.drawerCash.toFixed(2)}</p>
            <p><strong>الإجمالي الكلي للكاشير (بعد خصم المرتجعات):</strong> ${closure.grandTotal.toFixed(2)}</p>
            ${closure.totalReturns > 0 && closure.grandTotalAfterReturns !== closure.grandTotal ? `<p><strong>الإجمالي الكلي الذي قارنه المحاسب (بعد إضافة المرتجع):</strong> ${closure.grandTotalAfterReturns.toFixed(2)}</p>` : ''}
            <p><strong>إجمالي نيو مايند:</strong> ${closure.newMindTotal.toFixed(2)}</p>
            <p><strong>الفرق:</strong> ${closure.difference.toFixed(2)}</p>
            <p><strong>الحالة:</strong> ${closure.status}</p>
            <p><strong>تاريخ التقفيل:</strong> ${closure.closureDate} ${closure.closureTime.substring(0,5)}</p>
            ${closure.accountant ? `<p><strong>تم التقفيل بواسطة المحاسب:</strong> ${accountantDisplayName}</p>` : ''}
        `;

        const genericModal = document.getElementById('genericDetailsModal');
        const genericModalContent = document.getElementById('genericDetailsModalContent');
        if (genericModal && genericModalContent) {
            genericModalContent.innerHTML = detailsHtml;
            genericModal.classList.add('active');
        } else {
            alert(detailsHtml.replace(/<[^>]*>?/gm, '\n').replace(/\n\n/g, '\n').trim());
        }

    } catch (error) {
        console.error('Error viewing closure details:', error);
        showMessage('حدث خطأ أثناء عرض تفاصيل التقفيلة.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Displays detailed expense information for a specific cashier and form type within a period.
 * @param {string} cashierUsername - The username of the cashier.
 * @param {string} dateFrom - Start date.
 * @param {string} timeFrom - Start time.
 * @param {string} dateTo - End date.
 * @param {string} timeTo - End time.
 * @param {string} formType - The form type of expenses to display ('normal', 'فيزا', 'إنستا', etc.).
 */
async function viewExpenseDetails(cashierUsername, dateFrom, timeFrom, dateTo, timeTo, formType) {
    showLoading(true);
    try {
        const filters = {
            cashier: cashierUsername,
            dateFrom: dateFrom,
            dateTo: dateTo,
            timeFrom: timeFrom,
            timeTo: timeTo
        };
        
        if (formType === 'normal') {
            // Filter after loading all expenses
        } else {
            filters.formType = formType;
        }

        const expenses = await loadExpenses(filters);

        let filteredExpenses = [];
        if (formType === 'normal') {
            filteredExpenses = expenses.filter(exp => {
                const category = categories.find(c => c.name === exp.category || c.code === exp.categoryCode);
                return category && !['فيزا', 'إنستا', 'اونلاين', 'مرتجع', 'اجل', 'سلف_موظف'].includes(category.formType);
            });
        } else {
            filteredExpenses = expenses;
        }

        let detailsHtml = `
            <h3>تفاصيل ${formType === 'normal' ? 'المصروفات العادية' : formType} للكاشير ${users.find(u => u.username === cashierUsername)?.name || cashierUsername}</h3>
            <p>الفترة: ${dateFrom} ${timeFrom.substring(0,5)} - ${dateTo} ${timeTo.substring(0,5)}</p>
        `;

        if (filteredExpenses.length === 0) {
            detailsHtml += '<p>لا توجد فواتير لهذا النوع في الفترة المحددة.</p>';
        } else {
            detailsHtml += `
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

            filteredExpenses.sort((a, b) => new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`));

            filteredExpenses.forEach(exp => {
                detailsHtml += `
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

            detailsHtml += `
                    </tbody>
                </table>
                <p><strong>إجمالي: ${filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(2)}</strong> (${filteredExpenses.length} فاتورة)</p>
            `;
        }

        const genericModal = document.getElementById('genericDetailsModal');
        const genericModalContent = document.getElementById('genericDetailsModalContent');
        if (genericModal && genericModalContent) {
            genericModalContent.innerHTML = detailsHtml;
            genericModal.classList.add('active');
        } else {
            alert(detailsHtml.replace(/<[^>]*>?/gm, '\n').replace(/\n\n/g, '\n').trim());
        }

    } catch (error) {
        console.error('Error viewing expense details:', error);
        showMessage('حدث خطأ أثناء عرض تفاصيل المصروفات.', 'error');
    } finally {
        showLoading(false);
    }
}
