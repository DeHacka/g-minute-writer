import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAudioRecorder, AudioModule, RecordingPresets } from "expo-audio";
import { transcribeChunk } from "../services/api";
import { CONFIG } from "../config";

const RECORDING_OPTIONS = RecordingPresets.HIGH_QUALITY;

export default function RecordingScreen({ navigation }) {

  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("Team Meeting");
  const [recordingDuration, setRecordingDuration] = useState(0);

  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);

  const chunkTimerRef = useRef(null);
  const durationTimerRef = useRef(null);
  const transcriptRef = useRef("");
  const isRecordingRef = useRef(false);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    return () => stopAllTimers();
  }, []);

  function stopAllTimers() {
    if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
  }

  function formatDuration(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  async function requestPermission() {
    const status = await AudioModule.requestRecordingPermissionsAsync();
    if (!status.granted) {
      Alert.alert("Permission Required", "Please allow microphone access.");
      return false;
    }
    return true;
  }

  // ── KEY: When user edits the transcript manually, keep the ref in sync too
  // transcriptRef is what gets sent to the minutes screen.
  // If we only update state but not the ref, the edits get lost.
  function handleTranscriptChange(text) {
    setTranscript(text);
    transcriptRef.current = text;
  }

  async function processChunk() {
    if (isProcessingRef.current) return;
    if (!isRecordingRef.current) return;

    isProcessingRef.current = true;

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      if (uri) {
        setIsTranscribing(true);
        const text = await transcribeChunk(uri);
        if (text && text.trim()) {
          const newTranscript = transcriptRef.current
            ? transcriptRef.current + " " + text
            : text;
          transcriptRef.current = newTranscript;
          setTranscript(newTranscript);
        }
      }

    } catch (error) {
      console.error("Chunk processing error:", error.message);
      try {
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
      } catch (_) {
        isRecordingRef.current = false;
        setIsRecording(false);
        stopAllTimers();
      }
    } finally {
      setIsTranscribing(false);
      isProcessingRef.current = false;
    }
  }

  async function startRecording() {
    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    try {
      setTranscript("");
      transcriptRef.current = "";
      setRecordingDuration(0);
      isProcessingRef.current = false;

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      isRecordingRef.current = true;
      setIsRecording(true);

      chunkTimerRef.current = setInterval(
        () => processChunk(),
        CONFIG.CHUNK_INTERVAL_MS
      );

      durationTimerRef.current = setInterval(
        () => setRecordingDuration((prev) => prev + 1),
        1000
      );

    } catch (error) {
      Alert.alert("Recording Error", "Could not start recording: " + error.message);
    }
  }

  async function stopRecording() {
    isRecordingRef.current = false;
    setIsRecording(false);
    stopAllTimers();

    while (isProcessingRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      if (uri) {
        setIsTranscribing(true);
        const text = await transcribeChunk(uri);
        if (text && text.trim()) {
          const newTranscript = transcriptRef.current
            ? transcriptRef.current + " " + text
            : text;
          transcriptRef.current = newTranscript;
          setTranscript(newTranscript);
        }
        setIsTranscribing(false);
      }
    } catch (error) {
      console.error("Stop recording error:", error.message);
      setIsTranscribing(false);
    }
  }

  function goToMinutes() {
    if (!transcriptRef.current.trim()) {
      Alert.alert("No Transcript", "Please record some audio first.");
      return;
    }
    navigation.navigate("Minutes", {
      transcript: transcriptRef.current,
      meetingTitle,
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>

      <View style={styles.titleSection}>
        <Text style={styles.label}>Meeting Title</Text>
        <TextInput
          style={styles.titleInput}
          value={meetingTitle}
          onChangeText={setMeetingTitle}
          placeholder="Enter meeting title..."
          editable={!isRecording}
          placeholderTextColor="#a0aec0"
        />
      </View>

      <View style={styles.statusBar}>
        {isRecording ? (
          <View style={styles.recordingStatus}>
            <View style={styles.redDot} />
            <Text style={styles.recordingText}>
              Recording — {formatDuration(recordingDuration)}
            </Text>
          </View>
        ) : (
          // Show hint to user that they can edit the transcript when not recording
          <Text style={styles.idleText}>
            {transcript ? "Tap transcript to edit" : "Ready to record"}
          </Text>
        )}
        {isTranscribing && (
          <View style={styles.transcribingRow}>
            <ActivityIndicator size="small" color="#f6bf36" />
            <Text style={styles.transcribingText}> Transcribing...</Text>
          </View>
        )}
      </View>

      {/* ── EDITABLE TRANSCRIPT BOX ───────────────────────────────────────
          Changed from a ScrollView+Text to a TextInput with multiline.
          - While recording: not editable (editable={!isRecording}) so the
            user doesn't accidentally type while speaking
          - After stopping: fully editable so they can fix transcription errors
            before generating the PDF
          - onChangeText keeps both state and ref in sync via handleTranscriptChange
      */}
      <TextInput
        style={[
          styles.transcriptBox,
          // Slightly different border color when editable to hint it's tappable
          !isRecording && transcript ? styles.transcriptBoxEditable : null
        ]}
        value={transcript}
        onChangeText={handleTranscriptChange}
        placeholder="Your transcription will appear here as you speak..."
        placeholderTextColor="#cbd5e0"
        multiline
        editable={!isRecording}
        textAlignVertical="top"
      />

      <View style={styles.buttonRow}>
        {!isRecording ? (
          <TouchableOpacity style={styles.recordButton} onPress={startRecording}>
            <Text style={styles.recordButtonText}>🎙  Start Recording</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.stopButton} onPress={stopRecording}>
            <Text style={styles.stopButtonText}>⏹  Stop Recording</Text>
          </TouchableOpacity>
        )}

        {transcript !== "" && !isRecording && (
          <TouchableOpacity style={styles.minutesButton} onPress={goToMinutes}>
            <Text style={styles.minutesButtonText}>Generate Minutes →</Text>
          </TouchableOpacity>
        )}
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f4f8",
    padding: 16
  },
  titleSection: { marginBottom: 12 },
  label: { fontSize: 13, color: "#718096", marginBottom: 4, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  titleInput: { backgroundColor: "#ffffff", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, borderWidth: 1, borderColor: "#e2e8f0", color: "#1a202c" },
  statusBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, minHeight: 28 },
  recordingStatus: { flexDirection: "row", alignItems: "center" },
  redDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#e53e3e", marginRight: 8 },
  recordingText: { color: "#e53e3e", fontWeight: "600", fontSize: 15 },
  idleText: { color: "#a0aec0", fontSize: 14 },
  transcribingRow: { flexDirection: "row", alignItems: "center" },
  transcribingText: { color: "#4299e1", fontSize: 13 },

  // ── Transcript box styles ──────────────────────────────────────────
  transcriptBox: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
    padding: 16,
    fontSize: 16,
    color: "#2d3748",
    lineHeight: 26,
  },
  // When editable (recording stopped and has content), show a blue border
  // as a visual hint that the text can be tapped and edited
  transcriptBoxEditable: {
    borderColor: "#4299e1",
    borderWidth: 1.5,
  },

  buttonRow: { gap: 10 },
  recordButton: {
    backgroundColor: "#f6bf36",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    elevation: 3
  },
  recordButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold"
  },
  stopButton: {
    backgroundColor: "#e53e3e",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    elevation: 3
  },
  stopButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold"
  },
  minutesButton: { backgroundColor: "#276749", paddingVertical: 16, borderRadius: 12, alignItems: "center", elevation: 3 },
  minutesButtonText: { color: "#ffffff", fontSize: 18, fontWeight: "600" },
});