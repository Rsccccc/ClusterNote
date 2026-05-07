import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { encryptionApi } from '../lib/encryption';

// ─── Types ────────────────────────────────────────────────────────────────────
type Note = {
  id: number;
  title: string;
  content: string;
  images: string | null;
  voice: string | null;
  created_at: string;
};

type MCQ = {
  question: string;
  options: string[];
  answer: number; // index of correct option
};

type Props = {
  visible: boolean;
  onClose: () => void;
  notes: Note[];
};

type Screen = 'pick' | 'quiz' | 'result';

// ─── Quiz Generator ───────────────────────────────────────────────────────────
function generateQuiz(noteText: string): MCQ[] {
  // Split into sentences, clean them up
  const sentences = noteText
    .replace(/([.?!])\s+/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 30 && s.split(' ').length >= 5);

  if (sentences.length === 0) return [];

  // Shuffle helper
  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Extract key terms from a sentence (words > 4 chars)
  const keyTerms = (s: string) =>
    s.split(' ').filter(w => w.replace(/[^a-zA-Z]/g, '').length > 4);

  const questions: MCQ[] = [];
  const usedIndices = new Set<number>();
  const shuffledSentences = shuffle([...sentences]);

  for (const sentence of shuffledSentences) {
    if (questions.length >= 10) break;

    const terms = keyTerms(sentence);
    if (terms.length < 2) continue;

    // Pick a random key term to blank out
    const blankTerm = terms[Math.floor(Math.random() * terms.length)].replace(/[^a-zA-Z]/g, '');
    if (blankTerm.length < 4) continue;

    const questionText = sentence.replace(
      new RegExp(`\\b${blankTerm}\\b`, 'i'),
      '______'
    );

    if (questionText === sentence) continue; // no replacement happened

    // Collect wrong answers from other sentences' key terms
    const wrongPool: string[] = [];
    for (const other of sentences) {
      if (other === sentence) continue;
      const otherTerms = keyTerms(other).map(w => w.replace(/[^a-zA-Z]/g, ''));
      for (const t of otherTerms) {
        if (t.toLowerCase() !== blankTerm.toLowerCase() && t.length > 3 && !wrongPool.includes(t)) {
          wrongPool.push(t);
        }
      }
    }

    if (wrongPool.length < 3) continue;

    const wrongs = shuffle(wrongPool).slice(0, 3);
    const correctIndex = Math.floor(Math.random() * 4);
    const options = [...wrongs];
    options.splice(correctIndex, 0, blankTerm);

    questions.push({
      question: `Fill in the blank: "${questionText}"`,
      options,
      answer: correctIndex,
    });
  }

  return questions;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function QuizModal({ visible, onClose, notes }: Props) {
  const [screen, setScreen] = useState<Screen>('pick');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [customText, setCustomText] = useState('');
  const [questions, setQuestions] = useState<MCQ[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const resetAll = () => {
    setScreen('pick');
    setSelectedIds(new Set());
    setCustomText('');
    setQuestions([]);
    setAnswers([]);
    setCurrentQ(0);
    setSubmitted(false);
  };

  const handleClose = () => { resetAll(); onClose(); };

  // Toggle note selection
  const toggleNote = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Build quiz from selected notes + custom text
  const handleGenerate = async () => {
    setSubmitted(false); // reset state

    const selectedNotes = notes.filter(n => selectedIds.has(n.id));
    
    // Decrypt all selected notes
    const decryptedNotes = await Promise.all(
      selectedNotes.map(async (n) => {
        let content = n.content || '';
        try {
          if (content.startsWith('{"iv":')) {
            const parsed = JSON.parse(content);
            if (parsed.iv && parsed.ciphertext) {
              const result = await encryptionApi.decrypt(parsed.iv, parsed.ciphertext);
              if (result.success) {
                content = result.data;
              }
            }
          }
        } catch (err) {
          console.warn(`Failed to decrypt note ${n.id} for quiz:`, err);
        }
        return { ...n, content };
      })
    );

    const notesText = decryptedNotes
      .map(n => `${n.title ?? ''}. ${n.content ?? ''}`)
      .join(' ');
      
    const fullText = `${notesText} ${customText}`.trim();

    if (fullText.length < 50) {
      Alert.alert('Not Enough Content', 'Please select notes or paste more text to generate a quiz.');
      return;
    }

    const qs = generateQuiz(fullText);
    if (qs.length < 3) {
      Alert.alert('Not Enough Sentences', 'Your notes need more detailed sentences. Try adding more content or selecting more notes.');
      return;
    }

    setQuestions(qs);
    setAnswers(new Array(qs.length).fill(null));
    setCurrentQ(0);
    setScreen('quiz');
  };

  const selectAnswer = (optionIdx: number) => {
    if (submitted) return;
    const updated = [...answers];
    updated[currentQ] = optionIdx;
    setAnswers(updated);
  };

  const handleNext = () => {
    if (answers[currentQ] === null) {
      Alert.alert('Pick an answer', 'Please select an option before continuing.');
      return;
    }
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      setSubmitted(true);
      setScreen('result');
    }
  };

  const score = answers.filter((a, i) => a === questions[i]?.answer).length;

  // ── Screens ──────────────────────────────────────────────────────────────────

  const renderPick = () => (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📝 Quiz Generator</Text>
        <TouchableOpacity onPress={handleClose}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Select notes to quiz from:</Text>

        {notes.length === 0 && (
          <Text style={styles.emptyHint}>No notes found. Add some notes first or paste text below.</Text>
        )}

        {notes.map(n => {
          const selected = selectedIds.has(n.id);
          return (
            <TouchableOpacity
              key={n.id}
              style={[styles.noteItem, selected && styles.noteItemSelected]}
              onPress={() => toggleNote(n.id)}
              activeOpacity={0.75}
            >
              <View style={styles.noteItemInner}>
                <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
                  {selected && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.noteItemTitle} numberOfLines={1}>
                    {n.title || '(Untitled)'}
                  </Text>
                  <Text style={styles.noteItemSnippet} numberOfLines={2}>
                    {n.content}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        <Text style={[styles.sectionLabel, { marginTop: 18 }]}>Or paste your own text:</Text>
        <TextInput
          style={styles.pasteInput}
          placeholder="Paste notes or study material here..."
          placeholderTextColor="#aaa"
          value={customText}
          onChangeText={setCustomText}
          multiline
          textAlignVertical="top"
        />
      </ScrollView>

      <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate}>
        <Text style={styles.generateBtnText}>🎯 Generate Quiz</Text>
      </TouchableOpacity>
    </View>
  );

  const renderQuiz = () => {
    const q = questions[currentQ];
    const chosen = answers[currentQ];
    return (
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Question {currentQ + 1} of {questions.length}</Text>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((currentQ + 1) / questions.length) * 100}%` as any }]} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.questionText}>{q.question}</Text>

          {q.options.map((opt, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.optionBtn, chosen === i && styles.optionSelected]}
              onPress={() => selectAnswer(i)}
              activeOpacity={0.75}
            >
              <View style={[styles.optionBullet, chosen === i && styles.optionBulletSelected]}>
                <Text style={[styles.optionBulletText, chosen === i && { color: '#fff' }]}>
                  {['A', 'B', 'C', 'D'][i]}
                </Text>
              </View>
              <Text style={[styles.optionText, chosen === i && styles.optionTextSelected]}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>
            {currentQ < questions.length - 1 ? 'Next →' : 'Finish Quiz'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderResult = () => {
    const pct = Math.round((score / questions.length) * 100);
    const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '👍' : pct >= 40 ? '📚' : '💪';
    const label = pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good Job!' : pct >= 40 ? 'Keep Studying' : 'Keep Practicing';

    return (
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Quiz Results</Text>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {/* Score card */}
          <View style={styles.scoreCard}>
            <Text style={styles.scoreEmoji}>{emoji}</Text>
            <Text style={styles.scoreLabel}>{label}</Text>
            <Text style={styles.scoreNum}>{score} / {questions.length}</Text>
            <Text style={styles.scorePct}>{pct}%</Text>
            <View style={styles.scoreBar}>
              <View style={[styles.scoreBarFill, { width: `${pct}%` as any, backgroundColor: pct >= 80 ? '#27ae60' : pct >= 60 ? '#f39c12' : '#e74c3c' }]} />
            </View>
          </View>

          {/* Per-question review */}
          <Text style={styles.sectionLabel}>Review:</Text>
          {questions.map((q, i) => {
            const correct = answers[i] === q.answer;
            return (
              <View key={i} style={[styles.reviewItem, correct ? styles.reviewCorrect : styles.reviewWrong]}>
                <Text style={styles.reviewQ}>Q{i + 1}. {q.question}</Text>
                <Text style={styles.reviewYour}>
                  Your answer: <Text style={{ fontWeight: 'bold', color: correct ? '#27ae60' : '#e74c3c' }}>
                    {answers[i] !== null ? q.options[answers[i]!] : '(none)'}
                  </Text>
                  {!correct && (
                    <Text style={{ color: '#27ae60' }}>  ✓ {q.options[q.answer]}</Text>
                  )}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        <TouchableOpacity style={styles.retryBtn} onPress={resetAll}>
          <Text style={styles.retryBtnText}>🔄 New Quiz</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {screen === 'pick' && renderPick()}
        {screen === 'quiz' && renderQuiz()}
        {screen === 'result' && renderResult()}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '94%',
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
  closeBtn: {
    fontSize: 20,
    color: '#888',
  },
  body: {
    padding: 16,
    paddingBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyHint: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 12,
    fontStyle: 'italic',
  },

  // Note picker
  noteItem: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
    marginBottom: 10,
    backgroundColor: '#fafafa',
    overflow: 'hidden',
  },
  noteItemSelected: {
    borderColor: '#4A90D9',
    backgroundColor: '#EEF5FD',
  },
  noteItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: '#4A90D9',
    backgroundColor: '#4A90D9',
  },
  checkmark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  noteItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginBottom: 2,
  },
  noteItemSnippet: {
    fontSize: 12,
    color: '#888',
  },
  pasteInput: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 12,
    minHeight: 100,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#fafafa',
  },
  generateBtn: {
    backgroundColor: '#4A90D9',
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
  },
  generateBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },

  // Progress bar
  progressBar: {
    height: 5,
    backgroundColor: '#eee',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 3,
  },
  progressFill: {
    height: 5,
    backgroundColor: '#4A90D9',
    borderRadius: 3,
  },

  // Quiz
  questionText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a2e',
    lineHeight: 25,
    marginBottom: 24,
    marginTop: 8,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#fafafa',
    gap: 12,
  },
  optionSelected: {
    borderColor: '#4A90D9',
    backgroundColor: '#EEF5FD',
  },
  optionBullet: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBulletSelected: {
    borderColor: '#4A90D9',
    backgroundColor: '#4A90D9',
  },
  optionBulletText: {
    fontWeight: 'bold',
    fontSize: 13,
    color: '#555',
  },
  optionText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  optionTextSelected: {
    color: '#1a5fa8',
    fontWeight: '600',
  },
  nextBtn: {
    backgroundColor: '#4A90D9',
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
  },
  nextBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },

  // Results
  scoreCard: {
    backgroundColor: '#f0f6ff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#d0e4f7',
  },
  scoreEmoji: {
    fontSize: 52,
    marginBottom: 8,
  },
  scoreLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  scoreNum: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#4A90D9',
  },
  scorePct: {
    fontSize: 16,
    color: '#888',
    marginBottom: 12,
  },
  scoreBar: {
    width: '100%',
    height: 10,
    backgroundColor: '#dde',
    borderRadius: 5,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: 10,
    borderRadius: 5,
  },
  reviewItem: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  reviewCorrect: {
    backgroundColor: '#f0fff4',
    borderLeftColor: '#27ae60',
  },
  reviewWrong: {
    backgroundColor: '#fff5f5',
    borderLeftColor: '#e74c3c',
  },
  reviewQ: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  reviewYour: {
    fontSize: 13,
    color: '#555',
  },
  retryBtn: {
    backgroundColor: '#4A90D9',
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
