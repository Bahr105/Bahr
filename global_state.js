// --- Global Application State and Constants ---

// Google Sheets API Configuration
const API_KEY = 'AIzaSyAFKAWVM6Y7V3yxuD7c-9u0e11Ki1z-5VU';
const CLIENT_ID = '514562869133-nuervm5carqqctkqudvqkcolup7s12ve.apps.googleusercontent.com';
const SPREADSHEET_ID = '16WsTQuebZDGErC8NwPRYf7qsHDVWhfDvUtvQ7u7IC9Q'; // تأكد من تحديث هذا الـ ID إذا كان مختلفًا
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

// Sheet Names
const SHEETS = {
    USERS: 'Users',
    CATEGORIES: 'Categories',
    EXPENSES: 'Expenses',
    CUSTOMERS: 'Customers',
    SHIFT_CLOSURES: 'ShiftClosures',
    CUSTOMER_CREDIT_HISTORY: 'CustomerCreditHistory',
    CATEGORY_CUSTOM_FIELDS: 'CategoryCustomFields',
    EMPLOYEES: 'Employees',
    EMPLOYEE_ADVANCE_HISTORY: 'EmployeeAdvanceHistory'
};

// Authentication State
let isAuthenticated = localStorage.getItem('googleAuthState') === 'authenticated';
let gapiInited = false;
let gisInited = false;
let tokenClient;

// Application Data
let users = [];
let categories = [];
let customers = [];
let employees = [];
let categoryCustomFields = [];

// Current User and Selected Items
let currentUser = null;
let currentUserName = '';
let currentUserRole = '';
let currentSelectedCustomerId = null; // لتتبع العميل المحدد في تفاصيل الأجل
let currentSelectedEmployeeId = null; // لتتبع الموظف المحدد في تفاصيل السلف
let currentEditUserId = null; // لتتبع المستخدم الذي يتم تعديله
let currentEditCategoryId = null; // لتتبع التصنيف الذي يتم تعديله
let currentEditExpenseId = null; // لتتبع المصروف الذي يتم تعديله
let currentEditEmployeeId = null; // لتتبع الموظف الذي يتم تعديله

// Flags to prevent duplicate actions or track state
let initialDataLoaded = false;
let expenseSubmissionInProgress = false;
window.authInProgress = false;
window.authClickInProgress = false;
let googleScriptsLoadedAndInitialized = false; // متغير جديد لتتبع حالة التحميل والتهيئة الكاملة

// Passwords (should be replaced with more secure mechanisms in production)
const EDIT_PASSWORD = '2552';
const MODIFICATION_PASSWORD = '2552025';

// Global variable to store closure data for accountant
window.currentClosureData = null;
window.currentAccountantClosure = null;
window.isEditMode = false; // Flag for accountant closure modal edit mode