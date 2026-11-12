import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { VaultProvider } from './src/context/VaultContext';
import RootNavigator from './src/navigation/RootNavigator';
export default function App() { return <VaultProvider><NavigationContainer><StatusBar style="dark" /><RootNavigator /></NavigationContainer></VaultProvider>; }
