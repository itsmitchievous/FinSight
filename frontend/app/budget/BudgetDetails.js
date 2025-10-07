import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { API_BASE_URL } from "../config";

export default function BudgetDetails() {
  const [budgetData, setBudgetData] = useState(null);
  const [loading, setLoading] = useState(true);

  const { userId, budgetId } = useLocalSearchParams();
  const numericUserId = Number(userId);
  const numericBudgetId = Number(budgetId);

  useFocusEffect(
    useCallback(() => {
      fetchBudgetDetails();
    }, [])
  );

  const fetchBudgetDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/budget-details-home?budget_id=${numericBudgetId}`
      );
      const data = await response.json();

      if (response.ok) {
        setBudgetData(data);
      }
    } catch (error) {
      console.error("Error fetching budget details:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00B14F" />
        <Text style={styles.loadingText}>Loading budget details...</Text>
      </View>
    );
  }

  if (!budgetData) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Budget not found</Text>
      </View>
    );
  }

  // Calculate totals
  const totalAllocated = budgetData.allocations.reduce(
    (sum, alloc) => sum + parseFloat(alloc.allocated_amount),
    0
  );
  const totalSpent = budgetData.allocations.reduce(
    (sum, alloc) => sum + parseFloat(alloc.spent_amount),
    0
  );
  const totalRemaining = totalAllocated - totalSpent;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{budgetData.budget_name}</Text>
          <Text style={styles.subtitle}>
            {budgetData.budget_rule} • {budgetData.budget_period}
          </Text>
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Budget</Text>
            <Text style={styles.summaryValue}>
              ₱{parseFloat(budgetData.total_income).toLocaleString()}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Spent</Text>
            <Text style={[styles.summaryValue, styles.spentValue]}>
              ₱{totalSpent.toLocaleString()}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.lastRow]}>
            <Text style={styles.summaryLabel}>Remaining</Text>
            <Text
              style={[
                styles.summaryValue,
                styles.remainingValue,
                totalRemaining < 0 && styles.overBudget,
              ]}
            >
              ₱{totalRemaining.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* By Wallet Breakdown */}
        {budgetData.by_wallet && budgetData.by_wallet.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Budget by Wallet</Text>

            {budgetData.by_wallet.map((wallet) => (
              <View key={wallet.wallet_id} style={styles.walletCard}>
                <View style={styles.walletHeader}>
                  <Text style={styles.walletName}>{wallet.wallet_name}</Text>
                  <Text style={styles.walletCount}>
                    {wallet.allocations.length} categories
                  </Text>
                </View>

                {wallet.allocations.map((alloc) => (
                  <View key={alloc.allocation_id} style={styles.allocationItem}>
                    <View style={styles.allocationLeft}>
                      <Text style={styles.categoryName}>
                        {alloc.category_name}
                      </Text>
                      <Text style={styles.categoryType}>
                        {alloc.category_type}
                      </Text>
                    </View>

                    <View style={styles.allocationRight}>
                      <View style={styles.amountRow}>
                        <Text style={styles.allocatedAmount}>
                          ₱{alloc.allocated_amount.toLocaleString()}
                        </Text>
                        <Text style={styles.separator}>|</Text>
                        <Text style={styles.spentAmount}>
                          ₱{alloc.spent_amount.toLocaleString()}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.remainingAmount,
                          alloc.remaining < 0 && styles.overBudgetText,
                        ]}
                      >
                        {alloc.remaining >= 0 ? "Left: " : "Over: "}₱
                        {Math.abs(alloc.remaining).toLocaleString()}
                      </Text>
                      
                      {/* Progress Bar */}
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(
                                (alloc.spent_amount / alloc.allocated_amount) * 100,
                                100
                              )}%`,
                              backgroundColor:
                                alloc.remaining < 0 ? "#FF6B6B" : "#00B14F",
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Category Type Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>By Category Type</Text>

          {["Need", "Want", "Savings"].map((type) => {
            const typeAllocations = budgetData.allocations.filter(
              (a) => a.category_type === type
            );
            if (typeAllocations.length === 0) return null;

            const typeAllocated = typeAllocations.reduce(
              (sum, a) => sum + parseFloat(a.allocated_amount),
              0
            );
            const typeSpent = typeAllocations.reduce(
              (sum, a) => sum + parseFloat(a.spent_amount),
              0
            );
            const typeRemaining = typeAllocated - typeSpent;

            return (
              <View key={type} style={styles.typeCard}>
                <View style={styles.typeHeader}>
                  <Text style={styles.typeName}>{type}</Text>
                  <Text style={styles.typeCount}>
                    {typeAllocations.length} categories
                  </Text>
                </View>

                <View style={styles.typeStats}>
                  <View style={styles.typeStat}>
                    <Text style={styles.typeStatLabel}>Allocated</Text>
                    <Text style={styles.typeStatValue}>
                      ₱{typeAllocated.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.typeStat}>
                    <Text style={styles.typeStatLabel}>Spent</Text>
                    <Text style={[styles.typeStatValue, styles.spentValue]}>
                      ₱{typeSpent.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.typeStat}>
                    <Text style={styles.typeStatLabel}>Remaining</Text>
                    <Text
                      style={[
                        styles.typeStatValue,
                        typeRemaining >= 0
                          ? styles.remainingValue
                          : styles.overBudgetText,
                      ]}
                    >
                      ₱{typeRemaining.toLocaleString()}
                    </Text>
                  </View>
                </View>

                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(
                          (typeSpent / typeAllocated) * 100,
                          100
                        )}%`,
                        backgroundColor:
                          typeRemaining < 0 ? "#FF6B6B" : "#00B14F",
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
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
  errorText: {
    fontSize: 16,
    color: "#FF6B6B",
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  summaryLabel: {
    fontSize: 16,
    color: "#666",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  spentValue: {
    color: "#FF6B6B",
  },
  remainingValue: {
    color: "#00B14F",
  },
  overBudget: {
    color: "#FF6B6B",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  walletCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  walletHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#6C5CE7",
  },
  walletName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  walletCount: {
    fontSize: 12,
    color: "#666",
  },
  allocationItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  allocationLeft: {
    flex: 1,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  categoryType: {
    fontSize: 12,
    color: "#999",
  },
  allocationRight: {
    alignItems: "flex-end",
    flex: 1,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  allocatedAmount: {
    fontSize: 13,
    color: "#666",
  },
  separator: {
    fontSize: 13,
    color: "#ccc",
    marginHorizontal: 6,
  },
  spentAmount: {
    fontSize: 13,
    color: "#FF6B6B",
    fontWeight: "600",
  },
  remainingAmount: {
    fontSize: 12,
    color: "#00B14F",
    fontWeight: "600",
    marginBottom: 6,
  },
  overBudgetText: {
    color: "#FF6B6B",
  },
  progressBar: {
    height: 6,
    backgroundColor: "#e0e0e0",
    borderRadius: 3,
    overflow: "hidden",
    width: 120,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  typeCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  typeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  typeName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  typeCount: {
    fontSize: 12,
    color: "#666",
  },
  typeStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  typeStat: {
    flex: 1,
    alignItems: "center",
  },
  typeStatLabel: {
    fontSize: 11,
    color: "#666",
    marginBottom: 4,
  },
  typeStatValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
});