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


export default function EditExpense() {
  const router = useRouter();
  const { userId, walletId, expenseId } = useLocalSearchParams();
  const numericUserId = Number(userId);
  const numericWalletId = Number(walletId);
  const numericExpenseId = Number(expenseId);

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isRecurring, setIsRecurring] = useState(false);
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState(null);

  useEffect(() => {
    fetchCategories();
    fetchExpenseDetails();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCategories();
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

  const fetchExpenseDetails = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/wallet-expenses?user_id=${numericUserId}&wallet_id=${numericWalletId}`
      );
      const data = await response.json();
      
      if (response.ok) {
        const expense = data.find(exp => exp.expense_id === numericExpenseId);
        if (expense) {
          setAmount(expense.amount_spent.toString());
          setNotes(expense.notes || "");
          setExpenseDate(expense.expense_date.split('T')[0]);
          setIsRecurring(expense.is_recurring || false);
          setRecurringFrequency(expense.recurring_frequency || null);
          
          // Set category after categories are loaded
          setTimeout(() => {
            const category = categories.find(cat => cat.category_id === expense.category_id);
            if (category) {
              setSelectedCategory(category);
            }
          }, 100);
        } else {
          Alert.alert("Error", "Expense not found");
          router.back();
        }
      }
    } catch (error) {
      console.error("Error fetching expense details:", error);
      Alert.alert("Error", "Failed to load expense details");
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

  const handleUpdate = async () => {
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

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/edit-expense`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expense_id: numericExpenseId,
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
        Alert.alert("Success", "Expense updated successfully!", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("Error", data.message || "Failed to update expense");
      }
    } catch (error) {
      console.error("Error updating expense:", error);
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      "Delete Expense",
      "Are you sure you want to delete this expense? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              const response = await fetch(
                `${API_BASE_URL}/delete-expense?expense_id=${numericExpenseId}&user_id=${numericUserId}`,
                { method: "DELETE" }
              );

              const data = await response.json();
              if (response.ok) {
                Alert.alert("Success", "Expense deleted successfully", [
                  { text: "OK", onPress: () => router.back() },
                ]);
              } else {
                Alert.alert("Error", data.message || "Failed to delete expense");
              }
            } catch (error) {
              console.error("Error deleting expense:", error);
              Alert.alert("Error", "Network error. Please try again.");
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>EDIT EXPENSE</Text>

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
          onPress={handleUpdate}
          disabled={isLoading || isDeleting}
        >
          <Text style={styles.saveButtonText}>
            {isLoading ? "Updating..." : "Update Expense"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.deleteButton, isDeleting && styles.disabledButton]}
          onPress={handleDelete}
          disabled={isLoading || isDeleting}
        >
          <Text style={styles.deleteButtonText}>
            {isDeleting ? "Deleting..." : "Delete Expense"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={isLoading || isDeleting}
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
  categoryInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryName: { fontSize: 16, color: "#333", flex: 1 },
  categoryType: { fontSize: 12, color: "#666", marginLeft: 8 },
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
  deleteButton: {
    backgroundColor: "#FF6B6B",
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    shadowColor: "#FF6B6B",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 10,
  },
  disabledButton: { backgroundColor: "#ccc", shadowOpacity: 0 },
  saveButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  deleteButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
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