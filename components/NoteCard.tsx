import React, { useRef } from 'react';
import {
  Image,
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
  note: Note;
  onPress: (note: Note) => void;
  onEdit: (note: Note) => void;
  onDelete: (id: number) => void;
};

export default function NoteCard({ note, onPress, onEdit, onDelete }: Props) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const imageList: string[] = note.images ? JSON.parse(note.images) : [];
  const [displayContent, setDisplayContent] = useState<string>(note.content || '');

  useEffect(() => {
    const decrypt = async () => {
      let content = note.content || '';
      if (content.startsWith('{"iv":')) {
        try {
          const parsed = JSON.parse(content);
          if (parsed.iv && parsed.ciphertext) {
            const result = await encryptionApi.decrypt(parsed.iv, parsed.ciphertext);
            if (result.success) {
              content = result.data;
            }
          }
        } catch (err) {
          console.warn('Card decryption failed:', err);
        }
      }
      setDisplayContent(content);
    };
    decrypt();
  }, [note.content]);

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

  const dateStr = new Date(note.created_at).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(note)} activeOpacity={0.85}>
      {/* Title row with action buttons */}
      <View style={styles.titleRow}>
        {!!note.title && <Text style={styles.title} numberOfLines={1}>{note.title}</Text>}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit(note)}>
            <Text style={styles.editIcon}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => onDelete(note.id)}>
            <Text style={styles.deleteIcon}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {!!displayContent && (
        <Text style={styles.content} numberOfLines={3}>
          {displayContent}
        </Text>
      )}

      {/* Images */}
      {imageList.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageRow}>
          {imageList.map((img, i) => (
            <Image key={i} source={{ uri: img }} style={styles.imageThumb} />
          ))}
        </ScrollView>
      )}

      {/* Voice */}
      {!!note.voice && (
        <TouchableOpacity style={styles.voiceBtn} onPress={playVoice}>
          <Text style={styles.voiceBtnText}>▶ Play Voice Note</Text>
        </TouchableOpacity>
      )}

      {/* Date */}
      <Text style={styles.date}>{dateStr}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    flex: 1,
    marginRight: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    backgroundColor: '#fff0f0',
  },
  editIcon: {
    fontSize: 15,
  },
  deleteIcon: {
    fontSize: 15,
  },
  content: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  imageRow: {
    marginBottom: 8,
  },
  imageThumb: {
    width: 70,
    height: 70,
    borderRadius: 8,
    marginRight: 6,
  },
  voiceBtn: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  voiceBtnText: {
    color: '#838635',
    fontWeight: 'bold',
    fontSize: 13,
  },
  date: {
    fontSize: 11,
    color: '#aaa',
    textAlign: 'right',
  },
});
