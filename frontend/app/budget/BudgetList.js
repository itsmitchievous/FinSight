import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { API_BASE_URL } from "../config";

export default function BudgetList() {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const { userId, walletId } = useLocalSearchParams();
  const numericUserId = Number(userId);
  const numericWalletId = Number(walletId);

  useFocusEffect(
    useCallback(() => {
      fetchBudgets();
    }, [numericUserId, numericWalletId])
  );

  const fetchBudgets = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/wallet-budgets?user_id=${numericUserId}&wallet_id=${numericWalletId}`
      );
      const data = await response.json();

      if (response.ok) {
        // Fetch detailed allocations for each budget to calculate remaining
        const budgetsWithRemaining = await Promise.all(
          data.map(async (budget) => {
            try {
              const detailsResponse = await fetch(
                `${API_BASE_URL}/budget-details?budget_id=${budget.budget_id}`
              );
              const detailsData = await detailsResponse.json();

              if (detailsResponse.ok && detailsData.allocations) {
                const totalSpent = detailsData.allocations.reduce(
                  (sum, alloc) => sum + parseFloat(alloc.spent_amount || 0),
                  0
                );
                const totalAllocated = parseFloat(budget.total_allocated) || 0;
                const remaining = totalAllocated - totalSpent;

                return {
                  ...budget,
                  total_spent: totalSpent,
                  remaining: remaining
                };
              }
              return {
                ...budget,
                total_spent: 0,
                remaining: parseFloat(budget.total_allocated) || 0
              };
            } catch (error) {
              console.error("Error fetching budget details:", error);
              return {
                ...budget,
                total_spent: 0,
                remaining: parseFloat(budget.total_allocated) || 0
              };
            }
          })
        );

        setBudgets(budgetsWithRemaining);
      } else {
        console.error("Failed to fetch budgets:", data.message);
      }
    } catch (error) {
      console.error("Error fetching budgets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBudget = async (budgetId) => {
    Alert.alert(
      "Delete Budget",
      "Are you sure you want to delete this budget?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(
                `${API_BASE_URL}/delete-budget?budget_id=${budgetId}`,
                { method: "DELETE" }
              );
              const data = await response.json();

              if (response.ok) {
                Alert.alert("Success", "Budget deleted successfully");
                fetchBudgets();
              } else {
                Alert.alert("Error", data.message || "Failed to delete budget");
              }
            } catch (error) {
              console.error("Error deleting budget:", error);
              Alert.alert("Error", "Failed to delete budget");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00B14F" />
        <Text style={styles.loadingText}>Loading budgets...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>My Budgets</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() =>
              router.push(
                `budget/AddBudget?userId=${numericUserId}&walletId=${numericWalletId}`
              )
            }
          >
            <Text style={styles.addButtonText}>+ New Budget</Text>
          </TouchableOpacity>
        </View>

        {budgets.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📊</Text>
            <Text style={styles.emptyStateText}>No budgets yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Create your first budget to start tracking your spending
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() =>
                router.push(
                  `budget/AddBudget?userId=${numericUserId}&walletId=${numericWalletId}`
                )
              }
            >
              <Text style={styles.emptyStateButtonText}>Create Budget</Text>
            </TouchableOpacity>
          </View>
        ) : (
          budgets.map((budget) => (
            <TouchableOpacity
              key={budget.budget_id}
              style={styles.budgetCard}
              onPress={() =>
                router.push(
                  `budget/BudgetDetails?userId=${numericUserId}&walletId=${numericWalletId}&budgetId=${budget.budget_id}`
                )
              }
            >
              <View style={styles.budgetHeader}>
                <View style={styles.budgetInfo}>
                  <Text style={styles.budgetName}>{budget.budget_name}</Text>
                  <Text style={styles.budgetMeta}>
                    {budget.budget_rule} • {budget.budget_period}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteIconButton}
                  onPress={() => handleDeleteBudget(budget.budget_id)}
                >
                  <Text style={styles.deleteIcon}>🗑</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.budgetAmount}>
                <Text style={styles.budgetLabel}>Budget Remaining</Text>
                <Text style={[
                  styles.budgetValue,
                  budget.remaining < 0 && styles.budgetOverspent
                ]}>
                  ₱{budget.remaining?.toLocaleString()}
                </Text>
              </View>

              <View style={styles.budgetStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Total Budget</Text>
                  <Text style={styles.statValue}>
                    ₱{budget.total_income?.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Spent</Text>
                  <Text style={[styles.statValue, styles.spentValue]}>
                    ₱{budget.total_spent?.toLocaleString()}
                  </Text>
                </View>
              </View>

              <Text style={styles.viewDetailsText}>Tap to view details →</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  addButton: {
    backgroundColor: "#00B14F",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  emptyState: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 40,
    alignItems: "center",
    marginTop: 40,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: "#00B14F",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  budgetCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  budgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  budgetInfo: {
    flex: 1,
  },
  budgetName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  budgetMeta: {
    fontSize: 14,
    color: "#666",
  },
  deleteIconButton: {
    padding: 4,
  },
  deleteIcon: {
    fontSize: 20,
  },
  budgetAmount: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#f0f0f0",
    marginBottom: 12,
  },
  budgetLabel: {
    fontSize: 14,
    color: "#666",
  },
  budgetValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00B14F",
  },
  budgetOverspent: {
    color: "#FF6B6B",
  },
  budgetStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  spentValue: {
    color: "#FF6B6B",
  },
  viewDetailsText: {
    fontSize: 12,
    color: "#00B14F",
    textAlign: "right",
  },
});