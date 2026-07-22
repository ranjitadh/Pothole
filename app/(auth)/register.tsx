import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase';

export default function RegisterScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !username || !displayName) {
      Alert.alert('Error', 'Please fill out all fields');
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.toLowerCase().trim(),
            display_name: displayName.trim(),
          },
        },
      });

      if (error) throw error;

      Alert.alert(
        'Success',
        'Registration successful! Please check your email to verify your account.',
        [{ text: 'OK', onPress: () => router.replace('/login') }]
      );
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white justify-center px-6">
      <View className="space-y-6">
        <View className="items-center mb-6">
          <Text className="text-3xl font-extrabold text-primary tracking-tight">Create Account</Text>
          <Text className="text-sm text-gray-500 mt-2">Join Pothole and start reporting</Text>
        </View>

        <View className="space-y-4">
          <View>
            <Text className="text-sm font-semibold text-gray-700 mb-1.5">Username</Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 text-base bg-gray-50 focus:border-primary"
              placeholder="username"
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />
          </View>

          <View>
            <Text className="text-sm font-semibold text-gray-700 mb-1.5">Full Name</Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 text-base bg-gray-50 focus:border-primary"
              placeholder="John Doe"
              value={displayName}
              onChangeText={setDisplayName}
            />
          </View>

          <View>
            <Text className="text-sm font-semibold text-gray-700 mb-1.5">Email</Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 text-base bg-gray-50 focus:border-primary"
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View>
            <Text className="text-sm font-semibold text-gray-700 mb-1.5">Password</Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 text-base bg-gray-50 focus:border-primary"
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
            />
          </View>
        </View>

        <TouchableOpacity 
          className="bg-primary rounded-lg p-3.5 items-center justify-center mt-4"
          disabled={isLoading}
          onPress={handleRegister}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-base font-bold">Sign Up</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6">
          <Text className="text-sm text-gray-500">Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/login')}>
            <Text className="text-sm text-primary font-bold">Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
