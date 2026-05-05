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
import { saveSession } from '../../lib/session';

export default function Login() {
  const { width } = useWindowDimensions();
  const isWide = width > 600;
  const [identifier, setIdentifier] = useState(''); // email or username
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier || !password) {
      alert('Please fill all fields');
      return;
    }

    setLoading(true);

    // Query Users table matching either email OR username
    const { data, error } = await supabase
      .from('Users')
      .select('*')
      .or(`email.eq.${identifier},username.eq.${identifier}`)
      .eq('password', password)
      .single();

    setLoading(false);

    if (error || !data) {
      alert('Invalid username/email or password.');
      return;
    }

    // Save session so home screen knows who is logged in
    await saveSession(data.username);

    router.replace('/home');
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
        placeholder="Email or Username"
        placeholderTextColor="#777"
        style={[styles.input, isWide && styles.inputWide]}
        value={identifier}
        onChangeText={setIdentifier}
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

      {/* BUTTON */}
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? 'Logging in...' : 'Login'}
        </Text>
      </TouchableOpacity>

      {/* LINK */}
      <Text style={styles.link} onPress={() => router.push('/auth/signup')}>
        Sign Up
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