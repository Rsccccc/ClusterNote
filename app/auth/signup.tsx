import { router } from 'expo-router';
import { useState } from 'react';
import {
    Image,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import { supabase } from '../../lib/supabase';

export default function Signup() {
  const { width } = useWindowDimensions();
  const isWide = width > 600;
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!username || !email || !password || !confirm) {
      alert('Please fill all fields');
      return;
    }

    if (password !== confirm) {
      alert('Passwords do not match');
      return;
    }

    setLoading(true);

    // Check if email already exists
    const { data: existing } = await supabase
      .from('Users')
      .select('email')
      .eq('email', email)
      .single();

    if (existing) {
      setLoading(false);
      alert('An account with that email already exists.');
      return;
    }

    const { error } = await supabase
      .from('Users')
      .insert({ username, email, password });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert('Signup successful! Please log in.');
    router.replace('/auth/login');
  };

  return (
    <View style={styles.container}>
      
      {/* LOGO */}
      <Image
        source={require('../../assets/images/ClusterNoteLogo.png')}
        style={[styles.logo, isWide && styles.logoWide]}
        resizeMode="contain"
      />

      {/* INPUTS */}
      <TextInput
        placeholder="Username"
        placeholderTextColor="#777"
        style={[styles.input, isWide && styles.inputWide]}
        value={username}
        onChangeText={setUsername}
      />

      <TextInput
        placeholder="Email"
        placeholderTextColor="#777"
        style={[styles.input, isWide && styles.inputWide]}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor="#777"
        secureTextEntry
        style={[styles.input, isWide && styles.inputWide]}
        value={password}
        onChangeText={setPassword}
      />

      <TextInput
        placeholder="Confirm Password"
        placeholderTextColor="#777"
        secureTextEntry
        style={[styles.input, isWide && styles.inputWide]}
        value={confirm}
        onChangeText={setConfirm}
      />

      {/* BUTTON */}
      <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? 'Signing up...' : 'Sign Up'}
        </Text>
      </TouchableOpacity>

      {/* LINK */}
      <Text style={styles.link} onPress={() => router.push('/auth/login')}>
        Login
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1E883',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 25,
  },

  logo: {
    width: 340,
    height: 120,
    marginBottom: 0,
  },
  logoWide: {
    width: 480,
    height: 160,
  },

  input: {
    width: '100%',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 10,
    marginVertical: 10,
  },
  inputWide: {
    width: 400,
  },

  button: {
    backgroundColor: '#838635',
    paddingVertical: 14,
    paddingHorizontal: 70,
    borderRadius: 30,
    marginTop: 20,
  },

  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },

  link: {
    marginTop: 12,
    fontSize: 12,
    color: '#000',
  },
});