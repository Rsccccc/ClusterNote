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
};

export default function NoteCard({ note }: Props) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const imageList: string[] = note.images ? JSON.parse(note.images) : [];

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
    <View style={styles.card}>
      {/* Title */}
      {!!note.title && <Text style={styles.title}>{note.title}</Text>}

      {/* Content */}
      {!!note.content && (
        <Text style={styles.content} numberOfLines={3}>
          {note.content}
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
    </View>
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
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
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
