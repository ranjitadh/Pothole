import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '../../components/useColorScheme';
import { Camera, Image as ImageIcon, MapPin, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { createPost, uploadPhoto } from '../../services/post';
import { PinpointLocationModal } from '../../components/PinpointLocationModal';

export default function CreateScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; placeName?: string } | null>(null);
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to take a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSelectPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Photo library permission is required to select a photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!text && !imageUri) {
      Alert.alert('Error', 'Please write a description or attach a photo.');
      return;
    }

    setIsLoading(true);
    try {
      let uploadedUrl: string | undefined = undefined;
      if (imageUri) {
        uploadedUrl = await uploadPhoto(imageUri);
      }

      await createPost({
        text: text.trim() || undefined,
        visibility: 'public',
        media: uploadedUrl ? [{ url: uploadedUrl, type: 'image' }] : undefined,
        location: location ? {
          latitude: location.latitude,
          longitude: location.longitude,
          placeName: location.placeName,
        } : undefined,
      });

      Alert.alert('Success', 'Hazard report posted successfully!', [
        {
          text: 'OK',
          onPress: () => {
            setText('');
            setImageUri(null);
            setLocation(null);
            queryClient.invalidateQueries({ queryKey: ['feed'] });
            router.push('/(tabs)');
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Failed to Post', err.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.contentWrapper}>
          <Text style={[styles.title, isDark && styles.textLight]}>Report Road Hazard</Text>

          <TextInput
            style={[
              styles.input,
              isDark && styles.inputDark,
              { color: isDark ? '#f8fafc' : '#0f172a' }
            ]}
            placeholder="Describe the pothole or hazard..."
            placeholderTextColor="#94a3b8"
            multiline
            textAlignVertical="top"
            value={text}
            onChangeText={setText}
          />

          {location && (
            <View style={[styles.locationCard, isDark && styles.locationCardDark]}>
              <View style={styles.locationLabelContainer}>
                <MapPin size={18} color="#ea580c" />
                <Text style={[styles.locationText, isDark && styles.textLight]} numberOfLines={1}>
                  {location.placeName || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setLocation(null)} style={styles.removeBtn}>
                <X size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}

          {imageUri && (
            <View style={[styles.imagePreviewContainer, isDark && styles.imagePreviewContainerDark]}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <TouchableOpacity 
                style={styles.removeImageBtn}
                onPress={() => setImageUri(null)}
              >
                <X size={16} color="white" />
              </TouchableOpacity>
            </View>
          )}

          {/* Action Row */}
          <View style={[styles.actionRow, isDark && styles.actionRowDark]}>
            <View style={styles.mediaButtonsRow}>
              <TouchableOpacity 
                onPress={handleTakePhoto} 
                style={[styles.mediaBtn, isDark && styles.mediaBtnDark]}
              >
                <Camera size={20} color={isDark ? '#cbd5e1' : '#64748b'} />
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={handleSelectPhoto} 
                style={[styles.mediaBtn, isDark && styles.mediaBtnDark]}
              >
                <ImageIcon size={20} color={isDark ? '#cbd5e1' : '#64748b'} />
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setIsMapModalVisible(true)} 
                style={[styles.mediaBtn, isDark && styles.mediaBtnDark]}
              >
                <MapPin size={20} color={isDark ? '#cbd5e1' : '#64748b'} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              onPress={handleSubmit}
              disabled={isLoading}
              style={styles.postBtn}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.postBtnText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <PinpointLocationModal
        visible={isMapModalVisible}
        onClose={() => setIsMapModalVisible(false)}
        onConfirm={(loc) => setLocation(loc)}
        initialLocation={location}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 110,
  },
  contentWrapper: {
    padding: 16,
    flexDirection: 'column',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    backgroundColor: '#f8fafc',
    height: 128,
    marginBottom: 16,
    fontWeight: '500',
  },
  inputDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  locationCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationCardDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  locationLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 16,
  },
  locationText: {
    fontSize: 13,
    color: '#475569',
    marginLeft: 8,
    flex: 1,
    fontWeight: '600',
  },
  removeBtn: {
    padding: 2,
  },
  imagePreviewContainer: {
    position: 'relative',
    width: '100%',
    height: 192,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  imagePreviewContainerDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    padding: 6,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 16,
  },
  actionRowDark: {
    borderTopColor: '#334155',
  },
  mediaButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mediaBtn: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#f8fafc',
    marginRight: 8,
  },
  mediaBtnDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  postBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    maxWidth: 120,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  postBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  textLight: {
    color: '#f8fafc',
  },
  textMuted: {
    color: '#94a3b8',
  },
});
