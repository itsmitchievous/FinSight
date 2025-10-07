import React, { useState, useRef } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  Alert, 
  StyleSheet, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform 
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { API_BASE_URL } from "../config";

export default function VerifyOTP() {
  const router = useRouter();
  const { userId, flow } = useLocalSearchParams(); // flow = "signup" or "reset"
  const numericUserId = Number(userId);

  const [otp, setOtp] = useState("");
  const inputs = useRef([]);

  // ==================== VERIFY OTP ====================
  const handleVerify = async () => {
    if (otp.length < 6) {
      Alert.alert("Missing Info", "Please enter the 6-digit OTP.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          user_id: numericUserId, 
          otp_code: otp, 
          flow // ✅ include flow
        }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        const text = await res.text();
        console.error("❌ Verify response not JSON:", text);
        Alert.alert("Error", "Unexpected server response");
        return;
      }

      if (res.ok) {
        Alert.alert("Success", data.message || "OTP verified!");

        if (flow === "reset") {
          // If from forgot password, go to reset password page
          router.push(`/account/ForgotPasswordReset?userId=${numericUserId}`);
        } else {
          // If from signup, go to normal onboarding page
          router.push(`/account/BudgetingCheckIn?userId=${numericUserId}`);
        }
      } else {
        Alert.alert("Verification Failed", data.message || "Invalid OTP");
      }
    } catch (err) {
      console.error("❌ Verify OTP error:", err);
      Alert.alert("Error", "Failed to connect to server");
    }
  };

  // ==================== RESEND OTP ====================
  const handleResend = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          user_id: numericUserId,
          flow // ✅ include flow so backend knows if it's signup or reset
        }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        const text = await res.text();
        console.error("❌ Resend response not JSON:", text);
        Alert.alert("Error", "Unexpected server response");
        return;
      }

      if (res.ok) {
        Alert.alert("Success", data.message || "OTP resent!");
      } else {
        Alert.alert("Error", data.message || "Failed to resend OTP");
      }
    } catch (err) {
      console.error("❌ Resend OTP error:", err);
      Alert.alert("Error", "Could not connect to server");
    }
  };

  // ==================== RENDER ====================
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Enter Verification Code</Text>
      <Text style={styles.subtitle}>
        Enter the 6-digit code we sent to your email
      </Text>

      <View style={styles.codeInputContainer}>
        {Array(6).fill(0).map((_, index) => (
          <TextInput
            key={index}
            ref={(ref) => (inputs.current[index] = ref)}
            value={otp[index] || ""}
            onChangeText={(text) => {
              let newOtp = otp.split("");
              newOtp[index] = text;
              setOtp(newOtp.join(""));

              if (text && index < 5) {
                inputs.current[index + 1]?.focus();
              }
            }}
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === "Backspace" && !otp[index] && index > 0){
                inputs.current[index - 1]?.focus();
              }
            }}
            maxLength={1}
            keyboardType="numeric"
            style={styles.codeInput}
          />
        ))}
      </View>

      <TouchableOpacity onPress={handleResend}>
        <Text style={styles.resendText}>Resend Code</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.continueButton} onPress={handleVerify}>
        <Text style={styles.continueText}>Continue</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00C37E",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 30,
    textAlign: "center",
  },
  codeInputContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  codeInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    width: 50,
    textAlign: "center",
    fontSize: 18,
    backgroundColor: "#f9f9f9",
  },
  resendText: {
    color: "#00C37E",
    textAlign: "center",
    marginBottom: 40,
    textDecorationLine: "underline",
  },
  continueButton: {
    backgroundColor: "#00C37E",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  continueText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});