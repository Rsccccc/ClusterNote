import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { clearSession } from '../lib/session';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDEBAR_WIDTH = Math.min(SCREEN_WIDTH * 0.75, 300);

type Props = {
  visible: boolean;
  onClose: () => void;
  username: string;
  profilePic: string | null;
  onProfilePicChange: (base64: string) => void;
};

export default function Sidebar({ visible, onClose, username, profilePic, onProfilePicChange }: Props) {
  const slideAnim = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : SIDEBAR_WIDTH,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const pickProfilePic = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert('Permission to access photos is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const compressed = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 200, height: 200 } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    if (!compressed.base64) return;
    const base64str = `data:image/jpeg;base64,${compressed.base64}`;

    await supabase
      .from('Users')
      .update({ profile_pic: base64str })
      .eq('username', username);

    onProfilePicChange(base64str);
  };

  const handleLogout = async () => {
    await clearSession();
    onClose();
    router.replace('/auth/login');
  };

  const NAV_ITEMS = ['Home', 'Clusters', 'Favorites', 'Settings', 'About'];

  return (
    <>
      {/* Backdrop */}
      {visible && (
        <Pressable style={styles.backdrop} onPress={onClose} />
      )}

      {/* Sidebar panel */}
      <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>

        {/* Profile section */}
        <TouchableOpacity style={styles.profileSection} onPress={pickProfilePic}>
          {profilePic ? (
            <Image source={{ uri: profilePic }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{username?.[0]?.toUpperCase() ?? '?'}</Text>
            </View>
          )}
          <Text style={styles.avatarHint}>Tap to change</Text>
        </TouchableOpacity>

        {/* Username */}
        <Text style={styles.username}>{username}</Text>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Nav items */}
        {NAV_ITEMS.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.navItem, item === 'Home' && styles.navItemActive]}
          >
            <Text style={[styles.navText, item === 'Home' && styles.navTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Logout button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Logo at bottom */}
        <Image
          source={require('../assets/images/ClusterNoteLogo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 10,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#F1E883',
    zIndex: 20,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: -3, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#838635',
  },
  avatarPlaceholder: {
    backgroundColor: '#838635',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  avatarHint: {
    fontSize: 10,
    color: '#555',
    marginTop: 4,
  },
  username: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 16,
    color: '#222',
  },
  divider: {
    height: 1,
    backgroundColor: '#bbb',
    marginBottom: 12,
  },
  navItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    borderRadius: 10,
  },
  navItemActive: {
    backgroundColor: '#fff',
    borderBottomColor: 'transparent',
  },
  navText: {
    fontSize: 18,
    color: '#333',
  },
  navTextActive: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 22,
  },
  logoutBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
  },
  logoutText: {
    color: '#c0392b',
    fontWeight: 'bold',
    fontSize: 15,
  },
  logo: {
    width: '100%',
    height: 60,
    opacity: 0.85,
  },
});
