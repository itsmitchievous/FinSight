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
  Modal,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { API_BASE_URL } from "../config";

export default function AddBudget() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // All wallets data
  const [wallets, setWallets] = useState([]);
  const [totalWalletIncome, setTotalWalletIncome] = useState(0);

  // Step 1: Income & Rule Selection
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetRule, setBudgetRule] = useState("50-30-20");
  const [budgetPeriod, setBudgetPeriod] = useState("Monthly");

  // Step 2: Category Allocation with Wallet Selection
  const [needsCategories, setNeedsCategories] = useState([]);
  const [wantsCategories, setWantsCategories] = useState([]);
  const [savingsCategories, setSavingsCategories] = useState([]);

  // Format: { category_id: { wallet_id: X, amount: Y, category_name: Z } }
  const [needsAllocations, setNeedsAllocations] = useState({});
  const [wantsAllocations, setWantsAllocations] = useState({});
  const [savingsAllocations, setSavingsAllocations] = useState({});

  // Track remaining balance per wallet
  const [walletBalances, setWalletBalances] = useState({});

  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [currentAllocationCategory, setCurrentAllocationCategory] = useState(null);
  const [currentAllocationType, setCurrentAllocationType] = useState(null);

  // Calculated amounts
  const [needsAmount, setNeedsAmount] = useState(0);
  const [wantsAmount, setWantsAmount] = useState(0);
  const [savingsAmount, setSavingsAmount] = useState(0);

  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const numericUserId = Number(userId);

  const budgetRules = {
    "50-30-20": { needs: 50, wants: 30, savings: 20 },
    "70-20-10": { needs: 70, wants: 20, savings: 10 },
  };

  // Fetch all wallets income on mount
  useEffect(() => {
    fetchAllWalletsIncome();
  }, []);

  // Initialize wallet balances when wallets are loaded
  useEffect(() => {
    if (wallets.length > 0) {
      const balances = {};
      wallets.forEach(wallet => {
        balances[wallet.wallet_id] = wallet.total_income;
      });
      setWalletBalances(balances);
    }
  }, [wallets]);

  // Recalculate wallet balances whenever allocations change
  useEffect(() => {
    if (wallets.length > 0) {
      const balances = {};
      wallets.forEach(wallet => {
        balances[wallet.wallet_id] = wallet.total_income;
      });

      // Deduct all allocations
      const allAllocations = [
        ...Object.values(needsAllocations),
        ...Object.values(wantsAllocations),
        ...Object.values(savingsAllocations)
      ];

      allAllocations.forEach(allocation => {
        if (allocation.wallet_id && allocation.amount > 0) {
          balances[allocation.wallet_id] -= allocation.amount;
        }
      });

      setWalletBalances(balances);
    }
  }, [needsAllocations, wantsAllocations, savingsAllocations, wallets]);

  const fetchAllWalletsIncome = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/total-income-all-wallets?user_id=${numericUserId}`
      );
      const data = await response.json();

      if (response.ok) {
        setWallets(data.wallets || []);
        setTotalWalletIncome(data.total_income || 0);
      }
    } catch (error) {
      console.error("Error fetching wallet income:", error);
    }
  };

  useEffect(() => {
    if (budgetAmount && budgetRule !== "Custom") {
      const income = parseFloat(budgetAmount) || 0;
      const rule = budgetRules[budgetRule];
      
      setNeedsAmount((income * rule.needs) / 100);
      setWantsAmount((income * rule.wants) / 100);
      setSavingsAmount((income * rule.savings) / 100);
    }
  }, [budgetAmount, budgetRule]);

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
      if (!budgetAmount || parseFloat(budgetAmount) <= 0) {
        Alert.alert("Invalid Input", "Please enter a valid budget amount");
        return;
      }

      if (totalWalletIncome === 0) {
        Alert.alert(
          "No Income Found",
          "You need to add income to at least one wallet before creating a budget.",
          [{ text: "OK" }]
        );
        return;
      }

      if (parseFloat(budgetAmount) > totalWalletIncome) {
        Alert.alert(
          "Insufficient Income",
          `Your budget amount (₱${parseFloat(budgetAmount).toLocaleString()}) cannot exceed your total wallet income (₱${totalWalletIncome.toLocaleString()}).`,
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

  const handleAddCategory = (type) => {
    setCurrentAllocationType(type);
    setShowCategoryModal(true);
  };

  const handleSelectCategory = (category) => {
    const type = currentAllocationType;
    let allocations;
    
    if (type === "needs") allocations = needsAllocations;
    else if (type === "wants") allocations = wantsAllocations;
    else allocations = savingsAllocations;

    // Check if category already added
    if (allocations[category.category_id]) {
      Alert.alert("Already Added", "This category is already in your budget");
      setShowCategoryModal(false);
      return;
    }

    // Add category with default values
    if (type === "needs") {
      setNeedsAllocations({ 
        ...needsAllocations, 
        [category.category_id]: { 
          wallet_id: null, 
          amount: 0,
          category_name: category.category_name 
        } 
      });
    } else if (type === "wants") {
      setWantsAllocations({ 
        ...wantsAllocations, 
        [category.category_id]: { 
          wallet_id: null, 
          amount: 0,
          category_name: category.category_name 
        } 
      });
    } else if (type === "savings") {
      setSavingsAllocations({ 
        ...savingsAllocations, 
        [category.category_id]: { 
          wallet_id: null, 
          amount: 0,
          category_name: category.category_name 
        } 
      });
    }

    setShowCategoryModal(false);
  };

  const handleRemoveCategory = (categoryId, type) => {
    if (type === "needs") {
      const updated = { ...needsAllocations };
      delete updated[categoryId];
      setNeedsAllocations(updated);
    } else if (type === "wants") {
      const updated = { ...wantsAllocations };
      delete updated[categoryId];
      setWantsAllocations(updated);
    } else if (type === "savings") {
      const updated = { ...savingsAllocations };
      delete updated[categoryId];
      setSavingsAllocations(updated);
    }
  };

  const handleAllocationChange = (categoryId, walletId, amount, type) => {
    const numAmount = parseFloat(amount) || 0;

    // Get current allocation for this category
    let currentAllocation;
    if (type === "needs") currentAllocation = needsAllocations[categoryId];
    else if (type === "wants") currentAllocation = wantsAllocations[categoryId];
    else currentAllocation = savingsAllocations[categoryId];

    // If wallet is selected, check if it has enough balance
    if (walletId && numAmount > 0) {
      const wallet = wallets.find(w => w.wallet_id === walletId);
      if (wallet) {
        // Calculate what the remaining balance would be
        let availableBalance = wallet.total_income;
        
        // Deduct all current allocations for this wallet
        const allAllocations = [
          ...Object.values(needsAllocations),
          ...Object.values(wantsAllocations),
          ...Object.values(savingsAllocations)
        ];

        allAllocations.forEach(allocation => {
          if (allocation.wallet_id === walletId && allocation.amount > 0) {
            availableBalance -= allocation.amount;
          }
        });

        // Add back the current category's allocation if it exists and is from the same wallet
        if (currentAllocation && currentAllocation.wallet_id === walletId) {
          availableBalance += currentAllocation.amount;
        }

        // Check if new amount exceeds available balance
        if (numAmount > availableBalance) {
          Alert.alert(
            "Insufficient Wallet Balance",
            `${wallet.wallet_name} only has ₱${availableBalance.toFixed(2)} available.\n\nTotal Income: ₱${wallet.total_income.toLocaleString()}\nAlready Allocated: ₱${(wallet.total_income - availableBalance).toFixed(2)}\nAvailable: ₱${availableBalance.toFixed(2)}`
          );
          return;
        }
      }
    }

    if (type === "needs") {
      setNeedsAllocations({ 
        ...needsAllocations, 
        [categoryId]: { 
          wallet_id: walletId, 
          amount: numAmount,
          category_name: currentAllocation?.category_name 
        } 
      });
    } else if (type === "wants") {
      setWantsAllocations({ 
        ...wantsAllocations, 
        [categoryId]: { 
          wallet_id: walletId, 
          amount: numAmount,
          category_name: currentAllocation?.category_name 
        } 
      });
    } else if (type === "savings") {
      setSavingsAllocations({ 
        ...savingsAllocations, 
        [categoryId]: { 
          wallet_id: walletId, 
          amount: numAmount,
          category_name: currentAllocation?.category_name 
        } 
      });
    }
  };

  const handleOpenWalletModal = (categoryId, type) => {
    setCurrentAllocationCategory({ categoryId, type });
    setShowWalletModal(true);
  };

  const handleSelectWallet = (wallet) => {
    const { categoryId, type } = currentAllocationCategory;
    
    let currentAllocation;
    if (type === "needs") currentAllocation = needsAllocations[categoryId];
    else if (type === "wants") currentAllocation = wantsAllocations[categoryId];
    else currentAllocation = savingsAllocations[categoryId];

    handleAllocationChange(
      categoryId,
      wallet.wallet_id,
      currentAllocation?.amount || 0,
      type
    );

    setShowWalletModal(false);
  };

  const getTotalAllocated = (type) => {
    let allocations;
    if (type === "needs") allocations = needsAllocations;
    else if (type === "wants") allocations = wantsAllocations;
    else allocations = savingsAllocations;

    return Object.values(allocations).reduce((sum, val) => sum + (val.amount || 0), 0);
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

    // Check if all allocations have wallet assigned
    const allAllocations = [
      ...Object.values(needsAllocations),
      ...Object.values(wantsAllocations),
      ...Object.values(savingsAllocations)
    ];

    const missingWallet = allAllocations.some(alloc => !alloc.wallet_id && alloc.amount > 0);
    if (missingWallet) {
      Alert.alert("Error", "Please assign a wallet to all allocations");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateAllocations()) return;

    const allocations = [];

    Object.entries(needsAllocations).forEach(([categoryId, data]) => {
      if (data.amount > 0) {
        allocations.push({
          category_id: parseInt(categoryId),
          wallet_id: data.wallet_id,
          amount: data.amount,
          category_type: "Need",
        });
      }
    });

    Object.entries(wantsAllocations).forEach(([categoryId, data]) => {
      if (data.amount > 0) {
        allocations.push({
          category_id: parseInt(categoryId),
          wallet_id: data.wallet_id,
          amount: data.amount,
          category_type: "Want",
        });
      }
    });

    Object.entries(savingsAllocations).forEach(([categoryId, data]) => {
      if (data.amount > 0) {
        allocations.push({
          category_id: parseInt(categoryId),
          wallet_id: data.wallet_id,
          amount: data.amount,
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
      const response = await fetch(`${API_BASE_URL}/create-budget-home`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: numericUserId,
          budget_name: `${budgetRule} Budget`,
          total_income: parseFloat(budgetAmount),
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

  const getAvailableCategories = (type) => {
    let categories, allocations;
    
    if (type === "needs") {
      categories = needsCategories;
      allocations = needsAllocations;
    } else if (type === "wants") {
      categories = wantsCategories;
      allocations = wantsAllocations;
    } else {
      categories = savingsCategories;
      allocations = savingsAllocations;
    }

    return categories.filter(cat => !allocations[cat.category_id]);
  };

  const renderCategoryAllocation = (allocations, type, budgetAmount) => {
    const remaining = getRemainingAmount(type);
    const totalAllocated = getTotalAllocated(type);
    const allocationEntries = Object.entries(allocations);

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

        {/* Added Categories */}
        {allocationEntries.map(([categoryId, allocation]) => {
          const selectedWallet = wallets.find(w => w.wallet_id === allocation.wallet_id);
          
          return (
            <View key={categoryId} style={styles.categoryCard}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryLabel}>{allocation.category_name}</Text>
                <TouchableOpacity
                  onPress={() => handleRemoveCategory(categoryId, type)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.inputRow}>
                <View style={styles.walletSelectorContainer}>
                  <Text style={styles.inputLabel}>Wallet</Text>
                  <TouchableOpacity
                    style={styles.walletSelector}
                    onPress={() => handleOpenWalletModal(categoryId, type)}
                  >
                    <Text style={styles.walletSelectorText}>
                      {selectedWallet ? selectedWallet.wallet_name : "Select Wallet"}
                    </Text>
                    <Text style={styles.dropdownIcon}>▼</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.amountInputContainer}>
                  <Text style={styles.inputLabel}>Amount</Text>
                  <TextInput
                    style={[
                      styles.amountInput,
                      !allocation.wallet_id && styles.amountInputDisabled
                    ]}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    value={allocation.amount ? allocation.amount.toString() : ""}
                    onChangeText={(text) =>
                      handleAllocationChange(
                        categoryId, 
                        allocation.wallet_id,
                        text, 
                        type
                      )
                    }
                    editable={!!allocation.wallet_id}
                  />
                </View>
              </View>
            </View>
          );
        })}

        {/* Add Category Button */}
        <TouchableOpacity
          style={styles.addCategoryButton}
          onPress={() => handleAddCategory(type)}
        >
          <Text style={styles.addCategoryButtonText}>+ Add Category</Text>
        </TouchableOpacity>
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
            <Text style={styles.title}>Create Budget</Text>
            <Text style={styles.subtitle}>
              Budget across all your wallets
            </Text>

            <View style={styles.incomeCard}>
              <Text style={styles.incomeCardTitle}>Total Wallet Income</Text>
              <Text style={styles.incomeAmount}>
                ₱{totalWalletIncome.toLocaleString()}
              </Text>
              
              <View style={styles.walletsList}>
                {wallets.map(wallet => (
                  <View key={wallet.wallet_id} style={styles.walletItem}>
                    <Text style={styles.walletItemName}>{wallet.wallet_name}</Text>
                    <Text style={styles.walletItemAmount}>
                      ₱{wallet.total_income.toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Budget Amount</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter budget amount"
                keyboardType="decimal-pad"
                value={budgetAmount}
                onChangeText={setBudgetAmount}
              />
              <Text style={styles.helperText}>
                Maximum: ₱{totalWalletIncome.toLocaleString()}
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

            {budgetAmount && budgetRule !== "Custom" && (
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
                (!budgetAmount || totalWalletIncome === 0) && styles.nextButtonDisabled
              ]}
              onPress={handleNext}
              disabled={!budgetAmount || totalWalletIncome === 0}
            >
              <Text style={styles.nextButtonText}>Next: Allocate by Category</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.title}>Allocate Your Budget</Text>
            <Text style={styles.subtitle}>
              Assign categories to specific wallets
            </Text>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Total Budget</Text>
              <Text style={styles.summaryAmount}>₱{budgetAmount}</Text>
            </View>

            {/* Wallet Balance Summary - Show once before allocations */}
            <View style={styles.walletBalanceSummaryGlobal}>
              <Text style={styles.walletBalanceTitle}>Wallet Balances:</Text>
              {wallets.map(wallet => {
                const balance = walletBalances[wallet.wallet_id] || 0;
                const isLow = balance < wallet.total_income * 0.2;
                return (
                  <View key={wallet.wallet_id} style={styles.walletBalanceItem}>
                    <Text style={styles.walletBalanceName}>{wallet.wallet_name}</Text>
                    <Text style={[
                      styles.walletBalanceAmount,
                      { color: balance < 0 ? "#FF6B6B" : isLow ? "#FF9800" : "#00B14F" }
                    ]}>
                      ₱{balance.toFixed(2)} / ₱{wallet.total_income.toLocaleString()}
                    </Text>
                  </View>
                );
              })}
            </View>

            {renderCategoryAllocation(needsAllocations, "needs", needsAmount)}
            {renderCategoryAllocation(wantsAllocations, "wants", wantsAmount)}
            {renderCategoryAllocation(savingsAllocations, "savings", savingsAmount)}

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

      {/* Category Selection Modal */}
      <Modal
        visible={showCategoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalList}>
              {getAvailableCategories(currentAllocationType).map(category => (
                <TouchableOpacity
                  key={category.category_id}
                  style={styles.modalItem}
                  onPress={() => handleSelectCategory(category)}
                >
                  <Text style={styles.modalItemText}>{category.category_name}</Text>
                </TouchableOpacity>
              ))}
              {getAvailableCategories(currentAllocationType).length === 0 && (
                <Text style={styles.emptyText}>No more categories available</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Wallet Selection Modal */}
      <Modal
        visible={showWalletModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowWalletModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Wallet</Text>
              <TouchableOpacity onPress={() => setShowWalletModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalList}>
              {wallets.map(wallet => {
                const balance = walletBalances[wallet.wallet_id] || 0;
                const isLow = balance < wallet.total_income * 0.2;
                const isNegative = balance < 0;

                return (
                  <TouchableOpacity
                    key={wallet.wallet_id}
                    style={[
                      styles.walletModalItem,
                      isNegative && styles.walletModalItemDisabled
                    ]}
                    onPress={() => !isNegative && handleSelectWallet(wallet)}
                    disabled={isNegative}
                  >
                    <View style={styles.walletModalInfo}>
                      <Text style={[
                        styles.walletModalName,
                        isNegative && styles.disabledText
                      ]}>
                        {wallet.wallet_name}
                      </Text>
                      <Text style={[
                        styles.walletModalBalance,
                        { color: isNegative ? "#FF6B6B" : isLow ? "#FF9800" : "#00B14F" }
                      ]}>
                        Available: ₱{balance.toFixed(2)}
                      </Text>
                      <Text style={styles.walletModalTotal}>
                        Total: ₱{wallet.total_income.toLocaleString()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
    marginBottom: 8,
  },
  incomeAmount: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00B14F",
    marginBottom: 12,
  },
  walletsList: {
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingTop: 12,
  },
  walletItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  walletItemName: {
    fontSize: 14,
    color: "#666",
  },
  walletItemAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
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
  categoryCard: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  categoryLabel: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
    flex: 1,
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FF6B6B",
    justifyContent: "center",
    alignItems: "center",
  },
  removeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  amountInputContainer: {
    flex: 1,
  },
  walletSelectorContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 6,
    fontWeight: "500",
  },
  amountInput: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  amountInputDisabled: {
    backgroundColor: "#f5f5f5",
    color: "#999",
  },
  walletSelector: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  walletSelectorText: {
    fontSize: 14,
    color: "#333",
  },
  dropdownIcon: {
    fontSize: 10,
    color: "#666",
  },
  walletBalanceSummaryGlobal: {
    backgroundColor: "#f0f9ff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#b3e0ff",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  walletBalanceTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  walletBalanceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  walletBalanceName: {
    fontSize: 12,
    color: "#666",
  },
  walletBalanceAmount: {
    fontSize: 12,
    fontWeight: "600",
  },
  addCategoryButton: {
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#00B14F",
    borderStyle: "dashed",
  },
  addCategoryButtonText: {
    color: "#00B14F",
    fontSize: 14,
    fontWeight: "600",
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  modalClose: {
    fontSize: 24,
    color: "#666",
    fontWeight: "bold",
  },
  modalList: {
    padding: 16,
  },
  modalItem: {
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  modalItemText: {
    fontSize: 15,
    color: "#333",
    fontWeight: "500",
  },
  walletModalItem: {
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  walletModalItemDisabled: {
    backgroundColor: "#f5f5f5",
    opacity: 0.5,
  },
  walletModalInfo: {
    gap: 4,
  },
  walletModalName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  walletModalBalance: {
    fontSize: 13,
    fontWeight: "600",
  },
  walletModalTotal: {
    fontSize: 12,
    color: "#666",
  },
  disabledText: {
    color: "#999",
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    fontSize: 14,
    marginTop: 20,
  },
});