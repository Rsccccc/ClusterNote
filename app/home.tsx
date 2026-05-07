import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { getSession } from '../lib/session';
import Sidebar from '../components/Sidebar';
import NoteModal from '../components/NoteModal';
import NoteCard from '../components/NoteCard';
import QuizModal from '../components/QuizModal';
import NoteViewModal from '../components/NoteViewModal';

type Note = {
  id: number;
  title: string;
  content: string;
  images: string | null;
  voice: string | null;
  created_at: string;
};

export default function Home() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 800;
  const [username, setUsername] = useState('');
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState('');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [quizModalOpen, setQuizModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const uname = await getSession();
      if (!uname) { router.replace('/auth/login'); return; }
      setUsername(uname);

      const { data } = await supabase
        .from('Users')
        .select('profile_pic')
        .eq('username', uname)
        .single();

      if (data?.profile_pic) setProfilePic(data.profile_pic);
    })();
  }, []);

  const loadNotes = useCallback(async () => {
    if (!username) return;
    const { data } = await supabase
      .from('Notes')
      .select('*')
      .eq('username', username)
      .order('created_at', { ascending: false });
    if (data) setNotes(data as Note[]);
  }, [username]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  // ── Edit ──────────────────────────────────────────────────────────────────────
  const handleEdit = (note: Note) => {
    setEditingNote(note);
    setNoteModalOpen(true);
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const handleDelete = (id: number) => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('Notes').delete().eq('id', id);
            if (error) {
              Alert.alert('Error', 'Failed to delete note: ' + error.message);
            } else {
              loadNotes();
            }
          },
        },
      ]
    );
  };

  const handleModalClose = () => {
    setNoteModalOpen(false);
    setEditingNote(null);
  };

  const filteredNotes = notes.filter(n =>
    n.title?.toLowerCase().includes(search.toLowerCase()) ||
    n.content?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.root}>

      {/* ── Yellow header card with rounded bottom ── */}
      <SafeAreaView style={styles.header}>
        <View style={styles.topBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search Your Notes"
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
          />
          <TouchableOpacity onPress={() => setSidebarOpen(true)}>
            <Text style={styles.hamburgerIcon}>☰</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── Notes list on white background ── */}
      <FlatList
        data={filteredNotes}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <NoteCard
            note={item}
            onPress={setViewingNote}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
        contentContainerStyle={styles.listContent}
        style={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No notes yet. Tap + to create one!</Text>
        }
      />

      {/* ── FAB Row ── */}
      <View style={styles.fabRow}>
        {/* Quiz FAB - left */}
        <TouchableOpacity style={styles.quizFab} onPress={() => setQuizModalOpen(true)}>
          <Text style={styles.quizFabText}>📝</Text>
          <Text style={styles.quizFabText}>Quiz</Text>
        </TouchableOpacity>

        {/* Add Note FAB - right */}
        <TouchableOpacity
          style={[styles.fab, isDesktop && styles.fabDesktop]}
          onPress={() => {
            setEditingNote(null);
            setNoteModalOpen(true);
          }}
        >
          <Text style={[styles.fabText, isDesktop && styles.fabTextDesktop]}>+</Text>
        </TouchableOpacity>
      </View>

      {/* ── Sidebar ── */}
      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        username={username}
        profilePic={profilePic}
        onProfilePicChange={setProfilePic}
      />

      {/* ── Note modal (create or edit) ── */}
      <NoteModal
        visible={noteModalOpen}
        onClose={handleModalClose}
        username={username}
        onNoteSaved={loadNotes}
        editNote={editingNote}
      />

      {/* ── Note viewer ── */}
      <NoteViewModal
        note={viewingNote}
        visible={!!viewingNote}
        onClose={() => setViewingNote(null)}
        onEdit={(n) => { setViewingNote(null); setTimeout(() => handleEdit(n), 300); }}
        onDelete={(id) => { setViewingNote(null); setTimeout(() => handleDelete(id), 300); }}
      />

      {/* ── Quiz modal ── */}
      <QuizModal
        visible={quizModalOpen}
        onClose={() => setQuizModalOpen(false)}
        notes={notes}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f2f2f2',
  },

  /* Yellow header card */
  header: {
    backgroundColor: '#F1E883',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 30,
    paddingHorizontal: 18,
    paddingVertical: 11,
    fontSize: 15,
    color: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  hamburgerIcon: {
    fontSize: 28,
    color: '#333',
  },

  /* Notes list */
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  emptyText: {
    textAlign: 'center',
    color: '#aaa',
    marginTop: 60,
    fontSize: 15,
  },

  // FABs
  fabRow: {
    position: 'absolute',
    bottom: 30,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#F1E883',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  fabDesktop: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  fabText: {
    fontSize: 34,
    color: '#333',
    lineHeight: 38,
  },
  fabTextDesktop: {
    fontSize: 48,
  },
  quizFab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#4A90D9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  quizFabText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
});