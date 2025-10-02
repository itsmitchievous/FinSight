import React from "react";
import { ScrollView } from "react-native";
import Signup from "./account/Signup";
import Login from "./account/Login";
import Splash from "./Splash";

export default function App() {
  return (
    <ScrollView>
      <Splash />
    </ScrollView>
  );
}
