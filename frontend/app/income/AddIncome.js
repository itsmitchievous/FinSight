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


export default function AddIncome() {
  const router = useRouter();
  const { userId, walletId } = useLocalSearchParams();
  const numericUserId = Number(userId);
  const numericWalletId = Number(walletId);

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [incomeDate, setIncomeDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCategories();
    }, [])
  );

  const fetchCategories = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/categories?user_id=${numericUserId}&transaction_type=Income`
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

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setShowDropdown(false);
  };

  const handleAddNewCategory = () => {
    setShowDropdown(false);
    router.push(`/categories/AddCategory?userId=${numericUserId}&transactionType=Income`);
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

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/add-income`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: numericUserId,
          wallet_id: numericWalletId,
          category_id: selectedCategory.category_id,
          amount: parseFloat(amount),
          notes: notes.trim(),
          income_date: incomeDate,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert("Success", "Income added successfully!", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("Error", data.message || "Failed to add income");
      }
    } catch (error) {
      console.error("Error adding income:", error);
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>ADD INCOME</Text>

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
                    <Text style={styles.categoryName}>
                      {category.category_name}
                    </Text>
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
            value={incomeDate}
            onChangeText={setIncomeDate}
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
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.disabledButton]}
          onPress={handleSave}
          disabled={isLoading}
        >
          <Text style={styles.saveButtonText}>
            {isLoading ? "Adding..." : "Add Income"}
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
    color: "#00B14F",
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
  selectedItem: { backgroundColor: "#f0fdf4" },
  categoryName: { fontSize: 16, color: "#333" },
  addCategoryItem: { backgroundColor: "#f9f9f9" },
  addCategoryBtnText: { fontSize: 16, color: "#00B14F", fontWeight: "600" },

  notesInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    height: 80,
    textAlignVertical: "top",
  },

  // Buttons
  saveButton: {
    backgroundColor: "#00B14F",
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    shadowColor: "#00B14F",
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