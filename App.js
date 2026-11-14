import React from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { VaultProvider } from './src/context/VaultContext';
import RootNavigator from './src/navigation/RootNavigator';
import { ThemeProvider, useTheme } from './src/theme/styles';
import TimerManager from './src/components/TimerManager';
import ReminderCenter from './src/components/ReminderCenter';
function AppContent() {
  const { dark } = useTheme();
  return <NavigationContainer theme={dark ? DarkTheme : DefaultTheme}><StatusBar style={dark ? 'light' : 'dark'} /><TimerManager /><ReminderCenter /><RootNavigator /></NavigationContainer>;
}
export default function App() { return <VaultProvider><ThemeProvider><AppContent /></ThemeProvider></VaultProvider>; }
