import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet, Switch, TextInput, Modal, Platform, AppState, AppStateStatus } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/auth-store';
import { supabase } from '../../services/supabase';
import { LogOut, Trash2, Bell, MapPin, Moon, Eye, EyeOff, Camera, Image as ImageIcon, AlignLeft, MoreHorizontal, Settings } from 'lucide-react-native';
import { useThemeStore } from '../../store/theme-store';
import { useColorScheme } from '../../components/useColorScheme';
import * as ImagePicker from 'expo-image-picker';
import { uploadPhoto } from '../../services/post';
import { openNotificationSettings } from '../../services/notifications';
import { useNotificationStore } from '../../store/notification-store';
async function deleteOldFile(url: string, bucket: string): Promise<void> {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const bucketIndex = pathParts.indexOf(bucket);
    if (bucketIndex === -1 || bucketIndex >= pathParts.length - 1) return;
    const filePath = pathParts.slice(bucketIndex + 1).join('/');
    if (!filePath || filePath === 'null') return;
    await supabase.storage.from(bucket).remove([filePath]);
  } catch {
    // Ignore cleanup errors
  }
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut, refreshProfile } = useAuthStore();
  const { themeMode, setThemeMode } = useThemeStore();
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const menuTop = insets.top + 56;

  const [deleting, setDeleting] = useState(false);

  // Notification state — driven by notification-store (not local useState).
  const {
    effectiveEnabled: notificationsEnabled,
    isToggling: notificationToggling,
    isPermissionDenied,
    toggle: toggleNotifications,
    refreshPermissions,
  } = useNotificationStore();
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const [isBioModalVisible, setIsBioModalVisible] = useState(false);
  const [bioText, setBioText] = useState('');
  const [updatingBio, setUpdatingBio] = useState(false);
  const [updatingAvatar, setUpdatingAvatar] = useState(false);
  const [updatingCover, setUpdatingCover] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleChangeAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow access to your photos to change your profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUpdatingAvatar(true);
        const oldAvatarUrl = profile?.avatarUrl;
        const uploadedUrl = await uploadPhoto(result.assets[0].uri, 'avatars');
        
        const { error } = await supabase
          .from('profiles')
          .update({ avatar_url: uploadedUrl })
          .eq('id', profile?.id);

        if (error) throw error;
        await refreshProfile();
        if (oldAvatarUrl) {
          await deleteOldFile(oldAvatarUrl, 'avatars');
        }
        Alert.alert('Success', 'Profile picture updated successfully!');
      }
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not update profile picture.');
    } finally {
      setUpdatingAvatar(false);
    }
  };

  const handleChangeCover = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow access to your photos to change your cover photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUpdatingCover(true);
        const oldCoverUrl = profile?.coverUrl;
        const uploadedUrl = await uploadPhoto(result.assets[0].uri, 'covers');
        
        const { error } = await supabase
          .from('profiles')
          .update({ cover_url: uploadedUrl })
          .eq('id', profile?.id);

        if (error) throw error;
        await refreshProfile();
        if (oldCoverUrl) {
          await deleteOldFile(oldCoverUrl, 'covers');
        }
        Alert.alert('Success', 'Cover photo updated successfully!');
      }
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not update cover photo.');
    } finally {
      setUpdatingCover(false);
    }
  };

  const handleUpdateBio = async () => {
    setUpdatingBio(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ bio: bioText.trim() || null })
        .eq('id', profile?.id);

      if (error) throw error;
      await refreshProfile();
      setIsBioModalVisible(false);
      Alert.alert('Success', 'Bio updated successfully!');
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update bio.');
    } finally {
      setUpdatingBio(false);
    }
  };

  // AppState listener: refresh notification permission status when the user
  // returns from the device Settings app (e.g. after granting / revoking).
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    if (!profile?.id) return;
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current !== 'active' && nextState === 'active') {
        refreshPermissions(profile.id);
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleNotifications = () => {
    if (!profile?.id) return;
    toggleNotifications(profile.id);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'WARNING: This will permanently delete your account, posts, and details. This cannot be undone. Are you sure you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const { error } = await supabase.rpc('delete_user_account');
              if (error) throw error;
              await signOut();
            } catch (err: any) {
              Alert.alert('Delete Failed', err.message || 'Could not delete account.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleUpdatePassword = async () => {
    if (!newPassword.trim()) {
      Alert.alert('Error', 'Please enter a new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert('Password Updated', 'Your password has been changed successfully.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update password.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ea580c" />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Cover Photo Backdrop */}
        <View style={styles.coverPhotoContainer}>
          {profile.coverUrl ? (
            <Image source={{ uri: profile.coverUrl }} style={styles.coverPhoto} />
          ) : (
            <View style={styles.coverPhotoFallback} />
          )}

          {/* Edit menu in top right corner (3 dots) */}
          <View style={styles.topRightControls}>
            <TouchableOpacity 
              onPress={() => setShowProfileMenu(!showProfileMenu)} 
              style={styles.editIconBtn}
              testID="profile-menu-button"
            >
              <MoreHorizontal size={18} color="#ea580c" />
            </TouchableOpacity>

            {showProfileMenu && (
              <Modal
                visible={showProfileMenu}
                transparent={true}
                animationType="none"
                onRequestClose={() => setShowProfileMenu(false)}
              >
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  activeOpacity={1}
                  onPress={() => setShowProfileMenu(false)}
                />
                <View 
                  style={[
                    styles.profileMenu, 
                    isDark && styles.profileMenuDark,
                    {
                      position: 'absolute',
                      top: menuTop,
                      right: 16,
                    }
                  ]}
                >
                  <TouchableOpacity 
                    onPress={() => { setShowProfileMenu(false); handleChangeAvatar(); }} 
                    style={styles.profileMenuItem}
                    testID="change-avatar-menu-item"
                    disabled={updatingAvatar}
                  >
                    <Camera size={14} color="#ea580c" style={{ marginRight: 8 }} />
                    <Text style={[styles.profileMenuText, isDark && styles.textLight]}>
                      {updatingAvatar ? 'Updating Photo...' : 'Edit Profile Photo'}
                    </Text>
                  </TouchableOpacity>
                  
                  <View style={[styles.profileMenuSeparator, isDark && styles.profileMenuSeparatorDark]} />

                  <TouchableOpacity 
                    onPress={() => { setShowProfileMenu(false); handleChangeCover(); }} 
                    style={styles.profileMenuItem}
                    testID="change-cover-menu-item"
                    disabled={updatingCover}
                  >
                    <ImageIcon size={14} color="#ea580c" style={{ marginRight: 8 }} />
                    <Text style={[styles.profileMenuText, isDark && styles.textLight]}>
                      {updatingCover ? 'Updating Cover...' : 'Edit Cover Photo'}
                    </Text>
                  </TouchableOpacity>
                  
                  <View style={[styles.profileMenuSeparator, isDark && styles.profileMenuSeparatorDark]} />

                  <TouchableOpacity 
                    onPress={() => {
                      setShowProfileMenu(false);
                      setBioText(profile.bio || '');
                      setIsBioModalVisible(true);
                    }} 
                    style={styles.profileMenuItem}
                    testID="edit-bio-menu-item"
                  >
                    <AlignLeft size={14} color="#ea580c" style={{ marginRight: 8 }} />
                    <Text style={[styles.profileMenuText, isDark && styles.textLight]}>Edit Bio</Text>
                  </TouchableOpacity>
                </View>
              </Modal>
            )}
          </View>
        </View>

        {/* Profile Details Header */}
        <View style={styles.profileHeader}>
          <Image
            source={{ uri: profile.avatarUrl || 'https://via.placeholder.com/150' }}
            style={styles.avatar}
          />

          <View style={styles.infoContainer}>
            <Text style={[styles.displayName, isDark && styles.displayNameDark]}>{profile.displayName}</Text>
            <Text style={[styles.username, isDark && styles.usernameDark]}>@{profile.username}</Text>
            {profile.bio && <Text style={[styles.bio, isDark && styles.bioDark]}>{profile.bio}</Text>}
          </View>

          {/* Stats Row */}
          <View style={[styles.statsRow, isDark && styles.statsRowDark]}>
            <View style={styles.statCol}>
              <Text style={[styles.statCount, isDark && styles.statCountDark]}>{profile.postsCount}</Text>
              <Text style={styles.statLabel}>reports</Text>
            </View>
            <View style={[styles.statDivider, isDark && styles.statDividerDark]} />
            <View style={styles.statCol}>
              <Text style={[styles.statCount, isDark && styles.statCountDark]}>{profile.followersCount}</Text>
              <Text style={styles.statLabel}>followers</Text>
            </View>
            <View style={[styles.statDivider, isDark && styles.statDividerDark]} />
            <View style={styles.statCol}>
              <Text style={[styles.statCount, isDark && styles.statCountDark]}>{profile.followingCount}</Text>
              <Text style={styles.statLabel}>following</Text>
            </View>
          </View>
        </View>

        {/* Divider Section - Boarder Up and Down */}
        <View style={[styles.sectionDivider, isDark && styles.sectionDividerDark]} />

        {/* Settings Area */}
        <View style={styles.settingsArea}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>Settings</Text>
          
          <View style={[styles.settingsCard, isDark && styles.settingsCardDark]}>
            <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
              <View style={styles.settingLabelContainer}>
                <Bell size={18} color="#ea580c" />
                <Text style={[styles.settingText, isDark && styles.settingTextDark]}>Push Notifications</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleToggleNotifications}
                disabled={notificationToggling}
                trackColor={{ false: '#cbd5e1', true: '#ffedd5' }}
                thumbColor={notificationsEnabled ? '#ea580c' : '#f8fafc'}
              />
            </View>

            {/* Shown only when the OS has denied notification permission */}
            {isPermissionDenied && (
              <TouchableOpacity
                onPress={openNotificationSettings}
                style={[styles.openSettingsRow, isDark && styles.openSettingsRowDark]}
                testID="open-notification-settings-btn"
                activeOpacity={0.7}
              >
                <Settings size={14} color="#ea580c" style={{ marginRight: 6 }} />
                <Text style={styles.openSettingsText}>
                  Notifications are blocked — tap to open Settings
                </Text>
              </TouchableOpacity>
            )}

            <View style={[styles.settingSeparator, isDark && styles.settingSeparatorDark]} />

            <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
              <View style={styles.settingLabelContainer}>
                <MapPin size={18} color="#ea580c" />
                <Text style={[styles.settingText, isDark && styles.settingTextDark]}>Location Services</Text>
              </View>
              <Switch
                value={locationEnabled}
                onValueChange={setLocationEnabled}
                trackColor={{ false: '#cbd5e1', true: '#ffedd5' }}
                thumbColor={locationEnabled ? '#ea580c' : '#f8fafc'}
              />
            </View>
            
            <View style={[styles.settingSeparator, isDark && styles.settingSeparatorDark]} />

            <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
              <View style={styles.settingLabelContainer}>
                <Moon size={18} color="#ea580c" />
                <Text style={[styles.settingText, isDark && styles.settingTextDark]}>Dark Mode</Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={(val) => setThemeMode(val ? 'dark' : 'light')}
                trackColor={{ false: '#cbd5e1', true: '#ffedd5' }}
                thumbColor={isDark ? '#ea580c' : '#f8fafc'}
              />
            </View>
          </View>

          {/* Account Security Card */}
          <View style={[styles.settingsCard, isDark && styles.settingsCardDark, { marginTop: 20, padding: 16 }]}>
            <Text style={[styles.accountCardTitle, isDark && styles.accountCardTitleDark]}>Account</Text>
            <Text style={[styles.accountCardSubtitle, isDark && styles.accountCardSubtitleDark]}>Manage your account security</Text>
            
            <Text style={[styles.changePasswordTitle, isDark && styles.changePasswordTitleDark]}>Change Password</Text>

            <Text style={[styles.inputLabel, isDark && styles.inputLabelDark]}>New Password</Text>
            <View style={[styles.passwordInputContainer, isDark && styles.passwordInputContainerDark]}>
              <TextInput
                style={[styles.passwordInput, isDark && styles.passwordInputDark]}
                placeholder="Enter new password"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                {showPassword ? <EyeOff size={16} color="#64748b" /> : <Eye size={16} color="#64748b" />}
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, isDark && styles.inputLabelDark]}>Confirm New Password</Text>
            <View style={[styles.passwordInputContainer, isDark && styles.passwordInputContainerDark]}>
              <TextInput
                style={[styles.passwordInput, isDark && styles.passwordInputDark]}
                placeholder="Confirm new password"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity 
              onPress={handleUpdatePassword}
              disabled={updatingPassword}
              style={[styles.updatePasswordButton, isDark && styles.updatePasswordButtonDark]}
            >
              {updatingPassword ? (
                <ActivityIndicator size="small" color="#64748b" />
              ) : (
                <Text style={[styles.updatePasswordText, isDark && styles.updatePasswordTextDark]}>Update Password</Text>
              )}
            </TouchableOpacity>

            <View style={[styles.accountCardSeparator, isDark && styles.accountCardSeparatorDark]} />

            <Text style={styles.dangerZoneTitle}>Danger Zone</Text>
            <View style={styles.dangerButtonsRow}>
              <TouchableOpacity 
                onPress={handleDeleteAccount} 
                disabled={deleting}
                style={[styles.deleteOutlineButton, isDark && styles.deleteOutlineButtonDark]}
              >
                <Trash2 size={16} color="#ef4444" />
                <Text style={styles.deleteOutlineText}>Delete Account</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={handleSignOut} 
                style={styles.signOutSolidButton}
              >
                <LogOut size={16} color="#ffffff" />
                <Text style={styles.signOutSolidText}>Sign Out</Text>
              </TouchableOpacity>

              <View style={[styles.disclaimerBox, isDark && styles.disclaimerBoxDark]}>
                <Text style={[styles.disclaimerText, isDark && styles.disclaimerTextDark]}>
                  Disclaimer: Pothole is an independent community app and is NOT affiliated with, endorsed by, or connected to any government entity, municipal authority, or official road maintenance organization. Reports made through this app are community-submitted and do not constitute official government reports or service requests. For official road complaints, please contact your local government office directly.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Update Bio Modal */}
      <Modal
        visible={isBioModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsBioModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsBioModalVisible(false)}
          />
          <View style={[styles.bioModalContent, isDark && styles.bioModalContentDark]}>
            <Text style={[styles.bioModalTitle, isDark && styles.textLight]}>Update Bio</Text>
            
            <TextInput
              style={[
                styles.bioInput,
                isDark && styles.bioInputDark,
                { color: isDark ? '#f8fafc' : '#0f172a' }
              ]}
              placeholder="Tell us about yourself..."
              placeholderTextColor="#94a3b8"
              value={bioText}
              onChangeText={setBioText}
              maxLength={160}
              multiline
            />
            
            <View style={styles.bioModalButtons}>
              <TouchableOpacity 
                onPress={() => setIsBioModalVisible(false)} 
                style={styles.bioCancelBtn}
              >
                <Text style={styles.bioCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={handleUpdateBio} 
                disabled={updatingBio}
                style={styles.bioSaveBtn}
              >
                {updatingBio ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.bioSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  coverPhotoContainer: {
    height: 128,
    width: '100%',
    position: 'relative',
  },
  coverPhotoFallback: {
    height: 128,
    backgroundColor: 'rgba(234, 88, 12, 0.15)',
    width: '100%',
  },
  coverPhoto: {
    height: 128,
    width: '100%',
    resizeMode: 'cover',
  },
  topRightControls: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
  },
  editIconBtn: {
    backgroundColor: '#ffffff',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileMenu: {
    position: 'absolute',
    right: 0,
    top: 40,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 6,
    width: 172,
    zIndex: 100,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  profileMenuDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  profileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  profileMenuText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  profileMenuSeparator: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 4,
  },
  profileMenuSeparatorDark: {
    backgroundColor: '#334155',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  bioModalContent: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  bioModalContentDark: {
    backgroundColor: '#1e293b',
  },
  bioModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  bioInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    height: 80,
    textAlignVertical: 'top',
    fontSize: 14,
    backgroundColor: '#f8fafc',
    marginBottom: 16,
  },
  bioInputDark: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
  },
  bioModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bioCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  bioCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  bioSaveBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  bioSaveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  textLight: {
    color: '#f8fafc',
  },
  profileHeader: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    marginTop: -48,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: '#ffffff',
    backgroundColor: '#e5e7eb',
  },
  infoContainer: {
    marginTop: 16,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  username: {
    fontSize: 14,
    color: '#6b7280',
  },
  bio: {
    fontSize: 14,
    color: '#374151',
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statCount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  statLabel: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#e5e7eb',
  },
  sectionDivider: {
    height: 8,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6', // border up and down divider
  },
  settingsArea: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  settingsCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 12,
  },
  settingSeparator: {
    height: 1,
    backgroundColor: '#f3f4f6',
  },
  openSettingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff7ed',
    borderTopWidth: 1,
    borderTopColor: '#fed7aa',
  },
  openSettingsRowDark: {
    backgroundColor: '#431407',
    borderTopColor: '#7c2d12',
  },
  openSettingsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ea580c',
    flex: 1,
    flexWrap: 'wrap',
  },
  accountCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  accountCardSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 16,
  },
  changePasswordTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 8,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    paddingVertical: 8,
  },
  eyeButton: {
    padding: 6,
  },
  updatePasswordButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    marginTop: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  updatePasswordText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  accountCardSeparator: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 20,
  },
  dangerZoneTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ef4444',
    marginBottom: 12,
  },
  dangerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  deleteOutlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    marginRight: 12,
  },
  deleteOutlineText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 8,
  },
  signOutSolidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#d93f0f',
  },
  signOutSolidText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 8,
  },
  disclaimerBox: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
  },
  disclaimerBoxDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
  },
  disclaimerTextDark: {
    color: '#64748b',
  },
  containerDark: {
    backgroundColor: '#0f172a',
  },
  displayNameDark: {
    color: '#f8fafc',
  },
  usernameDark: {
    color: '#94a3b8',
  },
  bioDark: {
    color: '#cbd5e1',
  },
  statsRowDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  statCountDark: {
    color: '#f8fafc',
  },
  statDividerDark: {
    backgroundColor: '#334155',
  },
  sectionDividerDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  sectionTitleDark: {
    color: '#f8fafc',
  },
  settingsCardDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  settingRowDark: {
    backgroundColor: '#1e293b',
  },
  settingTextDark: {
    color: '#f8fafc',
  },
  settingSeparatorDark: {
    backgroundColor: '#334155',
  },
  accountCardTitleDark: {
    color: '#f8fafc',
  },
  accountCardSubtitleDark: {
    color: '#94a3b8',
  },
  changePasswordTitleDark: {
    color: '#f8fafc',
  },
  inputLabelDark: {
    color: '#cbd5e1',
  },
  passwordInputContainerDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  passwordInputDark: {
    color: '#f8fafc',
  },
  updatePasswordButtonDark: {
    backgroundColor: '#334155',
    borderColor: '#475569',
  },
  updatePasswordTextDark: {
    color: '#f8fafc',
  },
  accountCardSeparatorDark: {
    backgroundColor: '#334155',
  },
  deleteOutlineButtonDark: {
    backgroundColor: '#1e293b',
    borderColor: '#ef4444',
  },
});
