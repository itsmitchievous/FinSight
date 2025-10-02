CREATE DATABASE `finsight` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
use finsight;
-- USERS
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email_add VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    user_description TEXT,
    budgeting_challenges TEXT,
    spending_priority VARCHAR(100),
    confidence_level TINYINT CHECK (confidence_level BETWEEN 1 AND 10),
    is_active BOOLEAN DEFAULT TRUE,
    last_login DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

SELECT user_id, full_name, email_add, verified FROM users;

delete from users;
delete from otps;

ALTER TABLE users ADD COLUMN verified BOOLEAN DEFAULT FALSE;

-- OTPS
CREATE TABLE otps (
    otp_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    type ENUM('signup','reset','2fa') NOT NULL,
    expires_at DATETIME NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
-- email: finsightapplication.email@gmail.com
-- email pass: group1finsightprojman

-- WALLETS
CREATE TABLE wallets (
    wallet_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    wallet_name VARCHAR(100) NOT NULL,
    wallet_type ENUM('Cash','Bank','E-Wallet','Other') NOT NULL,
    wallet_created DATE DEFAULT (CURRENT_DATE),
    wallet_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

ALTER TABLE wallets 
MODIFY wallet_type ENUM('Cash','Bank','E-Wallet','Savings','Other') NOT NULL;

-- CATEGORIES
CREATE TABLE categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    category_name VARCHAR(100) NOT NULL,
    category_type ENUM('Need', 'Want', 'Savings') NULL,  -- Only relevant for expenses
    transaction_type ENUM('Expense', 'Income') NOT NULL DEFAULT 'Expense',
    is_default BOOLEAN DEFAULT FALSE,
    category_created DATE DEFAULT (CURRENT_DATE),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_categories (user_id, transaction_type)
);

-- Expense categories
INSERT INTO categories (user_id, category_name, category_type, transaction_type, is_default) VALUES
(NULL, 'Food', 'Need', 'Expense', TRUE),
(NULL, 'Transportation', 'Need', 'Expense', TRUE),
(NULL, 'Groceries', 'Need', 'Expense', TRUE),
(NULL, 'Housing', 'Need', 'Expense', TRUE),
(NULL, 'Bills', 'Need', 'Expense', TRUE),
(NULL, 'Rent', 'Need', 'Expense', TRUE),
(NULL, 'Insurance', 'Need', 'Expense', TRUE),
(NULL, 'Health', 'Need', 'Expense', TRUE),
(NULL, 'Shopping', 'Want', 'Expense', TRUE),
(NULL, 'Travel', 'Want', 'Expense', TRUE),
(NULL, 'Subscriptions', 'Want', 'Expense', TRUE),
(NULL, 'Savings', 'Savings', 'Expense', TRUE),
(NULL, 'Emergency Fund', 'Savings', 'Expense', TRUE),
(NULL, 'Others', 'Need', 'Expense', TRUE);

-- Income categories
INSERT INTO categories (user_id, category_name, transaction_type, is_default) VALUES
(NULL, 'Salary', 'Income', TRUE),
(NULL, 'Bonus', 'Income', TRUE),
(NULL, 'Freelance', 'Income', TRUE),
(NULL, 'Investment Returns', 'Income', TRUE),
(NULL, 'Other Income', 'Income', TRUE);

-- INCOME
CREATE TABLE income (
    income_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    wallet_id INT NOT NULL,
    category_id INT,
    amount DECIMAL(12,2) NOT NULL,
    notes TEXT,
    income_date DATE NOT NULL,
    income_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    income_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (wallet_id) REFERENCES wallets(wallet_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL,
    INDEX idx_wallet_income (wallet_id),
    INDEX idx_user_income (user_id),
    INDEX idx_category_income (category_id)
);

-- EXPENSES
CREATE TABLE expenses (
    expense_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    wallet_id INT NOT NULL,
    category_id INT,
    amount_spent DECIMAL(12,2) NOT NULL,
    notes TEXT,
    expense_date DATE NOT NULL,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_frequency ENUM('Weekly', 'Monthly', 'Yearly') NULL,
    expense_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (wallet_id) REFERENCES wallets(wallet_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL,
    INDEX idx_wallet_expenses (wallet_id),
    INDEX idx_user_expenses (user_id)
);


-- TRANSACTIONS
CREATE TABLE transactions (
    transaction_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    wallet_id INT NOT NULL,
    category_id INT,
    transaction_type ENUM('Income', 'Expense') NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    notes TEXT,
    transaction_date DATE NOT NULL,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_frequency ENUM('Weekly', 'Monthly', 'Yearly') NULL,
    source_table ENUM('income', 'expenses') NOT NULL,
    source_id INT NOT NULL,
    transaction_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transaction_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (wallet_id) REFERENCES wallets(wallet_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL,
    INDEX idx_user_transactions (user_id),
    INDEX idx_wallet_transactions (wallet_id),
    INDEX idx_transaction_type (transaction_type),
    INDEX idx_transaction_date (transaction_date),
    INDEX idx_source (source_table, source_id)
);

-- BUDGET
CREATE TABLE budgets (
    budget_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    wallet_id INT NOT NULL,
    budget_name VARCHAR(100) NOT NULL,
    total_income DECIMAL(12,2) NOT NULL,
    budget_rule ENUM('50-30-20', '70-20-10', 'Custom') NOT NULL DEFAULT 'Custom',
    budget_period ENUM('Monthly', 'Weekly', 'Yearly') NOT NULL DEFAULT 'Monthly',
    budget_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    budget_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (wallet_id) REFERENCES wallets(wallet_id) ON DELETE CASCADE,
    INDEX idx_user_budgets (user_id),
    INDEX idx_wallet_budgets (wallet_id)
);

-- BUDGET ALLOCATION
CREATE TABLE budget_allocations (
    allocation_id INT AUTO_INCREMENT PRIMARY KEY,
    budget_id INT NOT NULL,
    category_id INT NOT NULL,
    allocated_amount DECIMAL(12,2) NOT NULL,
    category_type ENUM('Need', 'Want', 'Savings') NOT NULL,
    allocation_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    allocation_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (budget_id) REFERENCES budgets(budget_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE CASCADE,
    INDEX idx_budget_allocations (budget_id),
    INDEX idx_category_allocations (category_id)
);


-- SAVINGS JARS
CREATE TABLE savings_jars (
    savings_jar_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    jar_name VARCHAR(100) NOT NULL,
    deposit_amount DECIMAL(12,2) DEFAULT 0,
    target_amount DECIMAL(12,2) NOT NULL,
    current_amount DECIMAL(12,2) DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE,
    savings_jar_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    savings_jar_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);


-- CREDIT WALLET
CREATE TABLE credit_wallets (
    credit_wallet_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    wallet_id INT NOT NULL,                        -- link to main wallets table
    card_provider VARCHAR(100) NOT NULL,           -- e.g., BDO, Citibank
    card_number_last4 CHAR(4) NOT NULL,            -- last 4 digits only
    billing_date TINYINT NOT NULL CHECK (billing_date BETWEEN 1 AND 31),
    due_date TINYINT NOT NULL CHECK (due_date BETWEEN 1 AND 31),
    credit_limit DECIMAL(12,2) NOT NULL,
    interest_rate DECIMAL(5,2),                    -- percentage (e.g. 3.25)
    notes TEXT,
    statement_balance DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (wallet_id) REFERENCES wallets(wallet_id) ON DELETE CASCADE
);

-- AI CHAT
CREATE TABLE ai_chat (
    chat_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message_text TEXT NOT NULL,                     -- user’s input
    response_text TEXT,                             -- AI’s response
    messenger_type ENUM('web','mobile','bot') NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- time of message
    reference_id VARCHAR(100),                      -- link to related entity (optional)
    context_data JSON,                              -- store session context, e.g. {"topic":"budget"}
   
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);


