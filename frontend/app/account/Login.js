import React, { useState } from "react";
import { View, Text, TextInput, Button, Alert, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router"; // import router
import { API_BASE_URL } from "../config"; // <-- import config


export default function Login() {
  const [form, setForm] = useState({ email_add: "", password: "" });
  const router = useRouter(); // initialize router

  const handleChange = (name, value) => setForm({ ...form, [name]: value });

const handleSubmit = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    console.log("📩 Login response:", data);

    if (res.ok) {
      // If login is successful, navigate to HomePage
      const userId = data.userId || data.user_id; // get userId from response
      const verified = data.verified; // get verified bool
    
      if (!userId) {
        Alert.alert("Error", "Login succeeded but no user ID returned.");
        return;
      }
    
      if (verified === 1) {
        // Verified, let them in
        Alert.alert(
          "Success",
          data.message || "Login successful!",
          [
            {
              text: "OK",
              onPress: () => router.replace(`/Homepage?userId=${userId}`),
            },
          ],
          { cancelable: false }
        );
      } else {
        Alert.alert(
          "Verification Required",
          "Please enter the OTP sent to your email.",
          [
            {
              text: "OK",
              onPress: () => router.replace(`/account/VerifyOTP?userId=${userId}`),
            },
          ],
          { cancelable: false }
        );
      }
    } else {
      // Request failed (bad credentials, server error, etc.)
      Alert.alert("Login Failed", data.message || "Invalid username or password.");
    }    

  } catch (err) {
    console.error("Login error:", err);
    Alert.alert("Error connecting to server");
  }
};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <TextInput
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
        onChangeText={(text) => handleChange("email_add", text)}
      />
      <TextInput
        placeholder="Password"
        style={styles.input}
        secureTextEntry
        onChangeText={(text) => handleChange("password", text)}
      />
      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Log In</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/account/ForgotPassword")}>
        <Text style={styles.link}>Forgot Password?</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/account/Signup")}>
        <Text style={styles.link}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa", padding: 20, justifyContent: "center" },
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
  button: { backgroundColor: "#28a745", paddingVertical: 15, borderRadius: 10, marginTop: 10, marginBottom: 20 },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "bold", textAlign: "center" },
  link: { color: "#007bff", fontSize: 14, textAlign: "center", marginTop: 5 },
});