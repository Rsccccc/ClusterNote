import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { supabase } from '../lib/supabase';

type Props = {
  visible: boolean;
  onClose: () => void;
  username: string;
  onNoteSaved: () => void;
};

export default function NoteModal({ visible, onClose, username, onNoteSaved }: Props) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // ── Speech recognition events ───────────────────────────────────────────────
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results
      .map((r: { transcript: string }) => r.transcript)
      .join(' ');
    setContent(transcript);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsRecording(false);
    stopPulse();
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.warn('Speech error:', event.error);
    setIsRecording(false);
    stopPulse();
  });

  // ── Pulse animation while recording ─────────────────────────────────────────
  const startPulse = () => {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 500, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  };

  const stopPulse = () => {
    pulseLoop.current?.stop();
    pulseAnim.setValue(1);
  };

  // ── Record toggle ────────────────────────────────────────────────────────────
  const toggleRecording = async () => {
    if (isRecording) {
      ExpoSpeechRecognitionModule.stop();
      setIsRecording(false);
      stopPulse();
      return;
    }

    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission Required', 'Microphone permission is needed for voice notes.');
      return;
    }

    setContent(''); // clear old transcription
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: false,
    });
    setIsRecording(true);
    startPulse();
  };

  // ── Image picker ─────────────────────────────────────────────────────────────
  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission Required', 'Photo library access is needed.'); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (result.canceled || !result.assets) return;

    const newImages: string[] = [];
    for (const asset of result.assets) {
      const compressed = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 800 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (compressed.base64) {
        newImages.push(`data:image/jpeg;base64,${compressed.base64}`);
      }
    }
    setImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // ── Save note ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!title.trim() && !content.trim()) {
      Alert.alert('Empty Note', 'Please add a title or content before saving.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('Notes').insert({
      username,
      title: title.trim(),
      content: content.trim(),
      images: images.length > 0 ? JSON.stringify(images) : null,
      voice: null,
    });
    setSaving(false);
    if (error) { Alert.alert('Save Failed', error.message); return; }
    reset();
    onNoteSaved();
    onClose();
  };

  // ── Reset ────────────────────────────────────────────────────────────────────
  const reset = () => {
    setTitle('');
    setContent('');
    setImages([]);
    setIsRecording(false);
    stopPulse();
  };

  const handleClose = () => {
    if (isRecording) ExpoSpeechRecognitionModule.stop();
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>New Note</Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.cancelBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

            {/* Title */}
            <TextInput
              placeholder="Title"
              placeholderTextColor="#999"
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
            />

            {/* Content / Transcription area */}
            <View style={styles.contentWrapper}>
              <TextInput
                placeholder={isRecording ? '🎙 Listening...' : 'Write or record your note...'}
                placeholderTextColor={isRecording ? '#c0392b' : '#999'}
                style={styles.contentInput}
                value={content}
                onChangeText={setContent}
                multiline
                textAlignVertical="top"
              />
              {isRecording && (
                <Text style={styles.recordingHint}>
                  🔴 Recording — speak now, tap Stop when done
                </Text>
              )}
            </View>

            {/* Image previews */}
            {images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageRow}>
                {images.map((img, i) => (
                  <View key={i} style={styles.imageWrapper}>
                    <Image source={{ uri: img }} style={styles.imageThumb} />
                    <TouchableOpacity style={styles.removeImg} onPress={() => removeImage(i)}>
                      <Text style={{ color: '#fff', fontSize: 10 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Toolbar */}
            <View style={styles.toolbar}>

              {/* Image button */}
              <TouchableOpacity style={styles.toolBtn} onPress={pickImage}>
                <Text style={styles.toolIcon}>🖼</Text>
                <Text style={styles.toolLabel}>Image</Text>
              </TouchableOpacity>

              {/* Voice-to-text record button */}
              <TouchableOpacity
                style={[styles.toolBtn, isRecording && styles.toolBtnRecording]}
                onPress={toggleRecording}
                activeOpacity={0.7}
              >
                <Animated.Text style={[styles.toolIcon, { transform: [{ scale: pulseAnim }] }]}>
                  {isRecording ? '⏹' : '🎙'}
                </Animated.Text>
                <Text style={[styles.toolLabel, isRecording && { color: '#c0392b', fontWeight: 'bold' }]}>
                  {isRecording ? 'Stop' : 'Record'}
                </Text>
              </TouchableOpacity>

            </View>
          </ScrollView>

          {/* Save button */}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Note'}</Text>
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
  },
  cancelBtn: {
    fontSize: 20,
    color: '#888',
  },
  body: {
    padding: 16,
    paddingBottom: 8,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
    marginBottom: 14,
  },
  contentWrapper: {
    marginBottom: 14,
  },
  contentInput: {
    fontSize: 15,
    color: '#333',
    minHeight: 140,
    backgroundColor: '#fafafa',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  recordingHint: {
    fontSize: 11,
    color: '#c0392b',
    marginTop: 6,
    fontStyle: 'italic',
  },
  imageRow: {
    marginBottom: 14,
  },
  imageWrapper: {
    marginRight: 8,
    position: 'relative',
  },
  imageThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeImg: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    gap: 12,
  },
  toolBtn: {
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  toolBtnRecording: {
    backgroundColor: '#ffe0e0',
    borderWidth: 1.5,
    borderColor: '#c0392b',
  },
  toolIcon: {
    fontSize: 26,
  },
  toolLabel: {
    fontSize: 11,
    color: '#555',
    marginTop: 4,
  },
  saveBtn: {
    backgroundColor: '#838635',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
