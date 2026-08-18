import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../services/supabase';
import { GoogleIcon } from '../../components/GoogleIcon';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { useColorScheme } from '../../components/useColorScheme';

const SPLASH_LOGO = require('../../assets/images/splash-icon.png');
const BRAND = '#ea580c';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const bg = isDark ? '#0f172a' : '#ffffff';
  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#1e293b' : '#f9fafb';
  const inputBorder = isDark ? '#334155' : '#d1d5db';
  const inputText = isDark ? '#f8fafc' : '#1f2937';
  const dividerColor = isDark ? '#334155' : '#e5e7eb';

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
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanedEmail,
        password,
      });
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
      const isExpoGo = Constants.appOwnership === 'expo';
      const redirectUrl = isExpoGo
        ? Linking.createURL('auth/callback')
        : 'pothole://auth/callback';

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
      });
      if (error) throw error;

      if (data?.url) {
        const subscription = Linking.addEventListener('url', async (event) => {
          if (event.url) {
            WebBrowser.dismissBrowser();
            const url = event.url;
            const getParam = (urlStr: string, name: string) => {
              const regex = new RegExp('[#?&]' + name + '=([^&#]*)');
              const results = regex.exec(urlStr);
              return results ? decodeURIComponent(results[1]) : '';
            };
            const code = getParam(url, 'code');
            const accessToken = getParam(url, 'access_token');
            const refreshToken = getParam(url, 'refresh_token');
            if (code) {
              await supabase.auth.exchangeCodeForSession(code);
            } else if (accessToken && refreshToken) {
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
            }
          }
        });

        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl, {
          showInRecents: true,
        });
        subscription.remove();

        if (result.type === 'success' && result.url) {
          const getParam = (urlStr: string, name: string) => {
            const regex = new RegExp('[#?&]' + name + '=([^&#]*)');
            const results = regex.exec(urlStr);
            return results ? decodeURIComponent(results[1]) : '';
          };
          const code = getParam(result.url, 'code');
          const accessToken = getParam(result.url, 'access_token');
          const refreshToken = getParam(result.url, 'refresh_token');
          if (code) {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) throw exchangeError;
          } else if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) throw sessionError;
          } else {
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData?.session) {
              throw new Error('Authentication tokens missing in callback URL');
            }
          }
        } else {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session) return;
        }
      }
    } catch (err: any) {
      Alert.alert('Google Sign In Error', err.message || 'Could not connect.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.logoWrap}>
              <Image source={SPLASH_LOGO} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={[styles.title, { color: BRAND }]}>Pothole</Text>
            <Text style={[styles.subtitle, { color: textSecondary }]}>
              Report and track local road hazards
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: textSecondary }]}>Email</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: inputBg, borderColor: inputBorder, color: inputText },
                ]}
                placeholder="you@example.com"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                accessible
                accessibilityLabel="Email address"
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.passwordHeader}>
                <Text style={[styles.label, { color: textSecondary }]}>Password</Text>
                <TouchableOpacity onPress={() => router.push('/forgot-password')}>
                  <Text style={[styles.forgotPassword, { color: BRAND }]}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: inputBg,
                      borderColor: inputBorder,
                      color: inputText,
                      paddingRight: 48,
                    },
                  ]}
                  placeholder="••••••••"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  autoComplete="password"
                  value={password}
                  onChangeText={setPassword}
                  accessible
                  accessibilityLabel="Password"
                />
                <TouchableOpacity
                  style={styles.showButton}
                  onPress={() => setShowPassword(!showPassword)}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Text style={[styles.showText, { color: textSecondary }]}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.signInButton, isLoading && styles.buttonDisabled]}
            disabled={isLoading}
            onPress={handleLogin}
            accessibilityLabel="Sign in"
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.signInText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={[styles.divider, { backgroundColor: dividerColor }]} />
            <Text style={[styles.dividerText, { color: textSecondary }]}>Or continue with</Text>
            <View style={[styles.divider, { backgroundColor: dividerColor }]} />
          </View>

          <TouchableOpacity
            style={[styles.googleButton, { borderColor: inputBorder, backgroundColor: bg }]}
            disabled={isLoading}
            onPress={handleGoogleLogin}
            accessibilityLabel="Sign in with Google"
          >
            <GoogleIcon size={18} />
            <Text style={[styles.googleText, { color: textPrimary }]}>Sign in with Google</Text>
          </TouchableOpacity>

          <View style={styles.signUpContainer}>
            <Text style={[styles.signUpLabel, { color: textSecondary }]}>
              Don't have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={[styles.signUpLink, { color: BRAND }]}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
    elevation: 6,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
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
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  forgotPassword: {
    fontSize: 12,
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
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  googleButton: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  googleText: {
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
  },
  signUpLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});
