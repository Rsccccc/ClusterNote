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
// Safely load expo-speech-recognition only when the native module is available
// (i.e. in a development/production build, NOT in Expo Go)
let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: (event: string, cb: (e: any) => void) => void = () => {};
try {
  const speechMod = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = speechMod.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = speechMod.useSpeechRecognitionEvent;
} catch {
  // Native module not available (Expo Go) — voice features will be disabled
}
import { supabase } from '../lib/supabase';
import { encryptionApi } from '../lib/encryption';

type Note = {
  id: number;
  title: string;
  content: string;
  images: string | null;
  voice: string | null;
  created_at: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  username: string;
  onNoteSaved: () => void;
  editNote?: Note | null; // when set, modal is in edit mode
};

export default function NoteModal({ visible, onClose, username, onNoteSaved, editNote }: Props) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const isEditMode = !!editNote;

  // ── Pre-fill fields when editing ─────────────────────────────────────────────
  useEffect(() => {
    const prepareData = async () => {
      if (editNote) {
        // Try to decrypt content if it looks like encrypted JSON
        let displayContent = editNote.content ?? '';
        let displayTitle = editNote.title ?? '';
        
        try {
          if (displayContent.startsWith('{"iv":')) {
            const parsed = JSON.parse(displayContent);
            if (parsed.iv && parsed.ciphertext) {
              const result = await encryptionApi.decrypt(parsed.iv, parsed.ciphertext);
              if (result.success) {
                displayContent = result.data;
              }
            }
          }
          
          if (displayTitle.startsWith('{"iv":')) {
            const parsed = JSON.parse(displayTitle);
            if (parsed.iv && parsed.ciphertext) {
              const result = await encryptionApi.decrypt(parsed.iv, parsed.ciphertext);
              if (result.success) {
                displayTitle = result.data;
              }
            }
          }
        } catch (err) {
          console.warn('Decryption failed:', err);
        }
        setTitle(displayTitle);
        setContent(displayContent);
      } else {
        reset();
      }
    };
    
    prepareData();
  }, [editNote, visible]);

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
  const speechAvailable = !!ExpoSpeechRecognitionModule;

  const toggleRecording = async () => {
    if (!speechAvailable) {
      Alert.alert('Not Available', 'Voice recording requires a native build. It is not supported in Expo Go.');
      return;
    }
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

    setContent('');
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

  // ── Save (create or update) ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!title.trim() && !content.trim()) {
      Alert.alert('Empty Note', 'Please add a title or content before saving.');
      return;
    }
    setSaving(true);

    let finalContent = content.trim();
    let finalTitle = title.trim();

    // Try to encrypt, but fall back to plaintext if the Edge Function isn't available
    try {
      if (finalContent) {
        const encrypted = await encryptionApi.encrypt(finalContent);
        if (encrypted && encrypted.success) {
          finalContent = JSON.stringify({ iv: encrypted.iv, ciphertext: encrypted.ciphertext });
        }
      }
      if (finalTitle) {
        const encrypted = await encryptionApi.encrypt(finalTitle);
        if (encrypted && encrypted.success) {
          finalTitle = JSON.stringify({ iv: encrypted.iv, ciphertext: encrypted.ciphertext });
        }
      }
    } catch (err) {
      // Encryption not available (Edge Function not deployed yet) — save as plaintext
      console.warn('Encryption unavailable, saving as plaintext:', err);
      finalContent = content.trim();
      finalTitle = title.trim();
    }

    // Perform the DB write
    if (isEditMode && editNote) {
      const { error } = await supabase
        .from('Notes')
        .update({
          title: finalTitle,
          content: finalContent,
          images: images.length > 0 ? JSON.stringify(images) : null,
        })
        .eq('id', editNote.id);

      setSaving(false);
      if (error) {
        console.error('Supabase UPDATE error:', error);
        Alert.alert('Update Failed', error.message || 'Unknown error');
        return;
      }
    } else {
      const { error } = await supabase.from('Notes').insert({
        username,
        title: finalTitle,
        content: finalContent,
        images: images.length > 0 ? JSON.stringify(images) : null,
        voice: null,
      });

      setSaving(false);
      if (error) {
        console.error('Supabase INSERT error:', error);
        Alert.alert('Save Failed', error.message || 'Unknown error');
        return;
      }
    }

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
    if (isRecording && speechAvailable) ExpoSpeechRecognitionModule.stop();
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
            <Text style={styles.headerTitle}>{isEditMode ? 'Edit Note' : 'New Note'}</Text>
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
          <TouchableOpacity
            style={[styles.saveBtn, isEditMode && styles.saveBtnEdit]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>
              {saving ? 'Saving...' : isEditMode ? 'Update Note' : 'Save Note'}
            </Text>
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
  saveBtnEdit: {
    backgroundColor: '#5a6e1f',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
