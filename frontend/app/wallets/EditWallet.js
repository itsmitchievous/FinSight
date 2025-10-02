import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import DropDownPicker from "react-native-dropdown-picker";
import { API_BASE_URL } from "../config"; 


export default function EditWallet() {
  const router = useRouter();
  const { userId, walletId } = useLocalSearchParams();

  const numericUserId = parseInt(userId, 10);
  const numericWalletId = parseInt(walletId, 10);

  const [walletName, setWalletName] = useState("");

  // Dropdown state
  const [walletTypeOpen, setWalletTypeOpen] = useState(false);
  const [walletTypeValue, setWalletTypeValue] = useState(null);
  const [walletTypeItems, setWalletTypeItems] = useState([
    { label: "Cash", value: "Cash" },
    { label: "Bank", value: "Bank" },
    { label: "E-Wallet", value: "E-Wallet" },
    { label: "Savings", value: "Savings" },
    { label: "Other", value: "Other" },
  ]);

  // Fetch current wallet data
  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/wallet-details?user_id=${numericUserId}&wallet_id=${numericWalletId}`
        );
        const data = await response.json();
        if (response.ok) {
          setWalletName(data.wallet_name);
          setWalletTypeValue(data.wallet_type); // prefill dropdown
        } else {
          Alert.alert("Error", data.message || "Failed to fetch wallet details");
        }
      } catch (error) {
        console.error("Error fetching wallet:", error);
      }
    };
    fetchWallet();
  }, []);

const handleUpdateWallet = async () => {
  if (!walletName || !walletTypeValue) {
    Alert.alert("Validation", "Both wallet name and type are required");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/update-wallet`, {
      method: "PUT",   // ✅ must match backend
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: numericUserId,
        wallet_id: numericWalletId,
        wallet_name: walletName,
        wallet_type: walletTypeValue,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      Alert.alert("Success", "Wallet updated successfully");
      router.push(
        `wallets/WalletDetails?userId=${numericUserId}&walletId=${numericWalletId}`
      );
    } else {
      Alert.alert("Error", data.message || "Failed to update wallet");
    }
  } catch (error) {
    console.error("Error updating wallet:", error);
    Alert.alert("Error", "Something went wrong while updating wallet");
  }
};


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Wallet</Text>

      <Text style={styles.label}>Wallet Name</Text>
      <TextInput
        style={styles.input}
        value={walletName}
        onChangeText={setWalletName}
      />

      <Text style={styles.label}>Wallet Type</Text>
      <DropDownPicker
        open={walletTypeOpen}
        value={walletTypeValue}
        items={walletTypeItems}
        setOpen={setWalletTypeOpen}
        setValue={setWalletTypeValue}
        setItems={setWalletTypeItems}
        placeholder="Select wallet type"
        style={styles.dropdown}
        dropDownContainerStyle={styles.dropdownContainer}
      />

      <TouchableOpacity style={styles.button} onPress={handleUpdateWallet}>
        <Text style={styles.buttonText}>Save Changes</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 15,
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: "#ccc",
  },
  button: {
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
