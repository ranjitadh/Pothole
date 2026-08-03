import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase';
import { Globe } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { TEST_USER } from '../../constants/TestCredentials';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail || !password) {
      Alert.alert('Error', 'Please enter your email and password');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(cleanedEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: cleanedEmail, password });
      if (error) throw error;
    } catch (err: any) {
      Alert.alert('Sign In Failed', err.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      // If running inside the Expo Go sandbox, we must route back via the Metro dev server's exp:// scheme.
      // If running in a native production/development build, we use the custom pothole:// scheme.
      const isExpoGo = Constants.appOwnership === 'expo';
      const redirectUrl = (isExpoGo && Constants.expoConfig?.hostUri)
        ? `exp://${Constants.expoConfig.hostUri}/--/callback`
        : 'pothole://callback';
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (result.type === 'success' && result.url) {
          const url = result.url;
          const getParam = (urlStr: string, name: string) => {
            const regex = new RegExp('[#?&]' + name + '=([^&#]*)');
            const results = regex.exec(urlStr);
            return results ? decodeURIComponent(results[1]) : '';
          };
          const accessToken = getParam(url, 'access_token');
          const refreshToken = getParam(url, 'refresh_token');

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) throw sessionError;
          } else {
            throw new Error('Authentication tokens missing in callback URL');
          }
        }
      }
    } catch (err: any) {
      Alert.alert('Google Sign In Error', err.message || 'Could not connect.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Pothole</Text>
          <Text style={styles.subtitle}>Report and track local road hazards</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.passwordHeader}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity onPress={() => router.push('/forgot-password')}>
                <Text style={styles.forgotPassword}>Forgot password?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, { paddingRight: 48 }]}
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                autoComplete="password"
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity 
                style={styles.showButton} 
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.showText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.signInButton, isLoading && styles.buttonDisabled]}
          disabled={isLoading}
          onPress={handleLogin}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.signInText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>Or continue with</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity 
          style={styles.googleButton}
          disabled={isLoading}
          onPress={handleGoogleLogin}
        >
          <Globe size={18} color="#4285F4" />
          <Text style={styles.googleText}>Sign in with Google</Text>
        </TouchableOpacity>

        <View style={styles.signUpContainer}>
          <Text style={styles.signUpLabel}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.signUpLink}>Sign up</Text>
          </TouchableOpacity>
        </View>

        {__DEV__ && (
          <TouchableOpacity 
            style={styles.devFillButton}
            onPress={() => {
              setEmail(TEST_USER.email);
              setPassword(TEST_USER.password);
            }}
          >
            <Text style={styles.devFillText}>⚡ Quick Fill Test Credentials</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ea580c',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  form: {
    gap: 16,
    marginBottom: 24,
  },
  inputGroup: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  forgotPassword: {
    fontSize: 12,
    color: '#ea580c',
    fontWeight: '500',
  },
  passwordContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  showButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  showText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  signInButton: {
    height: 48,
    backgroundColor: '#ea580c',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  googleButton: {
    height: 48,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    gap: 8,
  },
  googleText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signUpLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  signUpLink: {
    fontSize: 14,
    color: '#ea580c',
    fontWeight: '700',
  },
  devFillButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#ffedd5',
    borderRadius: 8,
    alignItems: 'center',
  },
  devFillText: {
    color: '#c2410c',
    fontSize: 13,
    fontWeight: '600',
  },
});
