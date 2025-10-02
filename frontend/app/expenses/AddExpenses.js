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


export default function AddExpense() {
  const router = useRouter();
  const { userId, walletId } = useLocalSearchParams();
  const numericUserId = Number(userId);
  const numericWalletId = Number(walletId);

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isLoading, setIsLoading] = useState(false);

  const [isRecurring, setIsRecurring] = useState(false);
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState(null);

  // Budget tracking state
  const [categoryBudgets, setCategoryBudgets] = useState({});

  useEffect(() => {
    fetchCategories();
    fetchCategoryBudgets();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCategories();
      fetchCategoryBudgets();
    }, [])
  );

  const fetchCategories = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/categories?user_id=${numericUserId}&transaction_type=Expense`
      );
      const data = await response.json();
      if (response.ok) {
        setCategories(data);
      } else {
        Alert.alert("Error", "Failed to fetch categories");
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      Alert.alert("Error", "Network error. Please try again.");
    }
  };

  const fetchCategoryBudgets = async () => {
    try {
      // Get all budgets for this wallet
      const budgetsResponse = await fetch(
        `${API_BASE_URL}/wallet-budgets?user_id=${numericUserId}&wallet_id=${numericWalletId}`
      );
      const budgetsData = await budgetsResponse.json();

      if (budgetsResponse.ok && budgetsData.length > 0) {
        // For each budget, get the detailed allocations
        const budgetMap = {};
        
        for (const budget of budgetsData) {
          const detailsResponse = await fetch(
            `${API_BASE_URL}/budget-details?budget_id=${budget.budget_id}`
          );
          const detailsData = await detailsResponse.json();

          if (detailsResponse.ok && detailsData.allocations) {
            detailsData.allocations.forEach(allocation => {
              const categoryId = allocation.category_id;
              const allocated = parseFloat(allocation.allocated_amount);
              const spent = parseFloat(allocation.spent_amount);

              // Store or update budget info for this category
              if (!budgetMap[categoryId]) {
                budgetMap[categoryId] = {
                  allocated: allocated,
                  spent: spent,
                  remaining: allocated - spent
                };
              } else {
                // If multiple budgets exist, sum them up
                budgetMap[categoryId].allocated += allocated;
                budgetMap[categoryId].spent += spent;
                budgetMap[categoryId].remaining = budgetMap[categoryId].allocated - budgetMap[categoryId].spent;
              }
            });
          }
        }

        setCategoryBudgets(budgetMap);
      }
    } catch (error) {
      console.error("Error fetching category budgets:", error);
    }
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setShowDropdown(false);
  };

  const handleAddNewCategory = () => {
    setShowDropdown(false);
    router.push(`/categories/AddCategory?userId=${numericUserId}&transactionType=Expense`);
  };

  const checkBudgetLimit = async () => {
    if (!selectedCategory || !amount || parseFloat(amount) <= 0) {
      return true; // Allow to proceed to basic validation
    }

    const categoryId = selectedCategory.category_id;
    const expenseAmount = parseFloat(amount);

    // Check if this category has a budget
    if (categoryBudgets[categoryId]) {
      const budget = categoryBudgets[categoryId];
      const newTotal = budget.spent + expenseAmount;
      const remaining = budget.allocated - newTotal;

      if (newTotal > budget.allocated) {
        return new Promise((resolve) => {
          Alert.alert(
            "Budget Exceeded",
            `This expense will exceed your budget for "${selectedCategory.category_name}".\n\n` +
            `Budget: ₱${budget.allocated.toFixed(2)}\n` +
            `Already Spent: ₱${budget.spent.toFixed(2)}\n` +
            `This Expense: ₱${expenseAmount.toFixed(2)}\n` +
            `New Total: ₱${newTotal.toFixed(2)}\n\n` +
            `Over Budget By: ₱${Math.abs(remaining).toFixed(2)}\n\n` +
            `Do you want to continue?`,
            [
              {
                text: "Cancel",
                style: "cancel",
                onPress: () => resolve(false),
              },
              {
                text: "Continue Anyway",
                onPress: () => resolve(true),
              },
            ]
          );
        });
      } else if (remaining < budget.allocated * 0.2) {
        // Warn if spending will leave less than 20% of budget
        return new Promise((resolve) => {
          Alert.alert(
            "Budget Warning",
            `This expense will use most of your budget for "${selectedCategory.category_name}".\n\n` +
            `Budget: ₱${budget.allocated.toFixed(2)}\n` +
            `Already Spent: ₱${budget.spent.toFixed(2)}\n` +
            `This Expense: ₱${expenseAmount.toFixed(2)}\n` +
            `Remaining After: ₱${remaining.toFixed(2)}\n\n` +
            `Continue?`,
            [
              {
                text: "Cancel",
                style: "cancel",
                onPress: () => resolve(false),
              },
              {
                text: "Continue",
                onPress: () => resolve(true),
              },
            ]
          );
        });
      }
    }

    return true;
  };

  const handleSave = async () => {
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

    // Check budget first
    const budgetCheckPassed = await checkBudgetLimit();
    if (!budgetCheckPassed) {
      return;
    }

    // Check if expense will result in negative balance
    try {
      const walletResponse = await fetch(
        `${API_BASE_URL}/wallet-details?user_id=${numericUserId}&wallet_id=${numericWalletId}`
      );
      const walletData = await walletResponse.json();
      
      if (walletResponse.ok) {
        const currentBalance = walletData.balance || 0;
        const newBalance = currentBalance - parseFloat(amount);
        
        if (newBalance < 0) {
          const shouldContinue = await new Promise((resolve) => {
            Alert.alert(
              "Warning: Negative Balance",
              `This expense will result in a negative balance of ₱${newBalance.toFixed(2)}. Do you want to continue?`,
              [
                {
                  text: "Cancel",
                  style: "cancel",
                  onPress: () => resolve(false),
                },
                {
                  text: "Continue",
                  onPress: () => resolve(true),
                },
              ]
            );
          });
          
          if (!shouldContinue) {
            return;
          }
        }
      }
    } catch (error) {
      console.error("Error checking balance:", error);
    }

    // If all checks pass, proceed with saving
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
          wallet_id: numericWalletId,
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
          {/* Category Dropdown */}
          <Text style={styles.label}>Category *</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowDropdown(!showDropdown)}
          >
            <Text
              style={[
                styles.dropdownText,
                !selectedCategory && styles.placeholder,
              ]}
            >
              {selectedCategory
                ? selectedCategory.category_name
                : "Select a category"}
            </Text>
            <Text style={styles.dropdownArrow}>
              {showDropdown ? "▲" : "▼"}
            </Text>
          </TouchableOpacity>

          {showDropdown && (
            <View style={styles.dropdownList}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.category_id}
                    style={[
                      styles.dropdownItem,
                      selectedCategory?.category_id === category.category_id &&
                        styles.selectedItem,
                    ]}
                    onPress={() => handleCategorySelect(category)}
                  >
                    <View style={styles.categoryInfo}>
                      <Text style={styles.categoryName}>
                        {category.category_name}
                      </Text>
                      <Text style={styles.categoryType}>
                        ({category.category_type})
                      </Text>
                    </View>
                    {categoryBudgets[category.category_id] && (
                      <Text style={styles.budgetIndicator}>
                        Budget: ₱{categoryBudgets[category.category_id].remaining.toFixed(2)} left
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}

                {/* Add Category Option */}
                <TouchableOpacity
                  style={[styles.dropdownItem, styles.addCategoryItem]}
                  onPress={handleAddNewCategory}
                >
                  <Text style={styles.addCategoryBtnText}>
                    + Add New Category
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {/* Show budget info for selected category */}
          {selectedCategory && categoryBudgets[selectedCategory.category_id] && (
            <View style={styles.budgetInfoCard}>
              <Text style={styles.budgetInfoTitle}>Category Budget</Text>
              <View style={styles.budgetInfoRow}>
                <Text style={styles.budgetInfoLabel}>Allocated:</Text>
                <Text style={styles.budgetInfoValue}>
                  ₱{categoryBudgets[selectedCategory.category_id].allocated.toFixed(2)}
                </Text>
              </View>
              <View style={styles.budgetInfoRow}>
                <Text style={styles.budgetInfoLabel}>Spent:</Text>
                <Text style={styles.budgetInfoValue}>
                  ₱{categoryBudgets[selectedCategory.category_id].spent.toFixed(2)}
                </Text>
              </View>
              <View style={styles.budgetInfoRow}>
                <Text style={styles.budgetInfoLabel}>Remaining:</Text>
                <Text style={[
                  styles.budgetInfoValue,
                  styles.budgetInfoRemaining
                ]}>
                  ₱{categoryBudgets[selectedCategory.category_id].remaining.toFixed(2)}
                </Text>
              </View>
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
                onPress={() =>
                  setShowFrequencyDropdown(!showFrequencyDropdown)
                }
              >
                <Text
                  style={[
                    styles.dropdownText,
                    !recurringFrequency && styles.placeholder,
                  ]}
                >
                  {recurringFrequency || "Select frequency"}
                </Text>
                <Text style={styles.dropdownArrow}>
                  {showFrequencyDropdown ? "▲" : "▼"}
                </Text>
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

  // Dropdown
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
  categoryInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryName: { fontSize: 16, color: "#333", flex: 1 },
  categoryType: { fontSize: 12, color: "#666", marginLeft: 8 },
  budgetIndicator: {
    fontSize: 12,
    color: "#00B14F",
    marginTop: 4,
    fontWeight: "600",
  },
  addCategoryItem: { backgroundColor: "#f9f9f9" },
  addCategoryBtnText: { fontSize: 16, color: "#E63946", fontWeight: "600" },

  // Budget Info Card
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

  notesInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    height: 80,
    textAlignVertical: "top",
  },

  // Recurring
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

  // Buttons
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