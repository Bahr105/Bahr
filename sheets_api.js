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
 * @param {string} searchValue - The value to search for (ID).
 * @param {object} [closureFilters] - Filters for shift closures (cashier, dateFrom, etc.).
 * @returns {Promise<number>} The 1-based row index, or -1 if not found.
 */
async function findRowIndex(sheetName, columnIndex, searchValue, closureFilters = null) {
    const data = await readSheet(sheetName);
    console.log(`Searching in ${sheetName} with searchValue: ${searchValue}, filters:`, closureFilters); // Debug log

    for (let i = 1; i < data.length; i++) {
        let match = false;

        if (sheetName === SHEETS.SHIFT_CLOSURES && closureFilters) {
            // Search by filters for shift closures (independent of ID)
            const rowCashier = data[i][1]; // Column B: cashier
            const rowDateFrom = data[i][2]; // Column C: dateFrom
            const rowTimeFrom = data[i][3]; // Column D: timeFrom
            const rowDateTo = data[i][4];   // Column E: dateTo
            const rowTimeTo = data[i][5];   // Column F: timeTo
            const rowStatus = data[i][18];  // Column S: status

            // Ensure all filter properties are present before comparison
            const cashierMatch = closureFilters.cashier === undefined || rowCashier === closureFilters.cashier;
            const dateFromMatch = closureFilters.dateFrom === undefined || rowDateFrom === closureFilters.dateFrom;
            const timeFromMatch = closureFilters.timeFrom === undefined || flexibleTimeMatch(rowTimeFrom, closureFilters.timeFrom);
            const dateToMatch = closureFilters.dateTo === undefined || rowDateTo === closureFilters.dateTo;
            const timeToMatch = closureFilters.timeTo === undefined || flexibleTimeMatch(rowTimeTo, closureFilters.timeTo);
            const statusMatch = closureFilters.status === undefined || rowStatus === closureFilters.status; // Added status filter

            match = cashierMatch && dateFromMatch && timeFromMatch && dateToMatch && timeToMatch && statusMatch;
            
            console.log(`Row ${i+1} match for filters:`, match, { rowCashier, rowDateFrom, rowTimeFrom, rowDateTo, rowTimeTo, rowStatus, filterStatus: closureFilters.status }); // Debug
        } else if (searchValue !== null && searchValue !== undefined) {
            // Standard search by value (ID)
            if (sheetName === SHEETS.CATEGORIES) {
                const cellValue = data[i][columnIndex] || '';
                const normalizedCellValue = normalizeCategoryId(cellValue);
                const normalizedSearchValue = normalizeCategoryId(searchValue);
                match = normalizedCellValue === normalizedSearchValue;
            } else {
                match = data[i][columnIndex] === searchValue;
            }
        }

        if (match) {
            console.log(`Found match at row ${i+1}`); // Debug
            return i + 1; // 1-based index
        }
    }
    console.log('No match found'); // Debug
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

/**
 * Flexible time matching (ignores seconds and handles AM/PM if needed).
 * @param {string} time1 - First time (HH:MM or HH:MM:SS).
 * @param {string} time2 - Second time (HH:MM or HH:MM:SS).
 * @returns {boolean} True if they match.
 */
function flexibleTimeMatch(time1, time2) {
    if (!time1 || !time2) return false;
    
    // Clean and normalize to HH:MM
    const cleanTime1 = time1.toString().substring(0, 5);
    const cleanTime2 = time2.toString().substring(0, 5);
    
    // Handle potential AM/PM conversion if needed (basic check)
    const normalizeHour = (time) => {
        let [h, m] = time.split(':').map(Number);
        // This part might need adjustment based on actual time format in sheets (e.g., 13:00 vs 01:00 PM)
        // For now, assuming HH:MM 24-hour format or consistent 12-hour format.
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };
    
    return normalizeHour(cleanTime1) === normalizeHour(cleanTime2);
}
