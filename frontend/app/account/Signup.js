import React, { useState } from "react";
import { View, Text, TextInput, Button, Alert, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import { API_BASE_URL } from "../config";

export default function Signup() {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: "",
    email_add: "",
    password: "",
    confirm_password: ""
  });

  const handleChange = (name, value) => setForm({ ...form, [name]: value });

  const handleSubmit = async () => {
    const { full_name, email_add, password, confirm_password } = form;

    // 1. Check password match
    if (password !== confirm_password) {
      Alert.alert("Password mismatch", "The passwords you entered do not match.");
      return;
    }

    // 2. Validate password complexity
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
    if (!passwordRegex.test(password)) {
      Alert.alert(
        "Weak Password",
        "Password must be at least 6 characters long and include:\n- 1 uppercase letter\n- 1 lowercase letter\n- 1 number\n- 1 special character"
      );
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name, email_add, password }),
      });

      const data = await res.json();
      console.log("📩 Signup response:", data);

      if (res.ok) {
        const userId = data.userId || data.user_id;
        if (!userId) {
          Alert.alert("Error", "Signup succeeded but no userId returned.");
          return;
        }

        Alert.alert("Success", data.message || "Signup successful!");

        // Navigate to VerifyOTP with userId param
        router.push({
          pathname: "/account/VerifyOTP",
          params: { userId: String(userId),
          flow: "signup"},
        });
      } else {
        Alert.alert("Signup Failed", data.message || "Please try again.");
      }
    } catch (err) {
      console.error("Signup error:", err);
      Alert.alert("Error connecting to server");
    }
  };

  return (
    <View style={styles.container}> 
      <Text style={styles.title}>Signup</Text>

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        onChangeText={text => handleChange("full_name", text)}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        onChangeText={text => handleChange("email_add", text)}
      />
      <TextInput
      style={styles.input}
        placeholder="Password"
        secureTextEntry
        onChangeText={text => handleChange("password", text)}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        secureTextEntry
        onChangeText={text => handleChange("confirm_password", text)}
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/account/Login")}>
        <Text style={styles.link}>Already have an account? Log In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    padding: 20,
    justifyContent: "center",
  },
  logo: {
    width: 120,
    height: 120,
    resizeMode: "contain",
    alignSelf: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
    color: "#222",
  },
  input: {
    height: 50,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#007bff",
    paddingVertical: 15,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  link: {
    color: "#007bff",
    fontSize: 14,
    textAlign: "center",
  },
});