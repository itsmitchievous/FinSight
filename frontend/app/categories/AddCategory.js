import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { API_BASE_URL } from "../config"; 


export default function AddCategory() {
  const router = useRouter();
  const { userId, transactionType } = useLocalSearchParams();
  const numericUserId = Number(userId);
  const categoryTransactionType = transactionType || "Expense";

  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState("Need");
  const [isLoading, setIsLoading] = useState(false);

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      Alert.alert("Error", "Please enter category name");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/add-category`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: numericUserId,
          category_name: categoryName.trim(),
          category_type: categoryTransactionType === "Expense" ? categoryType : null,
          transaction_type: categoryTransactionType
        })
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          "Success",
          "Category added successfully!",
          [
            {
              text: "OK",
              onPress: () => router.back()
            }
          ]
        );
      } else {
        Alert.alert("Error", data.message || "Failed to add category");
      }
    } catch (error) {
      console.error("Error adding category:", error);
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ADD CATEGORY</Text>
        <Text style={styles.subtitle}>
          Create a new {categoryTransactionType.toLowerCase()} category
        </Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>Category Name *</Text>
        <TextInput
          style={styles.input}
          placeholder={
            categoryTransactionType === "Income" 
              ? "e.g., Salary, Freelance, Business" 
              : "e.g., Entertainment, Utilities, Gym"
          }
          value={categoryName}
          onChangeText={setCategoryName}
          maxLength={50}
        />

        {categoryTransactionType === "Expense" && (
          <>
            <Text style={styles.label}>Category Type *</Text>
            <Text style={styles.typeDescription}>
              Choose the type that best describes this category
            </Text>
            
            <View style={styles.typeSelector}>
              {[
                { type: "Need", description: "Essential expenses" },
                { type: "Want", description: "Non-essential expenses" },
                { type: "Savings", description: "Money set aside" }
              ].map((item) => (
                <TouchableOpacity
                  key={item.type}
                  style={[
                    styles.typeButton,
                    categoryType === item.type && styles.selectedType
                  ]}
                  onPress={() => setCategoryType(item.type)}
                >
                  <Text style={[
                    styles.typeText,
                    categoryType === item.type && styles.selectedTypeText
                  ]}>
                    {item.type}
                  </Text>
                  <Text style={[
                    styles.typeDesc,
                    categoryType === item.type && styles.selectedTypeDesc
                  ]}>
                    {item.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity 
          style={[styles.saveButton, isLoading && styles.disabledButton]} 
          onPress={handleSaveCategory}
          disabled={isLoading}
        >
          <Text style={styles.saveButtonText}>
            {isLoading ? "Adding..." : "Add Category"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={isLoading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#007BFF",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
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
  },
  label: {
    fontSize: 16,
    color: "#333",
    marginBottom: 8,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: "#fafafa",
  },
  typeDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 15,
  },
  typeSelector: {
    marginBottom: 30,
  },
  typeButton: {
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  selectedType: {
    borderColor: "#007BFF", 
    backgroundColor: "#f0f8ff",
  },
  typeText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  selectedTypeText: {
    color: "#007BFF", 
  },
  typeDesc: {
    fontSize: 14,
    color: "#666",
  },
  selectedTypeDesc: {
    color: "#007BFF", 
  },
  saveButton: {
    backgroundColor: "#007BFF", 
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#007BFF", 
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 15,
  },
  disabledButton: {
    backgroundColor: "#ccc",
    shadowOpacity: 0,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  cancelButton: {
    backgroundColor: "#fff",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ddd",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
});
