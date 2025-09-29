// --- Google Sheets API Interaction Functions ---

/**
 * Reads data from a specified sheet and range.
 * @param {string} sheetName - The name of the sheet.
 * @param {string} [range='A:Z'] - The range to read (e.g., 'A1:C10').
 * @returns {Promise<Array<Array<string>>>} A promise that resolves with the sheet data.
 */
async function readSheet(sheetName, range = 'A:Z') {
    try {
        if (!isAuthenticated) {
            console.log(`Not authenticated for readSheet(${sheetName}). Attempting re-authentication.`);
            await handleAuthClick(true);
            if (!isAuthenticated) {
                throw new Error('Authentication failed before reading sheet.');
            }
        }

        const fullRange = range ? `${sheetName}!${range}` : `${sheetName}!A:Z`;
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: fullRange,
        });
        return response.result.values || [];
    } catch (error) {
        console.error(`Error reading sheet ${sheetName}:`, error);
        showMessage(`خطأ في قراءة البيانات من ${sheetName}`, 'error');
        return [];
    }
}

/**
 * Appends a row of values to a specified sheet.
 * @param {string} sheetName - The name of the sheet.
 * @param {Array<string>} values - An array of values representing a row.
 * @returns {Promise<{success: boolean, data?: object, message?: string}>} A promise that resolves with the operation result.
 */
async function appendToSheet(sheetName, values) {
    try {
        if (!isAuthenticated) {
            console.log(`Not authenticated for appendToSheet(${sheetName}). Attempting re-authentication.`);
            await handleAuthClick(true);
            if (!isAuthenticated) {
                throw new Error('Authentication failed before appending to sheet.');
            }
        }

        const response = await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:Z`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [values]
            }
        });
        return { success: true, data: response.result };
    } catch (error) {
        console.error(`Error appending to sheet ${sheetName}:`, error);
        return { success: false, message: error.message };
    }
}

/**
 * Updates a range of cells in a specified sheet.
 * @param {string} sheetName - The name of the sheet.
 * @param {string} range - The range to update (e.g., 'A1:C1').
 * @param {Array<Array<string>>} values - An array of arrays, where each inner array is a row of values.
 * @returns {Promise<{success: boolean, data?: object, message?: string}>} A promise that resolves with the operation result.
 */
async function updateSheet(sheetName, range, values) {
    try {
        if (!isAuthenticated) {
            console.log(`Not authenticated for updateSheet(${sheetName}). Attempting re-authentication.`);
            await handleAuthClick(true);
            if (!isAuthenticated) {
                throw new Error('Authentication failed before updating sheet.');
            }
        }

        const response = await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!${range}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: values
            }
        });
        return { success: true, data: response.result };
    } catch (error) {
        console.error(`Error updating sheet ${sheetName}:`, error);
        return { success: false, message: error.message };
    }
}

/**
 * Deletes a row from a specified sheet.
 * @param {string} sheetName - The name of the sheet.
 * @param {number} rowIndex - The 1-based index of the row to delete.
 * @returns {Promise<{success: boolean, data?: object, message?: string}>} A promise that resolves with the operation result.
 */
async function deleteSheetRow(sheetName, rowIndex) {
    try {
        if (!isAuthenticated) {
            console.log(`Not authenticated for deleteSheetRow(${sheetName}). Attempting re-authentication.`);
            await handleAuthClick(true);
            if (!isAuthenticated) {
                throw new Error('Authentication failed before deleting sheet row.');
            }
        }

        const response = await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: await getSheetId(sheetName),
                            dimension: 'ROWS',
                            startIndex: rowIndex - 1, // Google Sheets API uses 0-based index
                            endIndex: rowIndex
                        }
                    }
                }]
            }
        });
        return { success: true, data: response.result };
    } catch (error) {
        console.error(`Error deleting row from sheet ${sheetName}:`, error);
        return { success: false, message: error.message };
    }
}

/**
 * Gets the sheet ID for a given sheet name.
 * @param {string} sheetName - The name of the sheet.
 * @returns {Promise<number>} A promise that resolves with the sheet ID.
 */
async function getSheetId(sheetName) {
    const response = await gapi.client.sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
    });
    const sheet = response.result.sheets.find(s => s.properties.title === sheetName);
    if (!sheet) {
        throw new Error(`Sheet with name ${sheetName} not found.`);
    }
    return sheet.properties.sheetId;
}

/**
 * Finds the 1-based row index of a value in a specific column of a sheet.
 * @param {string} sheetName - The name of the sheet.
 * @param {number} columnIndex - The 0-based index of the column to search.
 * @param {string} searchValue - The value to search for.
 * @returns {Promise<number>} The 1-based row index, or -1 if not found.
 */
async function findRowIndex(sheetName, columnIndex, searchValue) {
    const data = await readSheet(sheetName);
    // Start from the second row (index 1) to ignore headers
    for (let i = 1; i < data.length; i++) {
        // Special handling for categories - flexible ID comparison
        if (sheetName === SHEETS.CATEGORIES) {
            const cellValue = data[i][columnIndex] || '';
            const normalizedCellValue = normalizeCategoryId(cellValue);
            const normalizedSearchValue = normalizeCategoryId(searchValue);
            
            if (normalizedCellValue === normalizedSearchValue) {
                return i + 1; // +1 because Google Sheets API uses 1-based index for rows
            }
        } else {
            // Original behavior for other tables
            if (data[i][columnIndex] === searchValue) {
                return i + 1;
            }
        }
    }
    return -1;
}

/**
 * Helper function to normalize category IDs for consistent comparison.
 * @param {string} id - The category ID to normalize.
 * @returns {string} The normalized category ID.
 */
function normalizeCategoryId(id) {
    if (!id) return '';
    
    let normalized = id.toString().trim();
    
    // If ID is numeric only, add prefix
    if (!isNaN(normalized) && normalized.length < 10) {
        normalized = 'CAT_' + normalized;
    }
    
    // If it contains the prefix but inconsistently
    if (normalized.startsWith('CAT') && !normalized.startsWith('CAT_')) {
        normalized = 'CAT_' + normalized.substring(3);
    }
    
    return normalized;
}

// في نهاية ملف sheets_api.js، أضف هذه الدالة
/**
 * مقارنة مرنة للأوقات (تجاهل الثواني وتحويل AM/PM إذا لزم)
 * @param {string} time1 - الوقت الأول (HH:MM أو HH:MM:SS)
 * @param {string} time2 - الوقت الثاني (HH:MM أو HH:MM:SS)
 * @returns {boolean} true إذا تطابقا
 */
function flexibleTimeMatch(time1, time2) {
    if (!time1 || !time2) return false;
    
    // تنظيف وتوحيد التنسيق إلى HH:MM
    const cleanTime1 = time1.substring(0, 5);
    const cleanTime2 = time2.substring(0, 5);
    
    return cleanTime1 === cleanTime2;
}

/**
 * تحسين findRowIndex لدعم البحث في التقفيلات (مقارنة مرنة للأوقات والتواريخ)
 * @param {string} sheetName - اسم الورقة
 * @param {number} idColumn - عمود الـ ID
 * @param {string} id - الـ ID للبحث
 * @param {object} [closureFilters] - فلاتر إضافية للتقفيلات (cashier, dateFrom, etc.)
 * @returns {Promise<number>} رقم الصف (1-based) أو -1
 */
async function findRowIndex(sheetName, idColumn, id, closureFilters = null) {
    const data = await readSheet(sheetName);
    for (let i = 1; i < data.length; i++) {
        if (data[i][idColumn] === id) {
            // إذا كان بحث تقفيلة، تحقق من الفلاتر المرنة
            if (sheetName === SHEETS.SHIFT_CLOSURES && closureFilters) {
                const rowCashier = data[i][1]; // عمود الكاشير (الثاني)
                const rowDateFrom = data[i][2]; // dateFrom
                const rowTimeFrom = data[i][3]; // timeFrom
                const rowDateTo = data[i][4];   // dateTo
                const rowTimeTo = data[i][5];   // timeTo
                const rowStatus = data[i][18];  // status

                if (rowCashier === closureFilters.cashier &&
                    rowDateFrom === closureFilters.dateFrom &&
                    flexibleTimeMatch(rowTimeFrom, closureFilters.timeFrom) &&
                    rowDateTo === closureFilters.dateTo &&
                    flexibleTimeMatch(rowTimeTo, closureFilters.timeTo) &&
                    rowStatus === 'مغلق') {
                    return i + 1;
                }
            } else {
                return i + 1;
            }
        }
    }
    return -1;
}
