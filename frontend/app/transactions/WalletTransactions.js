import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { API_BASE_URL } from "../config"; 


export default function ViewAllTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const { userId, walletId } = useLocalSearchParams();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      fetchAllTransactions();
    }, [userId, walletId])
  );

  const fetchAllTransactions = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/wallet-transactions?user_id=${userId}&wallet_id=${walletId}`
      );
      const data = await response.json();

      if (response.ok) {
        setTransactions(data);
      } else {
        console.error("Failed to fetch transactions:", data.message);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAllTransactions();
  };

  const groupTransactionsByDate = () => {
    const grouped = {};
    
    transactions.forEach(transaction => {
      const date = new Date(transaction.transaction_date);
      const dateKey = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(transaction);
    });
    
    return grouped;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>All Transactions</Text>
          <View style={styles.placeholder} />
        </View>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const groupedTransactions = groupTransactionsByDate();
  const dateKeys = Object.keys(groupedTransactions);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>All Transactions</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>No transactions found</Text>
            <Text style={styles.emptySubtext}>
              Start by adding income or expenses to your wallet
            </Text>
          </View>
        ) : (
          <>
            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total Transactions</Text>
                  <Text style={styles.summaryValue}>{transactions.length}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Income</Text>
                  <Text style={[styles.summaryValue, styles.incomeText]}>
                    {transactions.filter(t => t.transaction_type === "Income").length}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Expenses</Text>
                  <Text style={[styles.summaryValue, styles.expenseText]}>
                    {transactions.filter(t => t.transaction_type === "Expense").length}
                  </Text>
                </View>
              </View>
            </View>

            {/* Grouped Transactions */}
            {dateKeys.map((dateKey) => (
              <View key={dateKey} style={styles.dateGroup}>
                <Text style={styles.dateHeader}>{dateKey}</Text>
                {groupedTransactions[dateKey].map((transaction) => (
                  <TouchableOpacity 
                    key={transaction.transaction_id} 
                    style={styles.transactionItem}
                    onPress={() => router.push(
                      `transactions/TransactionDetails?userId=${userId}&walletId=${walletId}&transactionId=${transaction.transaction_id}`
                    )}
                    activeOpacity={0.7}
                  >
                    <View style={styles.transactionLeft}>
                      <View style={[
                        styles.iconCircle,
                        transaction.transaction_type === "Income" 
                          ? styles.incomeCircle 
                          : styles.expenseCircle
                      ]}>
                        <Text style={styles.iconText}>
                          {transaction.transaction_type === "Income" ? "↑" : "↓"}
                        </Text>
                      </View>
                      <View style={styles.transactionDetails}>
                        <Text style={styles.transactionType}>
                          {transaction.category_name || transaction.transaction_type}
                        </Text>
                        {transaction.category_type && (
                          <Text style={styles.categoryType}>
                            {transaction.category_type}
                          </Text>
                        )}
                        {transaction.notes && (
                          <Text style={styles.transactionNotes} numberOfLines={1}>
                            {transaction.notes}
                          </Text>
                        )}
                        {transaction.is_recurring === 1 && (
                          <Text style={styles.recurringBadge}>
                            🔄 {transaction.recurring_frequency}
                          </Text>
                        )}
                      </View>
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
                ))}
              </View>
            ))}
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
  summaryCard: {
    backgroundColor: "#fff",
    margin: 20,
    marginBottom: 10,
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#eee",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  incomeText: {
    color: "#00B14F",
  },
  expenseText: {
    color: "#FF6B6B",
  },
  dateGroup: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  dateHeader: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 10,
    marginTop: 10,
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
  transactionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  incomeCircle: {
    backgroundColor: "#E8F5E9",
  },
  expenseCircle: {
    backgroundColor: "#FFEBEE",
  },
  iconText: {
    fontSize: 20,
    fontWeight: "bold",
  },
  transactionDetails: {
    flex: 1,
  },
  transactionType: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  categoryType: {
    fontSize: 12,
    color: "#999",
    marginBottom: 2,
  },
  transactionNotes: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  recurringBadge: {
    fontSize: 11,
    color: "#4ECDC4",
    marginTop: 4,
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
  incomeAmount: {
    color: "#00B14F",
  },
  expenseAmount: {
    color: "#FF6B6B",
  },
  arrowText: {
    fontSize: 24,
    color: "#999",
    fontWeight: "300",
  },
  loadingText: {
    textAlign: "center",
    marginTop: 50,
    fontSize: 16,
    color: "#666",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  emptySubtext: {
    textAlign: "center",
    fontSize: 14,
    color: "#999",
  },
});