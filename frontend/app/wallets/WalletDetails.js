import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { API_BASE_URL } from "../config"; 


export default function WalletDetails() {
  const [walletData, setWalletData] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [budgetSummary, setBudgetSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const { userId, walletId } = useLocalSearchParams();
  const numericUserId = Number(userId);
  const numericWalletId = Number(walletId);

  useFocusEffect(
    useCallback(() => {
      fetchWalletDetails();
      fetchRecentTransactions();
      fetchBudgetSummary();
    }, [numericUserId, numericWalletId])
  );

  const fetchWalletDetails = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/wallet-details?user_id=${numericUserId}&wallet_id=${numericWalletId}`
      );
      const data = await response.json();

      if (response.ok) {
        setWalletData(data);
      } else {
        console.error("Failed to fetch wallet details:", data.message);
      }
    } catch (error) {
      console.error("Error fetching wallet details:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentTransactions = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/wallet-transactions?user_id=${numericUserId}&wallet_id=${numericWalletId}&limit=5`
      );
      const transactions = await response.json();

      if (response.ok) {
        setRecentTransactions(transactions);
      } else {
        console.error("Failed to fetch transactions:", transactions.message);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  };

  const fetchBudgetSummary = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/wallet-budgets?user_id=${numericUserId}&wallet_id=${numericWalletId}`
      );
      const budgets = await response.json();

      if (response.ok && budgets.length > 0) {
        let totalAllocated = 0;
        let totalSpent = 0;

        // Fetch detailed allocations for each budget to get spent amounts
        for (const budget of budgets) {
          const detailsResponse = await fetch(
            `${API_BASE_URL}/budget-details?budget_id=${budget.budget_id}`
          );
          const detailsData = await detailsResponse.json();

          if (detailsResponse.ok && detailsData.allocations) {
            detailsData.allocations.forEach(allocation => {
              totalAllocated += parseFloat(allocation.allocated_amount) || 0;
              totalSpent += parseFloat(allocation.spent_amount) || 0;
            });
          }
        }

        const totalRemaining = totalAllocated - totalSpent;

        setBudgetSummary({
          count: budgets.length,
          total_allocated: totalAllocated,
          total_spent: totalSpent,
          total_remaining: totalRemaining
        });
      } else {
        setBudgetSummary(null);
      }
    } catch (error) {
      console.error("Error fetching budget summary:", error);
      setBudgetSummary(null);
    }
  };

  const handleDeleteWallet = async () => {
    Alert.alert(
      "Delete Wallet",
      "Are you sure you want to delete this wallet? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(
                `${API_BASE_URL}/delete-wallet?user_id=${numericUserId}&wallet_id=${numericWalletId}`,
                { method: "DELETE" }
              );
              const data = await response.json();

              if (response.ok) {
                Alert.alert("Success", "Wallet deleted successfully");
                router.back();
              } else {
                Alert.alert("Error", data.message || "Failed to delete wallet");
              }
            } catch (error) {
              console.error("Error deleting wallet:", error);
              Alert.alert("Error", "Failed to delete wallet");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading wallet details...</Text>
      </View>
    );
  }

  if (!walletData) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Wallet not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.walletName}>
              {walletData.wallet_name}{" "}
              <Text style={styles.walletType}>({walletData.wallet_type})</Text>
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() =>
                router.push(
                  `wallets/EditWallet?userId=${numericUserId}&walletId=${numericWalletId}`
                )
              }
            >
              <Text style={styles.headerButtonText}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerButton, styles.deleteButton]}
              onPress={handleDeleteWallet}
            >
              <Text style={styles.headerButtonText}>🗑</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceAmount}>
            ₱{walletData.balance?.toLocaleString() || "0"}
          </Text>

          <View style={styles.balanceBreakdown}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Income</Text>
              <Text style={styles.incomeAmount}>
                ₱{walletData.total_income?.toLocaleString() || "0"}
              </Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Expenses</Text>
              <Text style={styles.expenseAmount}>
                ₱{walletData.total_expenses?.toLocaleString() || "0"}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.incomeButton]}
            onPress={() =>
              router.push(
                `income/AddIncome?userId=${numericUserId}&walletId=${numericWalletId}`
              )
            }
          >
            <Text style={styles.actionButtonText}>+ Add Income</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.expenseButton]}
            onPress={() =>
              router.push(
                `expenses/AddExpenses?userId=${numericUserId}&walletId=${numericWalletId}`
              )
            }
          >
            <Text style={styles.actionButtonText}>+ Add Expense</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity
              onPress={() =>
                router.push(
                  `transactions/WalletTransactions?userId=${numericUserId}&walletId=${numericWalletId}`
                )
              }
            >
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {recentTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No transactions yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Add your first income or expense above
              </Text>
            </View>
          ) : (
            recentTransactions.map((transaction, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.transactionItem}
                onPress={() => router.push(
                  `transactions/TransactionDetails?userId=${numericUserId}&walletId=${numericWalletId}&transactionId=${transaction.transaction_id}`
                )}
                activeOpacity={0.7}
              >
                <View style={styles.transactionDetails}>
                  <Text style={styles.transactionType}>
                    {transaction.category_name || 
                     (transaction.transaction_type === "Income" ? "Income" : "Expense")}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {new Date(transaction.transaction_date).toLocaleDateString()}
                  </Text>
                  {transaction.notes && (
                    <Text style={styles.transactionNotes}>
                      {transaction.notes}
                    </Text>
                  )}
                </View>
                <View style={styles.transactionRight}>
                  <Text
                    style={[
                      styles.transactionAmount,
                      transaction.transaction_type === "Income"
                        ? styles.incomeAmount
                        : styles.expenseAmount,
                    ]}
                  >
                    {transaction.transaction_type === "Income" ? "+" : "-"}₱
                    {transaction.amount?.toLocaleString()}
                  </Text>
                  <Text style={styles.arrowText}>›</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Budget Allocation */}
        {budgetSummary && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.budgetSummaryCard}
              onPress={() =>
                router.push(
                  `budget/BudgetList?userId=${numericUserId}&walletId=${numericWalletId}`
                )
              }
              activeOpacity={0.7}
            >
              <View style={styles.budgetIconContainer}>
                <Text style={styles.budgetIcon}>📊</Text>
              </View>
              <View style={styles.budgetSummaryContent}>
                <View style={styles.budgetSummaryLeft}>
                  <Text style={styles.budgetSummaryLabel}>Budget Allocation</Text>
                  <Text style={styles.budgetSummarySubtext}>
                    {budgetSummary.count} {budgetSummary.count === 1 ? 'active plan' : 'active plans'}
                  </Text>
                </View>
                <View style={styles.budgetSummaryRight}>
                  <View style={styles.budgetAmountContainer}>
                    <Text style={[
                      styles.budgetSummaryAmount,
                      budgetSummary.total_remaining < 0 && styles.budgetOverspent
                    ]}>
                      ₱{budgetSummary.total_remaining?.toLocaleString()}
                    </Text>
                    <Text style={styles.budgetBreakdownText}>
                      of ₱{budgetSummary.total_allocated?.toLocaleString()}
                    </Text>
                  </View>
                  <Text style={styles.budgetViewText}>View details →</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          {budgetSummary ? (
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() =>
                router.push(
                  `budget/BudgetList?userId=${numericUserId}&walletId=${numericWalletId}`
                )
              }
            >
              <Text style={styles.quickActionText}>📊 Manage Budget</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() =>
                router.push(
                  `budget/AddBudget?userId=${numericUserId}&walletId=${numericWalletId}`
                )
              }
            >
              <Text style={styles.quickActionText}>📊 Create Budget</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() =>
              router.push(
                `categories/ManageCategories?userId=${numericUserId}&walletId=${numericWalletId}`
              )
            }
          >
            <Text style={styles.quickActionText}>🏷️ Manage Categories</Text>
          </TouchableOpacity>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  walletName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  walletType: {
    fontSize: 16,
    color: "#666",
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#eee",
  },
  deleteButton: {
    backgroundColor: "#FF6B6B",
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  balanceCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 5,
  },
  balanceLabel: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#00B14F",
    textAlign: "center",
    marginVertical: 10,
  },
  balanceBreakdown: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  breakdownItem: {
    alignItems: "center",
  },
  breakdownLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  incomeAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00B14F",
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF6B6B",
  },
  budgetAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4ECDC4",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 15,
    marginBottom: 25,
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
  incomeButton: {
    backgroundColor: "#00B14F",
  },
  expenseButton: {
    backgroundColor: "#FF6B6B",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  section: {
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  viewAllText: {
    fontSize: 14,
    color: "#00B14F",
    fontWeight: "600",
  },
  transactionItem: {
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
  transactionDetails: {
    flex: 1,
  },
  transactionType: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: "#666",
  },
  transactionNotes: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  transactionRight: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 10,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 8,
  },
  arrowText: {
    fontSize: 24,
    color: "#999",
    fontWeight: "300",
  },
  emptyState: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  budgetSummaryCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
    borderLeftWidth: 4,
    borderLeftColor: "#6C5CE7",
  },
  budgetIconContainer: {
    position: "absolute",
    top: 15,
    right: 15,
    backgroundColor: "#F0EDFF",
    borderRadius: 25,
    width: 45,
    height: 45,
    justifyContent: "center",
    alignItems: "center",
  },
  budgetIcon: {
    fontSize: 24,
  },
  budgetSummaryContent: {
    flexDirection: "column",
    paddingRight: 60,
  },
  budgetSummaryLeft: {
    marginBottom: 12,
  },
  budgetSummaryLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2D3436",
    marginBottom: 4,
  },
  budgetSummarySubtext: {
    fontSize: 13,
    color: "#636E72",
  },
  budgetSummaryRight: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  budgetAmountContainer: {
    flexDirection: "column",
  },
  budgetSummaryAmount: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#6C5CE7",
  },
  budgetOverspent: {
    color: "#FF6B6B",
  },
  budgetBreakdownText: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
  budgetViewText: {
    fontSize: 12,
    color: "#6C5CE7",
    fontWeight: "600",
  },
  quickActionButton: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  quickActionText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
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