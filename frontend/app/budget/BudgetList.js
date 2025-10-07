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
  const { userId } = useLocalSearchParams();
  const numericUserId = Number(userId);

  useFocusEffect(
    useCallback(() => {
      fetchBudgets();
    }, [])
  );

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/user-budgets?user_id=${numericUserId}`
      );
      const data = await response.json();

      if (response.ok) {
        setBudgets(data);
      } else {
        Alert.alert("Error", data.message || "Failed to fetch budgets");
      }
    } catch (error) {
      console.error("Error fetching budgets:", error);
      Alert.alert("Error", "Failed to fetch budgets");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBudget = (budgetId) => {
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
        <Text style={styles.title}>My Budgets</Text>
        <Text style={styles.subtitle}>
          Manage your budget plans across all wallets
        </Text>

        {budgets.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No budgets yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first budget to start managing your finances
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() =>
                router.push(`/budget/AddBudget?userId=${numericUserId}`)
              }
            >
              <Text style={styles.createButtonText}>Create Budget</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {budgets.map((budget) => (
              <TouchableOpacity
                key={budget.budget_id}
                style={styles.budgetCard}
                onPress={() =>
                  router.push(
                    `/budget/BudgetDetails?userId=${numericUserId}&budgetId=${budget.budget_id}`
                  )
                }
                activeOpacity={0.7}
              >
                <View style={styles.budgetHeader}>
                  <View style={styles.budgetHeaderLeft}>
                    <Text style={styles.budgetName}>{budget.budget_name}</Text>
                    <Text style={styles.budgetRule}>
                      {budget.budget_rule} Rule • {budget.budget_period}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteIconButton}
                    onPress={() => handleDeleteBudget(budget.budget_id)}
                  >
                    <Text style={styles.deleteIcon}>🗑️</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.budgetStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Total Budget</Text>
                    <Text style={styles.statValue}>
                      ₱{parseFloat(budget.total_income).toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.statDivider} />

                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Categories</Text>
                    <Text style={styles.statValue}>{budget.allocation_count}</Text>
                  </View>

                  <View style={styles.statDivider} />

                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Wallets</Text>
                    <Text style={styles.statValue}>{budget.wallet_count}</Text>
                  </View>
                </View>

                <View style={styles.budgetFooter}>
                  <Text style={styles.createdDate}>
                    Created: {new Date(budget.budget_created).toLocaleDateString()}
                  </Text>
                  <Text style={styles.viewDetails}>View Details →</Text>
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.addMoreButton}
              onPress={() =>
                router.push(`/budget/AddBudget?userId=${numericUserId}`)
              }
            >
              <Text style={styles.addMoreButtonText}>+ Create New Budget</Text>
            </TouchableOpacity>
          </>
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
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
  },
  emptyState: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 40,
    alignItems: "center",
    marginTop: 50,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: "#00B14F",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 25,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  budgetCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
    borderLeftWidth: 5,
    borderLeftColor: "#6C5CE7",
  },
  budgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  budgetHeaderLeft: {
    flex: 1,
  },
  budgetName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  budgetRule: {
    fontSize: 13,
    color: "#666",
  },
  deleteIconButton: {
    padding: 4,
  },
  deleteIcon: {
    fontSize: 20,
  },
  budgetStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#f0f0f0",
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  statDivider: {
    width: 1,
    backgroundColor: "#e0e0e0",
  },
  budgetFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  createdDate: {
    fontSize: 12,
    color: "#999",
  },
  viewDetails: {
    fontSize: 14,
    color: "#6C5CE7",
    fontWeight: "600",
  },
  addMoreButton: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 2,
    borderColor: "#00B14F",
    borderStyle: "dashed",
  },
  addMoreButtonText: {
    color: "#00B14F",
    fontSize: 16,
    fontWeight: "bold",
  },
});