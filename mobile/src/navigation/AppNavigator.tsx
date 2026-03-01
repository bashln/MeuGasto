import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../context';
import { Loading } from '../components';
import {
  LoginScreen,
  RegisterScreen,
  ForgotPasswordScreen,
  DashboardScreen,
  PurchasesScreen,
  PurchaseDetailScreen,
  PurchaseEditScreen,
  DraftsScreen,
  DraftDetailScreen,
  ReportsScreen,
  ProfileScreen,
  ScanQRCodeScreen,
  EditProfileScreen,
} from '../screens';
import { RootStackParamList, MainTabParamList } from '../types';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabs: React.FC = () => {
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.success,
        tabBarInactiveTintColor: colors.primaryText,
        tabBarStyle: {
          backgroundColor: colors.primary,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          height: 70,
          paddingBottom: 8,
          paddingTop: 8,
          borderTopWidth: 0,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="PurchasesTab"
        component={PurchasesScreen}
        options={{
          title: 'Compras',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cart" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DraftsTab"
        component={DraftsScreen}
        options={{
          title: 'Rascunhos',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="note-multiple" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ReportsTab"
        component={ReportsScreen}
        options={{
          title: 'Relatórios',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-bar" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export const AppNavigator: React.FC = () => {
  const { isLoading, isAuthenticated } = useAuth();
  const theme = useTheme();

  if (isLoading) {
    return <Loading fullScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.primary,
          },
          headerTintColor: colors.primaryText,
        }}
      >
        {!isAuthenticated ? (
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="Main"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PurchaseDetail"
              component={PurchaseDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PurchaseEdit"
              component={PurchaseEditScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="DraftDetail"
              component={DraftDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ScanQRCode"
              component={ScanQRCodeScreen}
              options={{
                headerShown: false,
                presentation: 'fullScreenModal'
              }}
            />
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
