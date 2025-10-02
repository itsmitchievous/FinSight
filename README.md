"# FinSight" 

## Requirements
- Install [Node.js](https://nodejs.org)
- Install [MySQL Workbench](https://dev.mysql.com/downloads/workbench/)
- Install Expo Go app on phone

## Install & Run
cmd
npm install
npm install express mysql2 bcrypt cors body-parser nodemailer
npm install react-native-radio-buttons-group @expo/vector-icons react-native-screens react-native-dropdown-picker
expo install react-native-gesture-handler
# if expo install fails:
npm install -g expo-cli
expo install react-native-gesture-handler

# change ip address in frontend/app/config.js

# run backend
cd backend
node server.js

# run frontend
cd frontend
npx expo start
