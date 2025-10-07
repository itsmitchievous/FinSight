import React, { useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  StyleSheet 
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { API_BASE_URL } from "../config";

export default function ForgotPasswordReset({ route }) {
  const router = useRouter();
  const params = useLocalSearchParams(); // works in Expo Router
  const userId = params.userId; // make sure you pass userId in the URL

  const [form, setForm] = useState({
    password: "",
    confirm_password: "",
  });

  const handleChange = (name, value) => setForm({ ...form, [name]: value });

  const handleSubmit = async () => {
    const { password, confirm_password } = form;

    if (!userId) {
      Alert.alert("Error", "Missing user ID. Go back and try again.");
      return;
    }

    if (password !== confirm_password) {
      Alert.alert("Password mismatch", "The passwords you entered do not match.");
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
    if (!passwordRegex.test(password)) {
      Alert.alert(
        "Weak Password",
        "Password must be at least 6 characters long and include:\n- 1 uppercase letter\n- 1 lowercase letter\n- 1 number\n- 1 special character"
      );
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/forgot-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, new_password: password }),
      });

      const data = await res.json();
      console.log("📩 Reset password response:", data);

      if (res.ok) {
        Alert.alert("Success", "Your password has been reset!", [
          { text: "OK", onPress: () => router.replace("/account/Login") }
        ]);
      } else {
        Alert.alert("Error", data.message || "Failed to reset password.");
      }
    } catch (err) {
      console.error("Reset password error:", err);
      Alert.alert("Error", "Could not connect to server.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset Password</Text>
      <TextInput
        style={styles.input}
        placeholder="New Password"
        secureTextEntry
        onChangeText={text => handleChange("password", text)}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm New Password"
        secureTextEntry
        onChangeText={text => handleChange("confirm_password", text)}
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Reset Password</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "#f8f9fa" },
  title: { fontSize: 26, fontWeight: "bold", marginBottom: 30, textAlign: "center" },
  input: {
    height: 50,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    backgroundColor: "#fff",
  },
  button: { backgroundColor: "#28a745", paddingVertical: 15, borderRadius: 10, marginTop: 10 },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "bold", textAlign: "center" },
});