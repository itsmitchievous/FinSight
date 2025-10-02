import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { API_BASE_URL } from "../config";

export default function BudgetDetails() {
  const [budgetData, setBudgetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingAllocation, setEditingAllocation] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReallocationModal, setShowReallocationModal] = useState(false);
  const [excessAmount, setExcessAmount] = useState(0);
  const [categoryType, setCategoryType] = useState("");
  const [reallocationOptions, setReallocationOptions] = useState([]);
  const [loadingReallocation, setLoadingReallocation] = useState(false);

  const { budgetId } = useLocalSearchParams();
  const numericBudgetId = Number(budgetId);

  useFocusEffect(
    useCallback(() => {
      fetchBudgetDetails();
    }, [numericBudgetId])
  );

  const fetchBudgetDetails = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/budget-details?budget_id=${numericBudgetId}`
      );
      const data = await response.json();

      if (response.ok) {
        setBudgetData(data);
      } else {
        console.error("Failed to fetch budget details:", data.message);
      }
    } catch (error) {
      console.error("Error fetching budget details:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReallocationOptions = async (allocation) => {
    try {
      setLoadingReallocation(true);
      const response = await fetch(
        `${API_BASE_URL}/reallocatable-categories?budget_id=${numericBudgetId}&category_type=${allocation.category_type}&exclude_allocation_id=${allocation.allocation_id}&user_id=${budgetData.user_id}`
      );
      const data = await response.json();

      if (response.ok) {
        setReallocationOptions(data);
      } else {
        console.error("Failed to fetch reallocation options:", data.message);
        Alert.alert("Error", "Failed to load reallocation options");
      }
    } catch (error) {
      console.error("Error fetching reallocation options:", error);
      Alert.alert("Error", "Failed to load reallocation options");
    } finally {
      setLoadingReallocation(false);
    }
  };

  const groupAllocationsByType = () => {
    if (!budgetData || !budgetData.allocations) return {};

    return budgetData.allocations.reduce((acc, allocation) => {
      const type = allocation.category_type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(allocation);
      return acc;
    }, {});
  };

  const calculateTypeTotal = (type) => {
    const grouped = groupAllocationsByType();
    if (!grouped[type]) return { allocated: 0, spent: 0 };

    return grouped[type].reduce(
      (acc, alloc) => ({
        allocated: acc.allocated + parseFloat(alloc.allocated_amount),
        spent: acc.spent + parseFloat(alloc.spent_amount || 0),
      }),
      { allocated: 0, spent: 0 }
    );
  };

  const getProgressColor = (spent, allocated) => {
    const percentage = (spent / allocated) * 100;
    if (percentage >= 100) return "#FF6B6B";
    if (percentage >= 80) return "#FFB84D";
    return "#00B14F";
  };

  const handleEditAllocation = (allocation) => {
    setEditingAllocation(allocation);
    setEditAmount(allocation.allocated_amount.toString());
    setCategoryType(allocation.category_type);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    const newAmount = parseFloat(editAmount);
    
    if (isNaN(newAmount) || newAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount greater than 0");
      return;
    }

    const oldAmount = parseFloat(editingAllocation.allocated_amount);
    const difference = oldAmount - newAmount;

    // If reducing the allocation, show reallocation options
    if (difference > 0.01) {
      setExcessAmount(difference);
      setShowEditModal(false);
      
      // Fetch reallocation options from database
      await fetchReallocationOptions(editingAllocation);
      setShowReallocationModal(true);
      return;
    }

    // If increasing, check if it exceeds type budget
    if (difference < -0.01) {
      const typeTotals = calculateTypeTotal(categoryType);
      const newTotal = typeTotals.allocated - oldAmount + newAmount;
      
      const typePercentage = getTypePercentageFromRule(categoryType);
      const maxTypeAmount = (parseFloat(budgetData.total_income) * typePercentage) / 100;

      if (newTotal > maxTypeAmount + 0.01) {
        Alert.alert(
          "Exceeds Budget",
          `This would exceed your ${categoryType} budget of ₱${maxTypeAmount.toFixed(2)}.\n\nCurrent total: ₱${typeTotals.allocated.toFixed(2)}\nNew total would be: ₱${newTotal.toFixed(2)}\n\nYou need to reduce other categories first.`
        );
        return;
      }
    }

    // If amount is the same or increasing (and within budget), update directly
    await updateAllocation(editingAllocation.allocation_id, newAmount);
  };

  const handleReallocation = async (selectedOption) => {
    if (!selectedOption) {
      Alert.alert("Error", "Please select a category");
      return;
    }

    const isNewAllocation = !selectedOption.in_budget;
    const newEditAmount = parseFloat(editAmount);
    
    let confirmMessage = "";
    let newTargetAmount = 0;

    if (isNewAllocation) {
      newTargetAmount = excessAmount;
      confirmMessage = `${editingAllocation.category_name}: ₱${parseFloat(editingAllocation.allocated_amount).toFixed(2)} → ₱${newEditAmount.toFixed(2)}\n\n${selectedOption.category_name}: Will be added with ₱${newTargetAmount.toFixed(2)}\n\nThis will add a new category to your budget.\n\nContinue?`;
    } else {
      newTargetAmount = parseFloat(selectedOption.allocated_amount) + excessAmount;
      confirmMessage = `${editingAllocation.category_name}: ₱${parseFloat(editingAllocation.allocated_amount).toFixed(2)} → ₱${newEditAmount.toFixed(2)}\n\n${selectedOption.category_name}: ₱${parseFloat(selectedOption.allocated_amount).toFixed(2)} → ₱${newTargetAmount.toFixed(2)}\n\nExcess of ₱${excessAmount.toFixed(2)} will be added to ${selectedOption.category_name}.\n\nContinue?`;
    }

    Alert.alert(
      "Confirm Reallocation",
      confirmMessage,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/reallocate-budget`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  budget_id: numericBudgetId,
                  source_allocation_id: editingAllocation.allocation_id,
                  target_category_id: selectedOption.category_id,
                  target_allocation_id: selectedOption.allocation_id || null,
                  new_source_amount: newEditAmount,
                  excess_amount: excessAmount,
                }),
              });

              const data = await response.json();

              if (!response.ok) {
                throw new Error(data.message || "Failed to reallocate budget");
              }
              
              setShowReallocationModal(false);
              Alert.alert("Success", data.message);
              fetchBudgetDetails();
            } catch (error) {
              console.error("Error reallocating budget:", error);
              Alert.alert("Error", error.message || "Failed to reallocate budget");
            }
          },
        },
      ]
    );
  };

  const updateAllocation = async (allocationId, newAmount) => {
    try {
      const response = await fetch(`${API_BASE_URL}/update-budget-allocation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocation_id: allocationId,
          allocated_amount: newAmount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update allocation");
      }

      setShowEditModal(false);
      Alert.alert("Success", "Allocation updated successfully");
      fetchBudgetDetails();
    } catch (error) {
      console.error("Error updating allocation:", error);
      Alert.alert("Error", error.message || "Failed to update allocation");
    }
  };

  const getTypePercentageFromRule = (type) => {
    const rules = {
      "50-30-20": { Need: 50, Want: 30, Savings: 20 },
      "70-20-10": { Need: 70, Want: 20, Savings: 10 },
    };
    return rules[budgetData.budget_rule]?.[type] || 0;
  };

  const renderCategoryGroup = (type, categories) => {
    if (!categories || categories.length === 0) return null;

    const totals = calculateTypeTotal(type);
    const percentage = (totals.spent / totals.allocated) * 100;
    const remaining = totals.allocated - totals.spent;

    return (
      <View key={type} style={styles.categoryGroup}>
        <View style={styles.groupHeader}>
          <Text style={styles.groupTitle}>{type}</Text>
          <View style={styles.groupTotals}>
            <Text
              style={[
                styles.totalLabel,
                { color: getProgressColor(totals.spent, totals.allocated) },
              ]}
            >
              ₱{remaining.toLocaleString()} left
            </Text>
          </View>
        </View>

        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${Math.min(percentage, 100)}%`,
                backgroundColor: getProgressColor(totals.spent, totals.allocated),
              },
            ]}
          />
        </View>

        <Text style={styles.percentageText}>
          {percentage.toFixed(1)}% used • ₱{totals.spent.toLocaleString()} of ₱
          {totals.allocated.toLocaleString()}
        </Text>

        <View style={styles.categoriesList}>
          {categories.map((allocation) => {
            const allocPercentage =
              (parseFloat(allocation.spent_amount) /
                parseFloat(allocation.allocated_amount)) *
              100;
            const categoryRemaining =
              parseFloat(allocation.allocated_amount) -
              parseFloat(allocation.spent_amount);

            return (
              <View key={allocation.allocation_id} style={styles.categoryItem}>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>
                    {allocation.category_name}
                  </Text>
                  <View style={styles.categoryAmounts}>
                    <Text
                      style={[
                        styles.remainingAmount,
                        {
                          color: getProgressColor(
                            parseFloat(allocation.spent_amount),
                            parseFloat(allocation.allocated_amount)
                          ),
                        },
                      ]}
                    >
                      ₱{categoryRemaining.toLocaleString()}
                    </Text>
                    <Text style={styles.allocatedAmount}> left</Text>
                  </View>
                </View>

                <View style={styles.categoryProgressContainer}>
                  <View style={styles.categoryProgressBar}>
                    <View
                      style={[
                        styles.categoryProgressFill,
                        {
                          width: `${Math.min(allocPercentage, 100)}%`,
                          backgroundColor: getProgressColor(
                            parseFloat(allocation.spent_amount),
                            parseFloat(allocation.allocated_amount)
                          ),
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.categoryBottomRow}>
                    <Text style={styles.categoryBreakdownText}>
                      ₱{parseFloat(allocation.spent_amount).toLocaleString()} / ₱
                      {parseFloat(allocation.allocated_amount).toLocaleString()}
                    </Text>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => handleEditAllocation(allocation)}
                    >
                      <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
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

  const groupedAllocations = groupAllocationsByType();
  const totalSpent = budgetData.allocations.reduce(
    (sum, alloc) => sum + parseFloat(alloc.spent_amount || 0),
    0
  );
  const totalRemaining = parseFloat(budgetData.total_income) - totalSpent;
  const overallPercentage =
    (totalSpent / parseFloat(budgetData.total_income)) * 100;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{budgetData.budget_name}</Text>
        <Text style={styles.subtitle}>
          {budgetData.budget_rule} • {budgetData.budget_period}
        </Text>

        <View style={styles.overallCard}>
          <Text style={styles.overallLabel}>Budget Remaining</Text>
          <Text
            style={[
              styles.overallAmount,
              {
                color: getProgressColor(
                  totalSpent,
                  parseFloat(budgetData.total_income)
                ),
              },
            ]}
          >
            ₱{totalRemaining.toLocaleString()}
          </Text>

          <View style={styles.overallStats}>
            <View style={styles.overallStatItem}>
              <Text style={styles.overallStatLabel}>Spent</Text>
              <Text style={[styles.overallStatValue, styles.spentValue]}>
                ₱{totalSpent.toLocaleString()}
              </Text>
            </View>
            <View style={styles.overallStatItem}>
              <Text style={styles.overallStatLabel}>Total Budget</Text>
              <Text style={styles.overallStatValue}>
                ₱{parseFloat(budgetData.total_income).toLocaleString()}
              </Text>
            </View>
          </View>

          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${Math.min(overallPercentage, 100)}%`,
                  backgroundColor: getProgressColor(
                    totalSpent,
                    parseFloat(budgetData.total_income)
                  ),
                },
              ]}
            />
          </View>
          <Text style={styles.percentageText}>
            {overallPercentage.toFixed(1)}% of budget used
          </Text>
        </View>

        {renderCategoryGroup("Need", groupedAllocations.Need)}
        {renderCategoryGroup("Want", groupedAllocations.Want)}
        {renderCategoryGroup("Savings", groupedAllocations.Savings)}
      </ScrollView>

      {/* Edit Allocation Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Allocation</Text>
            <Text style={styles.modalSubtitle}>
              {editingAllocation?.category_name}
            </Text>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalLabel}>Current Amount</Text>
              <Text style={styles.currentAmount}>
                ₱{parseFloat(editingAllocation?.allocated_amount || 0).toLocaleString()}
              </Text>
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalLabel}>New Amount</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter new amount"
                keyboardType="decimal-pad"
                value={editAmount}
                onChangeText={setEditAmount}
              />
            </View>

            <Text style={styles.helperText}>
              If you reduce this amount, you'll need to allocate the excess to another existing category in the same type.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSaveEdit}
              >
                <Text style={styles.modalSaveText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reallocation Modal */}
      <Modal
        visible={showReallocationModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowReallocationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reallocate Excess Amount</Text>
            <View style={styles.excessCard}>
              <Text style={styles.excessLabel}>Excess from {editingAllocation?.category_name}</Text>
              <Text style={styles.excessAmount}>₱{excessAmount.toFixed(2)}</Text>
            </View>

            <Text style={styles.instructionText}>
              Choose an existing {categoryType} category to receive this excess amount:
            </Text>

            {loadingReallocation ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#00B14F" />
                <Text style={styles.loadingText}>Loading categories...</Text>
              </View>
            ) : (
              <ScrollView style={styles.reallocationList}>
                {reallocationOptions.length > 0 ? (
                  <>
                    {/* Categories already in budget */}
                    {reallocationOptions.filter(opt => opt.in_budget).length > 0 && (
                      <>
                        <Text style={styles.sectionTitle}>
                          Existing {categoryType} Categories in Budget
                        </Text>
                        {reallocationOptions
                          .filter(opt => opt.in_budget)
                          .map((option) => (
                            <TouchableOpacity
                              key={option.category_id}
                              style={styles.reallocationOption}
                              onPress={() => handleReallocation(option)}
                            >
                              <View style={styles.optionContent}>
                                <Text style={styles.reallocationOptionName}>
                                  {option.category_name}
                                </Text>
                                <Text style={styles.reallocationOptionAmount}>
                                  ₱{parseFloat(option.allocated_amount).toLocaleString()} → ₱
                                  {(parseFloat(option.allocated_amount) + excessAmount).toLocaleString()}
                                </Text>
                              </View>
                              <Text style={styles.selectText}>Select</Text>
                            </TouchableOpacity>
                          ))}
                      </>
                    )}

                    {/* Categories not yet in budget */}
                    {reallocationOptions.filter(opt => !opt.in_budget).length > 0 && (
                      <>
                        <Text style={styles.sectionTitle}>
                          Add New {categoryType} Category to Budget
                        </Text>
                        {reallocationOptions
                          .filter(opt => !opt.in_budget)
                          .map((option) => (
                            <TouchableOpacity
                              key={option.category_id}
                              style={styles.reallocationOptionNew}
                              onPress={() => handleReallocation(option)}
                            >
                              <View style={styles.optionContent}>
                                <View style={styles.newCategoryHeader}>
                                  <Text style={styles.reallocationOptionName}>
                                    {option.category_name}
                                  </Text>
                                  <View style={styles.newBadge}>
                                    <Text style={styles.newBadgeText}>NEW</Text>
                                  </View>
                                </View>
                                <Text style={styles.reallocationOptionAmountNew}>
                                  Will be added with ₱{excessAmount.toLocaleString()}
                                </Text>
                              </View>
                              <Text style={styles.selectText}>Select</Text>
                            </TouchableOpacity>
                          ))}
                      </>
                    )}
                  </>
                ) : (
                  <View style={styles.noCategoriesCard}>
                    <Text style={styles.noCategoriesText}>
                      No {categoryType} categories available.
                    </Text>
                    <Text style={styles.noCategoriesHint}>
                      Create a new {categoryType} category in Categories settings first.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.modalCancelButtonFull}
              onPress={() => {
                setShowReallocationModal(false);
                setShowEditModal(true);
              }}
            >
              <Text style={styles.modalCancelText}>Back</Text>
            </TouchableOpacity>
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
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#666",
  },
  errorText: {
    fontSize: 16,
    color: "#FF6B6B",
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
    marginBottom: 20,
  },
  overallCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  overallLabel: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  overallAmount: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 8,
  },
  overallStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  overallStatItem: {
    alignItems: "center",
  },
  overallStatLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  overallStatValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  spentValue: {
    color: "#FF6B6B",
  },
  categoryGroup: {
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
  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  groupTotals: {
    alignItems: "flex-end",
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  percentageText: {
    fontSize: 12,
    color: "#666",
    textAlign: "right",
    marginBottom: 16,
  },
  categoriesList: {
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 12,
  },
  categoryItem: {
    marginBottom: 16,
  },
  categoryInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  categoryAmounts: {
    flexDirection: "row",
    alignItems: "center",
  },
  remainingAmount: {
    fontSize: 14,
    fontWeight: "600",
  },
  allocatedAmount: {
    fontSize: 14,
    color: "#666",
  },
  categoryProgressContainer: {
    width: "100%",
  },
  categoryProgressBar: {
    height: 6,
    backgroundColor: "#e0e0e0",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 4,
  },
  categoryProgressFill: {
    height: "100%",
    borderRadius: 3,
  },
  categoryBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryBreakdownText: {
    fontSize: 11,
    color: "#999",
  },
  editButton: {
    backgroundColor: "#00B14F",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  editButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  modalInputGroup: {
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  currentAmount: {
    fontSize: 16,
    color: "#666",
  },
  modalInput: {
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  helperText: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCancelButtonFull: {
    backgroundColor: "#f0f0f0",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  modalCancelText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: "#00B14F",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalSaveText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  excessCard: {
    backgroundColor: "#FFF3E0",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FFB84D",
    alignItems: "center",
  },
  excessLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  excessAmount: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FF9800",
  },
  instructionText: {
    fontSize: 14,
    color: "#333",
    marginBottom: 16,
    fontWeight: "500",
  },
  reallocationList: {
    maxHeight: 350,
    marginBottom: 8,
  },
  reallocationOption: {
    backgroundColor: "#f8f8f8",
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optionContent: {
    flex: 1,
  },
  reallocationOptionName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  reallocationOptionAmount: {
    fontSize: 12,
    color: "#00B14F",
  },
  selectText: {
    fontSize: 14,
    color: "#00B14F",
    fontWeight: "600",
  },
  noCategoriesCard: {
    backgroundColor: "#f8f8f8",
    padding: 20,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: "center",
  },
  noCategoriesText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginBottom: 8,
  },
  noCategoriesHint: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    fontStyle: "italic",
  },
  reallocationOptionNew: {
    backgroundColor: "#E8F5E9",
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#00B14F",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  newCategoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  newBadge: {
    backgroundColor: "#00B14F",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  newBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  reallocationOptionAmountNew: {
    fontSize: 12,
    color: "#00B14F",
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 12,
  },
});