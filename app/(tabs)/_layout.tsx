import { Tabs } from 'expo-router';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Home, Search, Plus, Bell, User } from 'lucide-react-native';
import { useColorScheme } from '../../components/useColorScheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function CustomTabBarButton({ children, onPress, style }: any) {
  return (
    <TouchableOpacity
      style={[style, styles.customButtonContainer]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.customButton}>
        <Plus size={24} color="#ffffff" strokeWidth={3} />
      </View>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const theme = useColorScheme();
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ea580c',
        tabBarInactiveTintColor: isDark ? '#94a3b8' : '#64748b',
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginBottom: 2,
        },
        tabBarStyle: {
          position: 'absolute',
          bottom: insets.bottom > 0 ? insets.bottom : 12,
          left: 20,
          right: 20,
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.98)' : 'rgba(255, 255, 255, 0.98)',
          borderWidth: 1,
          borderBottomWidth: 1,
          borderColor: isDark ? '#1e293b' : '#e2e8f0',
          borderRadius: 24,
          height: 64,
          paddingTop: 8,
          paddingBottom: 8,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          headerTitle: 'Pothole',
          tabBarIcon: ({ color }) => <Home size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Search',
          headerShown: false,
          tabBarIcon: ({ color }) => <Search size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: '',
          headerTitle: 'Report Pothole',
          tabBarButton: (props) => <CustomTabBarButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          headerTitle: 'Notifications',
          tabBarIcon: ({ color }) => <Bell size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerShown: false,
          tabBarIcon: ({ color }) => <User size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  customButtonContainer: {
    top: -10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ea580c',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },
});

