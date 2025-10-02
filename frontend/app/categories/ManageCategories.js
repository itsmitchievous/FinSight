import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput, Modal } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { API_BASE_URL } from "../config"; 

export default function ManageCategories() {
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState("Expense");
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editedName, setEditedName] = useState("");
  const [editedType, setEditedType] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);

  const router = useRouter();
  const { userId, walletId } = useLocalSearchParams();
  const numericUserId = Number(userId);

  useFocusEffect(
    useCallback(() => {
      fetchCategories();
    }, [numericUserId, activeTab])
  );

  const fetchCategories = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/categories?user_id=${numericUserId}&transaction_type=${activeTab}`
      );
      const data = await response.json();

      if (response.ok) {
        setCategories(data);
      } else {
        console.error("Failed to fetch categories:", data.message);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setEditedName(category.category_name);
    setEditedType(category.category_type || "Need");
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editedName.trim()) {
      Alert.alert("Error", "Category name cannot be empty");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/update-category`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: editingCategory.category_id,
          category_name: editedName.trim(),
          category_type: activeTab === "Expense" ? editedType : null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert("Success", "Category updated successfully");
        setShowEditModal(false);
        setEditingCategory(null);
        fetchCategories();
      } else {
        Alert.alert("Error", data.message || "Failed to update category");
      }
    } catch (error) {
      console.error("Error updating category:", error);
      Alert.alert("Error", "Failed to update category");
    }
  };

  const handleDeleteCategory = (category) => {
    if (category.is_default) {
      Alert.alert("Error", "Cannot delete default categories");
      return;
    }

    Alert.alert(
      "Delete Category",
      `Are you sure you want to delete "${category.category_name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(
                `${API_BASE_URL}/delete-category?category_id=${category.category_id}`,
                { method: "DELETE" }
              );
              const data = await response.json();

              if (response.ok) {
                Alert.alert("Success", "Category deleted successfully");
                fetchCategories();
              } else {
                Alert.alert("Error", data.message || "Failed to delete category");
              }
            } catch (error) {
              console.error("Error deleting category:", error);
              Alert.alert("Error", "Failed to delete category");
            }
          },
        },
      ]
    );
  };

  const defaultCategories = categories.filter(cat => cat.is_default);
  const customCategories = categories.filter(cat => !cat.is_default);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Manage Categories</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "Expense" && styles.activeTab]}
          onPress={() => setActiveTab("Expense")}
        >
          <Text style={[styles.tabText, activeTab === "Expense" && styles.activeTabText]}>
            Expenses
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "Income" && styles.activeTab]}
          onPress={() => setActiveTab("Income")}
        >
          <Text style={[styles.tabText, activeTab === "Income" && styles.activeTabText]}>
            Income
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView>
        {/* Add New Category Button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() =>
            router.push(
              `categories/AddCategory?userId=${numericUserId}&transactionType=${activeTab}`
            )
          }
        >
          <Text style={styles.addButtonText}>+ Add New {activeTab} Category</Text>
        </TouchableOpacity>

        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : (
          <>
            {/* Default Categories */}
            {defaultCategories.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Default Categories</Text>
                <Text style={styles.sectionSubtitle}>These categories cannot be edited or deleted</Text>
                {defaultCategories.map((category) => (
                  <View key={category.category_id} style={styles.categoryItem}>
                    <View style={styles.categoryInfo}>
                      <Text style={styles.categoryName}>{category.category_name}</Text>
                      {category.category_type && (
                        <Text style={styles.categoryType}>Type: {category.category_type}</Text>
                      )}
                    </View>
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Default</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Custom Categories */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Custom Categories</Text>
              {customCategories.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No custom categories yet</Text>
                  <Text style={styles.emptySubtext}>
                    Create your own categories to better organize your {activeTab.toLowerCase()}s
                  </Text>
                </View>
              ) : (
                customCategories.map((category) => (
                  <View key={category.category_id} style={styles.categoryItem}>
                    <View style={styles.categoryInfo}>
                      <Text style={styles.categoryName}>{category.category_name}</Text>
                      {category.category_type && (
                        <Text style={styles.categoryType}>Type: {category.category_type}</Text>
                      )}
                    </View>
                    <View style={styles.categoryActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleEditCategory(category)}
                      >
                        <Text style={styles.actionButtonText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.deleteActionButton]}
                        onPress={() => handleDeleteCategory(category)}
                      >
                        <Text style={styles.actionButtonText}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Category</Text>

            <Text style={styles.label}>Category Name</Text>
            <TextInput
              style={styles.input}
              value={editedName}
              onChangeText={setEditedName}
              placeholder="Category name"
            />

            {activeTab === "Expense" && (
              <>
                <Text style={styles.label}>Category Type</Text>
                <View style={styles.typeSelector}>
                  {["Need", "Want", "Savings"].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        editedType === type && styles.selectedTypeButton
                      ]}
                      onPress={() => setEditedType(type)}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          editedType === type && styles.selectedTypeButtonText
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveModalButton]}
                onPress={handleSaveEdit}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={() => {
                  setShowEditModal(false);
                  setEditingCategory(null);
                }}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: "#00B14F",
    fontWeight: "600",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  placeholder: {
    width: 50,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: "#00B14F",
  },
  tabText: {
    color: "#666",
    fontWeight: "600",
  },
  activeTabText: {
    color: "#fff",
  },
  addButton: {
    backgroundColor: "#00B14F",
    margin: 20,
    marginBottom: 10,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 15,
  },
  categoryItem: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  categoryType: {
    fontSize: 14,
    color: "#666",
  },
  categoryActions: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  deleteActionButton: {
    backgroundColor: "#FFE5E5",
  },
  actionButtonText: {
    fontSize: 16,
  },
  defaultBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  defaultBadgeText: {
    color: "#00B14F",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyState: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 30,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  loadingText: {
    textAlign: "center",
    marginTop: 50,
    fontSize: 16,
    color: "#666",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 25,
    width: "85%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
    textAlign: "center",
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
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: "#fafafa",
  },
  typeSelector: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#ddd",
    alignItems: "center",
  },
  selectedTypeButton: {
    borderColor: "#00B14F",
    backgroundColor: "#E8F5E9",
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  selectedTypeButtonText: {
    color: "#00B14F",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  saveModalButton: {
    backgroundColor: "#00B14F",
  },
  cancelModalButton: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#ddd",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  cancelModalButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
});