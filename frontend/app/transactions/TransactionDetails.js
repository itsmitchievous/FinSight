import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { API_BASE_URL } from "../config"; 


export default function TransactionDetails() {
  const [transaction, setTransaction] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedAmount, setEditedAmount] = useState("");
  const [editedNotes, setEditedNotes] = useState("");
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const { userId, walletId, transactionId } = useLocalSearchParams();

  useEffect(() => {
    fetchTransactionDetails();
  }, [transactionId]);

  const fetchTransactionDetails = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/transaction-details?transaction_id=${transactionId}`
      );
      const data = await response.json();

      if (response.ok) {
        setTransaction(data);
        setEditedAmount(data.amount.toString());
        setEditedNotes(data.notes || "");
      } else {
        Alert.alert("Error", "Failed to fetch transaction details");
      }
    } catch (error) {
      console.error("Error fetching transaction details:", error);
      Alert.alert("Error", "Failed to load transaction");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedAmount(transaction.amount.toString());
    setEditedNotes(transaction.notes || "");
  };

  const handleSaveEdit = async () => {
    if (!editedAmount || parseFloat(editedAmount) <= 0) {
      Alert.alert("Error", "Amount must be greater than 0");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/update-transaction`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: transactionId,
          amount: parseFloat(editedAmount),
          notes: editedNotes,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert("Success", "Transaction updated successfully");
        setIsEditing(false);
        fetchTransactionDetails();
      } else {
        Alert.alert("Error", data.message || "Failed to update transaction");
      }
    } catch (error) {
      console.error("Error updating transaction:", error);
      Alert.alert("Error", "Failed to update transaction");
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Transaction",
      "Are you sure you want to delete this transaction? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(
                `${API_BASE_URL}/delete-transaction?transaction_id=${transactionId}`,
                { method: "DELETE" }
              );
              const data = await response.json();

              if (response.ok) {
                Alert.alert("Success", "Transaction deleted successfully", [
                  { text: "OK", onPress: () => router.back() }
                ]);
              } else {
                Alert.alert("Error", data.message || "Failed to delete transaction");
              }
            } catch (error) {
              console.error("Error deleting transaction:", error);
              Alert.alert("Error", "Failed to delete transaction");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!transaction) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Transaction not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Transaction Details</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Transaction Card */}
        <View style={styles.card}>
          <View style={[
            styles.typeIndicator,
            transaction.transaction_type === "Income" 
              ? styles.incomeIndicator 
              : styles.expenseIndicator
          ]}>
            <Text style={styles.typeText}>{transaction.transaction_type}</Text>
          </View>

          {/* Amount */}
          <View style={styles.detailRow}>
            <Text style={styles.label}>Amount</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={editedAmount}
                onChangeText={setEditedAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
            ) : (
              <Text style={[
                styles.amount,
                transaction.transaction_type === "Income" 
                  ? styles.incomeAmount 
                  : styles.expenseAmount
              ]}>
                {transaction.transaction_type === "Income" ? "+" : "-"}₱
                {transaction.amount?.toLocaleString()}
              </Text>
            )}
          </View>

          {/* Category */}
          <View style={styles.detailRow}>
            <Text style={styles.label}>Category</Text>
            <Text style={styles.value}>{transaction.category_name || "N/A"}</Text>
          </View>

          {/* Category Type */}
          {transaction.category_type && (
            <View style={styles.detailRow}>
              <Text style={styles.label}>Type</Text>
              <Text style={styles.value}>{transaction.category_type}</Text>
            </View>
          )}

          {/* Date */}
          <View style={styles.detailRow}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>
              {new Date(transaction.transaction_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Text>
          </View>

          {/* Notes */}
          <View style={styles.detailRow}>
            <Text style={styles.label}>Notes</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={editedNotes}
                onChangeText={setEditedNotes}
                placeholder="Add notes (optional)"
                multiline
              />
            ) : (
              <Text style={styles.value}>{transaction.notes || "No notes"}</Text>
            )}
          </View>

          {/* Recurring Info */}
          {transaction.is_recurring === 1 && (
            <View style={styles.detailRow}>
              <Text style={styles.label}>Recurring</Text>
              <Text style={styles.value}>{transaction.recurring_frequency}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {isEditing ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton]}
                onPress={handleSaveEdit}
              >
                <Text style={styles.actionButtonText}>Save Changes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={handleCancelEdit}
              >
                <Text style={styles.actionButtonText}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={handleEdit}
              >
                <Text style={styles.actionButtonText}>✏️ Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={handleDelete}
              >
                <Text style={styles.actionButtonText}>🗑 Delete</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
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
  card: {
    backgroundColor: "#fff",
    margin: 20,
    borderRadius: 15,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 5,
  },
  typeIndicator: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  incomeIndicator: {
    backgroundColor: "#E8F5E9",
  },
  expenseIndicator: {
    backgroundColor: "#FFEBEE",
  },
  typeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  detailRow: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  value: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  amount: {
    fontSize: 32,
    fontWeight: "bold",
  },
  incomeAmount: {
    color: "#00B14F",
  },
  expenseAmount: {
    color: "#FF6B6B",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 15,
    marginHorizontal: 20,
    marginBottom: 30,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  editButton: {
    backgroundColor: "#4ECDC4",
  },
  deleteButton: {
    backgroundColor: "#FF6B6B",
  },
  saveButton: {
    backgroundColor: "#00B14F",
  },
  cancelButton: {
    backgroundColor: "#999",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 50,
  },
  errorText: {
    fontSize: 16,
    color: "#FF6B6B",
    textAlign: "center",
    marginTop: 50,
  },
});