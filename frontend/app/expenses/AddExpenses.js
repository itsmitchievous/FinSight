import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { API_BASE_URL } from "../config"; 

export default function AddExpenses() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const numericUserId = Number(userId);

  const [wallets, setWallets] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [isLoading, setIsLoading] = useState(false);

  const [isRecurring, setIsRecurring] = useState(false);
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState(null);

  // Budget tracking - now shows budget for selected wallet + category combination
  const [categoryBudgetInfo, setCategoryBudgetInfo] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);

  useEffect(() => {
    fetchWallets();
    fetchCategories();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCategories();
    }, [])
  );

  useEffect(() => {
    if (selectedWallet) {
      fetchWalletBalance();
    }
  }, [selectedWallet]);

  // Fetch budget info when both wallet and category are selected
  useEffect(() => {
    if (selectedWallet && selectedCategory) {
      fetchCategoryBudgetInfo();
    } else {
      setCategoryBudgetInfo(null);
    }
  }, [selectedWallet, selectedCategory]);

  const fetchWallets = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/wallets?user_id=${numericUserId}`);
      const data = await response.json();
      if (response.ok) {
        setWallets(data);
      } else {
        Alert.alert("Error", "Failed to fetch wallets");
      }
    } catch (error) {
      console.error("Error fetching wallets:", error);
      Alert.alert("Error", "Network error. Please try again.");
    }
  };

  const fetchWalletBalance = async () => {
    if (!selectedWallet) return;
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/wallet-details?user_id=${numericUserId}&wallet_id=${selectedWallet.wallet_id}`
      );
      const data = await response.json();
      if (response.ok) {
        setWalletBalance(data.balance || 0);
      }
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/categories?user_id=${numericUserId}&transaction_type=Expense`
      );
      const data = await response.json();
      if (response.ok) {
        setCategories(data);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchCategoryBudgetInfo = async () => {
    if (!selectedWallet || !selectedCategory) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/category-budget-info?user_id=${numericUserId}&category_id=${selectedCategory.category_id}&wallet_id=${selectedWallet.wallet_id}`
      );
      const data = await response.json();

      if (response.ok && data && !Array.isArray(data)) {
        // Single object returned for specific wallet
        setCategoryBudgetInfo(data);
      } else if (response.ok && Array.isArray(data) && data.length > 0) {
        // Array returned, shouldn't happen with wallet_id specified but handle it
        setCategoryBudgetInfo(data[0]);
      } else {
        setCategoryBudgetInfo(null);
      }
    } catch (error) {
      console.error("Error fetching category budget info:", error);
      setCategoryBudgetInfo(null);
    }
  };

  const handleWalletSelect = (wallet) => {
    setSelectedWallet(wallet);
    setShowWalletDropdown(false);
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setShowCategoryDropdown(false);
  };

  const checkBudgetLimit = async () => {
    if (!selectedCategory || !amount || parseFloat(amount) <= 0) {
      return true;
    }

    if (!categoryBudgetInfo) {
      return true; // No budget set for this category/wallet combo
    }

    const expenseAmount = parseFloat(amount);
    const allocated = categoryBudgetInfo.allocated || 0;
    const spent = categoryBudgetInfo.spent || 0;
    const newTotal = spent + expenseAmount;
    const remaining = allocated - newTotal;

    if (newTotal > allocated) {
      return new Promise((resolve) => {
        Alert.alert(
          "Budget Exceeded",
          `This expense will exceed your budget for "${selectedCategory.category_name}" in ${selectedWallet.wallet_name}.\n\n` +
          `Budget: ₱${allocated.toFixed(2)}\n` +
          `Already Spent: ₱${spent.toFixed(2)}\n` +
          `This Expense: ₱${expenseAmount.toFixed(2)}\n` +
          `Over Budget By: ₱${Math.abs(remaining).toFixed(2)}\n\n` +
          `Continue?`,
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Continue", onPress: () => resolve(true) },
          ]
        );
      });
    }

    return true;
  };

  const handleSave = async () => {
    if (!selectedWallet) {
      Alert.alert("Error", "Please select a wallet");
      return;
    }
    if (!selectedCategory) {
      Alert.alert("Error", "Please select a category");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }
    if (isRecurring && !recurringFrequency) {
      Alert.alert("Error", "Please select a recurring frequency");
      return;
    }

    // Check if wallet has balance
    if (walletBalance === 0) {
      Alert.alert(
        "No Balance",
        "This wallet has zero balance. Please add income first.",
        [{ text: "OK" }]
      );
      return;
    }

    // Check if expense exceeds balance
    const newBalance = walletBalance - parseFloat(amount);
    if (newBalance < 0) {
      const shouldContinue = await new Promise((resolve) => {
        Alert.alert(
          "Warning: Negative Balance",
          `This expense will result in a negative balance of ₱${newBalance.toFixed(2)}.\n\n` +
          `Current Balance: ₱${walletBalance.toFixed(2)}\n` +
          `Expense Amount: ₱${parseFloat(amount).toFixed(2)}\n\n` +
          `Continue?`,
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Continue", onPress: () => resolve(true) },
          ]
        );
      });
      
      if (!shouldContinue) return;
    }

    // Check budget
    const budgetCheckPassed = await checkBudgetLimit();
    if (!budgetCheckPassed) return;

    await saveExpense();
  };

  const saveExpense = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/add-expense`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: numericUserId,
          wallet_id: selectedWallet.wallet_id,
          category_id: selectedCategory.category_id,
          amount: parseFloat(amount),
          notes: notes.trim(),
          expense_date: expenseDate,
          is_recurring: isRecurring,
          recurring_frequency: isRecurring ? recurringFrequency : null,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert("Success", "Expense added successfully!", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("Error", data.message || "Failed to add expense");
      }
    } catch (error) {
      console.error("Error adding expense:", error);
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>ADD EXPENSE</Text>

        <View style={styles.formCard}>
          {/* Wallet Selection */}
          <Text style={styles.label}>Select Wallet *</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowWalletDropdown(!showWalletDropdown)}
          >
            <Text style={[styles.dropdownText, !selectedWallet && styles.placeholder]}>
              {selectedWallet ? selectedWallet.wallet_name : "Select a wallet"}
            </Text>
            <Text style={styles.dropdownArrow}>{showWalletDropdown ? "▲" : "▼"}</Text>
          </TouchableOpacity>

          {showWalletDropdown && (
            <View style={styles.dropdownList}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 150 }}>
                {wallets.map((wallet) => (
                  <TouchableOpacity
                    key={wallet.wallet_id}
                    style={[
                      styles.dropdownItem,
                      selectedWallet?.wallet_id === wallet.wallet_id && styles.selectedItem,
                    ]}
                    onPress={() => handleWalletSelect(wallet)}
                  >
                    <Text style={styles.walletName}>{wallet.wallet_name}</Text>
                    <Text style={styles.walletType}>({wallet.wallet_type})</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Show wallet balance */}
          {selectedWallet && walletBalance !== null && (
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Available Balance:</Text>
              <Text style={[
                styles.balanceAmount,
                walletBalance === 0 && styles.zeroBalance
              ]}>
                ₱{walletBalance.toFixed(2)}
              </Text>
            </View>
          )}

          {/* Category Dropdown */}
          <Text style={styles.label}>Category *</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
          >
            <Text style={[styles.dropdownText, !selectedCategory && styles.placeholder]}>
              {selectedCategory ? selectedCategory.category_name : "Select a category"}
            </Text>
            <Text style={styles.dropdownArrow}>{showCategoryDropdown ? "▲" : "▼"}</Text>
          </TouchableOpacity>

          {showCategoryDropdown && (
            <View style={styles.dropdownList}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.category_id}
                    style={[
                      styles.dropdownItem,
                      selectedCategory?.category_id === category.category_id && styles.selectedItem,
                    ]}
                    onPress={() => handleCategorySelect(category)}
                  >
                    <View style={styles.categoryInfo}>
                      <Text style={styles.categoryName}>{category.category_name}</Text>
                      <Text style={styles.categoryType}>({category.category_type})</Text>
                    </View>
                  </TouchableOpacity>
                ))}

                {/* Add Category Option */}
                <TouchableOpacity
                  style={[styles.dropdownItem, styles.addCategoryItem]}
                  onPress={() => {
                    setShowCategoryDropdown(false);
                    router.push(`/categories/AddCategory?userId=${numericUserId}&transactionType=Expense`);
                  }}
                >
                  <Text style={styles.addCategoryBtnText}>
                    + Add New Category
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {/* Budget info for selected wallet + category */}
          {selectedWallet && selectedCategory && categoryBudgetInfo && (
            <View style={styles.budgetInfoCard}>
              <Text style={styles.budgetInfoTitle}>
                Category Budget ({selectedWallet.wallet_name})
              </Text>
              <View style={styles.budgetInfoRow}>
                <Text style={styles.budgetInfoLabel}>Allocated:</Text>
                <Text style={styles.budgetInfoValue}>
                  ₱{(categoryBudgetInfo.allocated || 0).toFixed(2)}
                </Text>
              </View>
              <View style={styles.budgetInfoRow}>
                <Text style={styles.budgetInfoLabel}>Spent:</Text>
                <Text style={styles.budgetInfoValue}>
                  ₱{(categoryBudgetInfo.spent || 0).toFixed(2)}
                </Text>
              </View>
              <View style={styles.budgetInfoRow}>
                <Text style={styles.budgetInfoLabel}>Remaining:</Text>
                <Text style={[
                  styles.budgetInfoValue,
                  styles.budgetInfoRemaining,
                  (categoryBudgetInfo.remaining || 0) < 0 && styles.budgetOverLimit
                ]}>
                  ₱{(categoryBudgetInfo.remaining || 0).toFixed(2)}
                </Text>
              </View>
            </View>
          )}

          {/* Show message if no budget set for this combo */}
          {selectedWallet && selectedCategory && !categoryBudgetInfo && (
            <View style={styles.noBudgetCard}>
              <Text style={styles.noBudgetText}>
                No budget set for "{selectedCategory.category_name}" in {selectedWallet.wallet_name}
              </Text>
            </View>
          )}

          {/* Amount */}
          <Text style={styles.label}>Amount *</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />

          {/* Date */}
          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.input}
            value={expenseDate}
            onChangeText={setExpenseDate}
            placeholder="YYYY-MM-DD"
          />

          {/* Notes */}
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Additional notes..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          {/* Recurring */}
          <Text style={styles.label}>Recurring Bill?</Text>
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleBtn, isRecurring && styles.toggleActive]}
              onPress={() => setIsRecurring(true)}
            >
              <Text style={styles.toggleText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, !isRecurring && styles.toggleActive]}
              onPress={() => setIsRecurring(false)}
            >
              <Text style={styles.toggleText}>No</Text>
            </TouchableOpacity>
          </View>

          {isRecurring && (
            <>
              <Text style={styles.label}>Recurring Frequency *</Text>
              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setShowFrequencyDropdown(!showFrequencyDropdown)}
              >
                <Text style={[styles.dropdownText, !recurringFrequency && styles.placeholder]}>
                  {recurringFrequency || "Select frequency"}
                </Text>
                <Text style={styles.dropdownArrow}>{showFrequencyDropdown ? "▲" : "▼"}</Text>
              </TouchableOpacity>

              {showFrequencyDropdown && (
                <View style={styles.dropdownList}>
                  {["Weekly", "Monthly", "Yearly"].map((freq) => (
                    <TouchableOpacity
                      key={freq}
                      style={[
                        styles.dropdownItem,
                        recurringFrequency === freq && styles.selectedItem,
                      ]}
                      onPress={() => {
                        setRecurringFrequency(freq);
                        setShowFrequencyDropdown(false);
                      }}
                    >
                      <Text style={styles.categoryName}>{freq}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.disabledButton]}
          onPress={handleSave}
          disabled={isLoading}
        >
          <Text style={styles.saveButtonText}>
            {isLoading ? "Adding..." : "Add Expense"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={isLoading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5", padding: 20 },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#E63946",
    marginBottom: 25,
    textAlign: "center",
  },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 25,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 5,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: "#555",
    marginBottom: 8,
    fontWeight: "600",
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingVertical: 10,
    marginBottom: 20,
    fontSize: 16,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  dropdownText: { fontSize: 16, color: "#333", flex: 1 },
  placeholder: { color: "#999" },
  dropdownArrow: { fontSize: 14, color: "#666", marginLeft: 10 },
  dropdownList: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: "#fff",
    marginBottom: 20,
  },
  dropdownItem: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  selectedItem: { backgroundColor: "#fff5f5" },
  walletName: { fontSize: 16, color: "#333", fontWeight: "600" },
  walletType: { fontSize: 12, color: "#666", marginTop: 2 },
  categoryInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryName: { fontSize: 16, color: "#333", flex: 1 },
  categoryType: { fontSize: 12, color: "#666", marginLeft: 8 },
  balanceCard: {
    backgroundColor: "#f0f9ff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balanceLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },
  balanceAmount: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#00B14F",
  },
  zeroBalance: {
    color: "#E63946",
  },
  budgetInfoCard: {
    backgroundColor: "#f0f9ff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: "#00B14F",
  },
  budgetInfoTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  budgetInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  budgetInfoLabel: {
    fontSize: 13,
    color: "#666",
  },
  budgetInfoValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  budgetInfoRemaining: {
    color: "#00B14F",
  },
  budgetOverLimit: {
    color: "#E63946",
  },
  noBudgetCard: {
    backgroundColor: "#fff9e6",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: "#ffc107",
  },
  noBudgetText: {
    fontSize: 13,
    color: "#666",
    fontStyle: "italic",
  },
  addCategoryItem: { backgroundColor: "#f9f9f9" },
  addCategoryBtnText: { fontSize: 16, color: "#E63946", fontWeight: "600" },
  notesInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    height: 80,
    textAlignVertical: "top",
  },
  toggleContainer: {
    flexDirection: "row",
    marginBottom: 20,
    justifyContent: "space-between",
  },
  toggleBtn: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
    marginHorizontal: 5,
    borderRadius: 8,
  },
  toggleActive: { backgroundColor: "#e6f7ff", borderColor: "#007bff" },
  toggleText: { fontSize: 16, fontWeight: "600" },
  saveButton: {
    backgroundColor: "#E63946",
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    shadowColor: "#E63946",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 10,
  },
  disabledButton: { backgroundColor: "#ccc", shadowOpacity: 0 },
  saveButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  cancelButton: {
    backgroundColor: "#fff",
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ccc",
  },
  cancelButtonText: { color: "#666", fontSize: 16, fontWeight: "600" },
});