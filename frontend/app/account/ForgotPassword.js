import React, { useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  Alert, 
  TouchableOpacity, 
  ActivityIndicator, 
  StyleSheet 
} from "react-native";
import { useRouter } from "expo-router";
import { API_BASE_URL } from "../config";


export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    if (!email) {
      Alert.alert("Missing Info", "Please enter your email address.");
      return;
    }

    setLoading(true);

    try {
        const res = await fetch(`${API_BASE_URL}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_add: email }),
      });

      const data = await res.json();
      console.log("📩 Forgot Password response:", data);

      if (res.ok) {
        const userId = data.userId;
        if (!userId) {
          Alert.alert("Error", "No user found with that email.");
          setLoading(false);
          return;
        }

        Alert.alert(
          "Check Your Email",
          "We've sent an OTP to reset your password.",
          [
            {
              text: "OK",
              onPress: () => router.replace(`/account/VerifyOTP?userId=${userId}&flow=reset`),
            },
          ],
          { cancelable: false }
        );
      } else {
        Alert.alert("Error", data.message || "Failed to send OTP.");
      }
    } catch (err) {
      console.error("❌ Forgot password error:", err);
      Alert.alert("Error", "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot Password</Text>
      <Text style={styles.subtitle}>
        Enter your registered email. We’ll send you an OTP to reset your password.
      </Text>

      <TextInput
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Send OTP</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/account/Login")}>
        <Text style={styles.link}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa", padding: 20, justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "bold", marginBottom: 10, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 30, textAlign: "center" },
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