const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors());
app.use(bodyParser.json());


// 1. Connect to MySQL
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "finsight",
  database: "finsight"
});

db.connect(err => {
  if (err) throw err;
  console.log("✅ MySQL Connected");
});

// 2. Nodemailer transporter (Gmail example)
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: "finsightapplication.email@gmail.com",
    pass: "lzvj amvn udmf pnco"
  }
});

// 3. Helper: Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}


// I. ACCOUNTS MANAGEMENT 

// ===================== SIGNUP =====================
app.post("/signup", async (req, res) => {
  const { full_name, email_add, password } = req.body;
  if (!full_name || !email_add || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = "INSERT INTO users (full_name, email_add, password_hash) VALUES (?, ?, ?)";
    db.query(sql, [full_name, email_add, hashedPassword], (err, result) => {
      if (err) {
        console.error("❌ DB Error inserting user:", err.sqlMessage);
        return res.status(500).json({ message: "Failed to register user", error: err.sqlMessage });
      }

      const userId = result.insertId;
      const otpCode = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60000);

      const otpSql = `
        INSERT INTO otps (user_id, otp_code, type, expires_at)
        VALUES (?, ?, 'signup', ?)
      `;
      db.query(otpSql, [userId, otpCode, expiresAt], (err2) => {
        if (err2) {
          console.error("❌ OTP DB Error:", err2);
          return res.status(500).json({ message: "Failed to generate OTP" });
        }

        transporter.sendMail({
          from: '"FinSight App" <finsightapplication.email@gmail.com>',
          to: email_add,
          subject: "Verify your email",
          text: `Your OTP code is: ${otpCode}`
        }, (emailErr) => {
          if (emailErr) {
            console.error("❌ Email error:", emailErr);
            return res.status(500).json({ message: "Failed to send OTP" });
          }

          console.log("✅ Signup OTP sent to", email_add);
          res.json({ message: "User registered! OTP sent.", userId });
        });
      });
    });
  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===================== VERIFY OTP =====================
app.post("/verify-otp", (req, res) => {
  let { user_id, otp_code } = req.body;

  user_id = Number(user_id);
  if (!user_id || !otp_code) {
    return res.status(400).json({ message: "Missing fields" });
  }

  console.log("Verifying OTP for user_id:", user_id, "otp_code:", otp_code);

  const selectOtpSql = `
    SELECT * FROM otps
    WHERE user_id = ? AND otp_code = ? AND type='signup' AND used=FALSE AND expires_at > NOW()
  `;

  db.query(selectOtpSql, [user_id, otp_code], (err, results) => {
    if (err) {
      console.error("DB error selecting OTP:", err);
      return res.status(500).json({ message: "DB error" });
    }

    if (results.length === 0) {
      console.warn("Invalid or expired OTP for user_id:", user_id);
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const otpId = results[0].otp_id;

    const markOtpUsedSql = "UPDATE otps SET used=TRUE WHERE otp_id=?";
    db.query(markOtpUsedSql, [otpId], (err2) => {
      if (err2) {
        console.error("DB error marking OTP as used:", err2);
        return res.status(500).json({ message: "Failed to mark OTP as used" });
      }

      const verifyUserSql = "UPDATE users SET verified=TRUE WHERE user_id=?";
      db.query(verifyUserSql, [user_id], (err3, result3) => {
        if (err3) {
          console.error("DB error verifying user:", err3);
          return res.status(500).json({ message: "Failed to verify user" });
        }

        if (result3.affectedRows === 0) {
          console.warn("No user found with user_id:", user_id);
          return res.status(404).json({ message: "User not found" });
        }

        console.log("✅ User verified successfully:", user_id);
        return res.json({ message: "✅ Email verified successfully!", userId: user_id });
      });
    });
  });
});

// ===================== LOGIN =====================
app.post("/login", (req, res) => {
  const { email_add, password } = req.body;

  const sql = "SELECT * FROM users WHERE email_add = ?";
  db.query(sql, [email_add], async (err, results) => {
    if (err) return res.status(500).json({ message: "Error on login" });
    if (results.length === 0) return res.status(400).json({ message: "User not found" });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (match) {
      res.json({ message: "Login successful", user_id: user.user_id, verified: user.verified });
    } else {
      res.status(401).json({ message: "Invalid password" });
    }
  });
});

// ===================== BUDGET CHECK-IN =====================
app.post("/budget-checkin", async (req, res) => {
  const { user_id, user_description, budgeting_challenges, spending_priority, confidence_level } = req.body;

  if (!user_id) return res.status(400).json({ message: "Missing user ID" });

  try {
    const [result] = await db.execute(
      `UPDATE users 
       SET user_description = ?, budgeting_challenges = ?, spending_priority = ?, confidence_level = ?, updated_at = NOW() 
       WHERE user_id = ?`,
      [user_description, budgeting_challenges, spending_priority, confidence_level, user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "Budgeting check-in saved successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===================== GET USER INFO =====================
app.get("/user", (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: true, message: "User ID required" });
  }

  const sql = `
    SELECT user_id, full_name, email_add, user_description,
           budgeting_challenges, spending_priority, confidence_level
    FROM users
    WHERE user_id = ?
  `;

  db.query(sql, [user_id], (err, results) => {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({ error: true, message: "Error fetching user info" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: true, message: "User not found" });
    }

    const user = results[0];
    res.json({
      user_id: user.user_id,
      full_name: user.full_name,
    });
  });
});

// ===================== HOME SUMMARY =====================
app.get("/home/summary", (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ message: "User ID required" });
  }

  const sql = `
    SELECT 
      full_name AS first_name, 
      COALESCE(SUM(t.amount), 0) AS spent, 
      COALESCE(u.monthly_budget, 0) AS budget
    FROM users u
    LEFT JOIN transactions t ON u.user_id = t.user_id
    WHERE u.user_id = ?
    GROUP BY u.user_id
  `;

  db.query(sql, [user_id], (err, results) => {
    if (err) {
      console.error("❌ DB Error:", err);
      return res.status(500).json({ message: "Error fetching summary" });
    }

    if (results.length === 0) {
      return res.json({ first_name: "User", spent: 0, budget: 0 });
    }

    res.json(results[0]);
  });
});

// II. WALLETS MANAGEMENT 

// ===================== ADD WALLET =====================
app.post("/add-wallet", (req, res) => {
  const { user_id, wallet_name, wallet_type } = req.body;

  if (!user_id || !wallet_name || !wallet_type) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const validTypes = ["Cash", "Bank", "E-Wallet", "Savings", "Other"];
  if (!validTypes.includes(wallet_type)) {
    return res.status(400).json({ message: "Invalid wallet type" });
  }

  const checkSql = `SELECT * FROM wallets WHERE user_id = ? AND wallet_name = ?`;
  db.query(checkSql, [user_id, wallet_name], (err, results) => {
    if (err) {
      console.error("❌ DB error checking duplicate wallet:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (results.length > 0) {
      return res.status(400).json({ message: "You already have a wallet with this name" });
    }

    const insertSql = `
      INSERT INTO wallets (user_id, wallet_name, wallet_type)
      VALUES (?, ?, ?)
    `;

    db.query(insertSql, [user_id, wallet_name, wallet_type], (err2, result) => {
      if (err2) {
        console.error("❌ Failed to add wallet:", err2);
        return res.status(500).json({ message: "Failed to add wallet" });
      }

      res.json({ 
        message: "✅ Wallet added successfully", 
        wallet_id: result.insertId 
      });
    });
  });
});

// ===================== DELETE WALLET =====================
app.delete("/delete-wallet", (req, res) => {
  const { user_id, wallet_id } = req.query;

  if (!user_id || !wallet_id) {
    return res.status(400).json({ message: "Missing user_id or wallet_id" });
  }

  const sql = "DELETE FROM wallets WHERE user_id = ? AND wallet_id = ?";
  db.query(sql, [user_id, wallet_id], (err, result) => {
    if (err) {
      console.error("❌ DB error deleting wallet:", err);
      return res.status(500).json({ message: "Server error" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    res.json({ message: "✅ Wallet deleted successfully" });
  });
});

// ===================== UPDATE WALLET =====================
app.put("/update-wallet", (req, res) => {
  const { user_id, wallet_id, wallet_name, wallet_type } = req.body;

  if (!user_id || !wallet_id || !wallet_name || !wallet_type) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const sql = `
    UPDATE wallets 
    SET wallet_name = ?, wallet_type = ? 
    WHERE user_id = ? AND wallet_id = ?
  `;

  db.query(sql, [wallet_name, wallet_type, user_id, wallet_id], (err, result) => {
    if (err) {
      console.error("❌ DB error updating wallet:", err);
      return res.status(500).json({ message: "Server error" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    res.json({ message: "✅ Wallet updated successfully" });
  });
});


// ===================== GET WALLET =====================
app.get("/wallets", (req, res) => {
  const user_id = Number(req.query.user_id);
  if (!user_id) return res.status(400).json({ message: "Missing user ID" });

  const sql = `
    SELECT w.wallet_id, w.wallet_name, w.wallet_type,
           COALESCE((
             SELECT SUM(b.total_income) 
             FROM budgets b 
             WHERE b.wallet_id = w.wallet_id
           ), 0) AS total_budget,
           COALESCE(SUM(i.amount), 0) AS total_income
    FROM wallets w
    LEFT JOIN income i ON w.wallet_id = i.wallet_id
    WHERE w.user_id = ?
    GROUP BY w.wallet_id, w.wallet_name, w.wallet_type
  `;

  db.query(sql, [user_id], (err, results) => {
    if (err) {
      console.error("DB error fetching wallets:", err);
      return res.status(500).json({ message: "Server error" });
    }

    const normalized = results.map(r => ({
      ...r,
      total_budget: r.total_budget || 0,
      total_income: r.total_income || 0,
    }));

    res.json(normalized);
  });
});

// ===================== GET CREDIT CARDS =====================
app.get("/credit-cards", (req, res) => {
  const user_id = Number(req.query.user_id);
  if (!user_id) return res.status(400).json({ message: "Missing user ID" });

  const sql = `
    SELECT credit_wallet_id, card_provider, card_number_last4, 
           billing_date, due_date, credit_limit 
    FROM credit_wallets WHERE user_id = ?`;

  db.query(sql, [user_id], (err, results) => {
    if (err) {
      console.error("DB error fetching credit cards:", err);
      return res.status(500).json({ message: "Server error" });
    }
    res.json(results);
  });
});

// ===================== GET WALLET DETAILS =====================
app.get("/wallet-details", (req, res) => {
    const { user_id, wallet_id } = req.query;
    
    if (!user_id || !wallet_id) {
        return res.status(400).json({ message: "Missing user_id or wallet_id" });
    }

    const sql = `
        SELECT 
            w.wallet_id, 
            w.wallet_name, 
            w.wallet_type,
            COALESCE(SUM(i.amount), 0) AS total_income,
            COALESCE(SUM(e.amount_spent), 0) AS total_expenses,
            COALESCE((
              SELECT SUM(b.total_income) 
              FROM budgets b 
              WHERE b.wallet_id = w.wallet_id
            ), 0) AS total_budget
        FROM wallets w
        LEFT JOIN income i ON w.wallet_id = i.wallet_id
        LEFT JOIN expenses e ON w.wallet_id = e.wallet_id
        WHERE w.user_id = ? AND w.wallet_id = ?
        GROUP BY w.wallet_id
    `;

    db.query(sql, [user_id, wallet_id], (err, results) => {
        if (err) {
            console.error("DB error fetching wallet details:", err);
            return res.status(500).json({ message: "Server error" });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ message: "Wallet not found" });
        }
        
        const wallet = results[0];
        const balance = parseFloat(wallet.total_income) - parseFloat(wallet.total_expenses);
        const remainingBudget = parseFloat(wallet.total_budget) - parseFloat(wallet.total_expenses);
        
        res.json({
            ...wallet,
            balance: balance,
            remaining_budget: Math.max(0, remainingBudget) // Don't show negative budget
        });
    });
});

// ================= GET WALLET EXPENSES =================
app.get("/wallet-expenses", (req, res) => {
  const { user_id, wallet_id } = req.query;

  if (!user_id || !wallet_id) {
    return res.status(400).json({ message: "Missing user_id or wallet_id" });
  }

  const sql = `
    SELECT e.expense_id, e.wallet_id, e.user_id, e.amount_spent, 
           e.notes, e.expense_date, c.category_name
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.category_id
    WHERE e.user_id = ? AND e.wallet_id = ?
    ORDER BY e.expense_date DESC
  `;

  db.query(sql, [user_id, wallet_id], (err, results) => {
    if (err) {
      console.error("DB error fetching expenses:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json(results);
  });
});

// ================= GET WALLET INCOME =================
app.get("/wallet-income", (req, res) => {
  const { user_id, wallet_id } = req.query;

  if (!user_id || !wallet_id) {
    return res.status(400).json({ message: "Missing user_id or wallet_id" });
  }

  const sql = `
    SELECT i.income_id, i.wallet_id, i.user_id, i.amount, 
           i.notes, i.income_date, c.category_name
    FROM income i
    LEFT JOIN categories c ON i.category_id = c.category_id
    WHERE i.user_id = ? AND i.wallet_id = ?
    ORDER BY i.income_date DESC
  `;

  db.query(sql, [user_id, wallet_id], (err, results) => {
    if (err) {
      console.error("DB error fetching income:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json(results);
  });
});

// ===================== GET WALLET BALANCE =====================

// get wallet's available balance (income - expenses - budgets)
app.get("/wallet-available-balance", (req, res) => {
  const { user_id, wallet_id } = req.query;

  if (!user_id || !wallet_id) {
    return res.status(400).json({ message: "Missing user_id or wallet_id" });
  }

  const sql = `
    SELECT 
      COALESCE(SUM(i.amount), 0) as total_income,
      COALESCE(SUM(e.amount_spent), 0) as total_expenses,
      COALESCE((
        SELECT SUM(b.total_income) 
        FROM budgets b 
        WHERE b.wallet_id = ? AND b.user_id = ?
      ), 0) as total_budgeted
    FROM income i
    LEFT JOIN expenses e ON i.wallet_id = e.wallet_id AND i.user_id = e.user_id
    WHERE i.user_id = ? AND i.wallet_id = ?
  `;

  db.query(sql, [wallet_id, user_id, user_id, wallet_id], (err, results) => {
    if (err) {
      console.error("❌ DB Error fetching available balance:", err);
      return res.status(500).json({ message: "Error fetching balance" });
    }

    const data = results[0];
    const available_balance = parseFloat(data.total_income) - parseFloat(data.total_budgeted);

    res.json({ 
      total_income: parseFloat(data.total_income),
      total_expenses: parseFloat(data.total_expenses),
      total_budgeted: parseFloat(data.total_budgeted),
      available_balance: available_balance
    });
  });
});


// III. EXPENSES MANAGEMENT 

// ===================== ADD EXPENSES =====================
app.post("/add-expense", (req, res) => {
  const {
    user_id,
    wallet_id,
    category_id,
    amount,
    notes,
    expense_date,
    is_recurring,
    recurring_frequency
  } = req.body;

  if (!user_id || !wallet_id || !category_id || !amount || !expense_date) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (parseFloat(amount) <= 0) {
    return res.status(400).json({ message: "Amount must be greater than 0" });
  }

  const verifyCategorySql = `
    SELECT * FROM categories 
    WHERE category_id = ? AND (user_id = ? OR user_id IS NULL) AND transaction_type = 'Expense'`;

  db.query(verifyCategorySql, [category_id, user_id], (err, categoryResults) => {
    if (err) {
      console.error("❌ DB error verifying category:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (categoryResults.length === 0) {
      return res.status(400).json({ message: "Invalid expense category selected" });
    }

    const insertExpenseSql = `
      INSERT INTO expenses (
        user_id, wallet_id, category_id, amount_spent, notes, expense_date, is_recurring, recurring_frequency
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      insertExpenseSql,
      [
        user_id,
        wallet_id,
        category_id,
        parseFloat(amount),
        notes || null,
        expense_date,
        is_recurring ? 1 : 0,
        is_recurring ? recurring_frequency : null
      ],
      (err2, result) => {
        if (err2) {
          console.error("❌ DB error adding expense:", err2);
          return res.status(500).json({ message: "Failed to add expense" });
        }

        const expenseId = result.insertId;

        // INSERT INTO TRANSACTIONS TABLE
        const insertTransactionSql = `
          INSERT INTO transactions (
            user_id, wallet_id, category_id, transaction_type, amount, 
            notes, transaction_date, is_recurring, recurring_frequency, 
            source_table, source_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(
          insertTransactionSql,
          [
            user_id,
            wallet_id,
            category_id,
            'Expense',
            parseFloat(amount),
            notes || null,
            expense_date,
            is_recurring ? 1 : 0,
            is_recurring ? recurring_frequency : null,
            'expenses',
            expenseId
          ],
          (err3, transactionResult) => {
            if (err3) {
              console.error("❌ DB error adding expense to transactions:", err3);
              return res.status(500).json({ 
                message: "Expense added but failed to log in transactions",
                expense_id: expenseId 
              });
            }

            res.json({
              message: "✅ Expense added successfully",
              expense_id: expenseId,
              transaction_id: transactionResult.insertId
            });
          }
        );
      }
    );
  });
});

// IV. INCOME MANAGEMENT 

// ===================== ADD INCOME =====================
app.post("/add-income", (req, res) => {
    const { user_id, wallet_id, category_id, amount, notes, income_date } = req.body;
    
    if (!user_id || !wallet_id || !category_id || !amount || !income_date) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    const verifyCategorySql = `
      SELECT * FROM categories 
      WHERE category_id = ? AND (user_id = ? OR user_id IS NULL) AND transaction_type = 'Income'`;

    db.query(verifyCategorySql, [category_id, user_id], (err, categoryResults) => {
      if (err) {
        console.error("❌ DB error verifying category:", err);
        return res.status(500).json({ message: "Database error" });
      }

      if (categoryResults.length === 0) {
        return res.status(400).json({ message: "Invalid income category selected" });
      }

      const insertIncomeSql = `
          INSERT INTO income (user_id, wallet_id, category_id, amount, notes, income_date)
          VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      db.query(insertIncomeSql, [user_id, wallet_id, category_id, amount, notes, income_date], (err2, result) => {
          if (err2) {
              console.error("❌ DB error adding income:", err2);
              return res.status(500).json({ message: "Failed to add income" });
          }
          
          const incomeId = result.insertId;

          // INSERT INTO TRANSACTIONS TABLE
          const insertTransactionSql = `
            INSERT INTO transactions (
              user_id, wallet_id, category_id, transaction_type, amount, 
              notes, transaction_date, source_table, source_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          db.query(
            insertTransactionSql,
            [user_id, wallet_id, category_id, 'Income', parseFloat(amount), notes, income_date, 'income', incomeId],
            (err3, transactionResult) => {
              if (err3) {
                console.error("❌ DB error adding income to transactions:", err3);
                return res.status(500).json({ 
                  message: "Income added but failed to log in transactions",
                  income_id: incomeId 
                });
              }

              res.json({
                  message: "✅ Income added successfully",
                  income_id: incomeId,
                  transaction_id: transactionResult.insertId
              });
            }
          );
      });
    });
});

// V. TRANSACTION MANAGEMENT

// ===================== GET ALL TRANSACTIONS IN A WALLET  =====================
app.get("/wallet-transactions", (req, res) => {
  const { user_id, wallet_id, limit } = req.query;

  if (!user_id || !wallet_id) {
    return res.status(400).json({ message: "Missing user_id or wallet_id" });
  }

  let sql = `
    SELECT 
      t.transaction_id,
      t.transaction_type,
      t.amount,
      t.notes,
      t.transaction_date,
      t.is_recurring,
      t.recurring_frequency,
      c.category_name,
      c.category_type
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.category_id
    WHERE t.user_id = ? AND t.wallet_id = ?
    ORDER BY t.transaction_date DESC, t.transaction_id DESC
  `;

  const params = [user_id, wallet_id];

  if (limit) {
    sql += ` LIMIT ?`;
    params.push(parseInt(limit));
  }

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("❌ DB Error fetching wallet transactions:", err);
      return res.status(500).json({ message: "Error fetching transactions" });
    }

    res.json(results);
  });
});

// ===================== GET ALL TRANSACTIONS =====================
app.get("/transactions", (req, res) => {
  const { user_id, wallet_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ message: "User ID required" });
  }

  let sql = `
    SELECT 
      t.transaction_id,
      t.user_id,
      t.wallet_id,
      t.transaction_type,
      t.amount,
      t.notes,
      t.transaction_date,
      t.is_recurring,
      t.recurring_frequency,
      c.category_name,
      c.category_type,
      w.wallet_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.category_id
    LEFT JOIN wallets w ON t.wallet_id = w.wallet_id
    WHERE t.user_id = ?
  `;

  const params = [user_id];

  if (wallet_id) {
    sql += ` AND t.wallet_id = ?`;
    params.push(wallet_id);
  }

  sql += ` ORDER BY t.transaction_date DESC, t.transaction_id DESC`;

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("❌ DB Error fetching transactions:", err);
      return res.status(500).json({ message: "Error fetching transactions" });
    }

    res.json(results);
  });
});


// ===================== GET TRANSACTION DETAILS =====================
app.get("/transaction-details", (req, res) => {
  const { transaction_id } = req.query;

  if (!transaction_id) {
    return res.status(400).json({ message: "Transaction ID required" });
  }

  const sql = `
    SELECT 
      t.transaction_id,
      t.user_id,
      t.wallet_id,
      t.transaction_type,
      t.amount,
      t.notes,
      t.transaction_date,
      t.is_recurring,
      t.recurring_frequency,
      t.source_table,
      t.source_id,
      c.category_name,
      c.category_type
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.category_id
    WHERE t.transaction_id = ?
  `;

  db.query(sql, [transaction_id], (err, results) => {
    if (err) {
      console.error("❌ DB Error fetching transaction details:", err);
      return res.status(500).json({ message: "Error fetching transaction" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    res.json(results[0]);
  });
});

// ===================== UPDATE TRANSACTION =====================
app.put("/update-transaction", (req, res) => {
  const { transaction_id, amount, notes } = req.body;

  if (!transaction_id || !amount) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (parseFloat(amount) <= 0) {
    return res.status(400).json({ message: "Amount must be greater than 0" });
  }

  // First, get the transaction details to know which source table to update
  const getTransactionSql = `
    SELECT source_table, source_id, transaction_type 
    FROM transactions 
    WHERE transaction_id = ?
  `;

  db.query(getTransactionSql, [transaction_id], (err, results) => {
    if (err) {
      console.error("❌ DB error fetching transaction:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const { source_table, source_id, transaction_type } = results[0];

    // Update the transactions table
    const updateTransactionSql = `
      UPDATE transactions 
      SET amount = ?, notes = ?
      WHERE transaction_id = ?
    `;

    db.query(updateTransactionSql, [amount, notes, transaction_id], (err2) => {
      if (err2) {
        console.error("❌ DB error updating transaction:", err2);
        return res.status(500).json({ message: "Failed to update transaction" });
      }

      // Update the source table (income or expenses)
      let updateSourceSql;

      if (source_table === "income") {
        updateSourceSql = `
          UPDATE income 
          SET amount = ?, notes = ?
          WHERE income_id = ?
        `;
      } else if (source_table === "expenses") {
        updateSourceSql = `
          UPDATE expenses 
          SET amount_spent = ?, notes = ?
          WHERE expense_id = ?
        `;
      } else {
        return res.status(400).json({ message: "Invalid source table" });
      }

      db.query(updateSourceSql, [amount, notes, source_id], (err3) => {
        if (err3) {
          console.error("❌ DB error updating source table:", err3);
          return res.status(500).json({ 
            message: "Transaction updated but failed to update source" 
          });
        }

        res.json({ message: "✅ Transaction updated successfully" });
      });
    });
  });
});

// ===================== DELETE TRANSACTION =====================
app.delete("/delete-transaction", (req, res) => {
  const { transaction_id } = req.query;

  if (!transaction_id) {
    return res.status(400).json({ message: "Transaction ID required" });
  }

  // First, get the transaction details to know which source table to delete from
  const getTransactionSql = `
    SELECT source_table, source_id 
    FROM transactions 
    WHERE transaction_id = ?
  `;

  db.query(getTransactionSql, [transaction_id], (err, results) => {
    if (err) {
      console.error("❌ DB error fetching transaction:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const { source_table, source_id } = results[0];

    // Delete from transactions table
    const deleteTransactionSql = "DELETE FROM transactions WHERE transaction_id = ?";

    db.query(deleteTransactionSql, [transaction_id], (err2) => {
      if (err2) {
        console.error("❌ DB error deleting transaction:", err2);
        return res.status(500).json({ message: "Failed to delete transaction" });
      }

      // Delete from source table (income or expenses)
      let deleteSourceSql;

      if (source_table === "income") {
        deleteSourceSql = "DELETE FROM income WHERE income_id = ?";
      } else if (source_table === "expenses") {
        deleteSourceSql = "DELETE FROM expenses WHERE expense_id = ?";
      } else {
        return res.status(400).json({ message: "Invalid source table" });
      }

      db.query(deleteSourceSql, [source_id], (err3) => {
        if (err3) {
          console.error("❌ DB error deleting from source table:", err3);
          return res.status(500).json({ 
            message: "Transaction deleted but failed to delete source" 
          });
        }

        res.json({ message: "✅ Transaction deleted successfully" });
      });
    });
  });
});

// VI. CATEGORIES MANAGEMENT 

// ===================== GET CATEGORIES =====================
app.get("/categories", (req, res) => {
  const { user_id, transaction_type } = req.query;

  if (!user_id) {
    return res.status(400).json({ message: "User ID required" });
  }

  let sql = `
    SELECT category_id, category_name, category_type, transaction_type, is_default
    FROM categories 
    WHERE (user_id = ? OR user_id IS NULL)
  `;
  
  const params = [user_id];
  
  if (transaction_type) {
    sql += ` AND transaction_type = ?`;
    params.push(transaction_type);
  }
  
  sql += ` ORDER BY is_default DESC, category_name ASC`;

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("❌ DB Error fetching categories:", err);
      return res.status(500).json({ message: "Error fetching categories" });
    }

    res.json(results);
  });
});

// ===================== ADD CATEGORY =====================
app.post("/add-category", (req, res) => {
  const { user_id, category_name, category_type, transaction_type } = req.body;

  if (!user_id || !category_name || !transaction_type) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const validTransactionTypes = ["Expense", "Income"];
  if (!validTransactionTypes.includes(transaction_type)) {
    return res.status(400).json({ message: "Invalid transaction type" });
  }

  if (transaction_type === "Expense") {
    const validTypes = ["Need", "Want", "Savings"];
    if (!category_type || !validTypes.includes(category_type)) {
      return res.status(400).json({ message: "Invalid category type for expense" });
    }
  }

  const checkSql = `
    SELECT * FROM categories 
    WHERE (user_id = ? OR user_id IS NULL) 
    AND LOWER(category_name) = LOWER(?)
    AND transaction_type = ?
  `;

  db.query(checkSql, [user_id, category_name, transaction_type], (err, results) => {
    if (err) {
      console.error("❌ DB error checking duplicate category:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (results.length > 0) {
      return res.status(400).json({ message: "Category name already exists" });
    }

    const insertSql = `
      INSERT INTO categories (user_id, category_name, category_type, transaction_type, is_default)
      VALUES (?, ?, ?, ?, FALSE)
    `;

    db.query(
      insertSql, 
      [user_id, category_name, transaction_type === "Expense" ? category_type : null, transaction_type], 
      (err2, result) => {
        if (err2) {
          console.error("❌ Failed to add category:", err2);
          return res.status(500).json({ message: "Failed to add category" });
        }

        res.json({
          message: "✅ Category added successfully",
          category_id: result.insertId
        });
      }
    );
  });
});


// ===================== UPDATE CATEGORY =====================
app.put("/update-category", (req, res) => {
  const { category_id, category_name, category_type } = req.body;

  if (!category_id || !category_name) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  // First check if this is a default category
  const checkDefaultSql = "SELECT is_default FROM categories WHERE category_id = ?";
  
  db.query(checkDefaultSql, [category_id], (err, results) => {
    if (err) {
      console.error("❌ DB error checking category:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Category not found" });
    }

    if (results[0].is_default) {
      return res.status(400).json({ message: "Cannot edit default categories" });
    }

    // Check for duplicate name (excluding current category)
    const checkDuplicateSql = `
      SELECT * FROM categories 
      WHERE LOWER(category_name) = LOWER(?) 
      AND category_id != ?
    `;

    db.query(checkDuplicateSql, [category_name, category_id], (err2, duplicates) => {
      if (err2) {
        console.error("❌ DB error checking duplicate:", err2);
        return res.status(500).json({ message: "Database error" });
      }

      if (duplicates.length > 0) {
        return res.status(400).json({ message: "Category name already exists" });
      }

      // Update the category
      const updateSql = `
        UPDATE categories 
        SET category_name = ?, category_type = ?
        WHERE category_id = ?
      `;

      db.query(updateSql, [category_name, category_type, category_id], (err3, result) => {
        if (err3) {
          console.error("❌ DB error updating category:", err3);
          return res.status(500).json({ message: "Failed to update category" });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ message: "Category not found" });
        }

        res.json({ message: "✅ Category updated successfully" });
      });
    });
  });
});

// ===================== DELETE CATEGORY =====================
app.delete("/delete-category", (req, res) => {
  const { category_id } = req.query;

  if (!category_id) {
    return res.status(400).json({ message: "Category ID required" });
  }

  // First check if this is a default category
  const checkDefaultSql = "SELECT is_default FROM categories WHERE category_id = ?";
  
  db.query(checkDefaultSql, [category_id], (err, results) => {
    if (err) {
      console.error("❌ DB error checking category:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Category not found" });
    }

    if (results[0].is_default) {
      return res.status(400).json({ message: "Cannot delete default categories" });
    }

    // Check if category is in use
    const checkUsageSql = `
      SELECT COUNT(*) as count FROM transactions WHERE category_id = ?
    `;

    db.query(checkUsageSql, [category_id], (err2, usageResults) => {
      if (err2) {
        console.error("❌ DB error checking usage:", err2);
        return res.status(500).json({ message: "Database error" });
      }

      if (usageResults[0].count > 0) {
        return res.status(400).json({ 
          message: "Cannot delete category that is being used in transactions" 
        });
      }

      // Delete the category
      const deleteSql = "DELETE FROM categories WHERE category_id = ?";

      db.query(deleteSql, [category_id], (err3, result) => {
        if (err3) {
          console.error("❌ DB error deleting category:", err3);
          return res.status(500).json({ message: "Failed to delete category" });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ message: "Category not found" });
        }

        res.json({ message: "✅ Category deleted successfully" });
      });
    });
  });
});

// VII. BUDGET MANAGEMENT 

// Get budget rules
app.get("/budget-rules", (req, res) => {
  const rules = {
    "50-30-20": { needs: 50, wants: 30, savings: 20 },
    "70-20-10": { needs: 70, wants: 20, savings: 10 }
  };
  res.json(rules);
});

// Get categories by type
app.get("/categories-by-type", (req, res) => {
  const { user_id, category_type } = req.query;

  if (!user_id || !category_type) {
    return res.status(400).json({ message: "User ID and category type required" });
  }

  const validTypes = ["Need", "Want", "Savings"];
  if (!validTypes.includes(category_type)) {
    return res.status(400).json({ message: "Invalid category type" });
  }

  const sql = `
    SELECT category_id, category_name, category_type
    FROM categories 
    WHERE (user_id = ? OR user_id IS NULL)
    AND category_type = ?
    AND transaction_type = 'Expense'
    ORDER BY is_default DESC, category_name ASC
  `;

  db.query(sql, [user_id, category_type], (err, results) => {
    if (err) {
      console.error("❌ DB Error fetching categories by type:", err);
      return res.status(500).json({ message: "Error fetching categories" });
    }
    res.json(results);
  });
});

// ===================== ADD BUDGET =====================

app.post("/create-budget", (req, res) => {
  const { 
    user_id, 
    wallet_id, 
    budget_name,
    total_income, 
    budget_rule, 
    budget_period,
    allocations 
  } = req.body;

  if (!user_id || !wallet_id || !total_income || !budget_rule || !allocations) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (parseFloat(total_income) <= 0) {
    return res.status(400).json({ message: "Total income must be greater than 0" });
  }

  if (!Array.isArray(allocations) || allocations.length === 0) {
    return res.status(400).json({ message: "Invalid allocations format" });
  }

  const totalAllocated = allocations.reduce((sum, alloc) => sum + parseFloat(alloc.amount), 0);
  
  if (Math.abs(totalAllocated - parseFloat(total_income)) > 0.01) {
    return res.status(400).json({ 
      message: `Total allocated (${totalAllocated}) must equal total income (${total_income})` 
    });
  }

  db.beginTransaction((err) => {
    if (err) {
      console.error("❌ Transaction error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    const insertBudgetSql = `
      INSERT INTO budgets (user_id, wallet_id, budget_name, total_income, budget_rule, budget_period)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(
      insertBudgetSql,
      [user_id, wallet_id, budget_name || `${budget_rule} Budget`, total_income, budget_rule, budget_period || 'Monthly'],
      (err2, budgetResult) => {
        if (err2) {
          return db.rollback(() => {
            console.error("❌ Error creating budget:", err2);
            res.status(500).json({ message: "Failed to create budget" });
          });
        }

        const budgetId = budgetResult.insertId;
        const insertAllocationSql = `
          INSERT INTO budget_allocations (budget_id, category_id, allocated_amount, category_type)
          VALUES (?, ?, ?, ?)
        `;

        let completedAllocations = 0;
        let allocationError = false;

        allocations.forEach((allocation) => {
          db.query(
            insertAllocationSql,
            [budgetId, allocation.category_id, allocation.amount, allocation.category_type],
            (err3) => {
              if (err3 && !allocationError) {
                allocationError = true;
                return db.rollback(() => {
                  console.error("❌ Error creating allocation:", err3);
                  res.status(500).json({ message: "Failed to create budget allocations" });
                });
              }

              completedAllocations++;

              if (completedAllocations === allocations.length && !allocationError) {
                db.commit((err4) => {
                  if (err4) {
                    return db.rollback(() => {
                      console.error("❌ Commit error:", err4);
                      res.status(500).json({ message: "Failed to save budget" });
                    });
                  }

                  res.json({
                    message: "✅ Budget created successfully",
                    budget_id: budgetId
                  });
                });
              }
            }
          );
        });
      }
    );
  });
});

// ===================== GET WALLET BUDGETS =====================
app.get("/wallet-budgets", (req, res) => {
  const { user_id, wallet_id } = req.query;

  if (!user_id || !wallet_id) {
    return res.status(400).json({ message: "Missing user_id or wallet_id" });
  }

  const sql = `
    SELECT 
      b.budget_id,
      b.budget_name,
      b.total_income,
      b.budget_rule,
      b.budget_period,
      b.budget_created,
      COUNT(ba.allocation_id) as allocation_count,
      SUM(ba.allocated_amount) as total_allocated
    FROM budgets b
    LEFT JOIN budget_allocations ba ON b.budget_id = ba.budget_id
    WHERE b.user_id = ? AND b.wallet_id = ?
    GROUP BY b.budget_id
    ORDER BY b.budget_created DESC
  `;

  db.query(sql, [user_id, wallet_id], (err, results) => {
    if (err) {
      console.error("❌ DB Error fetching budgets:", err);
      return res.status(500).json({ message: "Error fetching budgets" });
    }
    res.json(results);
  });
});

// ===================== GET BUDGET DETAILS WITH ALLOCATION =====================

app.get("/budget-details", (req, res) => {
  const { budget_id } = req.query;

  if (!budget_id) {
    return res.status(400).json({ message: "Budget ID required" });
  }

  const budgetSql = `
    SELECT budget_id, user_id, wallet_id, budget_name, total_income, 
           budget_rule, budget_period, budget_created
    FROM budgets
    WHERE budget_id = ?
  `;

  const allocationsSql = `
    SELECT 
      ba.allocation_id,
      ba.category_id,
      ba.allocated_amount,
      ba.category_type,
      c.category_name,
      COALESCE(SUM(e.amount_spent), 0) as spent_amount
    FROM budget_allocations ba
    LEFT JOIN categories c ON ba.category_id = c.category_id
    LEFT JOIN expenses e ON ba.category_id = e.category_id 
      AND e.wallet_id = (SELECT wallet_id FROM budgets WHERE budget_id = ?)
    WHERE ba.budget_id = ?
    GROUP BY ba.allocation_id, ba.category_id, ba.allocated_amount, 
             ba.category_type, c.category_name
  `;

  db.query(budgetSql, [budget_id], (err, budgetResults) => {
    if (err) {
      console.error("❌ DB Error fetching budget:", err);
      return res.status(500).json({ message: "Error fetching budget" });
    }

    if (budgetResults.length === 0) {
      return res.status(404).json({ message: "Budget not found" });
    }

    const budget = budgetResults[0];

    db.query(allocationsSql, [budget_id, budget_id], (err2, allocationResults) => {
      if (err2) {
        console.error("❌ DB Error fetching allocations:", err2);
        return res.status(500).json({ message: "Error fetching allocations" });
      }

      res.json({
        ...budget,
        allocations: allocationResults
      });
    });
  });
});

// ===================== UPDATE BUDGET ALLOCATION =====================
app.put("/update-budget-allocation", (req, res) => {
  const { allocation_id, allocated_amount } = req.body;

  if (!allocation_id || !allocated_amount) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (parseFloat(allocated_amount) <= 0) {
    return res.status(400).json({ message: "Amount must be greater than 0" });
  }

  // First, get the budget_id and current allocation
  const getAllocationSql = `
    SELECT ba.budget_id, ba.allocated_amount, ba.category_type
    FROM budget_allocations ba
    WHERE ba.allocation_id = ?
  `;

  db.query(getAllocationSql, [allocation_id], (err, allocationResults) => {
    if (err) {
      console.error("❌ DB Error fetching allocation:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (allocationResults.length === 0) {
      return res.status(404).json({ message: "Allocation not found" });
    }

    const { budget_id, allocated_amount: oldAmount } = allocationResults[0];

    // Check if the new total allocations will exceed total income
    const checkTotalSql = `
      SELECT b.total_income,
             SUM(ba.allocated_amount) as current_total
      FROM budgets b
      LEFT JOIN budget_allocations ba ON b.budget_id = ba.budget_id
      WHERE b.budget_id = ?
      GROUP BY b.budget_id
    `;

    db.query(checkTotalSql, [budget_id], (err2, totalResults) => {
      if (err2) {
        console.error("❌ DB Error checking totals:", err2);
        return res.status(500).json({ message: "Database error" });
      }

      const { total_income, current_total } = totalResults[0];
      const amountDifference = parseFloat(allocated_amount) - parseFloat(oldAmount);
      const newTotal = parseFloat(current_total) + amountDifference;

      if (newTotal > parseFloat(total_income) + 0.01) { // Allow small floating point difference
        return res.status(400).json({ 
          message: `Total allocations (${newTotal.toFixed(2)}) would exceed total income (${total_income})`,
          available: parseFloat(total_income) - (parseFloat(current_total) - parseFloat(oldAmount))
        });
      }

      // Update the allocation
      const updateSql = `
        UPDATE budget_allocations 
        SET allocated_amount = ?
        WHERE allocation_id = ?
      `;

      db.query(updateSql, [allocated_amount, allocation_id], (err3, result) => {
        if (err3) {
          console.error("❌ DB Error updating allocation:", err3);
          return res.status(500).json({ message: "Failed to update allocation" });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ message: "Allocation not found" });
        }

        res.json({ 
          message: "✅ Budget allocation updated successfully",
          new_total: newTotal
        });
      });
    });
  });
});

// ===================== DELETE BUDGET =====================

app.delete("/delete-budget", (req, res) => {
  const { budget_id } = req.query;

  if (!budget_id) {
    return res.status(400).json({ message: "Budget ID required" });
  }

  const sql = "DELETE FROM budgets WHERE budget_id = ?";

  db.query(sql, [budget_id], (err, result) => {
    if (err) {
      console.error("❌ DB error deleting budget:", err);
      return res.status(500).json({ message: "Failed to delete budget" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Budget not found" });
    }

    res.json({ message: "✅ Budget deleted successfully" });
  });
});


// ===================== GET REALLOCATABLE CATEGORIES =====================
app.get("/reallocatable-categories", (req, res) => {
  const { budget_id, category_type, exclude_allocation_id, user_id } = req.query;

  if (!budget_id || !category_type || !exclude_allocation_id || !user_id) {
    return res.status(400).json({ 
      message: "Missing required parameters" 
    });
  }

  // Get all categories of this type for the user, and check if they're already in the budget
  const sql = `
    SELECT 
      c.category_id,
      c.category_name,
      c.category_type,
      ba.allocation_id,
      ba.allocated_amount,
      CASE WHEN ba.allocation_id IS NOT NULL THEN 1 ELSE 0 END as in_budget
    FROM categories c
    LEFT JOIN budget_allocations ba ON c.category_id = ba.category_id 
      AND ba.budget_id = ?
      AND ba.allocation_id != ?
    WHERE (c.user_id = ? OR c.user_id IS NULL)
    AND c.category_type = ?
    AND c.transaction_type = 'Expense'
    ORDER BY in_budget DESC, c.category_name ASC
  `;

  db.query(sql, [budget_id, exclude_allocation_id, user_id, category_type], (err, results) => {
    if (err) {
      console.error("❌ DB Error fetching reallocatable categories:", err);
      return res.status(500).json({ message: "Error fetching categories" });
    }
    res.json(results);
  });
});

// ===================== REALLOCATE BUDGET =====================
app.post("/reallocate-budget", (req, res) => {
  const { 
    budget_id,
    source_allocation_id, 
    target_category_id,
    target_allocation_id,
    new_source_amount, 
    excess_amount 
  } = req.body;

  if (!budget_id || !source_allocation_id || !target_category_id || !new_source_amount || !excess_amount) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (parseFloat(new_source_amount) <= 0 || parseFloat(excess_amount) <= 0) {
    return res.status(400).json({ message: "Amounts must be greater than 0" });
  }

  // Start transaction
  db.beginTransaction((err) => {
    if (err) {
      console.error("❌ Transaction error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    // Update source allocation (reduce amount)
    const updateSourceSql = `
      UPDATE budget_allocations 
      SET allocated_amount = ?
      WHERE allocation_id = ?
    `;

    db.query(updateSourceSql, [new_source_amount, source_allocation_id], (err1) => {
      if (err1) {
        return db.rollback(() => {
          console.error("❌ Error updating source allocation:", err1);
          res.status(500).json({ message: "Failed to update source allocation" });
        });
      }

      // Check if target category already has an allocation in this budget
      if (target_allocation_id) {
        // Update existing allocation
        const getTargetSql = "SELECT allocated_amount FROM budget_allocations WHERE allocation_id = ?";
        
        db.query(getTargetSql, [target_allocation_id], (err2, targetResults) => {
          if (err2) {
            return db.rollback(() => {
              console.error("❌ Error fetching target allocation:", err2);
              res.status(500).json({ message: "Failed to fetch target allocation" });
            });
          }

          if (targetResults.length === 0) {
            return db.rollback(() => {
              res.status(404).json({ message: "Target allocation not found" });
            });
          }

          const currentTargetAmount = parseFloat(targetResults[0].allocated_amount);
          const newTargetAmount = currentTargetAmount + parseFloat(excess_amount);

          const updateTargetSql = `
            UPDATE budget_allocations 
            SET allocated_amount = ?
            WHERE allocation_id = ?
          `;

          db.query(updateTargetSql, [newTargetAmount, target_allocation_id], (err3) => {
            if (err3) {
              return db.rollback(() => {
                console.error("❌ Error updating target allocation:", err3);
                res.status(500).json({ message: "Failed to update target allocation" });
              });
            }

            // Commit transaction
            db.commit((err4) => {
              if (err4) {
                return db.rollback(() => {
                  console.error("❌ Commit error:", err4);
                  res.status(500).json({ message: "Failed to save reallocation" });
                });
              }

              res.json({
                message: "✅ Budget reallocated successfully",
                new_source_amount: parseFloat(new_source_amount),
                new_target_amount: newTargetAmount
              });
            });
          });
        });
      } else {
        // Create new allocation for this category
        const getCategoryTypeSql = "SELECT category_type FROM categories WHERE category_id = ?";
        
        db.query(getCategoryTypeSql, [target_category_id], (err2, categoryResults) => {
          if (err2) {
            return db.rollback(() => {
              console.error("❌ Error fetching category type:", err2);
              res.status(500).json({ message: "Failed to fetch category type" });
            });
          }

          if (categoryResults.length === 0) {
            return db.rollback(() => {
              res.status(404).json({ message: "Category not found" });
            });
          }

          const categoryType = categoryResults[0].category_type;

          const insertAllocationSql = `
            INSERT INTO budget_allocations (budget_id, category_id, allocated_amount, category_type)
            VALUES (?, ?, ?, ?)
          `;

          db.query(insertAllocationSql, [budget_id, target_category_id, excess_amount, categoryType], (err3) => {
            if (err3) {
              return db.rollback(() => {
                console.error("❌ Error creating new allocation:", err3);
                res.status(500).json({ message: "Failed to create new allocation" });
              });
            }

            // Commit transaction
            db.commit((err4) => {
              if (err4) {
                return db.rollback(() => {
                  console.error("❌ Commit error:", err4);
                  res.status(500).json({ message: "Failed to save reallocation" });
                });
              }

              res.json({
                message: "✅ Budget reallocated successfully (new category added)",
                new_source_amount: parseFloat(new_source_amount),
                new_target_amount: parseFloat(excess_amount)
              });
            });
          });
        });
      }
    });
  });
});


// ===================== START SERVER =====================
app.listen(5000, "0.0.0.0", () => {
  console.log("🚀 Server running on port 5000");
});

