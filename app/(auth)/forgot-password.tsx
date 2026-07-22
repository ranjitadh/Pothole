import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleResetRequest = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'potholereactnative://reset-password',
      });

      if (error) throw error;

      Alert.alert(
        'Email Sent',
        'Password reset link has been sent to your email. Check your inbox.',
        [{ text: 'OK', onPress: () => router.replace('/login') }]
      );
    } catch (err: any) {
      Alert.alert('Reset Failed', err.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white justify-center px-6">
      <View className="space-y-6">
        <View className="items-center mb-6">
          <Text className="text-3xl font-extrabold text-primary tracking-tight">Reset Password</Text>
          <Text className="text-sm text-gray-500 mt-2">Enter your email to receive a password reset link</Text>
        </View>

        <View className="space-y-4">
          <View>
            <Text className="text-sm font-semibold text-gray-700 mb-1.5">Email Address</Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 text-base bg-gray-50 focus:border-primary"
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>
        </View>

        <TouchableOpacity 
          className="bg-primary rounded-lg p-3.5 items-center justify-center mt-4"
          disabled={isLoading}
          onPress={handleResetRequest}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-base font-bold">Send Reset Link</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity className="items-center mt-6" onPress={() => router.push('/login')}>
          <Text className="text-sm text-gray-500 font-semibold hover:text-primary">Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
