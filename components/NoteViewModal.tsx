import React, { useRef } from 'react';
import {
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { encryptionApi } from '../lib/encryption';
import { useEffect, useState } from 'react';

type Note = {
  id: number;
  title: string;
  content: string;
  images: string | null;
  voice: string | null;
  created_at: string;
};

type Props = {
  note: Note | null;
  visible: boolean;
  onClose: () => void;
  onEdit: (note: Note) => void;
  onDelete: (id: number) => void;
};

export default function NoteViewModal({ note, visible, onClose, onEdit, onDelete }: Props) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [decryptedContent, setDecryptedContent] = useState<string>('');

  useEffect(() => {
    const decrypt = async () => {
      if (!note) return;
      let display = note.content || '';
      try {
        if (display.startsWith('{"iv":')) {
          const parsed = JSON.parse(display);
          if (parsed.iv && parsed.ciphertext) {
            const result = await encryptionApi.decrypt(parsed.iv, parsed.ciphertext);
            if (result.success) {
              display = result.data;
            }
          }
        }
      } catch (err) {
        console.warn('View decryption failed:', err);
      }
      setDecryptedContent(display);
    };
    
    if (visible) decrypt();
  }, [note, visible]);

  if (!note) return null;

  const imageList: string[] = note.images ? JSON.parse(note.images) : [];

  const dateStr = new Date(note.created_at).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const playVoice = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: note.voice! });
      soundRef.current = sound;
      await sound.playAsync();
    } catch {
      alert('Could not play recording.');
    }
  };

  const handleEdit = () => {
    onClose();
    setTimeout(() => onEdit(note), 300); // wait for modal to close
  };

  const handleDelete = () => {
    onClose();
    setTimeout(() => onDelete(note.id), 300);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>

        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.topActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleEdit}>
              <Text style={styles.actionIcon}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={handleDelete}>
              <Text style={styles.actionIcon}>🗑</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Scrollable content ── */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Date */}
          <Text style={styles.date}>{dateStr}</Text>

          {/* Title */}
          {!!note.title && (
            <Text style={styles.title}>{note.title}</Text>
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* Content */}
          {!!decryptedContent ? (
            <Text style={styles.content}>{decryptedContent}</Text>
          ) : (
            <Text style={styles.emptyContent}>No text content.</Text>
          )}

          {/* Images */}
          {imageList.length > 0 && (
            <View style={styles.imagesSection}>
              <Text style={styles.sectionLabel}>📷 Images</Text>
              {imageList.map((img, i) => (
                <Image
                  key={i}
                  source={{ uri: img }}
                  style={styles.fullImage}
                  resizeMode="contain"
                />
              ))}
            </View>
          )}

          {/* Voice note */}
          {!!note.voice && (
            <View style={styles.voiceSection}>
              <Text style={styles.sectionLabel}>🎙 Voice Note</Text>
              <TouchableOpacity style={styles.playBtn} onPress={playVoice}>
                <Text style={styles.playBtnText}>▶  Play Voice Note</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: '#333',
  },
  topActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    backgroundColor: '#fff0f0',
  },
  actionIcon: {
    fontSize: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 22,
  },
  date: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1a1a2e',
    lineHeight: 34,
    marginBottom: 14,
  },
  divider: {
    height: 2,
    backgroundColor: '#F1E883',
    borderRadius: 2,
    marginBottom: 18,
  },
  content: {
    fontSize: 16,
    color: '#333',
    lineHeight: 26,
  },
  emptyContent: {
    fontSize: 15,
    color: '#ccc',
    fontStyle: 'italic',
  },
  imagesSection: {
    marginTop: 28,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  fullImage: {
    width: '100%',
    height: 240,
    borderRadius: 14,
    marginBottom: 14,
    backgroundColor: '#f5f5f5',
  },
  voiceSection: {
    marginTop: 28,
  },
  playBtn: {
    backgroundColor: '#F1E883',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    alignSelf: 'flex-start',
  },
  playBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#555',
  },
});
