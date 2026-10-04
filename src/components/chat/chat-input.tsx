"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Square, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ChatInputProps {
  onSend: (msg: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  lastAssistantText?: string;
}

export function ChatInput({ onSend, onStop, isStreaming, disabled, lastAssistantText }: ChatInputProps) {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 160) + "px";
    }
  }, [text]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setText("");
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        try {
          const form = new FormData();
          form.append("audio", blob, "voice.webm");
          const res = await fetch("/api/ai/asr", { method: "POST", body: form });
          if (res.ok) {
            const data = await res.json();
            if (data.text) setText((t) => (t ? t + " " : "") + data.text);
          } else {
            toast.error("Voice transcription failed");
          }
        } catch {
          toast.error("Voice transcription failed");
        }
      };
      mr.start();
      recRef.current = mr;
      setIsRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };
  const stopRecording = () => {
    recRef.current?.stop();
    setIsRecording(false);
  };

  const speak = async () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    if (!lastAssistantText) {
      toast.info("No message to read aloud");
      return;
    }
    try {
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: lastAssistantText.slice(0, 1000) }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = url;
      audioRef.current.onended = () => setIsPlaying(false);
      await audioRef.current.play();
      setIsPlaying(true);
    } catch {
      toast.error("Text-to-speech failed");
    }
  };

  return (
    <div className="border-t border-border bg-background/95 backdrop-blur">
      <div className="max-w-3xl mx-auto px-3 py-3">
        <div
          className={cn(
            "flex items-end gap-2 rounded-2xl border bg-card transition-colors shadow-sm",
            text.trim() ? "border-primary/30" : "border-border"
          )}
        >
          {/* Voice + TTS controls */}
          <div className="flex flex-col gap-1 pb-1.5 pl-1.5">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={cn(
                "tap-target inline-flex items-center justify-center rounded-lg transition-colors h-8 w-8",
                isRecording
                  ? "bg-emergency/10 text-emergency"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              aria-label={isRecording ? "Stop recording" : "Start voice input"}
              title={isRecording ? "Stop recording" : "Voice input"}
            >
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              onClick={speak}
              className={cn(
                "tap-target inline-flex items-center justify-center rounded-lg transition-colors h-8 w-8",
                isPlaying ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              aria-label={isPlaying ? "Pause audio" : "Read last answer aloud"}
              title={isPlaying ? "Pause" : "Read aloud"}
            >
              {isPlaying ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>

          {/* Textarea */}
          <Textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about your legal rights… e.g. 'What are my rights if I'm arrested?'"
            className="min-h-[44px] max-h-40 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-1 py-2.5"
            disabled={disabled}
            rows={1}
          />

          {/* Send/Stop */}
          <div className="pb-1.5 pr-1.5">
            {isStreaming ? (
              <Button
                onClick={onStop}
                variant="outline"
                size="icon"
                className="tap-target shrink-0 h-9 w-9 rounded-lg border-emergency/30 text-emergency hover:bg-emergency/10"
                aria-label="Stop"
              >
                <Square className="h-4 w-4" fill="currentColor" />
              </Button>
            ) : (
              <Button
                onClick={submit}
                size="icon"
                className="tap-target shrink-0 h-9 w-9 rounded-lg"
                disabled={!text.trim() || disabled}
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Hint */}
        <p className="text-[10px] text-muted-foreground/70 text-center mt-2">
          Press <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[9px]">Enter</kbd> to send ·{" "}
          <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[9px]">Shift+Enter</kbd> for new line ·{" "}
          Nyaya provides legal information, not legal advice.
        </p>
      </div>
    </div>
  );
}
