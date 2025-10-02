import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { API_BASE_URL } from "../config";

export default function AddBudget() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Income tracking
  const [walletIncome, setWalletIncome] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0);

  // Step 1: Income & Rule Selection
  const [totalIncome, setTotalIncome] = useState("");
  const [budgetRule, setBudgetRule] = useState("50-30-20");
  const [budgetPeriod, setBudgetPeriod] = useState("Monthly");

  // Step 2: Category Allocation
  const [needsCategories, setNeedsCategories] = useState([]);
  const [wantsCategories, setWantsCategories] = useState([]);
  const [savingsCategories, setSavingsCategories] = useState([]);

  const [needsAllocations, setNeedsAllocations] = useState({});
  const [wantsAllocations, setWantsAllocations] = useState({});
  const [savingsAllocations, setSavingsAllocations] = useState({});

  // Calculated amounts
  const [needsAmount, setNeedsAmount] = useState(0);
  const [wantsAmount, setWantsAmount] = useState(0);
  const [savingsAmount, setSavingsAmount] = useState(0);

  const router = useRouter();
  const { userId, walletId } = useLocalSearchParams();
  const numericUserId = Number(userId);
  const numericWalletId = Number(walletId);

  const budgetRules = {
    "50-30-20": { needs: 50, wants: 30, savings: 20 },
    "70-20-10": { needs: 70, wants: 20, savings: 10 },
  };

  // Fetch wallet income on component mount
  useEffect(() => {
    fetchWalletIncome();
  }, []);

  const fetchWalletIncome = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/wallet-available-balance?user_id=${numericUserId}&wallet_id=${numericWalletId}`
      );
      const data = await response.json();

      if (response.ok) {
        setWalletIncome(data.total_income);
        setAvailableBalance(data.available_balance);
      }
    } catch (error) {
      console.error("Error fetching wallet income:", error);
    }
  };

  useEffect(() => {
    if (totalIncome && budgetRule !== "Custom") {
      const income = parseFloat(totalIncome) || 0;
      const rule = budgetRules[budgetRule];
      
      setNeedsAmount((income * rule.needs) / 100);
      setWantsAmount((income * rule.wants) / 100);
      setSavingsAmount((income * rule.savings) / 100);
    }
  }, [totalIncome, budgetRule]);

  const fetchCategoriesByType = async (type) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/categories-by-type?user_id=${numericUserId}&category_type=${type}`
      );
      const data = await response.json();

      if (response.ok) {
        return data;
      } else {
        console.error(`Failed to fetch ${type} categories:`, data.message);
        return [];
      }
    } catch (error) {
      console.error(`Error fetching ${type} categories:`, error);
      return [];
    }
  };

  const handleNext = async () => {
    if (step === 1) {
      if (!totalIncome || parseFloat(totalIncome) <= 0) {
        Alert.alert("Invalid Input", "Please enter a valid income amount");
        return;
      }

      // Check if wallet has any income
      if (walletIncome === 0) {
        Alert.alert(
          "No Income Found",
          "You need to add income to this wallet before creating a budget. Would you like to add income now?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Add Income",
              onPress: () => {
                router.push(
                  `/income/AddIncome?userId=${numericUserId}&walletId=${numericWalletId}`
                );
              },
            },
          ]
        );
        return;
      }

      // Check if budget exceeds available balance
      if (parseFloat(totalIncome) > availableBalance) {
        Alert.alert(
          "Insufficient Balance",
          `Your budget amount (₱${parseFloat(totalIncome).toLocaleString()}) cannot exceed your available balance (₱${availableBalance.toLocaleString()}).\n\nTotal Income: ₱${walletIncome.toLocaleString()}\nAvailable: ₱${availableBalance.toLocaleString()}`,
          [{ text: "OK" }]
        );
        return;
      }

      setLoadingCategories(true);

      try {
        const [needs, wants, savings] = await Promise.all([
          fetchCategoriesByType("Need"),
          fetchCategoriesByType("Want"),
          fetchCategoriesByType("Savings"),
        ]);

        setNeedsCategories(needs);
        setWantsCategories(wants);
        setSavingsCategories(savings);

        setStep(2);
      } catch (error) {
        Alert.alert("Error", "Failed to load categories");
      } finally {
        setLoadingCategories(false);
      }
    }
  };

  const handleAllocationChange = (categoryId, amount, type) => {
    const numAmount = parseFloat(amount) || 0;

    if (type === "needs") {
      setNeedsAllocations({ ...needsAllocations, [categoryId]: numAmount });
    } else if (type === "wants") {
      setWantsAllocations({ ...wantsAllocations, [categoryId]: numAmount });
    } else if (type === "savings") {
      setSavingsAllocations({ ...savingsAllocations, [categoryId]: numAmount });
    }
  };

  const getTotalAllocated = (type) => {
    let allocations;
    if (type === "needs") allocations = needsAllocations;
    else if (type === "wants") allocations = wantsAllocations;
    else allocations = savingsAllocations;

    return Object.values(allocations).reduce((sum, val) => sum + val, 0);
  };

  const getRemainingAmount = (type) => {
    let budgetAmount;
    if (type === "needs") budgetAmount = needsAmount;
    else if (type === "wants") budgetAmount = wantsAmount;
    else budgetAmount = savingsAmount;

    return budgetAmount - getTotalAllocated(type);
  };

  const validateAllocations = () => {
    const needsRemaining = getRemainingAmount("needs");
    const wantsRemaining = getRemainingAmount("wants");
    const savingsRemaining = getRemainingAmount("savings");

    if (Math.abs(needsRemaining) > 0.01) {
      Alert.alert(
        "Incomplete Allocation",
        `You need to allocate ₱${Math.abs(needsRemaining).toFixed(2)} ${
          needsRemaining > 0 ? "more" : "less"
        } for Needs`
      );
      return false;
    }

    if (Math.abs(wantsRemaining) > 0.01) {
      Alert.alert(
        "Incomplete Allocation",
        `You need to allocate ₱${Math.abs(wantsRemaining).toFixed(2)} ${
          wantsRemaining > 0 ? "more" : "less"
        } for Wants`
      );
      return false;
    }

    if (Math.abs(savingsRemaining) > 0.01) {
      Alert.alert(
        "Incomplete Allocation",
        `You need to allocate ₱${Math.abs(savingsRemaining).toFixed(2)} ${
          savingsRemaining > 0 ? "more" : "less"
        } for Savings`
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateAllocations()) return;

    const allocations = [];

    Object.entries(needsAllocations).forEach(([categoryId, amount]) => {
      if (amount > 0) {
        allocations.push({
          category_id: parseInt(categoryId),
          amount: amount,
          category_type: "Need",
        });
      }
    });

    Object.entries(wantsAllocations).forEach(([categoryId, amount]) => {
      if (amount > 0) {
        allocations.push({
          category_id: parseInt(categoryId),
          amount: amount,
          category_type: "Want",
        });
      }
    });

    Object.entries(savingsAllocations).forEach(([categoryId, amount]) => {
      if (amount > 0) {
        allocations.push({
          category_id: parseInt(categoryId),
          amount: amount,
          category_type: "Savings",
        });
      }
    });

    if (allocations.length === 0) {
      Alert.alert("Error", "Please allocate amounts to at least one category");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/create-budget`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: numericUserId,
          wallet_id: numericWalletId,
          budget_name: `${budgetRule} Budget`,
          total_income: parseFloat(totalIncome),
          budget_rule: budgetRule,
          budget_period: budgetPeriod,
          allocations: allocations,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert("Success", "Budget created successfully!", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("Error", data.message || "Failed to create budget");
      }
    } catch (error) {
      console.error("Error creating budget:", error);
      Alert.alert("Error", "Failed to create budget");
    } finally {
      setLoading(false);
    }
  };

  const renderCategoryAllocation = (categories, allocations, type, budgetAmount) => {
    const remaining = getRemainingAmount(type);
    const totalAllocated = getTotalAllocated(type);

    return (
      <View style={styles.allocationSection}>
        <View style={styles.allocationHeader}>
          <Text style={styles.allocationTitle}>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </Text>
          <Text style={styles.allocationBudget}>
            Budget: ₱{budgetAmount.toFixed(2)}
          </Text>
        </View>

        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min((totalAllocated / budgetAmount) * 100, 100)}%`,
                backgroundColor: remaining < -0.01 ? "#FF6B6B" : "#00B14F",
              },
            ]}
          />
        </View>

        <Text
          style={[
            styles.remainingText,
            { color: remaining < -0.01 ? "#FF6B6B" : "#666" },
          ]}
        >
          Remaining: ₱{remaining.toFixed(2)}
        </Text>

        {categories.map((category) => (
          <View key={category.category_id} style={styles.categoryInput}>
            <Text style={styles.categoryLabel}>{category.category_name}</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={
                allocations[category.category_id]
                  ? allocations[category.category_id].toString()
                  : ""
              }
              onChangeText={(text) =>
                handleAllocationChange(category.category_id, text, type)
              }
            />
          </View>
        ))}
      </View>
    );
  };

  if (loadingCategories) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00B14F" />
        <Text style={styles.loadingText}>Loading categories...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {step === 1 && (
          <View>
            <Text style={styles.title}>Set Your Budget</Text>
            <Text style={styles.subtitle}>
              Create a budget based on your available balance
            </Text>

            <View style={styles.incomeCard}>
              <Text style={styles.incomeCardTitle}>Wallet Income</Text>
              <View style={styles.incomeRow}>
                <Text style={styles.incomeLabel}>Total Income:</Text>
                <Text style={styles.incomeAmount}>₱{walletIncome.toLocaleString()}</Text>
              </View>
              <View style={styles.incomeRow}>
                <Text style={styles.incomeLabel}>Available for Budget:</Text>
                <Text style={[styles.incomeAmount, styles.availableAmount]}>
                  ₱{availableBalance.toLocaleString()}
                </Text>
              </View>
              {availableBalance === 0 && (
                <Text style={styles.warningText}>
                  No available balance. Add income first.
                </Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Budget Amount</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter budget amount"
                keyboardType="decimal-pad"
                value={totalIncome}
                onChangeText={setTotalIncome}
              />
              <Text style={styles.helperText}>
                Maximum: ₱{availableBalance.toLocaleString()}
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Budget Period</Text>
              <View style={styles.periodButtons}>
                {["Monthly", "Weekly", "Yearly"].map((period) => (
                  <TouchableOpacity
                    key={period}
                    style={[
                      styles.periodButton,
                      budgetPeriod === period && styles.periodButtonActive,
                    ]}
                    onPress={() => setBudgetPeriod(period)}
                  >
                    <Text
                      style={[
                        styles.periodButtonText,
                        budgetPeriod === period && styles.periodButtonTextActive,
                      ]}
                    >
                      {period}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Budget Rule</Text>

              {Object.keys(budgetRules).map((rule) => (
                <TouchableOpacity
                  key={rule}
                  style={[
                    styles.ruleCard,
                    budgetRule === rule && styles.ruleCardActive,
                  ]}
                  onPress={() => setBudgetRule(rule)}
                >
                  <Text style={styles.ruleName}>{rule} Rule</Text>
                  <View style={styles.ruleBreakdown}>
                    <Text style={styles.ruleText}>
                      {budgetRules[rule].needs}% Needs
                    </Text>
                    <Text style={styles.ruleText}>
                      {budgetRules[rule].wants}% Wants
                    </Text>
                    <Text style={styles.ruleText}>
                      {budgetRules[rule].savings}% Savings
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {totalIncome && budgetRule !== "Custom" && (
              <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>Budget Preview</Text>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Needs:</Text>
                  <Text style={styles.previewAmount}>
                    ₱{needsAmount.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Wants:</Text>
                  <Text style={styles.previewAmount}>
                    ₱{wantsAmount.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Savings:</Text>
                  <Text style={styles.previewAmount}>
                    ₱{savingsAmount.toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.nextButton,
                (!totalIncome || availableBalance === 0) && styles.nextButtonDisabled
              ]}
              onPress={handleNext}
              disabled={!totalIncome || availableBalance === 0}
            >
              <Text style={styles.nextButtonText}>Next: Allocate by Category</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.title}>Allocate Your Budget</Text>
            <Text style={styles.subtitle}>
              Distribute your budget across categories
            </Text>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Total Budget</Text>
              <Text style={styles.summaryAmount}>₱{totalIncome}</Text>
            </View>

            {renderCategoryAllocation(
              needsCategories,
              needsAllocations,
              "needs",
              needsAmount
            )}

            {renderCategoryAllocation(
              wantsCategories,
              wantsAllocations,
              "wants",
              wantsAmount
            )}

            {renderCategoryAllocation(
              savingsCategories,
              savingsAllocations,
              "savings",
              savingsAmount
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setStep(1)}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Create Budget</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
  incomeCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#00B14F",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  incomeCardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  incomeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  incomeLabel: {
    fontSize: 14,
    color: "#666",
  },
  incomeAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  availableAmount: {
    color: "#00B14F",
  },
  warningText: {
    fontSize: 14,
    color: "#FF6B6B",
    marginTop: 8,
    fontWeight: "600",
  },
  helperText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  periodButtons: {
    flexDirection: "row",
    gap: 10,
  },
  periodButton: {
    flex: 1,
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  periodButtonActive: {
    borderColor: "#00B14F",
    backgroundColor: "#E8F5E9",
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  periodButtonTextActive: {
    color: "#00B14F",
  },
  ruleCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  ruleCardActive: {
    borderColor: "#00B14F",
    backgroundColor: "#E8F5E9",
  },
  ruleName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  ruleBreakdown: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  ruleText: {
    fontSize: 14,
    color: "#666",
  },
  previewCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 14,
    color: "#666",
  },
  previewAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00B14F",
  },
  nextButton: {
    backgroundColor: "#00B14F",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  nextButtonDisabled: {
    backgroundColor: "#ccc",
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  summaryCard: {
    backgroundColor: "#00B14F",
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    alignItems: "center",
  },
  summaryTitle: {
    fontSize: 14,
    color: "#fff",
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
  },
  allocationSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  allocationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  allocationTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  allocationBudget: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00B14F",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: 8,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  remainingText: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: "right",
  },
  categoryInput: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  categoryLabel: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  amountInput: {
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    width: 120,
    textAlign: "right",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    marginBottom: 20,
  },
  backButton: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  backButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "bold",
  },
  submitButton: {
    flex: 2,
    backgroundColor: "#00B14F",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});